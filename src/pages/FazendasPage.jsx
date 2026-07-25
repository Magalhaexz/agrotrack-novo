import { useMemo, useRef, useState } from 'react';
import Button from '../components/ui/Button';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import FazendaCard from '../components/fazendas/FazendaCard';
import FazendaModal from '../components/fazendas/FazendaModal';
import { gerarNovoId } from '../utils/id';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../auth/useAuth';
import { resetSupabaseAuthLocally, supabase, validateSupabaseSessionForCloud } from '../lib/supabase';
import { perfilEhAdministrador } from '../auth/perfis';
import {
  createOperationalRecord,
  deleteOperationalRecord,
  getCloudSyncCooldownState,
  updateOperationalRecord,
} from '../services/operationalPersistence';
import { canCreateFarm, getSubscriptionLimitMessage } from '../services/subscriptions';
import { runMinimalCloudDiagnostic } from '../services/supabaseDiagnostics';
function ensureObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function resolveFazendaIdentity(row = {}) {
  return row?.cloud_id || row?.metadata?.cloud_id || row?.id || row?.metadata?.local_id || null;
}
function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

function buildFazendaFallbackIdentity(row = {}) {
  return `${normalizeText(row?.nome)}|${normalizeText(row?.cidade)}|${normalizeText(row?.estado)}`;
}
function isNumericId(value) {
  if (value === undefined || value === null || value === '') return false;
  return Number.isFinite(Number(value));
}
function isUuid(value) {
  const text = String(value ?? '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text);
}
function logFazendaDirectCreate(payload = {}) {
  if (!import.meta.env.DEV) return;
  if (import.meta.env.DEV) {
    console.info('[HERDON_FAZENDA_DIRECT_CREATE]', payload);
  }
}

export default function FazendasPage({ db, setDb, onConfirmAction, session: sessionProp, subscription = null, onNavigate = null }) {
  const { showToast, dismissToast } = useToast();
  const { hasPermission, session: authSession, user, forceLocalSignOut } = useAuth();
  const session = sessionProp ?? authSession;
  const mensagemSemPermissao = 'Você não tem permissão para executar esta ação.';

  const [openModal, setOpenModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [sincronizandoFazendas, setSincronizandoFazendas] = useState(false);
  const [diagnosticandoNuvem, setDiagnosticandoNuvem] = useState(false);
  const [reconectandoNuvem, setReconectandoNuvem] = useState(false);
  const loadingToastRef = useRef(null);
  const manualSyncRef = useRef({ inFlight: false, lastStartAt: 0 });
  const isAdmin = perfilEhAdministrador(user?.perfil) || hasPermission('configuracoes:editar');
  const podeVerDiagnostico = Boolean(import.meta.env.DEV || isAdmin);

  const fazendas = useMemo(() => (Array.isArray(db?.fazendas) ? db.fazendas : []), [db?.fazendas]);
  const lotes = useMemo(() => (Array.isArray(db?.lotes) ? db.lotes : []), [db?.lotes]);
  const limiteFazendas = useMemo(() => canCreateFarm(subscription, fazendas.length), [subscription, fazendas.length]);

  const lotesByFazendaMap = useMemo(() => {
    const map = new Map();
    lotes.forEach((lote) => {
      const fazendaId = Number(lote.faz_id);
      if (!map.has(fazendaId)) map.set(fazendaId, []);
      map.get(fazendaId).push(lote);
    });
    return map;
  }, [lotes]);

  const cards = useMemo(
    () => fazendas.map((fazenda) => {
      const lotesDaFazenda = lotesByFazendaMap.get(Number(fazenda.id)) || [];
      return {
        ...fazenda,
        lotesVinculados: lotesDaFazenda.length,
        animaisVinculados: lotesDaFazenda.reduce((total, lote) => total + Number(lote.heads || lote.qtd || 0), 0),
      };
    }),
    [fazendas, lotesByFazendaMap]
  );

  async function salvarFazenda(payload) {
    if (!hasPermission('fazendas:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    if (editando) {
      const localId = editando?.metadata?.local_id ?? editando?.id ?? null;
      const cloudId = editando?.cloud_id || editando?.metadata?.cloud_id || null;
      const fallbackIdentity = {
        nome: String(editando?.nome ?? '').trim(),
        cidade: String(editando?.cidade ?? '').trim(),
        estado: String(editando?.estado ?? '').trim(),
      };
      let selector = null;
      if (isNumericId(editando?.id)) selector = { type: 'id', value: Number(editando.id), identity: fallbackIdentity };
      else if (isUuid(editando?.cloud_id)) selector = { type: 'cloud_id', value: String(editando.cloud_id), identity: fallbackIdentity };
      else if (isUuid(editando?.metadata?.cloud_id)) selector = { type: 'cloud_id', value: String(editando.metadata.cloud_id), identity: fallbackIdentity };
      else if (editando?.metadata?.local_id !== undefined && editando?.metadata?.local_id !== null) selector = { type: 'metadata.local_id', value: String(editando.metadata.local_id), identity: fallbackIdentity };
      else selector = { type: 'fallback_identity', identity: fallbackIdentity };
      const patch = {
        ...payload,
        metadata: {
          ...ensureObject(editando?.metadata),
          ...ensureObject(payload?.metadata),
          local_id: localId,
          cloud_id: cloudId,
        },
        cloud_id: cloudId,
      };
      const targetId = cloudId || editando?.id || localId;
      const persisted = await updateOperationalRecord('fazendas', targetId, patch, session, { selector });
      if (!persisted.persisted) {
        showToast({ type: 'warning', message: persisted.error || 'Não foi possível confirmar a alteração agora.' });
        return;
      }
      const editIdentity = resolveFazendaIdentity(editando) || buildFazendaFallbackIdentity(editando);
      setDb((prev) => ({
        ...prev,
        fazendas: prev.fazendas.map((f) =>
          (resolveFazendaIdentity(f) || buildFazendaFallbackIdentity(f)) === editIdentity
            ? { ...f, ...(persisted.data || patch) }
            : f
        ),
      }));
      showToast({ type: 'success', message: 'Fazenda atualizada com sucesso.' });
    } else {
      const nomeNormalizado = String(payload?.nome ?? '').trim();
      if (!nomeNormalizado) {
        showToast({ type: 'warning', message: 'Informe o nome da fazenda.' });
        return;
      }
      if (!session?.user?.id) {
        showToast({ type: 'warning', message: 'Faça login novamente para continuar.' });
      }
      if (!limiteFazendas.allowed) {
        showToast({
          type: 'warning',
          message: getSubscriptionLimitMessage('farms', limiteFazendas) || 'Regularize sua assinatura para continuar usando o HERDON.',
        });
        onNavigate?.('minhaAssinatura', { action: 'upgrade', motivo: 'limite_fazendas' });
        return;
      }
      const localId = gerarNovoId(fazendas);
      const createPayload = {
        ...payload,
        nome: nomeNormalizado,
        metadata: {
          ...ensureObject(payload?.metadata),
          local_id: localId,
        },
      };
      logFazendaDirectCreate({
        hasSession: Boolean(session),
        hasUserId: Boolean(session?.user?.id),
        attemptedCloud: Boolean(session?.user?.id),
        payloadKeys: Object.keys(createPayload || {}),
      });
      const persisted = await createOperationalRecord('fazendas', createPayload, session);
      if (!persisted.persisted) {
        showToast({ type: 'warning', message: persisted.error || 'Não foi possível confirmar o salvamento agora.' });
        return;
      }
      const incoming = persisted.data || { id: localId, ...createPayload };
      setDb((prev) => {
        const next = Array.isArray(prev?.fazendas) ? [...prev.fazendas] : [];
        const incomingIdentity = resolveFazendaIdentity(incoming) || buildFazendaFallbackIdentity(incoming);
        const existingIndex = next.findIndex((f) => (
          (resolveFazendaIdentity(f) || buildFazendaFallbackIdentity(f)) === incomingIdentity
        ));
        if (existingIndex >= 0) {
          next[existingIndex] = { ...next[existingIndex], ...incoming };
        } else next.push(incoming);
        return { ...prev, fazendas: next };
      });
      logFazendaDirectCreate({
        hasSession: Boolean(session),
        hasUserId: Boolean(session?.user?.id),
        attemptedCloud: Boolean(session?.user?.id),
        syncStatus: persisted.syncStatus || 'pending_sync',
        code: persisted.code || null,
        safeMessage: persisted.error || 'Registro salvo com sucesso.',
        payloadKeys: Object.keys(createPayload || {}),
      });
      showToast({ type: 'success', message: 'Registro salvo com sucesso.' });
    }
    setOpenModal(false);
    setEditando(null);
  }

  async function excluirFazenda(id) {
    if (!hasPermission('fazendas:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    const fazenda = cards.find((f) => resolveFazendaIdentity(f) === id || f.id === id);
    if (!fazenda) return;
    const fazendaKeys = new Set([
      String(fazenda?.id ?? ''),
      String(resolveFazendaIdentity(fazenda) ?? ''),
      String(fazenda?.metadata?.local_id ?? ''),
      String(fazenda?.nome ?? ''),
    ].filter(Boolean));
    const hasLinkedRecords = (list = []) => list.some((item) => {
      const refs = [
        item?.fazenda_id, item?.fazendaId, item?.fazenda, item?.faz_id, item?.fazendaNome, item?.fazenda_nome,
      ];
      return refs.some((ref) => fazendaKeys.has(String(ref ?? '')));
    });
    // Teste de campo: um lote ENCERRADO também bloqueava a exclusão para
    // sempre, sem nenhum caminho — a fazenda ficava "presa" mesmo sem
    // operação ativa. Continua bloqueando (não apaga histórico
    // silenciosamente), mas agora a mensagem oferece o caminho real:
    // inativar a fazenda (campo Status já existe em Editar fazenda).
    // `pastagens`/`tarefas` também podem existir sem nenhum lote vinculado
    // (fazenda_id direto), por isso entram na checagem — pesagens/custos/
    // sanitário/consumo de suplementação sempre dependem de um lote, então já
    // ficam cobertos transitivamente pela checagem de `lotes`.
    if (
      hasLinkedRecords(db?.lotes)
      || hasLinkedRecords(db?.animais)
      || hasLinkedRecords(db?.movimentacoes_financeiras)
      || hasLinkedRecords(db?.estoque)
      || hasLinkedRecords(db?.sanitario)
      || hasLinkedRecords(db?.pastagens)
      || hasLinkedRecords(db?.tarefas)
    ) {
      showToast({
        type: 'warning',
        message: 'Esta fazenda possui dados históricos e não pode ser excluída definitivamente. Você pode inativá-la (Editar fazenda → Status → Inativa) para impedir novos registros, mantendo o histórico da operação.',
      });
      return;
    }
    const confirmado = typeof onConfirmAction === 'function'
      ? await onConfirmAction({
        title: 'Excluir fazenda?',
        message: 'Esta ação remove a fazenda selecionada. Verifique se não há lotes, animais ou lançamentos vinculados antes de continuar.',
        tone: 'danger',
      })
      : window.confirm('Esta ação remove a fazenda selecionada. Verifique se não há lotes, animais ou lançamentos vinculados antes de continuar.');

    if (!confirmado) return;
    const fallbackIdentity = {
      nome: String(fazenda?.nome ?? '').trim(),
      cidade: String(fazenda?.cidade ?? '').trim(),
      estado: String(fazenda?.estado ?? '').trim(),
    };
    let selector = null;
    if (isNumericId(fazenda?.id)) {
      selector = { type: 'id', value: Number(fazenda.id), identity: fallbackIdentity };
    } else if (isUuid(fazenda?.cloud_id)) {
      selector = { type: 'cloud_id', value: String(fazenda.cloud_id), identity: fallbackIdentity };
    } else if (isUuid(fazenda?.metadata?.cloud_id)) {
      selector = { type: 'cloud_id', value: String(fazenda.metadata.cloud_id), identity: fallbackIdentity };
    } else if (fazenda?.metadata?.local_id !== undefined && fazenda?.metadata?.local_id !== null) {
      selector = { type: 'metadata.local_id', value: String(fazenda.metadata.local_id), identity: fallbackIdentity };
    } else {
      selector = { type: 'fallback_identity', identity: fallbackIdentity };
    }

    const targetId = resolveFazendaIdentity(fazenda) || id;
    const persisted = await deleteOperationalRecord('fazendas', targetId, session, {
      selector,
      pendingPayload: {
        id: targetId,
        selector,
        metadata: { local_id: fazenda?.metadata?.local_id ?? null },
        nome: String(fazenda?.nome ?? ''),
        cidade: String(fazenda?.cidade ?? ''),
        estado: String(fazenda?.estado ?? ''),
      },
    });
    if (!persisted.persisted) {
      showToast({ type: 'warning', message: persisted.error || 'Não foi possível confirmar a exclusão agora.' });
      return;
    }
    const deletedIdentity = buildFazendaFallbackIdentity(fazenda);
    setDb((prev) => ({
      ...prev,
      fazendas: prev.fazendas.filter((f) => {
        const sameIdentity = (resolveFazendaIdentity(f) || f.id) === targetId;
        const sameFallback = buildFazendaFallbackIdentity(f) === deletedIdentity;
        return !(sameIdentity || sameFallback);
      }),
    }));
    showToast({ type: 'success', message: 'Fazenda excluída com sucesso.' });
  }

  function traduzirStatusEtapa(step) {
    if (step === 'env_check') return 'Ambiente';
    if (step === 'rest_without_session') return 'REST sem sessão';
    if (step === 'session_check') return 'Sessão';
    if (step === 'rest_with_session') return 'REST com sessão';
    if (step === 'fazendas_check') return 'Fazendas';
    if (step === 'lotes_check') return 'Lotes';
    if (step === 'client_select') return 'Supabase client';
    return 'Diagnóstico';
  }

  function traduzirSessaoStatus(status) {
    if (status === 'valid') return 'OK';
    if (status === 'expired') return 'Expirada';
    if (status === 'invalid') return 'Inválida';
    if (status === 'refresh_failed') return 'Inválida';
    return 'Expirada';
  }

  function resumirFalha(item) {
    const status = item?.httpStatus ? String(item.httpStatus) : null;
    const code = item?.postgrestCode ? String(item.postgrestCode).toUpperCase() : null;
    const type = String(item?.failureType || '').toLowerCase();

    if (code === '42501' || type === 'rls') return `${status || code || 'erro'} / RLS`;
    if (code === '42703' || code === 'PGRST204') return `${code} / Coluna ausente`;
    if (code === 'PGRST205' || code === '42P01' || type === 'schema') return `${code || status || '404'} / Tabela ausente`;
    if (type === 'auth' || status === '401') return `${status || '401'} / Sessão inválida`;
    if (type === 'payload' || status === '400') return `${code || status || '400'} / Estrutura incompatível`;
    if (type === 'network_reset' || type === 'http2_protocol_error' || type === 'timeout') return 'Sem resposta / Rede';
    return `${code || status || 'erro'} / ${item?.safeMessage || 'Falha'}`;
  }

  async function _executarDiagnosticoNuvem() {
    if (!hasPermission('fazendas:editar')) {
      showToast({ type: 'error', message: 'Acesso restrito ao perfil autorizado.' });
      return;
    }
    if (!podeVerDiagnostico || diagnosticandoNuvem) return;
    setDiagnosticandoNuvem(true);
    try {
      const result = await runMinimalCloudDiagnostic({ session, table: 'lotes', timeoutMs: 8000 });
      const steps = Array.isArray(result?.steps) ? result.steps : [];

      steps.forEach((item) => {
        if (item?.step === 'session_check') {
          showToast({
            type: item?.ok ? 'success' : 'warning',
            message: `Sessão: ${item?.ok ? 'OK' : traduzirSessaoStatus(item?.status)}`,
          });
          return;
        }

        if (item?.safeMessage === 'Bloqueado por sessão inválida') {
          showToast({
            type: 'warning',
            message: `${traduzirStatusEtapa(item?.step)}: Bloqueado por sessão inválida`,
          });
          return;
        }

        if (!item?.ok) {
          showToast({
            type: 'warning',
            message: `${traduzirStatusEtapa(item?.step)}: Erro — ${resumirFalha(item)}`,
          });
          return;
        }

        if (item?.safeMessage && item.safeMessage.includes(': OK')) {
          showToast({ type: 'success', message: item.safeMessage });
        }
      });

      showToast({
        type: result?.ok ? 'success' : 'warning',
        message: result?.conclusionMessage || 'Falha ao executar o diagnóstico.',
      });

      try {
        window.dispatchEvent(new CustomEvent('herdon-cloud-diagnostic-state', {
          detail: {
            verified: Boolean(result?.ok),
            message: result?.conclusionMessage || null,
            checkedAt: Date.now(),
          },
        }));
      } catch {
        // noop
      }

      if (result?.conclusion === 'session_failure') {
        showToast({
          type: 'warning',
          message: 'Sessão expirada. Entre novamente para continuar.',
        });
      }

      if (import.meta.env.DEV || isAdmin) {
        console.groupCollapsed('[HERDON_CLOUD_MINIMAL_DIAGNOSTIC]');
        console.info({
          appOrigin: result?.appOrigin || window.location.origin,
          supabaseHost: result?.supabaseHost || null,
          envStatus: result?.envStatus || null,
          table: result?.table || 'lotes',
          steps: steps.map((item) => ({
            step: item?.step || null,
            table: item?.table || 'lotes',
            endpointPath: item?.endpointPath || null,
            httpStatus: item?.httpStatus ?? null,
            postgrestCode: item?.postgrestCode ?? null,
            failureType: item?.failureType ?? null,
            safeMessage: item?.safeMessage || null,
          })),
          safeMessage: result?.conclusionMessage || null,
        });
        if (result?.authState) {
          console.info('[HERDON_CLOUD_AUTH_DIAGNOSTIC]', {
            hasSession: Boolean(result.authState.hasSession),
            hasAccessToken: Boolean(result.authState.hasAccessToken),
            tokenLooksJwt: Boolean(result.authState.tokenLooksJwt),
            tokenExpired: Boolean(result.authState.tokenExpired),
            refreshAttempted: Boolean(result.authState.refreshAttempted),
            refreshSucceeded: Boolean(result.authState.refreshSucceeded),
            safeMessage: result?.conclusionMessage || 'Sessão expirada. Entre novamente para continuar.',
          });
        }
        const authFailureSteps = steps.filter(
          (item) => ['rest_with_session', 'client_select'].includes(item?.step) && !item?.ok
        );
        authFailureSteps.forEach((item) => {
          console.groupCollapsed('[HERDON_CLOUD_AUTH_REQUEST_DETAIL]');
          console.info({
            step: item?.step || null,
            table: item?.table || 'lotes',
            endpointPath: item?.endpointPath || null,
            httpStatus: item?.httpStatus ?? null,
            postgrestCode: item?.postgrestCode ?? null,
            failureType: item?.failureType ?? null,
            safeMessage: item?.safeMessage || null,
          });
          console.groupEnd();
        });
        console.groupEnd();
      }
    } catch (error) {
      showToast({ type: 'warning', message: 'Não foi possível executar o diagnóstico.' });
      if (import.meta.env.DEV) {
        console.warn('[HERDON_CLOUD_MINIMAL_DIAGNOSTIC]', {
          stage: 'diagnostic_exception',
          classification: 'unknown_error',
          errorName: error?.name || null,
          errorMessage: error?.message || null,
        });
      }
    } finally {
      setDiagnosticandoNuvem(false);
    }
  }

  async function _reconectarNuvem() {
    if (!hasPermission('fazendas:editar')) {
      showToast({ type: 'error', message: 'Acesso restrito ao perfil autorizado.' });
      return;
    }
    if (sincronizandoFazendas || diagnosticandoNuvem || reconectandoNuvem) return;
    setReconectandoNuvem(true);
    try {
      if (import.meta.env.DEV || isAdmin) {
        console.info('[HERDON_CLOUD_RECONNECT_DIAGNOSTIC]', {
          action: 'reconnect',
          localCleanupStarted: true,
          localCleanupSucceeded: false,
          remoteSignOutSkipped: true,
          safeMessage: 'Iniciando limpeza local da sessão Supabase.',
        });
      }

      resetSupabaseAuthLocally();
      forceLocalSignOut?.();

      if (import.meta.env.DEV || isAdmin) {
        console.info('[HERDON_CLOUD_RECONNECT_DIAGNOSTIC]', {
          action: 'reconnect',
          localCleanupStarted: true,
          localCleanupSucceeded: true,
          remoteSignOutSkipped: true,
          safeMessage: 'Sessão local limpa com sucesso.',
        });
      }

      showToast({
        type: 'info',
        message: 'Sessão limpa. Entre novamente para continuar.',
      });
    } catch {
      if (import.meta.env.DEV || isAdmin) {
        console.warn('[HERDON_CLOUD_RECONNECT_DIAGNOSTIC]', {
          action: 'reconnect',
          localCleanupStarted: true,
          localCleanupSucceeded: false,
          remoteSignOutSkipped: true,
          safeMessage: 'Falha ao limpar sessão local. Tentando manter o app utilizável.',
        });
      }
      forceLocalSignOut?.();
      showToast({
        type: 'warning',
        message: 'Sessão limpa. Entre novamente para continuar.',
      });
    } finally {
      setReconectandoNuvem(false);
    }
  }

  async function _sincronizarFazendasComNuvem() {
    if (!hasPermission('fazendas:editar')) {
      showToast({ type: 'error', message: 'Somente perfis autorizados podem editar este registro.' });
      return;
    }
    const now = Date.now();
    if (sincronizandoFazendas || manualSyncRef.current.inFlight) return;
    if (now - manualSyncRef.current.lastStartAt < 1200) return;
    manualSyncRef.current = { inFlight: true, lastStartAt: now };

    if (!session?.user?.id) {
      showToast({ type: 'warning', message: 'Faça login para continuar.' });
      manualSyncRef.current.inFlight = false;
      return;
    }

    const sessionValidation = await validateSupabaseSessionForCloud();
    if (!sessionValidation?.ok) {
      showToast({
        type: 'warning',
        message: 'Sessão expirada. Entre novamente para continuar.',
      });
      if (import.meta.env.DEV || isAdmin) {
        console.info('[HERDON_CLOUD_AUTH_DIAGNOSTIC]', {
          hasSession: Boolean(sessionValidation?.authState?.hasSession),
          hasAccessToken: Boolean(sessionValidation?.authState?.hasAccessToken),
          tokenLooksJwt: Boolean(sessionValidation?.authState?.tokenLooksJwt),
          tokenExpired: Boolean(sessionValidation?.authState?.tokenExpired),
          refreshAttempted: Boolean(sessionValidation?.authState?.refreshAttempted),
          refreshSucceeded: Boolean(sessionValidation?.authState?.refreshSucceeded),
          safeMessage: sessionValidation?.safeMessage || 'Sessão expirada. Entre novamente para continuar.',
        });
      }
      manualSyncRef.current.inFlight = false;
      return;
    }

    setSincronizandoFazendas(true);
    loadingToastRef.current = showToast({
      id: 'fazendas-sync-loading',
      type: 'info',
      message: 'Sincronizando fazendas e lotes...',
      persist: true,
    });

    try {
      showToast({ type: 'info', message: 'Estamos atualizando seus dados. Aguarde...' });

      let fazendasSync = null;
      let lotesSync = null;

      try {
        const sessionResult = await supabase.auth.getSession();
        const accessToken = sessionResult?.data?.session?.access_token || null;
        const hasAccessToken = Boolean(accessToken);
        const tokenLooksJwt = typeof accessToken === 'string' && accessToken.split('.').length === 3;
        const tokenLength = typeof accessToken === 'string' ? accessToken.length : 0;
        if (import.meta.env.DEV || isAdmin) {
          console.groupCollapsed('[HERDON_SERVERLESS_AUTH_HEADER_DIAGNOSTIC]');
          console.info({ endpoint: '/api/cloud-sync', status: null, hasAccessToken, tokenLooksJwt, tokenLength, failureType: hasAccessToken && tokenLooksJwt ? null : 'invalid_session', safeMessage: hasAccessToken && tokenLooksJwt ? 'Pré-validação do token concluída.' : 'Sessão inválida.' });
          console.groupEnd();
        }
        if (!hasAccessToken || !tokenLooksJwt) {
          showToast({ type: 'warning', message: 'Sessão inválida. Entre novamente.' });
          return;
        }
        const response = await fetch('/api/cloud-sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            fazendas,
            lotes,
          }),
        });
        if (import.meta.env.DEV || isAdmin) {
          console.groupCollapsed('[HERDON_SERVERLESS_AUTH_HEADER_DIAGNOSTIC]');
          console.info({ endpoint: '/api/cloud-sync', status: response.status, hasAccessToken: true, tokenLooksJwt: true, tokenLength: accessToken.length, failureType: response.ok ? null : 'server_http_error', safeMessage: response.ok ? 'Resposta recebida com sucesso.' : 'Falha na operação. Tente novamente.' });
          console.groupEnd();
        }
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload) {
          throw new Error('server_sync_failed');
        }
        fazendasSync = {
          module: 'fazendas',
          status: payload?.fazendas?.status || 'error',
          message: payload?.fazendas?.status === 'success'
            ? 'Fazendas atualizadas com sucesso.'
            : 'Não foi possível concluir a operação. Os dados locais continuam disponíveis.',
          data: Array.isArray(payload?.fazendas?.data) ? payload.fazendas.data : fazendas,
          httpStatus: response.status,
          code: payload?.fazendas?.status === 'success' ? null : 'SERVER_SYNC_FAILED',
        };
        lotesSync = {
          module: 'lotes',
          status: payload?.lotes?.status || 'error',
          message: payload?.lotes?.status === 'success'
            ? 'Lotes atualizados com sucesso.'
            : 'Não foi possível concluir a operação. Os dados locais continuam disponíveis.',
          data: Array.isArray(payload?.lotes?.data) ? payload.lotes.data : lotes,
          httpStatus: response.status,
          code: payload?.lotes?.status === 'success' ? null : 'SERVER_SYNC_FAILED',
        };
      } catch {
        if (import.meta.env.DEV || isAdmin) {
          console.groupCollapsed('[HERDON_SERVERLESS_AUTH_HEADER_DIAGNOSTIC]');
          console.info({ endpoint: '/api/cloud-sync', status: 494, hasAccessToken: Boolean(session?.access_token || session?.session?.access_token), tokenLooksJwt: true, tokenLength: 0, failureType: 'server_network_error', safeMessage: 'Falha na operação.' });
          console.groupEnd();
        }
        fazendasSync = { module: 'fazendas', status: 'error', message: 'Não foi possível concluir a operação.', data: fazendas, httpStatus: 494, code: 'SERVER_SYNC_FAILED' };
        lotesSync = { module: 'lotes', status: 'error', message: 'Não foi possível concluir a operação.', data: lotes, httpStatus: 494, code: 'SERVER_SYNC_FAILED' };
      }

      if (Array.isArray(fazendasSync?.data) || Array.isArray(lotesSync?.data)) {
        setDb((prev) => ({
          ...prev,
          fazendas: Array.isArray(fazendasSync?.data) ? fazendasSync.data : prev.fazendas,
          lotes: Array.isArray(lotesSync?.data) ? lotesSync.data : prev.lotes,
        }));
      }

      if (fazendasSync?.status === 'success' && lotesSync?.status === 'success') {
        showToast({ type: 'success', message: 'Fazendas e lotes atualizados com sucesso.' });
      } else if (fazendasSync?.status === 'success' || lotesSync?.status === 'success') {
        showToast({ type: 'warning', message: 'Operação concluída parcialmente.' });
      } else {
        showToast({ type: 'warning', message: 'Falha na operação. Seus dados locais continuam disponíveis.' });
      }

      if (fazendasSync?.status !== 'success' || lotesSync?.status !== 'success') {
        let supabaseHost = null;
        try {
          supabaseHost = new URL(import.meta.env.VITE_SUPABASE_URL).host;
        } catch {
          supabaseHost = null;
        }
        const primaryModule = fazendasSync?.status !== 'success' ? 'fazendas' : 'lotes';
        const primaryResult = fazendasSync?.status !== 'success' ? fazendasSync : lotesSync;
        console.groupCollapsed('[HERDON_CLOUD_PRODUCTION_DIAGNOSTIC]');
        console.info({
          appOrigin: window.location.origin,
          supabaseHost,
          module: primaryModule,
          table: primaryModule,
          stage: primaryModule === 'fazendas' ? 'manual_sync_fazendas' : 'manual_sync_lotes',
          failureType: primaryResult?.status === 'timeout' ? 'timeout' : 'error',
          httpStatus: primaryResult?.httpStatus ?? null,
          postgrestCode: primaryResult?.code ?? null,
          safeMessage: primaryResult?.message || 'Falha ao concluir a operação.',
          cooldownState: {
            fazendas: getCloudSyncCooldownState('fazendas'),
            lotes: getCloudSyncCooldownState('lotes'),
          },
        });
        console.groupEnd();
      }
    } catch {
      showToast({ type: 'warning', message: 'Não foi possível concluir a operação. Seus dados locais continuam disponíveis.' });
    } finally {
      manualSyncRef.current.inFlight = false;
      if (loadingToastRef.current) {
        dismissToast(loadingToastRef.current);
        loadingToastRef.current = null;
      }
      setSincronizandoFazendas(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Fazendas"
        subtitle={`Organize propriedades, capacidade e responsáveis da operação. Fazendas: ${fazendas.length}${limiteFazendas.limit != null ? `/${limiteFazendas.limit}` : ''}`}
        actions={(
          <div className="action-row">
            <Button disabled={!hasPermission('fazendas:editar')} onClick={() => {
              if (!hasPermission('fazendas:editar')) {
                showToast({ type: 'error', message: mensagemSemPermissao });
                return;
              }
              if (!limiteFazendas.allowed) {
                showToast({
                  type: 'warning',
                  message: getSubscriptionLimitMessage('farms', limiteFazendas) || 'Regularize sua assinatura para continuar usando o HERDON.',
                });
                onNavigate?.('minhaAssinatura', { action: 'upgrade', motivo: 'limite_fazendas' });
                return;
              }
              setEditando(null);
              setOpenModal(true);
            }}
            >
              Cadastrar fazenda
            </Button>
          </div>
        )}
      />

      {cards.length === 0 ? (
        <EmptyState
          title="Nenhuma fazenda cadastrada."
          subtitle="Comece cadastrando sua primeira fazenda ou importando seus dados."
          action={
            <Button
              variant="primary"
              onClick={() => {
                if (!hasPermission('fazendas:editar')) {
                  showToast({ type: 'error', message: mensagemSemPermissao });
                  return;
                }
                setEditando(null);
                setOpenModal(true);
              }}
            >
              Cadastrar fazenda
            </Button>
          }
        />
      ) : (
        <div className="grid-3 fazendas-grid">
          {cards.map((fazenda) => (
            <FazendaCard
              key={fazenda.id}
              fazenda={fazenda}
              lotesVinculados={fazenda.lotesVinculados}
              animaisVinculados={fazenda.animaisVinculados}
              onClick={() => { setEditando(fazenda); setOpenModal(true); }}
              onDelete={() => excluirFazenda(fazenda.id)}
            />
          ))}
        </div>
      )}

      <FazendaModal
        open={openModal}
        initialData={editando}
        onSave={salvarFazenda}
        onCancel={() => { setOpenModal(false); setEditando(null); }}
      />
    </div>
  );
}
