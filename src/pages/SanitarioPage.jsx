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

  const dadosTabela = useMemo(() => {
    return [...sanitario]
      .map((item) => {
        const lote = lotes.find((l) => l.id === item.lote_id);
        const funcionario = funcionarios.find(
          (f) => f.id === item.funcionario_responsavel_id
        );

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
        return new Date(dataA) - new Date(dataB);
      });
  }, [sanitario, lotes, funcionarios]);

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
            novasRotinas = novasRotinas.map((r) =>
              r.id === rotinaAutomaticaId ? { ...r, ...tarefaAutomatica } : r
            );
          } else {
            rotinaAutomaticaId = gerarNovoId(novasRotinas);
            novasRotinas.push({
              id: rotinaAutomaticaId,
              ...tarefaAutomatica,
            });
          }
        } else if (rotinaAutomaticaId) {
          novasRotinas = novasRotinas.filter((r) => r.id !== rotinaAutomaticaId);
          rotinaAutomaticaId = null;
        }

        return {
          ...prev,
          sanitario: prev.sanitario.map((s) =>
            s.id === itemEditando.id
              ? {
                  ...s,
                  ...dados,
                  rotina_automatica_id: rotinaAutomaticaId,
                }
              : s
          ),
          rotinas: novasRotinas,
        };
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
                  <th>Status</th>
                  <th>Observação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {dadosTabela.map((item) => (
                  <tr key={item.id}>
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
          lotes={lotes}
          funcionarios={funcionarios}
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

function montarTarefaAutomatica(dados, sanitarioId) {
  return {
    funcionario_id: Number(dados.funcionario_responsavel_id),
    lote_id: dados.lote_id ? Number(dados.lote_id) : '',
    tarefa: `${normalizarTipo(dados.tipo)}: ${dados.desc}`,
    setor: 'Sanitário',
    obs: `Tarefa automática criada a partir do manejo sanitário${dados.obs ? ` • ${dados.obs}` : ''}`,
    recorrente: false,
    data: dados.proxima,
    status: 'pendente',
    recorrencia_tipo: '',
    dias_semana: [],
    data_inicio: '',
    data_fim: '',
    concluido_datas: [],
    origem_sistema: 'sanitario',
    origem_sanitario_id: sanitarioId,
  };
}



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

function obterStatus(dataProxima, alertaDiasAntes = 0) {
  if (!dataProxima) return 'sem-data';

  const hoje = new Date();
  const proxima = new Date(dataProxima);

  hoje.setHours(0, 0, 0, 0);
  proxima.setHours(0, 0, 0, 0);

  const diffDias = Math.round((proxima - hoje) / (1000 * 60 * 60 * 24));

  if (diffDias < 0) return 'vencido';
  if (diffDias <= Number(alertaDiasAntes || 0)) return 'proximo';
  return 'em-dia';
}

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
