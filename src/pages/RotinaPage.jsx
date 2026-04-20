import { useMemo, useState } from 'react';
import RotinaForm from '../components/RotinaForm';
import { formatarData } from '../utils/formatters';
import { gerarNovoId } from '../utils/id';

export default function RotinaPage({ db, setDb, onConfirmAction }) {
  const [abrirForm, setAbrirForm] = useState(false);
  const [itemEditando, setItemEditando] = useState(null);

  const funcionarios = db?.funcionarios || [];
  const lotes = db?.lotes || [];
  const rotinas = db?.rotinas || [];

  const hoje = zerarHora(new Date());
  const hojeStr = formatarDataISO(hoje);

  const dadosBase = useMemo(() => {
    return rotinas.map((item) => {
      const funcionario = funcionarios.find((f) => f.id === item.funcionario_id);
      const lote = lotes.find((l) => l.id === item.lote_id);

      return {
        ...item,
        funcionarioNome: funcionario?.nome || '—',
        funcionarioFuncao: funcionario?.funcao || '—',
        loteNome: lote?.nome || '—',
      };
    });
  }, [rotinas, funcionarios, lotes]);

  const tarefasAvulsas = dadosBase.filter((item) => !item.recorrente);
  const tarefasRecorrentes = dadosBase.filter((item) => item.recorrente);

  const tarefasHojeRecorrentes = tarefasRecorrentes
    .filter((item) => recorrenciaValeHoje(item, hoje))
    .map((item) => ({
      ...item,
      id_virtual: `rec-${item.id}-${hojeStr}`,
      id_base: item.id,
      _instanciaRecorrente: true,
      data_exibicao: hojeStr,
      status: Array.isArray(item.concluido_datas) && item.concluido_datas.includes(hojeStr)
        ? 'concluido'
        : 'pendente',
    }));

  const tarefasHojeAvulsas = tarefasAvulsas.filter((item) => {
    if (!item.data) return false;
    const dataItem = zerarHora(new Date(item.data));
    return dataItem.getTime() === hoje.getTime();
  });

  const tarefasHoje = [...tarefasHojeAvulsas, ...tarefasHojeRecorrentes].sort((a, b) =>
    a.tarefa.localeCompare(b.tarefa)
  );

  const tarefasAtrasadas = tarefasAvulsas.filter((item) => {
    if (!item.data || item.status === 'concluido') return false;
    const dataItem = zerarHora(new Date(item.data));
    return dataItem.getTime() < hoje.getTime();
  });

  const proximasTarefas = tarefasAvulsas.filter((item) => {
    if (!item.data || item.status === 'concluido') return false;
    const dataItem = zerarHora(new Date(item.data));
    return dataItem.getTime() > hoje.getTime();
  });

  const resumo = useMemo(() => {
    const concluidasHoje =
      tarefasHoje.filter((item) => item.status === 'concluido').length;

    return {
      total: rotinas.length,
      pendentesHoje: tarefasHoje.filter((item) => item.status !== 'concluido').length,
      atrasadas: tarefasAtrasadas.length,
      concluidasHoje,
    };
  }, [rotinas.length, tarefasHoje, tarefasAtrasadas.length]);

  function abrirNovo() {
    setItemEditando(null);
    setAbrirForm(true);
  }

  function editarItem(item) {
    const itemReal = item._instanciaRecorrente
      ? rotinas.find((r) => r.id === item.id_base)
      : item;

    setItemEditando(itemReal || item);
    setAbrirForm(true);
  }

  async function excluirItem(item) {
    const id = item._instanciaRecorrente ? item.id_base : item.id;

    const confirmado = typeof onConfirmAction === 'function'
      ? await onConfirmAction({
          title: 'Excluir tarefa',
          message: 'Deseja excluir esta tarefa?',
          tone: 'danger',
        })
      : window.confirm('Deseja excluir esta tarefa?');
    if (!confirmado) return;

    setDb((prev) => ({
      ...prev,
      rotinas: prev.rotinas.filter((r) => r.id !== id),
    }));
  }

  function salvarItem(dados) {
    if (itemEditando) {
      setDb((prev) => ({
        ...prev,
        rotinas: prev.rotinas.map((r) =>
          r.id === itemEditando.id ? { ...r, ...dados } : r
        ),
      }));
    } else {
      setDb((prev) => ({
        ...prev,
        rotinas: [
          ...prev.rotinas,
          {
            id: gerarNovoId(prev.rotinas),
            ...dados,
          },
        ],
      }));
    }

    setAbrirForm(false);
    setItemEditando(null);
  }

  function concluirOuReabrir(item, concluir) {
    if (item._instanciaRecorrente) {
      setDb((prev) => ({
        ...prev,
        rotinas: prev.rotinas.map((r) => {
          if (r.id !== item.id_base) return r;

          const lista = Array.isArray(r.concluido_datas) ? r.concluido_datas : [];
          const jaTem = lista.includes(hojeStr);

          return {
            ...r,
            concluido_datas: concluir
              ? jaTem
                ? lista
                : [...lista, hojeStr]
              : lista.filter((d) => d !== hojeStr),
          };
        }),
      }));

      return;
    }

    setDb((prev) => ({
      ...prev,
      rotinas: prev.rotinas.map((r) =>
        r.id === item.id ? { ...r, status: concluir ? 'concluido' : 'pendente' } : r
      ),
    }));
  }

  return (
    <div className="page">
      <div className="page-header page-topbar">
        <div>
          <h1>Rotina</h1>
          <p>Checklist diário da fazenda, com tarefas avulsas e recorrentes.</p>
        </div>

        <div className="page-topbar-actions">
          <button className="primary-btn" onClick={abrirNovo}>
            + Nova tarefa
          </button>
        </div>
      </div>

      <div className="kpi-grid-3">
        <div className="kpi-card">
          <div className="kpi-label">Pendentes hoje</div>
          <div className="kpi-value">{resumo.pendentesHoje}</div>
          <div className="kpi-sub">tarefas para executar hoje</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Atrasadas</div>
          <div className="kpi-value">{resumo.atrasadas}</div>
          <div className="kpi-sub">tarefas vencidas e não concluídas</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Concluídas hoje</div>
          <div className="kpi-value">{resumo.concluidasHoje}</div>
          <div className="kpi-sub">tarefas finalizadas no dia</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="fazendas-card">
          <div className="fazendas-card-header">
            <span className="fazendas-card-title">Tarefas de hoje</span>
          </div>
          <div className="card-body">
            <TodoSection
              items={tarefasHoje}
              vazioTitulo="Nenhuma tarefa para hoje."
              vazioTexto="Cadastre uma nova tarefa ou uma recorrência."
              onToggleStatus={concluirOuReabrir}
              onEditar={editarItem}
              onExcluir={excluirItem}
            />
          </div>
        </div>

        <div className="fazendas-card">
          <div className="fazendas-card-header">
            <span className="fazendas-card-title">Tarefas atrasadas</span>
          </div>
          <div className="card-body">
            <TodoSection
              items={tarefasAtrasadas}
              vazioTitulo="Nenhuma tarefa atrasada."
              vazioTexto="Ótimo, não há pendências vencidas."
              onToggleStatus={concluirOuReabrir}
              onEditar={editarItem}
              onExcluir={excluirItem}
              destaque="atrasado"
            />
          </div>
        </div>
      </div>

      <div className="fazendas-card" style={{ marginTop: 24 }}>
        <div className="fazendas-card-header">
          <span className="fazendas-card-title">Próximas tarefas</span>
        </div>
        <div className="card-body">
          <TodoSection
            items={proximasTarefas}
            vazioTitulo="Nenhuma próxima tarefa."
            vazioTexto="Cadastre tarefas futuras para organizar a operação."
            onToggleStatus={concluirOuReabrir}
            onEditar={editarItem}
            onExcluir={excluirItem}
          />
        </div>
      </div>

      <div className="fazendas-card" style={{ marginTop: 24 }}>
        <div className="fazendas-card-header">
          <span className="fazendas-card-title">Rotinas recorrentes cadastradas</span>
        </div>

        <div className="fazendas-table-wrap">
          {tarefasRecorrentes.length === 0 ? (
            <div className="empty-box">
              <strong>Nenhuma rotina recorrente cadastrada.</strong>
              <span>Crie tarefas recorrentes para automatizar o dia a dia.</span>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Funcionário</th>
                  <th>Setor</th>
                  <th>Lote</th>
                  <th>Tarefa</th>
                  <th>Recorrência</th>
                  <th>Início</th>
                  <th>Fim</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {tarefasRecorrentes.map((item) => (
                  <tr key={item.id}>
                    <td className="text-h">{item.funcionarioNome}</td>
                    <td>{item.setor}</td>
                    <td>{item.lote_id ? item.loteNome : '—'}</td>
                    <td>{item.tarefa}</td>
                    <td>{descreverRecorrencia(item)}</td>
                    <td>{formatarData(item.data_inicio)}</td>
                    <td>{formatarData(item.data_fim)}</td>
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
                          onClick={() => excluirItem(item)}
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
        <RotinaForm
          initialData={itemEditando}
          funcionarios={funcionarios}
          lotes={lotes}
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

function TodoSection({
  items,
  vazioTitulo,
  vazioTexto,
  onToggleStatus,
  onEditar,
  onExcluir,
  destaque = '',
}) {
  if (!items.length) {
    return (
      <div className="empty-box">
        <strong>{vazioTitulo}</strong>
        <span>{vazioTexto}</span>
      </div>
    );
  }

  return (
    <div className="todo-list">
      {items.map((item) => (
        <div
          key={item._instanciaRecorrente ? item.id_virtual : item.id}
          className={`todo-card ${
            destaque === 'atrasado' ? 'todo-card-atrasado' : ''
          }`}
        >
          <div className="todo-card-top">
            <div>
              <div className="todo-card-title">
                {item.tarefa}{' '}
                {item._instanciaRecorrente ? (
                  <span className="badge b-blue" style={{ marginLeft: 8 }}>
                    Recorrente
                  </span>
                ) : null}
              </div>

              <div className="todo-card-meta">
                {item.funcionarioNome} • {item.setor}
                {item.lote_id ? ` • ${item.loteNome}` : ''}
              </div>
            </div>

            <div>{renderStatus(item.status)}</div>
          </div>

          <div className="todo-card-bottom">
            <div className="todo-card-date">
              {formatarData(item._instanciaRecorrente ? item.data_exibicao : item.data)}
            </div>

            <div className="row-actions">
              {item.status !== 'concluido' ? (
                <button
                  className="action-btn"
                  onClick={() => onToggleStatus(item, true)}
                >
                  Concluir hoje
                </button>
              ) : (
                <button
                  className="action-btn"
                  onClick={() => onToggleStatus(item, false)}
                >
                  Reabrir hoje
                </button>
              )}

              <button
                className="action-btn"
                onClick={() => onEditar(item)}
              >
                Editar
              </button>

              <button
                className="action-btn action-btn-danger"
                onClick={() => onExcluir(item)}
              >
                Excluir
              </button>
            </div>
          </div>

          {item.obs ? <div className="todo-card-obs">{item.obs}</div> : null}
        </div>
      ))}
    </div>
  );
}

function recorrenciaValeHoje(item, hoje) {
  if (!item.recorrente) return false;
  if (!item.data_inicio) return false;

  const inicio = zerarHora(new Date(item.data_inicio));
  const fim = item.data_fim ? zerarHora(new Date(item.data_fim)) : null;

  if (hoje.getTime() < inicio.getTime()) return false;
  if (fim && hoje.getTime() > fim.getTime()) return false;

  if (item.recorrencia_tipo === 'diaria') return true;

  if (item.recorrencia_tipo === 'semanal') {
    const diaHoje = hoje.getDay();
    return Array.isArray(item.dias_semana) && item.dias_semana.includes(diaHoje);
  }

  return false;
}

function descreverRecorrencia(item) {
  if (item.recorrencia_tipo === 'diaria') return 'Diária';

  if (item.recorrencia_tipo === 'semanal') {
    const nomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const dias = (item.dias_semana || []).map((d) => nomes[d]).join(', ');
    return dias ? `Semanal (${dias})` : 'Semanal';
  }

  return '—';
}


function zerarHora(data) {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatarDataISO(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}


function renderStatus(status) {
  if (status === 'pendente') {
    return <span className="badge badge-a">Pendente</span>;
  }

  if (status === 'em_andamento') {
    return <span className="badge b-blue">Em andamento</span>;
  }

  if (status === 'concluido') {
    return <span className="badge badge-g">Concluído</span>;
  }

  return <span className="badge badge-n">Sem status</span>;
}
