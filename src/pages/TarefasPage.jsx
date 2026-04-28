import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input'; // Importar o componente Input
import { useToast } from '../hooks/useToast'; // Assumindo que você tem um hook de toast
import { useAuth } from '../auth/useAuth';
import {
  createOperationalRecord,
  deleteOperationalRecord,
  updateOperationalRecord,
} from '../services/operationalPersistence';
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

export default function TarefasPage({ db, setDb, onConfirmAction }) {
  const { showToast } = useToast();
  const { hasPermission, session } = useAuth();
  const mensagemSemPermissao = 'Você não tem permissão para executar esta ação.';
  const tarefas = Array.isArray(db?.tarefas) ? db.tarefas : [];
  const [openModal, setOpenModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filters, setFilters] = useState({
    prioridade: '',
    categoria: '',
    responsavel_id: '',
    periodo: '',
  });

  // Memoize maps for efficient lookups
  const funcionariosMap = useMemo(() => new Map((db.funcionarios || []).map(f => [f.id, f])), [db.funcionarios]);
  const lotesMap = useMemo(() => new Map((db.lotes || []).map(l => [l.id, l])), [db.lotes]);
  const fazendasMap = useMemo(() => new Map((db.fazendas || []).map(f => [f.id, f])), [db.fazendas]);

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
          .sort((a, b) => new Date(a.data_vencimento || '2999-12-31').getTime() - new Date(b.data_vencimento || '2999-12-31').getTime());
        return acc;
      }, {}),
    [tarefasFiltradas]
  );

  const resumo = useMemo(() => ({
    total: tarefasFiltradas.length,
    atrasadas: tarefasFiltradas.filter((task) => isOverdue(task.data_vencimento) && task.status !== 'concluida').length,
    concluidas: tarefasFiltradas.filter((task) => task.status === 'concluida').length,
  }), [tarefasFiltradas]);

  const openNewTask = useCallback(() => {
    if (!hasPermission('tarefas:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    setEditingTask(null);
    setOpenModal(true);
  }, [hasPermission, showToast]);

  const openEditTask = useCallback((task) => {
    if (!hasPermission('tarefas:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    setEditingTask(task);
    setOpenModal(true);
  }, [hasPermission, showToast]);

  const handleSave = useCallback(async (formData) => {
    if (!hasPermission('tarefas:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    if (editingTask) {
      const persisted = await updateOperationalRecord('tarefas', editingTask.id, formData, session);
      setDb((prev) => {
        const lista = Array.isArray(prev?.tarefas) ? prev.tarefas : [];
        return {
          ...prev,
          tarefas: lista.map((item) => (item.id === editingTask.id ? { ...item, ...(persisted.data || formData) } : item)),
        };
      });
      if (!persisted.persisted) {
        showToast({ type: 'warning', message: 'Tarefa atualizada apenas localmente.' });
      }
    } else {
      const payload = {
        ...formData,
        created_at: new Date().toISOString(),
      };
      const persisted = await createOperationalRecord('tarefas', payload, session);
      setDb((prev) => {
        const lista = Array.isArray(prev?.tarefas) ? prev.tarefas : [];
        return {
          ...prev,
          tarefas: [
            ...lista,
            {
              ...payload,
              ...(persisted.data || {}),
              id: persisted.data?.id ?? getNextId(lista),
            },
          ],
        };
      });
      if (!persisted.persisted) {
        showToast({ type: 'warning', message: 'Tarefa criada apenas localmente.' });
      }
    }
    showToast({ type: 'success', message: `Tarefa "${formData.titulo}" salva com sucesso!` });
    setOpenModal(false);
  }, [editingTask, hasPermission, session, setDb, showToast]);

  const handleDelete = useCallback(async (task) => {
    if (!hasPermission('tarefas:excluir')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    const canDelete = onConfirmAction
      ? await onConfirmAction({
          title: 'Excluir tarefa',
          message: `Deseja realmente excluir "${task.titulo}"?`,
          tone: 'danger',
        })
      : window.confirm(`Deseja realmente excluir "${task.titulo}"?`);

    if (!canDelete) return;

    const persisted = await deleteOperationalRecord('tarefas', task.id, session);
    setDb((prev) => ({
      ...prev,
      tarefas: (prev?.tarefas || []).filter((item) => item.id !== task.id),
    }));
    if (!persisted.persisted) {
      showToast({ type: 'warning', message: 'Exclusão salva apenas localmente.' });
    }
    showToast({ type: 'success', message: `Tarefa "${task.titulo}" excluída com sucesso.` });
  }, [hasPermission, onConfirmAction, session, setDb, showToast]);

  const moveToNextStatus = useCallback(async (task) => {
    if (!hasPermission('tarefas:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    const next = nextStatus(task.status);
    if (!next) {
      showToast({ type: 'info', message: 'Esta tarefa já está no último status ou não pode avançar.' });
      return;
    }

    const persisted = await updateOperationalRecord('tarefas', task.id, { status: next }, session);
    setDb((prev) => ({
      ...prev,
      tarefas: (prev?.tarefas || []).map((item) =>
        item.id === task.id
          ? {
              ...item,
              ...(persisted.data || {}),
              status: persisted.data?.status || next,
            }
          : item
      ),
    }));
    if (!persisted.persisted) {
      showToast({ type: 'warning', message: 'Status salvo apenas localmente.' });
    }
    showToast({ type: 'success', message: `Tarefa "${task.titulo}" movida para "${toLabel(next)}".` });
  }, [hasPermission, session, setDb, showToast]);

  return (
    <div className="tarefas-page">
      <header className="page-header">
        <h1>Gestão de Tarefas</h1>
        <p>Organize e acompanhe as atividades da sua fazenda.</p>
        <Button icon={<Plus size={16} />} onClick={openNewTask}>Nova Tarefa</Button>
      </header>

      <div className="dashboard-grid dashboard-grid--kpi-main">
        <Card title="Em foco">
          <div className="animais-kpi-value">{resumo.total}</div>
          <p className="animais-kpi-sub">Tarefas considerando os filtros aplicados</p>
        </Card>
        <Card title="Atrasadas">
          <div className="animais-kpi-value">{resumo.atrasadas}</div>
          <p className="animais-kpi-sub">Exigem atencao imediata</p>
        </Card>
        <Card title="Concluidas">
          <div className="animais-kpi-value">{resumo.concluidas}</div>
          <p className="animais-kpi-sub">Ja resolvidas neste quadro</p>
        </Card>
      </div>

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
    </div>
  );
}

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
function TaskForm({ open, initialData, onSave, onCancel, funcionariosMap, lotesMap, fazendasMap }) {
  const { showToast } = useToast();
  const [form, setForm] = useState(initialData || EMPTY_TASK);
  const [errors, setErrors] = useState({});

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setForm(initialData || EMPTY_TASK);
    setErrors({}); // Reset errors when initialData changes
  }, [initialData]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
            <option value="">Não definido</option>
            {funcionarios.map((item) => <option key={item.id} value={String(item.id)}>{item.nome}</option>)}
          </select>
        </label>
        <label className="ui-input-wrap">
          <span className="ui-input-label">Lote</span>
          <select className="ui-input" value={String(form.lote_id || '')} onChange={(e) => setForm((prev) => ({ ...prev, lote_id: e.target.value }))}>
            <option value="">Sem lote</option>
            {lotes.map((item) => <option key={item.id} value={String(item.id)}>{item.nome}</option>)}
          </select>
        </label>
        <label className="ui-input-wrap">
          <span className="ui-input-label">Fazenda</span>
          <select className="ui-input" value={String(form.fazenda_id || '')} onChange={(e) => setForm((prev) => ({ ...prev, fazenda_id: e.target.value }))}>
            <option value="">Sem fazenda</option>
            {fazendas.map((item) => <option key={item.id} value={String(item.id)}>{item.nome}</option>)}
          </select>
        </label>
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
function getNextId(items) {
  return items.reduce((max, item) => Math.max(max, Number(item.id || 0)), 0) + 1;
}

/**
 * Determina o próximo status de uma tarefa.
 * @param {string} status - O status atual da tarefa.
 * @returns {string|null} O próximo status ou null se não houver.
 */
function nextStatus(status) {
  if (status === 'pendente') return 'em_andamento';
  if (status === 'em_andamento') return 'concluida';
  return null;
}

/**
 * Converte um valor de string (ex: 'em_andamento') para um label legível.
 * @param {string} value - O valor a ser convertido.
 * @returns {string} O label formatado.
 */
function toLabel(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

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
  if (lote && fazenda) return `${lote} / ${fazenda}`;
  return lote || fazenda || 'Geral';
}

/**
 * Formata uma string de data para exibição.
 * @param {string} dateStr - A string da data (YYYY-MM-DD).
 * @returns {string} A data formatada (DD/MM/YYYY) ou 'Sem data'.
 */
function formatDate(dateStr) {
  if (!dateStr) return 'Sem data';
  const [y, m, d] = String(dateStr).split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

/**
 * Verifica se uma tarefa está atrasada.
 * @param {string} dateStr - A string da data de vencimento.
 * @returns {boolean} True se a tarefa está atrasada, false caso contrário.
 */
function isOverdue(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

/**
 * Verifica se uma data está dentro de um período especificado.
 * @param {string} dateStr - A string da data.
 * @param {string} periodo - O período ('hoje', 'semana', 'atrasadas').
 * @returns {boolean} True se a data está no período, false caso contrário.
 */
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
    limit.setHours(0, 0, 0, 0); // Ensure limit is also at start of day
    return date >= now && date <= limit;
  }
  if (periodo === 'atrasadas') return date < now;
  return true;
}

/**
 * Retorna a variante de estilo para a prioridade.
 * @param {string} priority - A prioridade da tarefa.
 * @returns {string} A variante de estilo ('danger', 'warning', 'info', 'success').
 */
function priorityVariant(priority) {
  if (priority === 'critica') return 'danger';
  if (priority === 'alta') return 'warning';
  if (priority === 'media') return 'info';
  return 'success';
}
