<<<<<<< HEAD
import { useMemo, useState, useCallback } from 'react';
import SanitarioForm from '../components/SanitarioForm';
import { formatarData } from '../utils/formatters';
import { gerarNovoId } from '../utils/id';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import PageHeader from '../components/PageHeader';
import { useToast } from '../hooks/useToast'; // Importar useToast

export default function SanitarioPage({ db, setDb, onConfirmAction }) {
  const { showToast } = useToast(); // Hook para exibir toasts
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
  const rotinas = db?.rotinas || [];
=======
import { useMemo, useState } from 'react';
import SanitarioForm from '../components/SanitarioForm';
import { formatarData } from '../utils/formatters';
import { gerarNovoId } from '../utils/id';

export default function SanitarioPage({ db, setDb, onConfirmAction }) {
  const [abrirForm, setAbrirForm] = useState(false);
  const [itemEditando, setItemEditando] = useState(null);

  const lotes = db?.lotes || [];
  const funcionarios = db?.funcionarios || [];
  const sanitario = db?.sanitario || [];
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d

  const dadosTabela = useMemo(() => {
    return [...sanitario]
      .map((item) => {
<<<<<<< HEAD
        const lote = lotesMap.get(item.lote_id);
        const funcionario = funcionariosMap.get(item.funcionario_responsavel_id);
=======
        const lote = lotes.find((l) => l.id === item.lote_id);
        const funcionario = funcionarios.find(
          (f) => f.id === item.funcionario_responsavel_id
        );
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d

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
<<<<<<< HEAD
        // Tratar datas nulas para ordenação
        if (!dataA && !dataB) return 0;
        if (!dataA) return 1; // Coloca itens sem data no final
        if (!dataB) return -1; // Coloca itens sem data no final
        return new Date(dataA).getTime() - new Date(dataB).getTime();
      });
  }, [sanitario, lotesMap, funcionariosMap]);
=======
        return new Date(dataA) - new Date(dataB);
      });
  }, [sanitario, lotes, funcionarios]);
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d

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

