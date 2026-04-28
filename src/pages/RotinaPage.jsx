import { useMemo, useState, useCallback } from 'react';
import RotinaForm from '../components/RotinaForm';
import { formatarData } from '../utils/formatters';
import { gerarNovoId } from '../utils/id';
import { useToast } from '../hooks/useToast'; // Importar useToast
import Card from '../components/ui/Card'; // Importar Card para os resumos
import Button from '../components/ui/Button'; // Importar Button
import PageHeader from '../components/PageHeader'; // Importar PageHeader
import { Plus } from 'lucide-react'; // Importar ícone
import { useAuth } from '../auth/useAuth';
import {
  createOperationalRecord,
  deleteOperationalRecord,
  updateOperationalRecord,
} from '../services/operationalPersistence';

export default function RotinaPage({ db, setDb, onConfirmAction }) {
  const { showToast } = useToast(); // Usar o hook de toast
  const { session } = useAuth();

  const [abrirForm, setAbrirForm] = useState(false);
  const [itemEditando, setItemEditando] = useState(null);

  // Memoizar mapas para lookups eficientes
  const funcionariosMap = useMemo(() => {
    const map = new Map();
    (db?.funcionarios || []).forEach(f => map.set(f.id, f));
    return map;
  }, [db?.funcionarios]);

  const lotesMap = useMemo(() => {
    const map = new Map();
    (db?.lotes || []).forEach(l => map.set(l.id, l));
    return map;
  }, [db?.lotes]);

  const rotinas = db?.rotinas || [];

  const hoje = useMemo(() => zerarHora(new Date()), []);
  const hojeStr = useMemo(() => formatarDataISO(hoje), [hoje]);

  const dadosBase = useMemo(() => {
    return rotinas.map((item) => {
      const funcionario = funcionariosMap.get(item.funcionario_id);
      const lote = lotesMap.get(item.lote_id);

      return {
        ...item,
        funcionarioNome: funcionario?.nome || '—',
        funcionarioFuncao: funcionario?.funcao || '—',
        loteNome: lote?.nome || '—',
      };
    });
  }, [rotinas, funcionariosMap, lotesMap]);

  const tarefasAvulsas = useMemo(() => dadosBase.filter((item) => !item.recorrente), [dadosBase]);
  const tarefasRecorrentes = useMemo(() => dadosBase.filter((item) => item.recorrente), [dadosBase]);

  const tarefasHojeRecorrentes = useMemo(() => {
    return tarefasRecorrentes
      .filter((item) => recorrenciaValeHoje(item, hoje))
      .map((item) => ({
        ...item,
        id_virtual: `rec-${item.id}-${hojeStr}`, // ID único para instância recorrente
        id_base: item.id, // ID da rotina base
        _instanciaRecorrente: true,
        data_exibicao: hojeStr,
        status: Array.isArray(item.concluido_datas) && item.concluido_datas.includes(hojeStr)
          ? 'concluido'
          : 'pendente',
      }));
  }, [tarefasRecorrentes, hoje, hojeStr]);

  const tarefasHojeAvulsas = useMemo(() => {
    return tarefasAvulsas.filter((item) => {
      if (!item.data) return false;
      const dataItem = zerarHora(new Date(item.data));
      return dataItem.getTime() === hoje.getTime();
    });
  }, [tarefasAvulsas, hoje]);

  const tarefasHoje = useMemo(() => {
    return [...tarefasHojeAvulsas, ...tarefasHojeRecorrentes].sort((a, b) =>
      a.tarefa.localeCompare(b.tarefa)
    );
  }, [tarefasHojeAvulsas, tarefasHojeRecorrentes]);

  const tarefasAtrasadas = useMemo(() => {
    return tarefasAvulsas.filter((item) => {
      if (!item.data || item.status === 'concluido') return false;
      const dataItem = zerarHora(new Date(item.data));
      return dataItem.getTime() < hoje.getTime();
    });
  }, [tarefasAvulsas, hoje]);

  const proximasTarefas = useMemo(() => {
    return tarefasAvulsas.filter((item) => {
      if (!item.data || item.status === 'concluido') return false;
      const dataItem = zerarHora(new Date(item.data));
      return dataItem.getTime() > hoje.getTime();
    });
  }, [tarefasAvulsas, hoje]);

  const resumo = useMemo(() => {
    const concluidasHoje = tarefasHoje.filter((item) => item.status === 'concluido').length;
    return {
      total: rotinas.length,
      pendentesHoje: tarefasHoje.filter((item) => item.status !== 'concluido').length,
      atrasadas: tarefasAtrasadas.length,
      concluidasHoje,
    };
  }, [rotinas.length, tarefasHoje, tarefasAtrasadas.length]);

  const abrirNovo = useCallback(() => {
    setItemEditando(null);
    setAbrirForm(true);
  }, []);

  const editarItem = useCallback((item) => {
    const itemReal = item._instanciaRecorrente
      ? rotinas.find((r) => r.id === item.id_base)
      : item;

    setItemEditando(itemReal || item);
    setAbrirForm(true);
  }, [rotinas]);

  const excluirItem = useCallback(async (item) => {
    const id = item._instanciaRecorrente ? item.id_base : item.id;

    const confirmado = typeof onConfirmAction === 'function'
      ? await onConfirmAction({
          title: 'Excluir tarefa',
          message: 'Deseja excluir esta tarefa?',
          tone: 'danger',
        })
      : window.confirm('Deseja excluir esta tarefa?');

    if (!confirmado) return;

    const persisted = await deleteOperationalRecord('rotinas', id, session);
    setDb((prev) => ({
      ...prev,
      rotinas: prev.rotinas.filter((r) => r.id !== id),
    }));
    if (!persisted.persisted) {
      showToast({ type: 'warning', message: 'Exclusão salva apenas localmente.' });
    }
    showToast({ type: 'success', message: 'Tarefa excluída com sucesso!' });
  }, [onConfirmAction, session, setDb, showToast]);

  const salvarItem = useCallback(async (dados) => {
    if (itemEditando) {
      const persisted = await updateOperationalRecord('rotinas', itemEditando.id, dados, session);
      setDb((prev) => ({
        ...prev,
        rotinas: prev.rotinas.map((r) =>
          r.id === itemEditando.id ? { ...r, ...(persisted.data || dados) } : r
        ),
      }));
      if (!persisted.persisted) {
        showToast({ type: 'warning', message: 'Tarefa atualizada apenas localmente.' });
      }
      showToast({ type: 'success', message: 'Tarefa atualizada com sucesso!' });
    } else {
      const persisted = await createOperationalRecord('rotinas', dados, session);
      setDb((prev) => ({
        ...prev,
        rotinas: [
          ...prev.rotinas,
          {
            ...dados,
            ...(persisted.data || {}),
            id: persisted.data?.id ?? gerarNovoId(prev.rotinas),
          },
        ],
      }));
      if (!persisted.persisted) {
        showToast({ type: 'warning', message: 'Tarefa criada apenas localmente.' });
      }
      showToast({ type: 'success', message: 'Tarefa criada com sucesso!' });
    }

    setAbrirForm(false);
    setItemEditando(null);
  }, [itemEditando, session, setDb, showToast]);

  const concluirOuReabrir = useCallback(async (item, concluir) => {
    if (item._instanciaRecorrente) {
      const rotinaBase = rotinas.find((r) => r.id === item.id_base);
      if (!rotinaBase) return;
      const concluidoDatas = new Set(rotinaBase.concluido_datas || []);
      if (concluir) {
        concluidoDatas.add(item.data_exibicao);
      } else {
        concluidoDatas.delete(item.data_exibicao);
      }
      const patch = { concluido_datas: Array.from(concluidoDatas) };
      const persisted = await updateOperationalRecord('rotinas', item.id_base, patch, session);
      setDb((prev) => ({
        ...prev,
        rotinas: prev.rotinas.map((r) => {
          if (r.id === item.id_base) {
            return { ...r, ...(persisted.data || patch) };
          }
          return r;
        }),
      }));
      if (!persisted.persisted) {
        showToast({ type: 'warning', message: 'Atualização salva apenas localmente.' });
      }
      showToast({ type: 'success', message: `Tarefa ${concluir ? 'concluída' : 'reaberta'} com sucesso!` });
    } else {
      const patch = { status: concluir ? 'concluido' : 'pendente' };
      const persisted = await updateOperationalRecord('rotinas', item.id, patch, session);
      setDb((prev) => ({
        ...prev,
        rotinas: prev.rotinas.map((r) =>
          r.id === item.id ? { ...r, ...(persisted.data || patch) } : r
        ),
      }));
      if (!persisted.persisted) {
        showToast({ type: 'warning', message: 'Atualização salva apenas localmente.' });
      }
      showToast({ type: 'success', message: `Tarefa ${concluir ? 'concluída' : 'reaberta'} com sucesso!` });
    }
  }, [rotinas, session, setDb, showToast]);

  return (
    <div className="page rotina-page">
      <PageHeader
        title="Rotinas e Tarefas"
        subtitle="Gerencie as atividades diárias e recorrentes da sua fazenda."
        actions={<Button icon={<Plus size={16} />} onClick={abrirNovo}>Nova Tarefa</Button>}
      />

      <div className="summary-cards">
        <Card title="Total de Rotinas" value={resumo.total} />
        <Card title="Pendentes Hoje" value={resumo.pendentesHoje} />
        <Card title="Atrasadas" value={resumo.atrasadas} />
        <Card title="Concluídas Hoje" value={resumo.concluidasHoje} />
      </div>

      <section className="todo-section">
        <h2>Tarefas para hoje</h2>
        <TodoList
          items={tarefasHoje}
          vazioTitulo="Nenhuma tarefa para hoje."
          vazioTexto="Sua agenda está livre! Que tal criar uma nova tarefa?"
          onToggleStatus={concluirOuReabrir}
          onEditar={editarItem}
          onExcluir={excluirItem}
        />
      </section>

      <section className="todo-section">
        <h2>Tarefas atrasadas</h2>
        <TodoList
          items={tarefasAtrasadas}
          vazioTitulo="Nenhuma tarefa atrasada."
          vazioTexto="Parabéns, você está em dia com suas tarefas!"
          destaque="atrasado"
          onToggleStatus={concluirOuReabrir}
          onEditar={editarItem}
          onExcluir={excluirItem}
        />
      </section>

      <section className="todo-section">
        <h2>Próximas tarefas</h2>
        <TodoList
          items={proximasTarefas}
          vazioTitulo="Nenhuma próxima tarefa."
          vazioTexto="Todas as tarefas futuras estão em dia."
          onToggleStatus={concluirOuReabrir}
          onEditar={editarItem}
          onExcluir={excluirItem}
        />
      </section>

      {abrirForm && (
        <RotinaForm
          initialData={itemEditando}
          funcionarios={db?.funcionarios || []}
          lotes={db?.lotes || []}
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
 * Componente para exibir uma lista de tarefas.
 * @param {object} props - As propriedades do componente.
 * @param {Array<object>} props.items - Array de tarefas a serem exibidas.
 * @param {string} props.vazioTitulo - Título para o estado vazio.
 * @param {string} props.vazioTexto - Texto para o estado vazio.
 * @param {string} [props.destaque] - Tipo de destaque para os cards ('atrasado').
 * @param {function} props.onToggleStatus - Callback para alternar o status da tarefa.
 * @param {function} props.onEditar - Callback para editar a tarefa.
 * @param {function} props.onExcluir - Callback para excluir a tarefa.
 */
function TodoList({ items, vazioTitulo, vazioTexto, destaque, onToggleStatus, onEditar, onExcluir }) {
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

/**
 * Verifica se uma tarefa recorrente é válida para a data de hoje.
 * @param {object} item - O objeto da tarefa.
 * @param {Date} hoje - A data de hoje (com hora zerada).
 * @returns {boolean} True se a recorrência é válida para hoje, false caso contrário.
 */
function recorrenciaValeHoje(item, hoje) {
  if (!item.recorrente) return false;
  if (!item.data_inicio) return false;

  const inicio = zerarHora(new Date(item.data_inicio));
  const fim = item.data_fim ? zerarHora(new Date(item.data_fim)) : null;

  if (hoje.getTime() < inicio.getTime()) return false;
  if (fim && hoje.getTime() > fim.getTime()) return false;

  if (item.recorrencia_tipo === 'diaria') return true;

  if (item.recorrencia_tipo === 'semanal') {
    const diaHoje = hoje.getDay(); // 0 para Domingo, 1 para Segunda, etc.
    // item.dias_semana deve ser um array de números [0, 1, 2, ...]
    return Array.isArray(item.dias_semana) && item.dias_semana.includes(diaHoje);
  }

  // Adicionar lógica para recorrência mensal, anual, etc. se necessário
  // if (item.recorrencia_tipo === 'mensal') { ... }

  return false;
}

/**
 * Zera a hora de um objeto Date para facilitar comparações de data.
 * @param {Date|string} data - A data a ser zerada.
 * @returns {Date} Um novo objeto Date com a hora zerada.
 */
function zerarHora(data) {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Formata um objeto Date para uma string ISO (YYYY-MM-DD).
 * @param {Date} data - O objeto Date a ser formatado.
 * @returns {string} A data formatada.
 */
function formatarDataISO(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * Renderiza um badge de status para a tarefa.
 * @param {string} status - O status da tarefa ('pendente', 'em_andamento', 'concluido').
 * @returns {JSX.Element} O elemento badge.
 */
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
