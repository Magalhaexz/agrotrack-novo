import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, FileText, Plus, X } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { normalizarPerfil, obterLabelPerfil, perfilPodeGerenciarAcessos } from '../auth/perfis';
import { supabase } from '../lib/supabase'; // Assumindo que supabase estÃ¡ configurado
import { useAuth } from '../auth/useAuth';
import { useToast } from '../hooks/useToast'; // Importa o hook de toast
import { createInvite, deleteInvite, isAccessModuleUnavailable, listInvites, listProfiles, updateInvite } from '../services/userAccess';
import { gerarNovoId } from '../utils/id'; // Importa a funÃ§Ã£o de gerar ID
import { normalizeBackupPayload } from '../utils/backupValidation';
import {
  createAuditEvent,
  createOperationalRecord,
  deleteOwnerScopedCollection,
  deleteOperationalRecord,
  updateOperationalRecord,
  upsertOperationalRecord,
} from '../services/operationalPersistence';
import '../styles/configuracoes.css';

const TABS = [
  { id: 'geral', label: 'Geral' },
  { id: 'notificacoes', label: 'NotificaÃ§Ãµes' },
  { id: 'acessos', label: 'UsuÃ¡rios e Acessos' },
  { id: 'dados', label: 'Dados e SeguranÃ§a' },
];

/**
 * PÃ¡gina de ConfiguraÃ§Ãµes da aplicaÃ§Ã£o.
 * Permite gerenciar parÃ¢metros globais, preferÃªncias de notificaÃ§Ã£o,
 * acessos de usuÃ¡rios e operaÃ§Ãµes de dados (exportar/importar/limpar).
 *
 * @param {object} props - As propriedades do componente.
 * @param {object} props.db - O objeto do banco de dados.
 * @param {function} props.setDb - FunÃ§Ã£o para atualizar o banco de dados.
 * @param {function} [props.onConfirmAction] - FunÃ§Ã£o para exibir um modal de confirmaÃ§Ã£o customizado.
 */
