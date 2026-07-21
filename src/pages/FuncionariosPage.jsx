import { useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import PageHeader from '../components/PageHeader';
import FuncionarioModal from '../components/funcionarios/FuncionarioModal';
import FuncionarioRow from '../components/funcionarios/FuncionarioRow';
import { gerarNovoId } from '../utils/id';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../auth/useAuth';
import {
  createOperationalRecord,
  updateOperationalRecord,
} from '../services/operationalPersistence';

/**
 * Página de Funcionários, para gestão de colaboradores.
 *
 * @param {object} props - As propriedades do componente.
 * @param {object} props.db - O objeto do banco de dados.
 * @param {function} props.setDb - Função para atualizar o banco de dados.
 * @param {function} [props.onConfirmAction] - Callback opcional para ações de confirmação.
 */
export default function FuncionariosPage({ db, setDb, onConfirmAction }) {
  const { showToast } = useToast();
  const { session } = useAuth();

  const [openModal, setOpenModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('ativos');

  const funcionarios = useMemo(() => (Array.isArray(db?.funcionarios) ? db.funcionarios : []), [db]);
  const fazendas = useMemo(() => (Array.isArray(db?.fazendas) ? db.fazendas : []), [db]);

  // Pré-indexar fazendas para busca eficiente de nomes
  const fazendasMap = useMemo(() => {
    return new Map(fazendas.map(f => [f.id, f]));
  }, [fazendas]);

  // Lista de funcionários filtrada e memoizada
  const lista = useMemo(() => {
    return funcionarios
      .filter((f) => {
        const s = f.status || 'ativo';
        if (status === 'todos') return true;
        if (status === 'ativos') return s === 'ativo';
        return ['inativo', 'desligado'].includes(s);
      })
      .filter((f) => {
        const termo = busca.trim().toLowerCase();
        if (!termo) return true;
        return `${f.nome || ''} ${f.cargo || ''}`.toLowerCase().includes(termo);
      });
  }, [funcionarios, busca, status]);

  /**
   * Retorna o nome da fazenda dado o seu ID.
   * Usa o mapa de fazendas para eficiência.
   * @param {number} id - O ID da fazenda.
   * @returns {string} O nome da fazenda ou '—' se não encontrada.
   */
  function getNomeFazenda(id) {
    return fazendasMap.get(Number(id))?.nome || '—';
  }

  /**
   * Salva um novo funcionário ou atualiza um existente.
   * @param {object} payload - Os dados do funcionário a serem salvos.
   */
  async function salvarFuncionario(payload) {
    if (editando) {
      const persisted = await updateOperationalRecord('funcionarios', editando.id, payload, session);
      if (!persisted.persisted) {
        showToast({ type: 'warning', message: persisted.error || 'Não foi possível confirmar a alteração agora.' });
        return;
      }
      setDb((prev) => ({
        ...prev,
        funcionarios: prev.funcionarios.map((f) =>
          f.id === editando.id ? { ...f, ...(persisted.data || payload) } : f
        ),
      }));
      showToast({ type: 'success', message: 'Funcionário atualizado com sucesso!' });
    } else {
      const persisted = await createOperationalRecord('funcionarios', payload, session);
      if (!persisted.persisted) {
        showToast({ type: 'warning', message: persisted.error || 'Não foi possível confirmar o cadastro agora.' });
        return;
      }
      setDb((prev) => ({
        ...prev,
        funcionarios: [
          ...prev.funcionarios,
          {
            ...payload,
            ...(persisted.data || {}),
            id: persisted.data?.id ?? gerarNovoId(prev.funcionarios),
          },
        ],
      }));
      showToast({ type: 'success', message: 'Funcionário adicionado com sucesso!' });
    }
    setOpenModal(false);
    setEditando(null);
  }

  /**
   * Exclui um funcionário após confirmação.
   * @param {number} id - O ID do funcionário a ser excluído.
   */
  async function atualizarStatusFuncionario(funcionario, novoStatus, mensagemConfirmacao) {
    const confirmado = typeof onConfirmAction === 'function'
      ? await onConfirmAction({ title: 'Confirmar ação', message: mensagemConfirmacao, tone: 'warning' })
      : window.confirm(mensagemConfirmacao);
    if (!confirmado) return;
    const persisted = await updateOperationalRecord('funcionarios', funcionario.id, { status: novoStatus }, session);
    if (!persisted.persisted) {
      showToast({ type: 'warning', message: persisted.error || 'Não foi possível confirmar a alteração agora.' });
      return;
    }
    setDb((prev) => ({ ...prev, funcionarios: (prev.funcionarios || []).map((f) => (f.id === funcionario.id ? { ...f, ...(persisted.data || { status: novoStatus }) } : f)) }));
  }

  return (
    <div className="page page--funcionarios">
      <PageHeader
        title="Funcionários"
        subtitle="Cadastro de quem trabalha na fazenda e pode ser responsável por tarefas, manejo sanitário e rotinas. Para quem acessa o sistema, use Equipe e Acessos."
        actions={<Button onClick={() => { setEditando(null); setOpenModal(true); }}>Novo funcionário</Button>}
      />

      <div className="filters-bar ui-card"> {/* Usando ui-card para a barra de filtros */}
        <input className="ui-input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou cargo" />
        <select className="ui-input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ativos">Ativos</option>
          <option value="inativos_desligados">Inativos/desligados</option>
          <option value="todos">Todos</option>
        </select>
      </div>

      <div className="ui-card no-padding funcionarios-list-shell"> {/* Adicionada classe no-padding para remover padding padrão */}
        {lista.length === 0 ? (
          <div className="empty-state padded"> {/* Adicionada classe padded para padding interno */}
            <p>{status === 'ativos' ? 'Nenhum funcionário ativo.' : status === 'inativos_desligados' ? 'Nenhum funcionário inativo/desligado.' : 'Nenhum funcionário encontrado.'}</p>
            <span>Ajuste os filtros ou adicione um novo funcionário.</span>
          </div>
        ) : (
          lista.map((funcionario) => (
            <FuncionarioRow
              key={funcionario.id}
              funcionario={funcionario}
              fazendaNome={getNomeFazenda(funcionario.fazenda_id)}
              onEdit={() => { setEditando(funcionario); setOpenModal(true); }}
              onDesativar={() => atualizarStatusFuncionario(funcionario, 'inativo', 'O funcionário continuará no histórico, mas não aparecerá como ativo.')}
              onReativar={() => atualizarStatusFuncionario(funcionario, 'ativo', 'Deseja reativar este funcionário?')}
              onDesligar={() => atualizarStatusFuncionario(funcionario, 'desligado', 'Deseja marcar este funcionário como desligado?')}
            />
          ))
        )}
      </div>

      <FuncionarioModal
        open={openModal}
        initialData={editando}
        fazendas={fazendas}
        onSave={salvarFuncionario}
        onCancel={() => { setOpenModal(false); setEditando(null); }}
      />
    </div>
  );
}
