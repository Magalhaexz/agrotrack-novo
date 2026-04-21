import { useMemo, useState } from 'react';
import { CheckSquare, ChevronRight, FileText, Plus, X } from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import '../styles/tarefas.css';

const STATUS_COLUMNS = [
  { id: 'pendente', title: 'Pendente' },
  { id: 'em_andamento', title: 'Em andamento' },
  { id: 'concluida', title: 'Concluída' },
];

const PRIORIDADES = ['baixa', 'media', 'alta', 'critica'];
const CATEGORIAS = ['manejo', 'sanitario', 'manutencao', 'administrativo', 'estoque'];

const EMPTY_TASK = {
  titulo: '',
  descricao: '',
  prioridade: 'media',
  categoria: 'manejo',
  status: 'pendente',
  responsavel_id: '',
  lote_id: '',
  fazenda_id: '',
  data_vencimento: '',
};

export default function TarefasPage({ db, setDb, onNavigate, onConfirmAction }) {
  const tarefas = Array.isArray(db?.tarefas) ? db.tarefas : [];
  const [openModal, setOpenModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filters, setFilters] = useState({
    prioridade: '',
    categoria: '',
    responsavel_id: '',
    periodo: '',
  });

  const tarefasFiltradas = useMemo(() => {
    return tarefas.filter((task) => {
      if (filters.prioridade && task.prioridade !== filters.prioridade) return false;
      if (filters.categoria && task.categoria !== filters.categoria) return false;
      if (filters.responsavel_id && String(task.responsavel_id || '') !== filters.responsavel_id) return false;
      if (filters.periodo && !isInPeriodo(task.data_vencimento, filters.periodo)) return false;
      return true;
    });
  }, [filters, tarefas]);

  const tarefasPorStatus = useMemo(
    () =>
      STATUS_COLUMNS.reduce((acc, column) => {
        acc[column.id] = tarefasFiltradas
          .filter((task) => task.status === column.id)
          .sort((a, b) => new Date(a.data_vencimento || '2999-12-31') - new Date(b.data_vencimento || '2999-12-31'));
        return acc;
      }, {}),
    [tarefasFiltradas]
  );

  function openNewTask() {
    setEditingTask(null);
    setOpenModal(true);
  }

  function openEditTask(task) {
    setEditingTask(task);
    setOpenModal(true);
  }

  function handleSave(formData) {
    if (!formData.titulo.trim()) {
      window.alert('Informe o título da tarefa.');
      return;
    }

    if (!formData.data_vencimento) {
      window.alert('Informe a data de vencimento da tarefa.');
      return;
    }

    setDb((prev) => {
      const lista = Array.isArray(prev?.tarefas) ? prev.tarefas : [];

      if (editingTask) {
        return {
          ...prev,
          tarefas: lista.map((item) => (item.id === editingTask.id ? { ...item, ...formData } : item)),
        };
      }

      return {
        ...prev,
        tarefas: [
          ...lista,
          {
            ...formData,
            id: getNextId(lista),
            created_at: new Date().toISOString(),
          },
        ],
      };
    });

    setOpenModal(false);
  }

  async function handleDelete(task) {
    const canDelete = onConfirmAction
      ? await onConfirmAction({
          title: 'Excluir tarefa',
          message: `Deseja realmente excluir "${task.titulo}"?`,
          tone: 'danger',
        })
      : window.confirm(`Deseja realmente excluir "${task.titulo}"?`);

    if (!canDelete) return;

    setDb((prev) => ({
      ...prev,
      tarefas: (prev?.tarefas || []).filter((item) => item.id !== task.id),
    }));
  }

  function moveToNextStatus(task) {
    const next = nextStatus(task.status);
    if (!next) return;

    setDb((prev) => ({
      ...prev,
      tarefas: (prev?.tarefas || []).map((item) =>
        item.id === task.id
          ? {
              ...item,
              status: next,
            }
          : item
      ),
    }));
  }

  return (
    <div className="tarefas-page">
      <header className="tarefas-header">
        <div>
          <h1>Tarefas</h1>
          <p>Acompanhamento operacional por prioridade e etapa de execução.</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openNewTask}>+ Nova Tarefa</Button>
      </header>

      <Card>
        <div className="tarefas-filtros">
          <select value={filters.prioridade} onChange={(e) => setFilters((prev) => ({ ...prev, prioridade: e.target.value }))}>
            <option value="">Todas prioridades</option>
            {PRIORIDADES.map((item) => <option key={item} value={item}>{toLabel(item)}</option>)}
          </select>
          <select value={filters.categoria} onChange={(e) => setFilters((prev) => ({ ...prev, categoria: e.target.value }))}>
            <option value="">Todas categorias</option>
            {CATEGORIAS.map((item) => <option key={item} value={item}>{toLabel(item)}</option>)}
          </select>
          <select value={filters.responsavel_id} onChange={(e) => setFilters((prev) => ({ ...prev, responsavel_id: e.target.value }))}>
            <option value="">Todos responsáveis</option>
            {(db.funcionarios || []).map((f) => <option key={f.id} value={String(f.id)}>{f.nome}</option>)}
          </select>
          <select value={filters.periodo} onChange={(e) => setFilters((prev) => ({ ...prev, periodo: e.target.value }))}>
            <option value="">Qualquer período</option>
            <option value="hoje">Vence hoje</option>
            <option value="semana">Próximos 7 dias</option>
            <option value="atrasadas">Atrasadas</option>
          </select>
        </div>
      </Card>

      <section className="tarefas-board">
        {STATUS_COLUMNS.map((column) => (
          <Card key={column.id} title={column.title} subtitle={`${tarefasPorStatus[column.id]?.length || 0} tarefa(s)`}>
            <div className="tarefas-column">
              {(tarefasPorStatus[column.id] || []).map((task) => {
                const isLate = isOverdue(task.data_vencimento) && task.status !== 'concluida';
                return (
                  <article key={task.id} className="tarefa-card">
                    <div className="tarefa-card-top">
                      <h3>{task.titulo}</h3>
                      <div className="tarefa-badges">
                        <Badge variant={priorityVariant(task.prioridade)}>{toLabel(task.prioridade)}</Badge>
                        <Badge variant="neutral">{toLabel(task.categoria)}</Badge>
                      </div>
                    </div>
                    {task.descricao ? <p>{task.descricao}</p> : null}
                    <div className="tarefa-meta">
                      <span>Responsável: <strong>{resolveResponsavel(db, task.responsavel_id)}</strong></span>
                      <span>Vínculo: <strong>{resolveVinculo(db, task)}</strong></span>
                      <span className={isLate ? 'late' : ''}>Vence em: <strong>{formatDate(task.data_vencimento)}</strong></span>
                    </div>
                    <div className="tarefa-actions">
                      <Button size="sm" variant="outline" icon={<ChevronRight size={14} />} disabled={task.status === 'concluida'} onClick={() => moveToNextStatus(task)}>Próxima etapa</Button>
                      <Button size="sm" variant="ghost" icon={<FileText size={14} />} onClick={() => openEditTask(task)}>Editar</Button>
                      <Button size="sm" variant="ghost" icon={<X size={14} />} onClick={() => handleDelete(task)}>Excluir</Button>
                    </div>
                  </article>
                );
              })}
              {(tarefasPorStatus[column.id] || []).length === 0 ? <p className="tarefas-empty">Sem tarefas nesta etapa.</p> : null}
            </div>
          </Card>
        ))}
      </section>

      <Modal open={openModal} onClose={() => setOpenModal(false)} title={editingTask ? 'Editar tarefa' : 'Nova tarefa'}>
        <TaskForm
          initialData={editingTask || EMPTY_TASK}
          funcionarios={db.funcionarios || []}
          lotes={db.lotes || []}
          fazendas={db.fazendas || []}
          onCancel={() => setOpenModal(false)}
          onSubmit={handleSave}
        />
      </Modal>

      <footer className="tarefas-footer-link">
        <Button variant="ghost" icon={<CheckSquare size={14} />} onClick={() => onNavigate?.('dashboard')}>Voltar ao Dashboard</Button>
      </footer>
    </div>
  );
}