<<<<<<< HEAD
  const abrirNovo = useCallback(() => {
    setItemEditando(null);
    setAbrirForm(true);
  }, []);

  const editarItem = useCallback((item) => {
    setItemEditando(item);
    setAbrirForm(true);
  }, []);

  const excluirItem = useCallback(async (id) => {
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
=======
  function abrirNovo() {
    setItemEditando(null);
    setAbrirForm(true);
  }

  function editarItem(item) {
    setItemEditando(item);
    setAbrirForm(true);
  }

  async function excluirItem(id) {
    const confirmado = typeof onConfirmAction === 'function'
      ? await onConfirmAction({
          title: 'Excluir manejo sanitário',
          message: 'Deseja excluir este manejo sanitário?',
          tone: 'danger',
        })
      : window.confirm('Deseja excluir este manejo sanitário?');
    if (!confirmado) return;
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d

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
<<<<<<< HEAD
    showToast({ type: 'success', message: 'Manejo sanitário excluído com sucesso!' });
  }, [onConfirmAction, setDb, showToast]);

  const salvarItem = useCallback((dados) => {
    setDb((prev) => {
      const currentRotinas = prev.rotinas || [];
      let novasRotinas = [...currentRotinas];
      let rotinaAutomaticaId = null;

      // Verifica se deve criar/atualizar/remover uma rotina automática
      const shouldManageAutomaticRoutine = dados.proxima && dados.funcionario_responsavel_id;

      if (itemEditando) {
        // Editando item existente
        rotinaAutomaticaId = itemEditando.rotina_automatica_id || null;

        if (shouldManageAutomaticRoutine) {
          const tarefaAutomatica = montarTarefaAutomatica(dados, itemEditando.id);
          if (rotinaAutomaticaId) {
            // Atualiza a rotina existente
=======
  }

  function salvarItem(dados) {
    setDb((prev) => {
      const rotinas = prev.rotinas || [];
      let novasRotinas = [...rotinas];

      if (itemEditando) {
        let rotinaAutomaticaId = itemEditando.rotina_automatica_id || null;

        if (dados.proxima && dados.funcionario_responsavel_id) {
          const tarefaAutomatica = montarTarefaAutomatica(
            dados,
            itemEditando.id
          );

          if (rotinaAutomaticaId) {
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
            novasRotinas = novasRotinas.map((r) =>
              r.id === rotinaAutomaticaId ? { ...r, ...tarefaAutomatica } : r
            );
          } else {
<<<<<<< HEAD
            // Cria uma nova rotina se não existia
            const novoIdRotina = gerarNovoId(novasRotinas);
            tarefaAutomatica.id = novoIdRotina;
            novasRotinas.push(tarefaAutomatica);
            rotinaAutomaticaId = novoIdRotina;
          }
        } else if (rotinaAutomaticaId) {
          // Remove a rotina se não há mais data/responsável
=======
            rotinaAutomaticaId = gerarNovoId(novasRotinas);
            novasRotinas.push({
              id: rotinaAutomaticaId,
              ...tarefaAutomatica,
            });
          }
        } else if (rotinaAutomaticaId) {
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
          novasRotinas = novasRotinas.filter((r) => r.id !== rotinaAutomaticaId);
          rotinaAutomaticaId = null;
        }

        return {
          ...prev,
          sanitario: prev.sanitario.map((s) =>
            s.id === itemEditando.id
<<<<<<< HEAD
              ? { ...s, ...dados, rotina_automatica_id: rotinaAutomaticaId }
=======
              ? {
                  ...s,
                  ...dados,
                  rotina_automatica_id: rotinaAutomaticaId,
                }
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
              : s
          ),
          rotinas: novasRotinas,
        };
<<<<<<< HEAD
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

    showToast({ type: 'success', message: `Manejo sanitário ${itemEditando ? 'atualizado' : 'criado'} com sucesso!` });
    setAbrirForm(false);
    setItemEditando(null);
  }, [itemEditando, setDb, showToast]);

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
=======
      }

      const novoSanitarioId = gerarNovoId(prev.sanitario);
      let rotinaAutomaticaId = null;

      if (dados.proxima && dados.funcionario_responsavel_id) {
        rotinaAutomaticaId = gerarNovoId(novasRotinas);
        novasRotinas.push({
          id: rotinaAutomaticaId,
          ...montarTarefaAutomatica(dados, novoSanitarioId),
        });
      }

      return {
        ...prev,
        sanitario: [
          ...prev.sanitario,
          {
            id: novoSanitarioId,
            ...dados,
            rotina_automatica_id: rotinaAutomaticaId,
          },
        ],
        rotinas: novasRotinas,
      };
    });

    setAbrirForm(false);
    setItemEditando(null);
  }

  return (
    <div className="page">
      <div className="page-header page-topbar">
        <div>
          <h1>Manejo Sanitário</h1>
          <p>Controle de vacinas, vermífugos, medicamentos e revisões.</p>
        </div>

        <div className="page-topbar-actions">
          <button className="primary-btn" onClick={abrirNovo}>
            + Novo manejo
          </button>
        </div>
      </div>

      <div className="kpi-grid-3">
        <div className="kpi-card">
          <div className="kpi-label">Registros sanitários</div>
          <div className="kpi-value">{resumo.total}</div>
          <div className="kpi-sub">lançamentos cadastrados</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Animais atendidos</div>
          <div className="kpi-value">{resumo.totalAtendidos}</div>
          <div className="kpi-sub">somando todas as aplicações</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Itens vencidos</div>
          <div className="kpi-value">{resumo.vencidos}</div>
          <div className="kpi-sub">pela próxima data prevista</div>
        </div>
      </div>

      <div className="fazendas-card">
        <div className="fazendas-card-header">
          <span className="fazendas-card-title">Lista de manejo sanitário</span>
        </div>

        <div className="fazendas-table-wrap">
          {dadosTabela.length === 0 ? (
            <div className="empty-box">
              <strong>Nenhum manejo sanitário cadastrado.</strong>
              <span>Use o botão “Novo manejo” para começar.</span>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Tipo</th>
                  <th>Descrição</th>
                  <th>Aplicação</th>
                  <th>Próxima</th>
                  <th>Avisar antes</th>
                  <th>Responsável</th>
                  <th>Qtd</th>
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
                  <th>Status</th>
                  <th>Observação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {dadosTabela.map((item) => (
                  <tr key={item.id}>
<<<<<<< HEAD
                    <td>{normalizarTipo(item.tipo)}</td>
                    <td>{item.desc}</td>
                    <td>{item.loteNome}</td>
                    <td>{formatarData(item.data_aplic)}</td>
                    <td>{item.proxima ? formatarData(item.proxima) : '—'}</td>
=======
                    <td className="text-h">{item.loteNome}</td>
                    <td>
                      <span className="badge b-blue">
                        {normalizarTipo(item.tipo)}
                      </span>
                    </td>
                    <td>{item.desc}</td>
                    <td>{formatarData(item.data_aplic)}</td>
                    <td>{formatarData(item.proxima)}</td>
                    <td>{item.alerta_dias_antes ?? 0} dias</td>
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
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
<<<<<<< HEAD
          lotes={db?.lotes || []}
          funcionarios={db?.funcionarios || []}
=======
          lotes={lotes}
          funcionarios={funcionarios}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
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

<<<<<<< HEAD
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
=======
function montarTarefaAutomatica(dados, sanitarioId) {
  return {
    funcionario_id: Number(dados.funcionario_responsavel_id),
    lote_id: dados.lote_id ? Number(dados.lote_id) : '',
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
    tarefa: `${normalizarTipo(dados.tipo)}: ${dados.desc}`,
    setor: 'Sanitário',
    obs: `Tarefa automática criada a partir do manejo sanitário${dados.obs ? ` • ${dados.obs}` : ''}`,
    recorrente: false,
    data: dados.proxima,
    status: 'pendente',
<<<<<<< HEAD
    // Campos de recorrência não aplicáveis para tarefas automáticas de sanitário
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
    recorrencia_tipo: '',
    dias_semana: [],
    data_inicio: '',
    data_fim: '',
    concluido_datas: [],
    origem_sistema: 'sanitario',
    origem_sanitario_id: sanitarioId,
  };
}

<<<<<<< HEAD
/**
 * Normaliza o tipo de manejo sanitário para exibição.
 * @param {string} tipo - O tipo de manejo.
 * @returns {string} O tipo normalizado.
 */
=======


>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
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

<<<<<<< HEAD
/**
 * Obtém o status de um manejo sanitário com base na próxima data e alerta.
 * @param {string} dataProxima - A próxima data de aplicação (ISO string).
 * @param {number} alertaDiasAntes - Número de dias para alertar antes da data.
 * @returns {string} O status ('vencido', 'proximo', 'em-dia', 'sem-data').
 */
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
function obterStatus(dataProxima, alertaDiasAntes = 0) {
  if (!dataProxima) return 'sem-data';

  const hoje = new Date();
  const proxima = new Date(dataProxima);

  hoje.setHours(0, 0, 0, 0);
  proxima.setHours(0, 0, 0, 0);

<<<<<<< HEAD
  const diffDias = Math.round((proxima.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
=======
  const diffDias = Math.round((proxima - hoje) / (1000 * 60 * 60 * 24));
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d

  if (diffDias < 0) return 'vencido';
  if (diffDias <= Number(alertaDiasAntes || 0)) return 'proximo';
  return 'em-dia';
}

<<<<<<< HEAD
/**
 * Renderiza um badge de status para o manejo sanitário.
 * @param {string} status - O status do manejo.
 * @returns {JSX.Element} O elemento badge.
 */
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
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
<<<<<<< HEAD
}
=======
}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
