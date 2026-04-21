<<<<<<< HEAD
import { useMemo, useState, useCallback } from 'react';
=======
import { useMemo, useState } from 'react';
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
import { CheckSquare, ChevronRight, FileText, Plus, X } from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
<<<<<<< HEAD
import Input from '../components/ui/Input'; // Importar o componente Input
import { useToast } from '../hooks/useToast'; // Assumindo que você tem um hook de toast
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
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
<<<<<<< HEAD
  const { showToast } = useToast();
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  const tarefas = Array.isArray(db?.tarefas) ? db.tarefas : [];
  const [openModal, setOpenModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filters, setFilters] = useState({
    prioridade: '',
    categoria: '',
    responsavel_id: '',
    periodo: '',
  });

<<<<<<< HEAD
  // Memoize maps for efficient lookups
  const funcionariosMap = useMemo(() => new Map((db.funcionarios || []).map(f => [f.id, f])), [db.funcionarios]);
  const lotesMap = useMemo(() => new Map((db.lotes || []).map(l => [l.id, l])), [db.lotes]);
  const fazendasMap = useMemo(() => new Map((db.fazendas || []).map(f => [f.id, f])), [db.fazendas]);

=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
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
<<<<<<< HEAD
          .sort((a, b) => new Date(a.data_vencimento || '2999-12-31').getTime() - new Date(b.data_vencimento || '2999-12-31').getTime());
=======
          .sort((a, b) => new Date(a.data_vencimento || '2999-12-31') - new Date(b.data_vencimento || '2999-12-31'));
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
        return acc;
      }, {}),
    [tarefasFiltradas]
  );