function TaskForm({ initialData, funcionarios, lotes, fazendas, onCancel, onSubmit }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_TASK, ...initialData }));

  return (
    <form
      className="task-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          ...form,
          titulo: form.titulo.trim(),
          descricao: String(form.descricao || '').trim(),
          responsavel_id: form.responsavel_id ? Number(form.responsavel_id) : null,
          lote_id: form.lote_id ? Number(form.lote_id) : null,
          fazenda_id: form.fazenda_id ? Number(form.fazenda_id) : null,
        });
      }}
    >
      <label>Título *
        <input value={form.titulo} onChange={(e) => setForm((prev) => ({ ...prev, titulo: e.target.value }))} required />
      </label>
      <label>Descrição
        <textarea rows={3} value={form.descricao} onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))} />
      </label>
      <div className="task-form-grid">
        <label>Prioridade
          <select value={form.prioridade} onChange={(e) => setForm((prev) => ({ ...prev, prioridade: e.target.value }))}>
            {PRIORIDADES.map((item) => <option key={item} value={item}>{toLabel(item)}</option>)}
          </select>
        </label>
        <label>Categoria
          <select value={form.categoria} onChange={(e) => setForm((prev) => ({ ...prev, categoria: e.target.value }))}>
            {CATEGORIAS.map((item) => <option key={item} value={item}>{toLabel(item)}</option>)}
          </select>
        </label>
        <label>Status
          <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
            {STATUS_COLUMNS.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
        <label>Data de vencimento *
          <input type="date" value={form.data_vencimento || ''} onChange={(e) => setForm((prev) => ({ ...prev, data_vencimento: e.target.value }))} required />
        </label>
        <label>Responsável
          <select value={String(form.responsavel_id || '')} onChange={(e) => setForm((prev) => ({ ...prev, responsavel_id: e.target.value }))}>
            <option value="">Não definido</option>
            {funcionarios.map((item) => <option key={item.id} value={String(item.id)}>{item.nome}</option>)}
          </select>
        </label>
        <label>Lote
          <select value={String(form.lote_id || '')} onChange={(e) => setForm((prev) => ({ ...prev, lote_id: e.target.value }))}>
            <option value="">Sem lote</option>
            {lotes.map((item) => <option key={item.id} value={String(item.id)}>{item.nome}</option>)}
          </select>
        </label>
        <label>Fazenda
          <select value={String(form.fazenda_id || '')} onChange={(e) => setForm((prev) => ({ ...prev, fazenda_id: e.target.value }))}>
            <option value="">Sem fazenda</option>
            {fazendas.map((item) => <option key={item.id} value={String(item.id)}>{item.nome}</option>)}
          </select>
        </label>
      </div>
      <div className="task-form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">Salvar tarefa</Button>
      </div>
    </form>
  );
}

