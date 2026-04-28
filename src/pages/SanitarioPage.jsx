import { useMemo, useState, useCallback } from 'react';
import SanitarioForm from '../components/SanitarioForm';
import { formatarData } from '../utils/formatters';
import { gerarNovoId } from '../utils/id';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import PageHeader from '../components/PageHeader';
import { useToast } from '../hooks/useToast'; // Importar useToast
import { useAuth } from '../auth/useAuth';
import {
  createOperationalRecord,
  deleteOperationalRecord,
  persistCollectionMutation,
  updateOperationalRecord,
} from '../services/operationalPersistence';

export default function SanitarioPage({ db, setDb, onConfirmAction }) {
  const { hasPermission, session } = useAuth();
  const { showToast } = useToast(); // Hook para exibir toasts
  const mensagemSemPermissao = 'Você não tem permissão para executar esta ação.';
  const [abrirForm, setAbrirForm] = useState(false);
  const [itemEditando, setItemEditando] = useState(null);

  // Memoizar mapas para otimizar lookups
  const lotesMap = useMemo(() => {
    const map = new Map();
    (db?.lotes || []).forEach(l => map.set(l.id, l));
    return map;
  }, [db?.lotes]);

  const funcionariosMap = useMemo(() => {
    const map = new Map();
    (db?.funcionarios || []).forEach(f => map.set(f.id, f));
    return map;
  }, [db?.funcionarios]);

  const sanitario = db?.sanitario || [];

  const dadosTabela = useMemo(() => {
    return [...sanitario]
      .map((item) => {
        const lote = lotesMap.get(item.lote_id);
        const funcionario = funcionariosMap.get(item.funcionario_responsavel_id);

        return {
          ...item,
          loteNome: lote?.nome || '—',
          funcionarioNome: funcionario?.nome || '—',
          status: obterStatus(item.proxima, item.alerta_dias_antes),
        };
      })
      .sort((a, b) => {
        const dataA = a.proxima || a.data_aplic;
        const dataB = b.proxima || b.data_aplic;
        // Tratar datas nulas para ordenação
        if (!dataA && !dataB) return 0;
        if (!dataA) return 1; // Coloca itens sem data no final
        if (!dataB) return -1; // Coloca itens sem data no final
        return new Date(dataA).getTime() - new Date(dataB).getTime();
      });
  }, [sanitario, lotesMap, funcionariosMap]);

  const resumo = useMemo(() => {
    const total = sanitario.length;
    const totalAtendidos = sanitario.reduce(
      (acc, item) => acc + Number(item.qtd || 0),
      0
    );

    const vencidos = sanitario.filter(
      (item) => obterStatus(item.proxima, item.alerta_dias_antes) === 'vencido'
    ).length;

    return {
      total,
      totalAtendidos,
      vencidos,
    };
  }, [sanitario]);

  const abrirNovo = useCallback(() => {
    if (!hasPermission('sanitario:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    setItemEditando(null);
    setAbrirForm(true);
  }, [hasPermission, showToast]);

  const editarItem = useCallback((item) => {
    if (!hasPermission('sanitario:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    setItemEditando(item);
    setAbrirForm(true);
  }, [hasPermission, showToast]);

  const excluirItem = useCallback(async (id) => {
    if (!hasPermission('sanitario:excluir')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    const confirmado = typeof onConfirmAction === 'function'
      ? await onConfirmAction({
          title: 'Excluir manejo sanitário',
          message: 'Deseja excluir este manejo sanitário? Esta ação é irreversível.',
          tone: 'danger',
        })
      : window.confirm('Deseja excluir este manejo sanitário? Esta ação é irreversível.');

    if (!confirmado) {
      showToast({ type: 'info', message: 'Exclusão cancelada.' });
      return;
    }

    const current = (db?.sanitario || []).find((s) => s.id === id);
    const mutations = [deleteOperationalRecord('sanitario', id, session)];
    if (current?.rotina_automatica_id) {
      mutations.push(deleteOperationalRecord('rotinas', current.rotina_automatica_id, session));
    }
    const persistedBatch = await persistCollectionMutation(mutations);
    setDb((prev) => {
      const item = prev.sanitario.find((s) => s.id === id);

      let novasRotinas = prev.rotinas || [];
      if (item?.rotina_automatica_id) {
        novasRotinas = novasRotinas.filter(
          (r) => r.id !== item.rotina_automatica_id
        );
      }

      return {
        ...prev,
        sanitario: prev.sanitario.filter((s) => s.id !== id),
        rotinas: novasRotinas,
      };
    });
    if (!persistedBatch.persisted) {
      showToast({ type: 'warning', message: 'Exclusão salva parcialmente apenas localmente.' });
    }
    showToast({ type: 'success', message: 'Manejo sanitário excluído com sucesso!' });
  }, [db?.sanitario, hasPermission, onConfirmAction, session, setDb, showToast]);

  async function salvarItem(dados) {
    if (!hasPermission('sanitario:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    const rotinasAtuais = Array.isArray(db?.rotinas) ? db.rotinas : [];
    const sanitariosAtuais = Array.isArray(db?.sanitario) ? db.sanitario : [];
    const shouldManageAutomaticRoutine = dados.proxima && dados.funcionario_responsavel_id;
    const mutations = [];

    setDb((prev) => {
      const currentRotinas = prev.rotinas || [];
      let novasRotinas = [...currentRotinas];
      let rotinaAutomaticaId = null;

      if (itemEditando) {
        // Editando item existente
        rotinaAutomaticaId = itemEditando.rotina_automatica_id || null;

        if (shouldManageAutomaticRoutine) {
          const tarefaAutomatica = montarTarefaAutomatica(dados, itemEditando.id);
          if (rotinaAutomaticaId) {
            // Atualiza a rotina existente
            novasRotinas = novasRotinas.map((r) =>
              r.id === rotinaAutomaticaId ? { ...r, ...tarefaAutomatica } : r
            );
          } else {
            // Cria uma nova rotina se não existia
            const novoIdRotina = gerarNovoId(novasRotinas);
            tarefaAutomatica.id = novoIdRotina;
            novasRotinas.push(tarefaAutomatica);
            rotinaAutomaticaId = novoIdRotina;
          }
        } else if (rotinaAutomaticaId) {
          // Remove a rotina se não há mais data/responsável
          novasRotinas = novasRotinas.filter((r) => r.id !== rotinaAutomaticaId);
          rotinaAutomaticaId = null;
        }

        return {
          ...prev,
          sanitario: prev.sanitario.map((s) =>
            s.id === itemEditando.id
              ? { ...s, ...dados, rotina_automatica_id: rotinaAutomaticaId }
              : s
          ),
          rotinas: novasRotinas,
        };
      } else {
        // Novo item sanitário
        const novoIdSanitario = gerarNovoId(prev.sanitario);

        if (shouldManageAutomaticRoutine) {
          const tarefaAutomatica = montarTarefaAutomatica(dados, novoIdSanitario);
          const novoIdRotina = gerarNovoId(novasRotinas);
          tarefaAutomatica.id = novoIdRotina;
          novasRotinas.push(tarefaAutomatica);
          rotinaAutomaticaId = novoIdRotina;
        }

        return {
          ...prev,
          sanitario: [
            ...prev.sanitario,
            { ...dados, id: novoIdSanitario, rotina_automatica_id: rotinaAutomaticaId },
          ],
          rotinas: novasRotinas,
        };
      }
    });

    if (itemEditando) {
      const rotinaAutomaticaIdAtual = itemEditando.rotina_automatica_id || null;
      let rotinaAutomaticaIdFinal = rotinaAutomaticaIdAtual;
      if (shouldManageAutomaticRoutine) {
        const tarefaAutomatica = montarTarefaAutomatica(dados, itemEditando.id);
        if (rotinaAutomaticaIdAtual) {
          mutations.push(updateOperationalRecord('rotinas', rotinaAutomaticaIdAtual, tarefaAutomatica, session));
        } else {
          const createdRotina = await createOperationalRecord('rotinas', tarefaAutomatica, session);
          rotinaAutomaticaIdFinal = createdRotina.data?.id ?? gerarNovoId(rotinasAtuais);
          mutations.push(Promise.resolve(createdRotina));
        }
      } else if (rotinaAutomaticaIdAtual) {
        mutations.push(deleteOperationalRecord('rotinas', rotinaAutomaticaIdAtual, session));
        rotinaAutomaticaIdFinal = null;
      }
      mutations.push(updateOperationalRecord('sanitario', itemEditando.id, {
        ...dados,
        rotina_automatica_id: rotinaAutomaticaIdFinal,
      }, session));
    } else {
      const createdSanitario = await createOperationalRecord('sanitario', dados, session);
      const novoIdSanitario = createdSanitario.data?.id ?? gerarNovoId(sanitariosAtuais);
      mutations.push(Promise.resolve(createdSanitario));
      if (shouldManageAutomaticRoutine) {
        const rotinaPayload = montarTarefaAutomatica(dados, novoIdSanitario);
        const createdRotina = await createOperationalRecord('rotinas', rotinaPayload, session);
        const rotinaAutomaticaId = createdRotina.data?.id ?? gerarNovoId(rotinasAtuais);
        mutations.push(Promise.resolve(createdRotina));
        mutations.push(updateOperationalRecord('sanitario', novoIdSanitario, { rotina_automatica_id: rotinaAutomaticaId }, session));
      }
    }

    const persistedBatch = await persistCollectionMutation(mutations);
    if (!persistedBatch.persisted) {
      showToast({ type: 'warning', message: 'Manejo salvo parcialmente apenas localmente.' });
    }

    showToast({ type: 'success', message: `Manejo sanitário ${itemEditando ? 'atualizado' : 'criado'} com sucesso!` });
    setAbrirForm(false);
    setItemEditando(null);
  }

  return (
    <div className="page">
      <PageHeader
        title="Manejo Sanitário"
        subtitle="Controle de vacinas, vermífugos e tratamentos do rebanho."
        actions={<Button onClick={abrirNovo}>+ Novo Manejo</Button>}
      />

      <div className="summary-cards-grid">
        <Card title="Total de Manejos">
          <strong>{resumo.total}</strong>
        </Card>
        <Card title="Animais Atendidos">
          <strong>{resumo.totalAtendidos}</strong>
        </Card>
        <Card title="Manejos Vencidos">
          <strong>{resumo.vencidos}</strong>
        </Card>
      </div>

      <div className="ui-card no-padding">
        <div className="table-responsive">
          {dadosTabela.length === 0 ? (
            <div className="empty-state padded">
              <p>Nenhum manejo sanitário registrado.</p>
              <span>Use o botão "Novo Manejo" para começar.</span>
            </div>
          ) : (
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Descrição</th>
                  <th>Lote</th>
                  <th>Data Aplicação</th>
                  <th>Próxima Data</th>
                  <th>Responsável</th>
                  <th>Qtd.</th>
                  <th>Status</th>
                  <th>Observação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {dadosTabela.map((item) => (
                  <tr key={item.id}>
                    <td>{normalizarTipo(item.tipo)}</td>
                    <td>{item.desc}</td>
                    <td>{item.loteNome}</td>
                    <td>{formatarData(item.data_aplic)}</td>
                    <td>{item.proxima ? formatarData(item.proxima) : '—'}</td>
                    <td>{item.funcionarioNome || '—'}</td>
                    <td>{item.qtd}</td>
                    <td>{renderStatus(item.status)}</td>
                    <td>{item.obs || '—'}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="action-btn"
                          onClick={() => editarItem(item)}
                        >
                          Editar
                        </button>
                        <button
                          className="action-btn action-btn-danger"
                          onClick={() => excluirItem(item.id)}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {abrirForm && (
        <SanitarioForm
          initialData={itemEditando}
          lotes={db?.lotes || []}
          funcionarios={db?.funcionarios || []}
          onSave={salvarItem}
          onCancel={() => {
            setAbrirForm(false);
            setItemEditando(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * Monta um objeto de tarefa automática para ser inserido nas rotinas.
 * @param {object} dados - Dados do manejo sanitário.
 * @param {number} sanitarioId - ID do manejo sanitário de origem.
 * @returns {object} Objeto de tarefa.
 */
function montarTarefaAutomatica(dados, sanitarioId) {
  return {
    funcionario_id: Number(dados.funcionario_responsavel_id),
    lote_id: dados.lote_id ? Number(dados.lote_id) : null, // Usar null para opcional
    tarefa: `${normalizarTipo(dados.tipo)}: ${dados.desc}`,
    setor: 'Sanitário',
    obs: `Tarefa automática criada a partir do manejo sanitário${dados.obs ? ` • ${dados.obs}` : ''}`,
    recorrente: false,
    data: dados.proxima,
    status: 'pendente',
    // Campos de recorrência não aplicáveis para tarefas automáticas de sanitário
    recorrencia_tipo: '',
    dias_semana: [],
    data_inicio: '',
    data_fim: '',
    concluido_datas: [],
    origem_sistema: 'sanitario',
    origem_sanitario_id: sanitarioId,
  };
}

/**
 * Normaliza o tipo de manejo sanitário para exibição.
 * @param {string} tipo - O tipo de manejo.
 * @returns {string} O tipo normalizado.
 */
function normalizarTipo(tipo) {
  const mapa = {
    vacina: 'Vacina',
    vermifugo: 'Vermífugo',
    medicamento: 'Medicamento',
    exame: 'Exame',
    outro: 'Outro',
  };

  return mapa[tipo] || tipo || '—';
}

/**
 * Obtém o status de um manejo sanitário com base na próxima data e alerta.
 * @param {string} dataProxima - A próxima data de aplicação (ISO string).
 * @param {number} alertaDiasAntes - Número de dias para alertar antes da data.
 * @returns {string} O status ('vencido', 'proximo', 'em-dia', 'sem-data').
 */
function obterStatus(dataProxima, alertaDiasAntes = 0) {
  if (!dataProxima) return 'sem-data';

  const hoje = new Date();
  const proxima = new Date(dataProxima);

  hoje.setHours(0, 0, 0, 0);
  proxima.setHours(0, 0, 0, 0);

  const diffDias = Math.round((proxima.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDias < 0) return 'vencido';
  if (diffDias <= Number(alertaDiasAntes || 0)) return 'proximo';
  return 'em-dia';
}

/**
 * Renderiza um badge de status para o manejo sanitário.
 * @param {string} status - O status do manejo.
 * @returns {JSX.Element} O elemento badge.
 */
function renderStatus(status) {
  if (status === 'vencido') {
    return <span className="badge badge-r">Vencido</span>;
  }

  if (status === 'proximo') {
    return <span className="badge badge-a">Próximo</span>;
  }

  if (status === 'em-dia') {
    return <span className="badge badge-g">Em dia</span>;
  }

  return <span className="badge badge-n">Sem data</span>;
}