export default function ConfiguracoesPage({ db, setDb, onConfirmAction }) {
  const { perfil, user, session, hasPermission } = useAuth();
  const { showToast } = useToast(); // Hook para exibir toasts
  const [tab, setTab] = useState('geral');
  const [openInvite, setOpenInvite] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const fileInputRef = useRef(null);
  const [profilesRows, setProfilesRows] = useState([]);
  const [invitesRows, setInvitesRows] = useState([]);
  const [loadingAccessData, setLoadingAccessData] = useState(false);
  const [accessModuleReady, setAccessModuleReady] = useState(false);

  const configGeral = db?.configuracoes?.geral || {};
  const configNotificacoes = db?.configuracoes?.notificacoes || {};

  const [geral, setGeral] = useState({
    nome_sistema: configGeral.nome_sistema || 'HERDON',
    moeda: configGeral.moeda || 'BRL',
    formato_data: configGeral.formato_data || 'DD/MM/AAAA',
    unidade_peso: configGeral.unidade_peso || 'kg',
    rendimento_carcaca_padrao: configGeral.rendimento_carcaca_padrao ?? 52,
    preco_arroba_padrao: configGeral.preco_arroba_padrao ?? 290,
  });

  const [notificacoes, setNotificacoes] = useState({
    estoque_critico: configNotificacoes.estoque_critico ?? true,
    sanitario_vencido: configNotificacoes.sanitario_vencido ?? true,
    pesagem_atrasada: configNotificacoes.pesagem_atrasada ?? true,
    lote_data_saida: configNotificacoes.lote_data_saida ?? true,
    dias_antecedencia: configNotificacoes.dias_antecedencia ?? 3,
  });
  const podeGerenciarAcessos = perfilPodeGerenciarAcessos(perfil);
  const mensagemSemPermissao = 'VocÃª nÃ£o tem permissÃ£o para executar esta aÃ§Ã£o.';
  const usuariosFallback = useMemo(
    () => (db.usuarios || []).map((item) => ({ ...item, perfil: normalizarPerfil(item.perfil) })),
    [db.usuarios]
  );
  const invitesPendentes = useMemo(
    () => invitesRows.filter((invite) => ['pendente', 'enviado'].includes(String(invite?.status || '').toLowerCase())),
    [invitesRows]
  );
  const invitesCanceladosExpirados = useMemo(
    () => invitesRows.filter((invite) => ['cancelado', 'expirado'].includes(String(invite?.status || '').toLowerCase())),
    [invitesRows]
  );
  const invitesAceitos = useMemo(
    () => invitesRows.filter((invite) => String(invite?.status || '').toLowerCase() === 'aceito' || Boolean(invite?.used_at)),
    [invitesRows]
  );
  const totalAdminsAtivosFallback = useMemo(
    () => usuariosFallback.filter((item) => ['admin', 'proprietario'].includes(String(item?.perfil || '').toLowerCase()) && String(item?.status || 'ativo') === 'ativo').length,
    [usuariosFallback]
  );

  function validarPermissao(permissao) {
    if (hasPermission(permissao)) return true;
    showToast({ type: 'error', message: mensagemSemPermissao });
    return false;
  }

  function mensagemErroSegura(error, fallbackMessage) {
    const message = String(error?.message || '').toLowerCase();
    const status = Number(error?.status || error?.code || 0);

    if (status === 406 || message.includes('cannot coerce the result to a single json object')) {
      return 'Não foi possível atualizar o convite. Atualize a lista e tente novamente.';
    }

    if (
      message.includes('jwt')
      || message.includes('token')
      || message.includes('permission')
      || message.includes('rls')
      || message.includes('auth')
      || message.includes('failed to fetch')
    ) {
      return fallbackMessage;
    }

    return error?.message || fallbackMessage;
  }

  function registrarEventoAuditoria(evento) {
    void createAuditEvent({
      ...evento,
      usuario_id: user?.id || null,
    }, session).then((result) => {
      if (!result?.persisted && import.meta.env.DEV) {
        if (import.meta.env.DEV) {
          console.warn('[HERDON_AUDITORIA_FALLBACK]', result?.error || 'Falha ao persistir auditoria.');
        }
      }
    });
  }

  const carregarDadosDeAcesso = useCallback(async () => {
    if (!podeGerenciarAcessos) {
      return;
    }

    setLoadingAccessData(true);

    const [profilesResponse, invitesResponse] = await Promise.all([listProfiles(), listInvites()]);

    if (profilesResponse.error || invitesResponse.error) {
      const erro = profilesResponse.error || invitesResponse.error;

      if (!isAccessModuleUnavailable(erro)) {
        showToast({ type: 'error', message: erro.message || 'Nao foi possivel carregar usuarios e convites.' });
      }

      setAccessModuleReady(false);
      setProfilesRows([]);
      setInvitesRows([]);
      setLoadingAccessData(false);
      return;
    }

    setProfilesRows(profilesResponse.data || []);
    setInvitesRows(invitesResponse.data || []);
    setAccessModuleReady(true);
    setLoadingAccessData(false);
  }, [podeGerenciarAcessos, showToast]);

  async function cancelarConvite(invite) {
    if (!validarPermissao('acessos:gerenciar')) return;
    const confirmar = onConfirmAction
      ? await onConfirmAction({ title: 'Cancelar convite', message: `Deseja cancelar o convite de ${invite.email}?`, tone: 'danger' })
      : window.confirm(`Deseja cancelar o convite de ${invite.email}?`);
    if (!confirmar) return;
    const { error } = await updateInvite(invite.id, { status: 'cancelado' });
    if (error) {
      showToast({ type: 'error', message: mensagemErroSegura(error, 'Não foi possível cancelar o convite.') });
      return;
    }
    setInvitesRows((prev) => prev.map((item) => (item.id === invite.id ? { ...item, status: 'cancelado' } : item)));
    showToast({ type: 'success', message: 'Convite cancelado com sucesso.' });
    try {
      await carregarDadosDeAcesso();
    } catch {
      showToast({ type: 'warning', message: 'Convite atualizado, mas não foi possível recarregar a lista agora.' });
    }
  }

  async function removerConvitePendente(invite) {
    if (!validarPermissao('acessos:gerenciar')) return;
    if (String(invite.status || '').toLowerCase() === 'aceito' || invite.used_at) {
      showToast({ type: 'warning', message: 'Este convite já foi aceito. Para remover acesso, altere o usuário.' });
      return;
    }
    const confirmar = onConfirmAction
      ? await onConfirmAction({ title: 'Remover convite pendente', message: `Remover convite pendente de ${invite.email}?`, tone: 'danger' })
      : window.confirm(`Remover convite pendente de ${invite.email}?`);
    if (!confirmar) return;
    const { error } = await deleteInvite(invite.id);
    if (error) {
      showToast({ type: 'error', message: mensagemErroSegura(error, 'Não foi possível remover o convite.') });
      return;
    }
    setInvitesRows((prev) => prev.filter((item) => item.id !== invite.id));
    showToast({ type: 'success', message: 'Convite pendente removido com sucesso.' });
    try {
      await carregarDadosDeAcesso();
    } catch {
      showToast({ type: 'warning', message: 'Convite removido, mas não foi possível recarregar a lista agora.' });
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void carregarDadosDeAcesso();
  }, [carregarDadosDeAcesso]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function salvarGeral() {
    if (!validarPermissao('configuracoes:editar')) return;
    if (!geral.nome_sistema.trim()) {
      showToast({ type: 'error', message: 'Nome do sistema/empresa Ã© obrigatÃ³rio.' });
      return;
    }

    const geralPayload = {
      ...geral,
      rendimento_carcaca_padrao: Number(geral.rendimento_carcaca_padrao || 0),
      preco_arroba_padrao: Number(geral.preco_arroba_padrao || 0),
    };
    const persisted = await upsertOperationalRecord('configuracoes', {
      id: db?.configuracoes?.id,
      owner_user_id: user?.id || null,
      geral: geralPayload,
      notificacoes: db?.configuracoes?.notificacoes || {},
    }, user ? { user } : null);
    setDb((prev) => ({
      ...prev,
      configuracoes: {
        ...prev.configuracoes,
        ...(persisted.data || {}),
        geral: geralPayload,
      },
    }));
    if (!persisted.persisted) {
      showToast({ type: 'warning', message: 'ConfiguraÃ§Ãµes gerais salvas apenas localmente.' });
    }
    registrarEventoAuditoria({
      acao: 'configuracoes_gerais_salvas',
      entidade: 'configuracoes',
      entidade_id: persisted.data?.id ?? db?.configuracoes?.id ?? null,
      criticidade: 'media',
      detalhes: { persistido: persisted.persisted },
    });

    showToast({ type: 'success', message: 'ConfiguraÃ§Ãµes gerais salvas com sucesso.' });
  }

  async function salvarNotificacoes() {
    if (!validarPermissao('configuracoes:editar')) return;
    if (Number(notificacoes.dias_antecedencia) < 0) {
      showToast({ type: 'error', message: 'Dias de antecedÃªncia deve ser maior ou igual a zero.' });
      return;
    }

    const notificacoesPayload = {
      ...notificacoes,
      dias_antecedencia: Number(notificacoes.dias_antecedencia || 0),
    };
    const persisted = await upsertOperationalRecord('configuracoes', {
      id: db?.configuracoes?.id,
      owner_user_id: user?.id || null,
      geral: db?.configuracoes?.geral || {},
      notificacoes: notificacoesPayload,
    }, user ? { user } : null);
    setDb((prev) => ({
      ...prev,
      configuracoes: {
        ...prev.configuracoes,
        ...(persisted.data || {}),
        notificacoes: notificacoesPayload,
      },
    }));
    if (!persisted.persisted) {
      showToast({ type: 'warning', message: 'NotificaÃ§Ãµes salvas apenas localmente.' });
    }
    registrarEventoAuditoria({
      acao: 'configuracoes_notificacoes_salvas',
      entidade: 'configuracoes',
      entidade_id: persisted.data?.id ?? db?.configuracoes?.id ?? null,
      criticidade: 'media',
      detalhes: { persistido: persisted.persisted },
    });

    showToast({ type: 'success', message: 'PreferÃªncias de notificaÃ§Ã£o salvas com sucesso.' });
  }

  function exportarDados() {
    const payload = {
      app: 'Herdon',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: db,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `herdon-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast({ type: 'success', message: 'Backup exportado com sucesso.' });
  }

  async function importarDados(event) {
    if (!validarPermissao('dados:importar')) {
      event.target.value = '';
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        const normalized = normalizeBackupPayload(parsed, { currentUserId: user?.id || null });

        if (!normalized.ok) {
          registrarEventoAuditoria({
            acao: 'backup_importado_invalido',
            entidade: 'backup',
            criticidade: 'alta',
            detalhes: { motivo: 'payload_invalido' },
          });
          showToast({ type: 'error', message: 'Arquivo de backup invÃ¡lido. Verifique o arquivo e tente novamente.' });
          return;
        }

        const confirmarImportacao = onConfirmAction
          ? await onConfirmAction({
              title: 'Importar backup validado',
              message: 'O backup serÃ¡ aplicado localmente. A sincronizaÃ§Ã£o completa com a nuvem requer confirmaÃ§Ã£o adicional. Deseja continuar?',
              tone: 'danger',
            })
          : window.confirm('O backup serÃ¡ aplicado localmente. A sincronizaÃ§Ã£o completa com a nuvem requer confirmaÃ§Ã£o adicional. Deseja continuar?');

        if (!confirmarImportacao) {
          showToast({ type: 'info', message: 'ImportaÃ§Ã£o cancelada pelo usuÃ¡rio.' });
          return;
        }

        setDb(normalized.data);

        const houveImportacaoParcial = normalized.summary.invalidRecords > 0
          || normalized.summary.skippedByOwner > 0
          || normalized.summary.nonArrayCollections > 0
          || normalized.summary.unknownTopLevelKeys > 0;

        if (houveImportacaoParcial) {
          registrarEventoAuditoria({
            acao: 'backup_importado_parcial',
            entidade: 'backup',
            criticidade: 'media',
            detalhes: normalized.summary,
          });
          showToast({
            type: 'warning',
            message: 'Backup validado localmente. Alguns registros invÃ¡lidos foram ignorados. A sincronizaÃ§Ã£o completa com a nuvem requer confirmaÃ§Ã£o adicional.',
          });
          return;
        }

        registrarEventoAuditoria({
          acao: 'backup_importado_local',
          entidade: 'backup',
          criticidade: 'media',
          detalhes: normalized.summary,
        });
        showToast({ type: 'warning', message: 'Backup validado localmente. A sincronizaÃ§Ã£o completa com a nuvem requer confirmaÃ§Ã£o adicional.' });
      } catch {
        registrarEventoAuditoria({
          acao: 'backup_importado_invalido',
          entidade: 'backup',
          criticidade: 'alta',
          detalhes: { motivo: 'json_invalido' },
        });
        showToast({ type: 'error', message: 'Arquivo de backup invÃ¡lido. Verifique o arquivo e tente novamente.' });
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Limpa o input de arquivo
  }

  async function limparDadosDemo() {
    if (!validarPermissao('dados:limpar')) return;
    const ok = onConfirmAction
      ? await onConfirmAction({ title: 'Limpar demonstraÃ§Ã£o', message: 'Remover dados fictÃ­cios do ambiente?', tone: 'danger' })
      : window.confirm('Remover dados fictÃ­cios do ambiente?');

    if (!ok) return;

    const confirmarLocal = onConfirmAction
      ? await onConfirmAction({
          title: 'Confirmar limpeza local',
          message: 'Esta limpeza afeta apenas os dados locais em memÃ³ria. Deseja continuar?',
          tone: 'danger',
        })
      : window.confirm('Esta limpeza afeta apenas os dados locais em memÃ³ria. Deseja continuar?');

    if (!confirmarLocal) return;

    setDb((prev) => ({
      ...prev,
      lotes: [],
      animais: [],
      custos: [],
      estoque: [],
      sanitario: [],
      rotinas: [],
      tarefas: [],
      pesagens: [],
      movimentacoes_animais: [],
      movimentacoes_estoque: [],
      movimentacoes_financeiras: [],
      // Manter configuraÃ§Ãµes e usuÃ¡rios
    }));

    const colecoesLimpeza = [
      'lotes',
      'animais',
      'custos',
      'estoque',
      'sanitario',
      'rotinas',
      'tarefas',
      'pesagens',
      'movimentacoes_animais',
      'movimentacoes_estoque',
      'movimentacoes_financeiras',
      'suplementacao',
      'dietas',
      'consumo_suplementacao',
      'eventos_operacionais',
    ];
    const resultadosLimpeza = await Promise.all(
      colecoesLimpeza.map((table) => deleteOwnerScopedCollection(table, session))
    );
    const houveFalhaPersistencia = resultadosLimpeza.some((item) => !item?.persisted);
    registrarEventoAuditoria({
      acao: 'limpeza_dados_operacionais',
      entidade: 'dados',
      criticidade: 'alta',
      detalhes: {
        escopo: 'demo_operacional',
        tabelas: colecoesLimpeza,
        persistido: !houveFalhaPersistencia,
      },
    });

    if (houveFalhaPersistencia) {
      showToast({ type: 'warning', message: 'Dados locais removidos. Parte da limpeza remota nÃ£o foi concluÃ­da.' });
      return;
    }
    showToast({ type: 'success', message: 'Dados de demonstraÃ§Ã£o removidos localmente e na nuvem.' });
  }

  async function excluirConta() {
    if (confirmText !== 'CONFIRMAR') {
      showToast({ type: 'error', message: 'Digite CONFIRMAR para prosseguir.' });
      return;
    }

    const confirmado = onConfirmAction
      ? await onConfirmAction({
          title: 'Excluir conta',
          message: 'Esta aÃ§Ã£o Ã© irreversÃ­vel. Deseja realmente continuar?',
          tone: 'danger',
        })
      : window.confirm('Esta aÃ§Ã£o Ã© irreversÃ­vel. Deseja realmente continuar?');

    if (!confirmado) return;

    // SimulaÃ§Ã£o de exclusÃ£o de conta no backend/auth
    await supabase.auth.signOut(); // Desloga o usuÃ¡rio localmente
    showToast({ type: 'success', message: 'Conta encerrada no app local. (Fluxo remoto deve ser conectado ao backend).' });
    // Em um ambiente real, aqui vocÃª chamaria uma API para excluir a conta do usuÃ¡rio no backend.
  }

  return (
    <div className="config-page">
      <header>
        <h1>ConfiguraÃ§Ãµes</h1>
        <p>ParÃ¢metros globais, notificaÃ§Ãµes e seguranÃ§a dos dados.</p>
      </header>

      <div className="config-tabs">
        {TABS.filter((item) => (item.id === 'acessos' ? podeGerenciarAcessos : true)).map((item) => (
          <button key={item.id} type="button" className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'geral' ? (
        <Card title="Geral">
          <div className="config-grid">
            <label className="ui-input-wrap">
              <span className="ui-input-label">Nome do sistema / empresa</span>
              <input className="ui-input" value={geral.nome_sistema} onChange={(e) => setGeral((prev) => ({ ...prev, nome_sistema: e.target.value }))} />
            </label>
            <label className="ui-input-wrap">
              <span className="ui-input-label">Moeda padrÃ£o</span>
              <select className="ui-input" value={geral.moeda} onChange={(e) => setGeral((prev) => ({ ...prev, moeda: e.target.value }))}>
                <option value="BRL">R$ BRL</option>
                <option value="USD">$ USD</option>
              </select>
            </label>
            <label className="ui-input-wrap">
              <span className="ui-input-label">Formato de data</span>
              <select className="ui-input" value={geral.formato_data} onChange={(e) => setGeral((prev) => ({ ...prev, formato_data: e.target.value }))}>
                <option value="DD/MM/AAAA">DD/MM/AAAA</option>
                <option value="AAAA-MM-DD">AAAA-MM-DD</option>
              </select>
            </label>
            <label className="ui-input-wrap">
              <span className="ui-input-label">Unidade de peso padrÃ£o</span>
              <select className="ui-input" value={geral.unidade_peso} onChange={(e) => setGeral((prev) => ({ ...prev, unidade_peso: e.target.value }))}>
                <option value="kg">kg</option>
                <option value="arroba">@</option>
              </select>
            </label>
            <label className="ui-input-wrap">
              <span className="ui-input-label">Rendimento de carcaÃ§a padrÃ£o (%)</span>
              <input className="ui-input" type="number" min="0" max="100" value={geral.rendimento_carcaca_padrao} onChange={(e) => setGeral((prev) => ({ ...prev, rendimento_carcaca_padrao: e.target.value }))} />
            </label>
            <label className="ui-input-wrap">
              <span className="ui-input-label">PreÃ§o da arroba padrÃ£o (R$)</span>
              <input className="ui-input" type="number" min="0" step="0.01" value={geral.preco_arroba_padrao} onChange={(e) => setGeral((prev) => ({ ...prev, preco_arroba_padrao: e.target.value }))} />
            </label>
            </div>
          <div className="config-actions"><Button onClick={salvarGeral}>Salvar configuraÃ§Ãµes gerais</Button></div>
        </Card>
      ) : null}

      {tab === 'notificacoes' ? (
        <Card title="NotificaÃ§Ãµes">
          <div className="config-grid">
            <SwitchRow label="Alertas de estoque crÃ­tico" checked={notificacoes.estoque_critico} onChange={(value) => setNotificacoes((prev) => ({ ...prev, estoque_critico: value }))} />
            <SwitchRow label="Alertas de vacinas/manejos vencidos" checked={notificacoes.sanitario_vencido} onChange={(value) => setNotificacoes((prev) => ({ ...prev, sanitario_vencido: value }))} />
            <SwitchRow label="Alertas de pesagem atrasada" checked={notificacoes.pesagem_atrasada} onChange={(value) => setNotificacoes((prev) => ({ ...prev, pesagem_atrasada: value }))} />
            <SwitchRow label="Alertas de lote na data de saÃ­da prevista" checked={notificacoes.lote_data_saida} onChange={(value) => setNotificacoes((prev) => ({ ...prev, lote_data_saida: value }))} />
            <label className="ui-input-wrap">
              <span className="ui-input-label">Quantos dias antes avisar</span>
              <input className="ui-input" type="number" min="0" value={notificacoes.dias_antecedencia} onChange={(e) => setNotificacoes((prev) => ({ ...prev, dias_antecedencia: e.target.value }))} />
            </label>
          </div>
          <div className="config-actions"><Button onClick={salvarNotificacoes}>Salvar preferÃªncias de notificaÃ§Ã£o</Button></div>
        </Card>
      ) : null}

      {tab === 'acessos' && podeGerenciarAcessos ? (
        <Card
          title="UsuÃ¡rios e Acessos"
          action={<Button size="sm" icon={<Plus size={14} />} onClick={() => setOpenInvite(true)}>+ Convidar usuÃ¡rio</Button>}
        >
          <div className="config-actions-wrap" style={{ marginBottom: 16 }}>
            <Button variant="outline" onClick={carregarDadosDeAcesso} loading={loadingAccessData}>
              Atualizar lista
            </Button>
          </div>
          <p style={{ marginTop: 0, marginBottom: 12, color: 'var(--text-muted)' }}>
            UsuÃ¡rio = acesso ao sistema HERDON. FuncionÃ¡rio = pessoa da operaÃ§Ã£o da fazenda.
          </p>

          {accessModuleReady ? (
            <>
              <div className="table-responsive">
                <table className="dashboard-table">
                  <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil atual</th><th>Origem</th><th>Atualizado em</th></tr></thead>
                  <tbody>
                    {profilesRows.length === 0 ? (
                      <tr><td colSpan="5">Nenhum usuÃ¡rio ativo encontrado.</td></tr>
                    ) : (
                      profilesRows.map((item) => (
                        <tr key={item.id}>
                          <td>{item.nome || 'Sem nome'}</td>
                          <td>{item.email}</td>
                          <td><span className={badgeStatusClass(item.perfil)}>{obterLabelPerfil(item.perfil)}</span></td>
                          <td>profile</td>
                          <td>{item.updated_at ? new Date(item.updated_at).toLocaleString('pt-BR') : '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ height: 20 }} />

              <div className="table-responsive">
                <table className="dashboard-table">
                  <thead><tr><th>Convite</th><th>Perfil automÃ¡tico</th><th>Status</th><th>Uso</th><th>AÃ§Ãµes</th></tr></thead>
                  <tbody>
                    {invitesPendentes.length === 0 ? (
                      <tr><td colSpan="5">Nenhum convite pendente.</td></tr>
                    ) : (
                      invitesPendentes.map((invite) => (
                        <tr key={invite.id}>
                          <td>
                            <strong>{invite.nome || 'Convite sem nome'}</strong>
                            <div>{invite.email}</div>
                          </td>
                          <td><span className={badgeStatusClass(invite.perfil)}>{obterLabelPerfil(invite.perfil)}</span></td>
                          <td><span className={badgeStatusClass(invite.status)}>{invite.status}</span></td>
                          <td>{invite.used_at ? new Date(invite.used_at).toLocaleString('pt-BR') : '-'}</td>
                          <td>
                            <div className="config-actions-wrap">
                              {invite.status !== 'cancelado' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => cancelarConvite(invite)}
                                >
                                  Cancelar convite
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => removerConvitePendente(invite)}
                              >
                                Remover convite pendente
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ height: 20 }} />
              <div className="table-responsive">
                <table className="dashboard-table">
                  <thead><tr><th colSpan="5">Convites aceitos</th></tr></thead>
                  <tbody>
                    {invitesAceitos.length === 0 ? <tr><td colSpan="5">Nenhum convite aceito.</td></tr> : invitesAceitos.map((invite) => (
                      <tr key={invite.id}><td><strong>{invite.nome || 'Convite sem nome'}</strong><div>{invite.email}</div></td><td><span className={badgeStatusClass(invite.perfil)}>{obterLabelPerfil(invite.perfil)}</span></td><td><span className={badgeStatusClass(invite.status)}>{invite.status}</span></td><td>{invite.used_at ? new Date(invite.used_at).toLocaleString('pt-BR') : '-'}</td><td>Este convite jÃ¡ foi aceito. Para remover acesso, altere o usuÃ¡rio.</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ height: 20 }} />
              <div className="table-responsive">
                <table className="dashboard-table">
                  <thead><tr><th colSpan="5">Convites cancelados/expirados</th></tr></thead>
                  <tbody>
                    {invitesCanceladosExpirados.length === 0 ? <tr><td colSpan="5">Nenhum convite cancelado.</td></tr> : invitesCanceladosExpirados.map((invite) => (
                      <tr key={invite.id}><td><strong>{invite.nome || 'Convite sem nome'}</strong><div>{invite.email}</div></td><td><span className={badgeStatusClass(invite.perfil)}>{obterLabelPerfil(invite.perfil)}</span></td><td><span className={badgeStatusClass(invite.status)}>{invite.status}</span></td><td>{invite.used_at ? new Date(invite.used_at).toLocaleString('pt-BR') : '-'}</td><td><Button size="sm" variant="danger" onClick={() => removerConvitePendente(invite)}>Remover convite pendente</Button></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="empty-state empty-state--warning" style={{ marginBottom: 16 }}>
              <strong>MÃ³dulo de acessos aguardando migration</strong>
              <span>Rode o SQL de profiles e invites para ativar o gerenciamento automÃ¡tico de perfis.</span>
            </div>
          )}

          {!accessModuleReady ? (
          <div className="table-responsive">
            <table className="dashboard-table">
              <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil atual</th><th>Origem</th><th>Status</th><th>AÃ§Ãµes</th></tr></thead>
              <tbody>
                {usuariosFallback.map((item) => (
                  <tr key={item.id}>
                    <td>{item.nome}<div style={{ fontSize: 12, opacity: 0.75 }}>Acesso especial de bootstrap.</div></td>
                    <td>{item.email}</td>
                    <td>
                      <span className="badge badge-info" style={{ marginRight: 8 }}>{obterLabelPerfil(item.perfil)}</span>
                      <select
                        className="ui-input" // Adicionado classe ui-input
                        value={item.perfil}
                        onChange={async (e) => {
                          if (!validarPermissao('acessos:gerenciar')) return;
                          const novoPerfil = e.target.value;
                          const isSelf = String(item.id) === String(user?.id);
                          if (isSelf && novoPerfil !== 'admin') {
                            showToast({ type: 'warning', message: 'VocÃª nÃ£o pode rebaixar seu prÃ³prio perfil administrativo.' });
                            return;
                          }
                          const adminAtual = ['admin', 'proprietario'].includes(String(item.perfil || '').toLowerCase());
                          const adminNovo = ['admin', 'proprietario'].includes(String(novoPerfil || '').toLowerCase());
                          if (adminAtual && !adminNovo && totalAdminsAtivosFallback <= 1) {
                            showToast({ type: 'warning', message: 'NÃ£o Ã© possÃ­vel remover ou rebaixar o Ãºltimo administrador.' });
                            return;
                          }
                          const confirmarAlteracao = onConfirmAction
                            ? await onConfirmAction({ title: 'Alterar perfil', message: 'Alterar o perfil deste usuÃ¡rio pode limitar o acesso dele ao sistema. Deseja continuar?', tone: 'warning' })
                            : window.confirm('Alterar o perfil deste usuÃ¡rio pode limitar o acesso dele ao sistema. Deseja continuar?');
                          if (!confirmarAlteracao) {
                            return;
                          }
                          await updateOperationalRecord('usuarios', item.id, { perfil: novoPerfil }, user ? { user } : null);
                          registrarEventoAuditoria({
                            acao: 'usuario_fallback_perfil_atualizado',
                            entidade: 'usuarios',
                            entidade_id: item.id,
                            criticidade: 'alta',
                            detalhes: { perfil_anterior: item.perfil, perfil_novo: novoPerfil },
                          });
                          setDb((prev) => ({
                            ...prev,
                            usuarios: (prev.usuarios || []).map((u) => (u.id === item.id ? { ...u, perfil: novoPerfil } : u)),
                          }));
                        }}
                      >
                        <option value="admin">Admin</option>
                        <option value="gerente">Gerente</option>
                        <option value="operador">Operador</option>
                        <option value="visualizador">Visualizador</option>
                      </select>
                    </td>
                    <td>fallback/bootstrap</td>
                    <td>
                      <select
                        className="ui-input" // Adicionado classe ui-input
                        value={item.status}
                        onChange={(e) => {
                          if (!validarPermissao('acessos:gerenciar')) return;
                          const novoStatus = e.target.value;
                          const isSelf = String(item.id) === String(user?.id);
                          if (isSelf && novoStatus !== 'ativo') {
                            showToast({ type: 'warning', message: 'VocÃª nÃ£o pode remover seu prÃ³prio acesso.' });
                            return;
                          }
                          if (['admin', 'proprietario'].includes(String(item.perfil || '').toLowerCase()) && novoStatus !== 'ativo' && totalAdminsAtivosFallback <= 1) {
                            showToast({ type: 'warning', message: 'NÃ£o Ã© possÃ­vel remover ou rebaixar o Ãºltimo administrador.' });
                            return;
                          }
                          void updateOperationalRecord('usuarios', item.id, { status: novoStatus }, user ? { user } : null);
                          registrarEventoAuditoria({
                            acao: 'usuario_fallback_status_atualizado',
                            entidade: 'usuarios',
                            entidade_id: item.id,
                            criticidade: 'alta',
                            detalhes: { status_anterior: item.status, status_novo: novoStatus },
                          });
                          setDb((prev) => ({
                            ...prev,
                            usuarios: (prev.usuarios || []).map((u) => (u.id === item.id ? { ...u, status: novoStatus } : u)),
                          }));
                        }}
                      >
                        <option value="ativo">Ativo</option>
                        <option value="inativo">Inativo</option>
                      </select>
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={async () => {
                          if (!validarPermissao('acessos:gerenciar')) return;
                          if (String(item.id) === String(user?.id)) {
                            showToast({ type: 'warning', message: 'VocÃª nÃ£o pode remover seu prÃ³prio acesso.' });
                            return;
                          }
                          if (['admin', 'proprietario'].includes(String(item.perfil || '').toLowerCase()) && totalAdminsAtivosFallback <= 1) {
                            showToast({ type: 'warning', message: 'NÃ£o Ã© possÃ­vel remover ou rebaixar o Ãºltimo administrador.' });
                            return;
                          }
                          const confirmarRemocaoLocal = onConfirmAction
                            ? await onConfirmAction({
                                title: 'Remover usuÃ¡rio',
                                message: `Deseja remover ${item.nome} da base local?`,
                                tone: 'danger',
                              })
                            : window.confirm(`Deseja remover ${item.nome} da base local?`);

                          if (!confirmarRemocaoLocal) return;
                          void deleteOperationalRecord('usuarios', item.id, user ? { user } : null);
                          registrarEventoAuditoria({
                            acao: 'usuario_fallback_removido',
                            entidade: 'usuarios',
                            entidade_id: item.id,
                            criticidade: 'alta',
                            detalhes: { nome: item.nome, email: item.email },
                          });
                          setDb((prev) => ({ ...prev, usuarios: (prev.usuarios || []).filter((u) => u.id !== item.id) }));
                        }}
                      >
                        Remover
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          ) : null}
        </Card>
      ) : null}

      {tab === 'dados' ? (
        <Card title="Dados e SeguranÃ§a">
          <div className="config-data-stack">
            <div className="config-actions-wrap config-actions-wrap--data">
              <div className="config-panel-intro">
                <span className="config-panel-kicker">Backup e manutenÃ§Ã£o</span>
                <p>Exporte, importe e limpe dados de demonstraÃ§Ã£o com uma hierarquia visual mais clara e segura.</p>
              </div>
              <div className="config-action-cluster">
                <Button icon={<FileText size={14} />} onClick={exportarDados}>Exportar todos os dados</Button>
                <Button icon={<FileText size={14} />} variant="outline" onClick={() => fileInputRef.current?.click()}>Importar dados</Button>
                <input ref={fileInputRef} type="file" accept="application/json" onChange={importarDados} hidden />
            <Button icon={<X size={14} />} variant="outline" onClick={limparDadosDemo}>Limpar dados de demonstraÃ§Ã£o</Button>
              </div>
            </div>

            <div className="danger-zone danger-zone--settings">
              <div className="danger-zone-head">
                <h4><AlertTriangle size={14} /> Zona de perigo</h4>
                <span className="danger-zone-chip">Acao irreversivel</span>
              </div>
              <p>Para excluir conta, digite <strong>CONFIRMAR</strong>.</p>
              <div className="danger-zone-controls">
                <input className="ui-input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Digite CONFIRMAR" />
                <Button variant="danger" onClick={excluirConta}>Excluir conta</Button>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      <Modal open={openInvite} onClose={() => setOpenInvite(false)} title="Convidar usuÃ¡rio">
        <InviteForm
          onClose={() => setOpenInvite(false)}
          onInvite={async (payload) => {
            if (!validarPermissao('acessos:gerenciar')) return;
            if (!accessModuleReady) {
              const persisted = await createOperationalRecord('usuarios', {
                ...payload,
                owner_user_id: user?.id || null,
              }, user ? { user } : null);
              setDb((prev) => ({
                ...prev,
                usuarios: [
                  ...(prev.usuarios || []),
                  { ...payload, ...(persisted.data || {}), id: persisted.data?.id ?? gerarNovoId(prev.usuarios || []), owner_user_id: user?.id || null },
                ],
              }));
              registrarEventoAuditoria({
                acao: 'usuario_fallback_criado',
                entidade: 'usuarios',
                entidade_id: persisted.data?.id ?? null,
                criticidade: 'alta',
                detalhes: { email: payload.email, perfil: payload.perfil },
              });
              showToast({ type: 'success', message: 'Convite salvo no modo local. A migration ativa o fluxo automÃ¡tico.' });
              setOpenInvite(false);
              return;
            }

            const { error } = await createInvite({
              email: payload.email,
              nome: payload.nome,
              perfil: payload.perfil,
              status: 'pendente',
              notes: payload.notes || null,
              created_by: user?.id || null,
              owner_user_id: user?.id || null,
            });

            if (error) {
              showToast({ type: 'error', message: mensagemErroSegura(error, 'Nao foi possivel criar o convite.') });
              return;
            }
            registrarEventoAuditoria({
              acao: 'convite_criado',
              entidade: 'invites',
              criticidade: 'alta',
              detalhes: { email: payload.email, perfil: payload.perfil },
            });

            showToast({ type: 'success', message: 'Convite criado. O perfil serÃ¡ aplicado automaticamente no cadastro.' });
            setOpenInvite(false);
            carregarDadosDeAcesso();
          }}
        />
      </Modal>
    </div>
  );
}

/**
 * FormulÃ¡rio para convidar um novo usuÃ¡rio.
 * @param {object} props - As propriedades do componente.
 * @param {function} props.onInvite - Callback para quando o usuÃ¡rio Ã© convidado.
 * @param {function} props.onClose - Callback para fechar o formulÃ¡rio.
 */
function badgeStatusClass(status = '') {
  const s = String(status).toLowerCase();
  if (['ativo', 'aceito'].includes(s)) return 'badge badge-g';
  if (['inativo', 'pendente', 'enviado'].includes(s)) return 'badge badge-a';
  if (['desligado', 'cancelado', 'expirado'].includes(s)) return 'badge badge-r';
  return 'badge badge-info';
}

function InviteForm({ onInvite, onClose }) {
  const { showToast } = useToast(); // Hook para exibir toasts
  const [form, setForm] = useState({ nome: '', email: '', perfil: 'visualizador', status: 'ativo', notes: '' });

  return (
    <form
      className="config-grid"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.nome.trim() || !form.email.trim()) {
          showToast({ type: 'error', message: 'Informe nome e e-mail do usuÃ¡rio.' });
          return;
        }
        onInvite({ ...form, nome: form.nome.trim(), email: form.email.trim() });
      }}
    >
      <label className="ui-input-wrap">
        <span className="ui-input-label">Nome</span>
        <input className="ui-input" value={form.nome} onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))} />
      </label>
      <label className="ui-input-wrap">
        <span className="ui-input-label">E-mail</span>
        <input className="ui-input" type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
      </label>
      <label className="ui-input-wrap">
        <span className="ui-input-label">Perfil</span>
        <select className="ui-input" value={form.perfil} onChange={(e) => setForm((prev) => ({ ...prev, perfil: e.target.value }))}>
          <option value="admin">Admin</option>
          <option value="gerente">Gerente</option>
          <option value="operador">Operador</option>
          <option value="visualizador">Visualizador</option>
        </select>
      </label>
      <label className="ui-input-wrap">
        <span className="ui-input-label">ObservaÃ§Ã£o interna</span>
        <input className="ui-input" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />
      </label>
      <div className="config-actions">
        <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button type="submit">Convidar</Button>
      </div>
    </form>
  );
}

/**
 * Componente de linha com um switch (checkbox).
 * @param {object} props - As propriedades do componente.
 * @param {string} props.label - O texto do label.
 * @param {boolean} props.checked - O estado do switch.
 * @param {function} props.onChange - Callback para quando o switch muda de estado.
 */
function SwitchRow({ label, checked, onChange }) {
  return (
    <label className="switch-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