<<<<<<< HEAD
  const openNewTask = useCallback(() => {
    setEditingTask(null);
    setOpenModal(true);
  }, []);

  const openEditTask = useCallback((task) => {
    setEditingTask(task);
    setOpenModal(true);
  }, []);

  const handleSave = useCallback((formData) => {
=======
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

>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
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
<<<<<<< HEAD
    showToast({ type: 'success', message: `Tarefa "${formData.titulo}" salva com sucesso!` });
    setOpenModal(false);
  }, [editingTask, setDb, showToast]);

  const handleDelete = useCallback(async (task) => {
=======

    setOpenModal(false);
  }

  async function handleDelete(task) {
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
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
<<<<<<< HEAD
    showToast({ type: 'success', message: `Tarefa "${task.titulo}" excluída com sucesso.` });
  }, [onConfirmAction, setDb, showToast]);

  const moveToNextStatus = useCallback((task) => {
    const next = nextStatus(task.status);
    if (!next) {
      showToast({ type: 'info', message: 'Esta tarefa já está no último status ou não pode avançar.' });
      return;
    }
=======
  }

  function moveToNextStatus(task) {
    const next = nextStatus(task.status);
    if (!next) return;
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d

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
<<<<<<< HEAD
    showToast({ type: 'success', message: `Tarefa "${task.titulo}" movida para "${toLabel(next)}".` });
  }, [setDb, showToast]);

  return (
    <div className="tarefas-page">
      <header className="page-header">
        <h1>Gestão de Tarefas</h1>
        <p>Organize e acompanhe as atividades da sua fazenda.</p>
        <Button icon={<Plus size={16} />} onClick={openNewTask}>Nova Tarefa</Button>
      </header>

      <Card className="tarefas-filters">
        <label className="ui-input-wrap">
          <span className="ui-input-label">Prioridade</span>
          <select className="ui-input" value={filters.prioridade} onChange={(e) => setFilters((p) => ({ ...p, prioridade: e.target.value }))}>
            <option value="">Todas</option>
            {PRIORIDADES.map((p) => <option key={p} value={p}>{toLabel(p)}</option>)}
          </select>
        </label>
        <label className="ui-input-wrap">
          <span className="ui-input-label">Categoria</span>
          <select className="ui-input" value={filters.categoria} onChange={(e) => setFilters((p) => ({ ...p, categoria: e.target.value }))}>
            <option value="">Todas</option>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{toLabel(c)}</option>)}
          </select>
        </label>
        <label className="ui-input-wrap">
          <span className="ui-input-label">Responsável</span>
          <select className="ui-input" value={filters.responsavel_id} onChange={(e) => setFilters((p) => ({ ...p, responsavel_id: e.target.value }))}>
            <option value="">Todos</option>
            {(db.funcionarios || []).map((f) => <option key={f.id} value={String(f.id)}>{f.nome}</option>)}
          </select>
        </label>
        <label className="ui-input-wrap">
          <span className="ui-input-label">Período</span>
          <select className="ui-input" value={filters.periodo} onChange={(e) => setFilters((p) => ({ ...p, periodo: e.target.value }))}>
            <option value="">Todos</option>
            <option value="hoje">Hoje</option>
            <option value="semana">Próximos 7 dias</option>
            <option value="atrasadas">Atrasadas</option>
          </select>
        </label>
      </Card>

      <div className="kanban-board">
        {STATUS_COLUMNS.map((column) => (
          <div key={column.id} className="kanban-column">
            <h2 className="kanban-column-title">{column.title} ({tarefasPorStatus[column.id]?.length || 0})</h2>
            <div className="kanban-cards">
              {tarefasPorStatus[column.id]?.length === 0 ? (
                <div className="empty-state small">Nenhuma tarefa aqui.</div>
              ) : (
                tarefasPorStatus[column.id]?.map((task) => (
                  <Card key={task.id} className={`kanban-card ${isOverdue(task.data_vencimento) && task.status !== 'concluida' ? 'overdue' : ''}`}>
                    <div className="kanban-card-header">
                      <h3 className="kanban-card-title">{task.titulo}</h3>
                      <Badge variant={priorityVariant(task.prioridade)}>{toLabel(task.prioridade)}</Badge>
                    </div>
                    <p className="kanban-card-description">{task.descricao}</p>
                    <div className="kanban-card-meta">
                      <span>Responsável: {resolveResponsavel(db, task.responsavel_id, funcionariosMap)}</span>
                      <span>Vencimento: {formatDate(task.data_vencimento)}</span>
                      <span>Vinculado: {resolveVinculo(db, task, lotesMap, fazendasMap)}</span>
                    </div>
                    <div className="kanban-card-actions">
                      <Button variant="ghost" size="sm" onClick={() => openEditTask(task)}>Editar</Button>
                      {task.status !== 'concluida' && (
                        <Button variant="secondary" size="sm" onClick={() => moveToNextStatus(task)}>
                          {task.status === 'pendente' ? 'Iniciar' : 'Concluir'} <ChevronRight size={14} />
                        </Button>
                      )}
                      <Button variant="danger" size="sm" onClick={() => handleDelete(task)}>Excluir</Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <TaskForm
        open={openModal}
        initialData={editingTask}
        onSave={handleSave}
        onCancel={() => setOpenModal(false)}
        db={db}
        funcionariosMap={funcionariosMap}
        lotesMap={lotesMap}
        fazendasMap={fazendasMap}
      />
=======
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
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
    </div>
  );
}

<<<<<<< HEAD
/**
 * Componente de formulário para adicionar ou editar uma tarefa.
 * @param {object} props - As propriedades do componente.
 * @param {boolean} props.open - Controla a visibilidade do modal.
 * @param {object} props.initialData - Dados iniciais da tarefa para edição.
 * @param {function} props.onSave - Callback para salvar a tarefa.
 * @param {function} props.onCancel - Callback para cancelar a operação.
 * @param {object} props.db - O objeto do banco de dados.
 * @param {Map} props.funcionariosMap - Mapa de funcionários para lookup eficiente.
 * @param {Map} props.lotesMap - Mapa de lotes para lookup eficiente.
 * @param {Map} props.fazendasMap - Mapa de fazendas para lookup eficiente.
 */
function TaskForm({ open, initialData, onSave, onCancel, db, funcionariosMap, lotesMap, fazendasMap }) {
  const { showToast } = useToast();
  const [form, setForm] = useState(initialData || EMPTY_TASK);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm(initialData || EMPTY_TASK);
    setErrors({}); // Reset errors when initialData changes
  }, [initialData]);

  const validate = useCallback(() => {
    const newErrors = {};
    if (!form.titulo.trim()) newErrors.titulo = 'Título é obrigatório.';
    if (!form.data_vencimento) newErrors.data_vencimento = 'Data de vencimento é obrigatória.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (validate()) {
      onSave(form);
    } else {
      showToast({ type: 'error', message: 'Por favor, preencha todos os campos obrigatórios.' });
    }
  }, [form, onSave, validate, showToast]);

  const funcionarios = useMemo(() => Array.from(funcionariosMap.values()), [funcionariosMap]);
  const lotes = useMemo(() => Array.from(lotesMap.values()), [lotesMap]);
  const fazendas = useMemo(() => Array.from(fazendasMap.values()), [fazendasMap]);

  return (
    <Modal open={open} onClose={onCancel} title={initialData ? 'Editar Tarefa' : 'Nova Tarefa'} footer={<Button onClick={handleSubmit}>Salvar Tarefa</Button>}>
      <form onSubmit={handleSubmit} className="task-form-grid">
        <Input label="Título *" value={form.titulo} error={errors.titulo} onChange={(e) => setForm((prev) => ({ ...prev, titulo: e.target.value }))} />
        <Input label="Descrição" value={form.descricao} onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))} />

        <label className="ui-input-wrap">
          <span className="ui-input-label">Prioridade</span>
          <select className="ui-input" value={form.prioridade} onChange={(e) => setForm((prev) => ({ ...prev, prioridade: e.target.value }))}>
            {PRIORIDADES.map((item) => <option key={item} value={item}>{toLabel(item)}</option>)}
          </select>
        </label>
        <label className="ui-input-wrap">
          <span className="ui-input-label">Categoria</span>
          <select className="ui-input" value={form.categoria} onChange={(e) => setForm((prev) => ({ ...prev, categoria: e.target.value }))}>
            {CATEGORIAS.map((item) => <option key={item} value={item}>{toLabel(item)}</option>)}
          </select>
        </label>
        <label className="ui-input-wrap">
          <span className="ui-input-label">Status</span>
          <select className="ui-input" value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
            {STATUS_COLUMNS.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
        <Input label="Data de vencimento *" type="date" value={form.data_vencimento || ''} error={errors.data_vencimento} onChange={(e) => setForm((prev) => ({ ...prev, data_vencimento: e.target.value }))} />
        <label className="ui-input-wrap">
          <span className="ui-input-label">Responsável</span>
          <select className="ui-input" value={String(form.responsavel_id || '')} onChange={(e) => setForm((prev) => ({ ...prev, responsavel_id: e.target.value }))}>
=======
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
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
            <option value="">Não definido</option>
            {funcionarios.map((item) => <option key={item.id} value={String(item.id)}>{item.nome}</option>)}
          </select>
        </label>
<<<<<<< HEAD
        <label className="ui-input-wrap">
          <span className="ui-input-label">Lote</span>
          <select className="ui-input" value={String(form.lote_id || '')} onChange={(e) => setForm((prev) => ({ ...prev, lote_id: e.target.value }))}>
=======
        <label>Lote
          <select value={String(form.lote_id || '')} onChange={(e) => setForm((prev) => ({ ...prev, lote_id: e.target.value }))}>
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
            <option value="">Sem lote</option>
            {lotes.map((item) => <option key={item.id} value={String(item.id)}>{item.nome}</option>)}
          </select>
        </label>
<<<<<<< HEAD
        <label className="ui-input-wrap">
          <span className="ui-input-label">Fazenda</span>
          <select className="ui-input" value={String(form.fazenda_id || '')} onChange={(e) => setForm((prev) => ({ ...prev, fazenda_id: e.target.value }))}>
=======
        <label>Fazenda
          <select value={String(form.fazenda_id || '')} onChange={(e) => setForm((prev) => ({ ...prev, fazenda_id: e.target.value }))}>
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
            <option value="">Sem fazenda</option>
            {fazendas.map((item) => <option key={item.id} value={String(item.id)}>{item.nome}</option>)}
          </select>
        </label>
<<<<<<< HEAD
        <div className="task-form-actions full">
          <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button type="submit">Salvar tarefa</Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Gera o próximo ID para um array de itens.
 * @param {Array<object>} items - O array de itens.
 * @returns {number} O próximo ID disponível.
 */
=======
      </div>
      <div className="task-form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">Salvar tarefa</Button>
      </div>
    </form>
  );
}