function getNextId(items) {
  return items.reduce((max, item) => Math.max(max, Number(item.id || 0)), 0) + 1;
}

function nextStatus(status) {
  if (status === 'pendente') return 'em_andamento';
  if (status === 'em_andamento') return 'concluida';
  return null;
}

function toLabel(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolveResponsavel(db, id) {
  if (!id) return 'Não definido';
  return db.funcionarios?.find((item) => item.id === id)?.nome || 'Não definido';
}

function resolveVinculo(db, task) {
  const lote = db.lotes?.find((item) => item.id === task.lote_id)?.nome;
  const fazenda = db.fazendas?.find((item) => item.id === task.fazenda_id)?.nome;
  if (lote && fazenda) return `${lote} / ${fazenda}`;
  return lote || fazenda || 'Geral';
}

function formatDate(dateStr) {
  if (!dateStr) return 'Sem data';
  const [y, m, d] = String(dateStr).split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

function isInPeriodo(dateStr, periodo) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  if (periodo === 'hoje') return date.getTime() === now.getTime();
  if (periodo === 'semana') {
    const limit = new Date(now);
    limit.setDate(now.getDate() + 7);
    return date >= now && date <= limit;
  }
  if (periodo === 'atrasadas') return date < now;
  return true;
}

function priorityVariant(priority) {
  if (priority === 'critica') return 'danger';
  if (priority === 'alta') return 'warning';
  if (priority === 'media') return 'info';
  return 'success';
}