>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
function getNextId(items) {
  return items.reduce((max, item) => Math.max(max, Number(item.id || 0)), 0) + 1;
}

<<<<<<< HEAD
/**
 * Determina o próximo status de uma tarefa.
 * @param {string} status - O status atual da tarefa.
 * @returns {string|null} O próximo status ou null se não houver.
 */
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
function nextStatus(status) {
  if (status === 'pendente') return 'em_andamento';
  if (status === 'em_andamento') return 'concluida';
  return null;
}

<<<<<<< HEAD
/**
 * Converte um valor de string (ex: 'em_andamento') para um label legível.
 * @param {string} value - O valor a ser convertido.
 * @returns {string} O label formatado.
 */
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
function toLabel(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

<<<<<<< HEAD
/**
 * Resolve o nome do responsável por um ID.
 * @param {object} db - O objeto do banco de dados.
 * @param {number} id - O ID do responsável.
 * @param {Map} funcionariosMap - Mapa de funcionários para lookup eficiente.
 * @returns {string} O nome do responsável ou 'Não definido'.
 */
function resolveResponsavel(db, id, funcionariosMap) {
  if (!id) return 'Não definido';
  return funcionariosMap.get(id)?.nome || 'Não definido';
}

/**
 * Resolve o vínculo da tarefa com lote/fazenda.
 * @param {object} db - O objeto do banco de dados.
 * @param {object} task - O objeto da tarefa.
 * @param {Map} lotesMap - Mapa de lotes para lookup eficiente.
 * @param {Map} fazendasMap - Mapa de fazendas para lookup eficiente.
 * @returns {string} A descrição do vínculo.
 */
function resolveVinculo(db, task, lotesMap, fazendasMap) {
  const lote = lotesMap.get(task.lote_id)?.nome;
  const fazenda = fazendasMap.get(task.fazenda_id)?.nome;
=======
function resolveResponsavel(db, id) {
  if (!id) return 'Não definido';
  return db.funcionarios?.find((item) => item.id === id)?.nome || 'Não definido';
}

function resolveVinculo(db, task) {
  const lote = db.lotes?.find((item) => item.id === task.lote_id)?.nome;
  const fazenda = db.fazendas?.find((item) => item.id === task.fazenda_id)?.nome;
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  if (lote && fazenda) return `${lote} / ${fazenda}`;
  return lote || fazenda || 'Geral';
}

<<<<<<< HEAD
/**
 * Formata uma string de data para exibição.
 * @param {string} dateStr - A string da data (YYYY-MM-DD).
 * @returns {string} A data formatada (DD/MM/YYYY) ou 'Sem data'.
 */
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
function formatDate(dateStr) {
  if (!dateStr) return 'Sem data';
  const [y, m, d] = String(dateStr).split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

<<<<<<< HEAD
/**
 * Verifica se uma tarefa está atrasada.
 * @param {string} dateStr - A string da data de vencimento.
 * @returns {boolean} True se a tarefa está atrasada, false caso contrário.
 */
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
function isOverdue(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

<<<<<<< HEAD
/**
 * Verifica se uma data está dentro de um período especificado.
 * @param {string} dateStr - A string da data.
 * @param {string} periodo - O período ('hoje', 'semana', 'atrasadas').
 * @returns {boolean} True se a data está no período, false caso contrário.
 */
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
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
<<<<<<< HEAD
    limit.setHours(0, 0, 0, 0); // Ensure limit is also at start of day
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
    return date >= now && date <= limit;
  }
  if (periodo === 'atrasadas') return date < now;
  return true;
}

<<<<<<< HEAD
/**
 * Retorna a variante de estilo para a prioridade.
 * @param {string} priority - A prioridade da tarefa.
 * @returns {string} A variante de estilo ('danger', 'warning', 'info', 'success').
 */
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
function priorityVariant(priority) {
  if (priority === 'critica') return 'danger';
  if (priority === 'alta') return 'warning';
  if (priority === 'media') return 'info';
  return 'success';
<<<<<<< HEAD
}
=======
}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
