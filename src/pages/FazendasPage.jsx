import { useMemo, useRef, useState } from 'react';
import Button from '../components/ui/Button';
import PageHeader from '../components/PageHeader';
import FazendaCard from '../components/fazendas/FazendaCard';
import FazendaModal from '../components/fazendas/FazendaModal';
import { gerarNovoId } from '../utils/id';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../auth/useAuth';
import { resetSupabaseAuthLocally, supabase, validateSupabaseSessionForCloud } from '../lib/supabase';
import {
  createOperationalRecord,
  deleteOperationalRecord,
  getCloudSyncCooldownState,
  updateOperationalRecord,
} from '../services/operationalPersistence';
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
  console.info('[HERDON_FAZENDA_DIRECT_CREATE]', payload);
}

export default function FazendasPage({ db, setDb, onConfirmAction, session: sessionProp }) {
  const { showToast, dismissToast } = useToast();
  const { hasPermission, session: authSession, user, forceLocalSignOut } = useAuth();
  const session = sessionProp ?? authSession;
  const mensagemSemPermissao = 'VocÃª nÃ£o tem permissÃ£o para executar esta aÃ§Ã£o.';

  const [openModal, setOpenModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [sincronizandoFazendas, setSincronizandoFazendas] = useState(false);
  const [diagnosticandoNuvem, setDiagnosticandoNuvem] = useState(false);
  const [reconectandoNuvem, setReconectandoNuvem] = useState(false);
  const loadingToastRef = useRef(null);
  const manualSyncRef = useRef({ inFlight: false, lastStartAt: 0 });
  const isAdmin = String(user?.perfil || '').toLowerCase() === 'admin' || hasPermission('configuracoes:editar');
  const podeVerDiagnostico = Boolean(import.meta.env.DEV || isAdmin);

  const fazendas = Array.isArray(db?.fazendas) ? db.fazendas : [];
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];

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
    () => fazendas.map((fazenda) => ({
      ...fazenda,
      lotesVinculados: (lotesByFazendaMap.get(Number(fazenda.id)) || []).length,
    })),
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
      const editIdentity = resolveFazendaIdentity(editando) || buildFazendaFallbackIdentity(editando);
      setDb((prev) => ({
        ...prev,
        fazendas: prev.fazendas.map((f) =>
          (resolveFazendaIdentity(f) || buildFazendaFallbackIdentity(f)) === editIdentity
            ? { ...f, ...(persisted.data || patch) }
            : f
        ),
      }));
      if (persisted.syncStatus === 'cloud_success') showToast({ type: 'success', message: 'Fazenda atualizada na nuvem.' });
      if (persisted.syncStatus === 'pending_sync' || persisted.syncStatus === 'local_only') {
        showToast({ type: 'warning', message: `Fazenda atualizada localmente. Sincronização pendente.${import.meta.env.DEV ? ` Motivo: ${persisted.error || persisted.code || 'unknown'}.` : ''}` });
      }
    } else {
      const nomeNormalizado = String(payload?.nome ?? '').trim();
      if (!nomeNormalizado) {
        showToast({ type: 'warning', message: 'Informe o nome da fazenda.' });
        return;
      }
      if (!session?.user?.id) {
        showToast({ type: 'warning', message: 'Sessão da nuvem não encontrada. Faça login novamente para salvar na nuvem.' });
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
        safeMessage: persisted.error || (persisted.syncStatus === 'cloud_success' ? 'Registro salvo na nuvem.' : 'Registro salvo localmente. Sincronização pendente.'),
        payloadKeys: Object.keys(createPayload || {}),
      });
      if (persisted.syncStatus === 'cloud_success') showToast({ type: 'success', message: 'Registro salvo na nuvem.' });
      if (persisted.syncStatus === 'pending_sync' || persisted.syncStatus === 'local_only') {
        showToast({ type: 'warning', message: `Registro salvo localmente. Sincronização pendente.${import.meta.env.DEV ? ` Motivo: ${persisted.error || persisted.code || 'unknown'}.` : ''}` });
      }
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
    if (
      hasLinkedRecords(db?.lotes)
      || hasLinkedRecords(db?.animais)
      || hasLinkedRecords(db?.movimentacoes_financeiras)
      || hasLinkedRecords(db?.estoque)
      || hasLinkedRecords(db?.sanitario)
    ) {
      showToast({
        type: 'warning',
        message: 'Esta fazenda possui registros vinculados. Remova ou transfira os registros antes de excluir.',
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
    const deletedIdentity = buildFazendaFallbackIdentity(fazenda);
    setDb((prev) => ({
      ...prev,
      fazendas: prev.fazendas.filter((f) => {
        const sameIdentity = (resolveFazendaIdentity(f) || f.id) === targetId;
        const sameFallback = buildFazendaFallbackIdentity(f) === deletedIdentity;
        return !(sameIdentity || sameFallback);
      }),
    }));
    if (persisted.syncStatus === 'cloud_success') showToast({ type: 'success', message: 'Fazenda excluída da nuvem.' });
    if (persisted.syncStatus === 'pending_sync' || persisted.syncStatus === 'local_only') {
      showToast({ type: 'warning', message: 'Exclusão registrada localmente. Sincronização pendente.' });
    }
  }

  function traduzirStatusEtapa(step) {
    if (step === 'env_check') return 'Ambiente';
    if (step === 'rest_without_session') return 'REST sem sessÃ£o';
    if (step === 'session_check') return 'SessÃ£o';
    if (step === 'rest_with_session') return 'REST com sessÃ£o';
    if (step === 'fazendas_check') return 'Fazendas';
    if (step === 'lotes_check') return 'Lotes';
    if (step === 'client_select') return 'Supabase client';
    return 'DiagnÃ³stico';
  }

  function traduzirSessaoStatus(status) {
    if (status === 'valid') return 'OK';
    if (status === 'expired') return 'Expirada';
    if (status === 'invalid') return 'InvÃ¡lida';
    if (status === 'refresh_failed') return 'InvÃ¡lida';
    return 'Expirada';
  }

  function resumirFalha(item) {
    const status = item?.httpStatus ? String(item.httpStatus) : null;
    const code = item?.postgrestCode ? String(item.postgrestCode).toUpperCase() : null;
    const type = String(item?.failureType || '').toLowerCase();

    if (code === '42501' || type === 'rls') return `${status || code || 'erro'} / RLS`;
    if (code === '42703' || code === 'PGRST204') return `${code} / Coluna ausente`;
    if (code === 'PGRST205' || code === '42P01' || type === 'schema') return `${code || status || '404'} / Tabela ausente`;
    if (type === 'auth' || status === '401') return `${status || '401'} / SessÃ£o invÃ¡lida`;
    if (type === 'payload' || status === '400') return `${code || status || '400'} / Estrutura incompatÃ­vel`;
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
            message: `SessÃ£o: ${item?.ok ? 'OK' : traduzirSessaoStatus(item?.status)}`,
          });
          return;
        }

        if (item?.safeMessage === 'Bloqueado por sessÃ£o invÃ¡lida') {
          showToast({
            type: 'warning',
            message: `${traduzirStatusEtapa(item?.step)}: Bloqueado por sessÃ£o invÃ¡lida`,
          });
          return;
        }

        if (!item?.ok) {
          showToast({
            type: 'warning',
            message: `${traduzirStatusEtapa(item?.step)}: Erro â€” ${resumirFalha(item)}`,
          });
          return;
        }

        if (item?.safeMessage && item.safeMessage.includes(': OK')) {
          showToast({ type: 'success', message: item.safeMessage });
        }
      });

      showToast({
        type: result?.ok ? 'success' : 'warning',
        message: result?.conclusionMessage || 'Falha ao executar diagnÃ³stico da nuvem.',
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
          message: 'SessÃ£o expirada. Use Reconectar Ã  nuvem para entrar novamente.',
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
            safeMessage: result?.conclusionMessage || 'SessÃ£o expirada. Entre novamente para sincronizar com a nuvem.',
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
      showToast({ type: 'warning', message: 'NÃ£o foi possÃ­vel executar o diagnÃ³stico da nuvem.' });
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
          safeMessage: 'Iniciando limpeza local da sessÃ£o Supabase.',
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
          safeMessage: 'SessÃ£o local limpa com sucesso.',
        });
      }

      showToast({
        type: 'info',
        message: 'SessÃ£o local limpa. Entre novamente para conectar Ã  nuvem.',
      });
    } catch {
      if (import.meta.env.DEV || isAdmin) {
        console.warn('[HERDON_CLOUD_RECONNECT_DIAGNOSTIC]', {
          action: 'reconnect',
          localCleanupStarted: true,
          localCleanupSucceeded: false,
          remoteSignOutSkipped: true,
          safeMessage: 'Falha ao limpar sessÃ£o local. Tentando manter o app utilizÃ¡vel.',
        });
      }
      forceLocalSignOut?.();
      showToast({
        type: 'warning',
        message: 'SessÃ£o local limpa. Entre novamente para conectar Ã  nuvem.',
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
      showToast({ type: 'warning', message: 'FaÃ§a login para sincronizar com a nuvem.' });
      manualSyncRef.current.inFlight = false;
      return;
    }

    const sessionValidation = await validateSupabaseSessionForCloud();
    if (!sessionValidation?.ok) {
      showToast({
        type: 'warning',
        message: 'SessÃ£o expirada. Entre novamente para sincronizar com a nuvem.',
      });
      if (import.meta.env.DEV || isAdmin) {
        console.info('[HERDON_CLOUD_AUTH_DIAGNOSTIC]', {
          hasSession: Boolean(sessionValidation?.authState?.hasSession),
          hasAccessToken: Boolean(sessionValidation?.authState?.hasAccessToken),
          tokenLooksJwt: Boolean(sessionValidation?.authState?.tokenLooksJwt),
          tokenExpired: Boolean(sessionValidation?.authState?.tokenExpired),
          refreshAttempted: Boolean(sessionValidation?.authState?.refreshAttempted),
          refreshSucceeded: Boolean(sessionValidation?.authState?.refreshSucceeded),
          safeMessage: sessionValidation?.safeMessage || 'SessÃ£o expirada. Entre novamente para sincronizar com a nuvem.',
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
      showToast({ type: 'info', message: 'SincronizaÃ§Ã£o iniciada. Aguarde...' });

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
          console.info({ endpoint: '/api/cloud-sync', status: null, hasAccessToken, tokenLooksJwt, tokenLength, failureType: hasAccessToken && tokenLooksJwt ? null : 'invalid_session', safeMessage: hasAccessToken && tokenLooksJwt ? 'PrÃ©-validaÃ§Ã£o do token concluÃ­da.' : 'SessÃ£o invÃ¡lida. Reconecte Ã  nuvem.' });
          console.groupEnd();
        }
        if (!hasAccessToken || !tokenLooksJwt) {
          showToast({ type: 'warning', message: 'SessÃ£o invÃ¡lida. Reconecte Ã  nuvem.' });
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
          console.info({ endpoint: '/api/cloud-sync', status: response.status, hasAccessToken: true, tokenLooksJwt: true, tokenLength: accessToken.length, failureType: response.ok ? null : 'server_http_error', safeMessage: response.ok ? 'Sync pelo servidor respondeu com sucesso.' : 'Falha na sincronizaÃ§Ã£o pelo servidor. O modo local continua ativo.' });
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
            ? 'Fazendas sincronizadas com a nuvem.'
            : 'NÃ£o foi possÃ­vel sincronizar pelo servidor. O modo local continua ativo.',
          data: Array.isArray(payload?.fazendas?.data) ? payload.fazendas.data : fazendas,
          httpStatus: response.status,
          code: payload?.fazendas?.status === 'success' ? null : 'SERVER_SYNC_FAILED',
        };
        lotesSync = {
          module: 'lotes',
          status: payload?.lotes?.status || 'error',
          message: payload?.lotes?.status === 'success'
            ? 'Lotes sincronizados com a nuvem.'
            : 'NÃ£o foi possÃ­vel sincronizar pelo servidor. O modo local continua ativo.',
          data: Array.isArray(payload?.lotes?.data) ? payload.lotes.data : lotes,
          httpStatus: response.status,
          code: payload?.lotes?.status === 'success' ? null : 'SERVER_SYNC_FAILED',
        };
      } catch {
        if (import.meta.env.DEV || isAdmin) {
          console.groupCollapsed('[HERDON_SERVERLESS_AUTH_HEADER_DIAGNOSTIC]');
          console.info({ endpoint: '/api/cloud-sync', status: 494, hasAccessToken: Boolean(session?.access_token || session?.session?.access_token), tokenLooksJwt: true, tokenLength: 0, failureType: 'server_network_error', safeMessage: 'Falha na sincronizaÃ§Ã£o pelo servidor. O modo local continua ativo.' });
          console.groupEnd();
        }
        fazendasSync = { module: 'fazendas', status: 'error', message: 'NÃ£o foi possÃ­vel sincronizar pelo servidor. O modo local continua ativo.', data: fazendas, httpStatus: 494, code: 'SERVER_SYNC_FAILED' };
        lotesSync = { module: 'lotes', status: 'error', message: 'NÃ£o foi possÃ­vel sincronizar pelo servidor. O modo local continua ativo.', data: lotes, httpStatus: 494, code: 'SERVER_SYNC_FAILED' };
      }

      if (Array.isArray(fazendasSync?.data) || Array.isArray(lotesSync?.data)) {
        setDb((prev) => ({
          ...prev,
          fazendas: Array.isArray(fazendasSync?.data) ? fazendasSync.data : prev.fazendas,
          lotes: Array.isArray(lotesSync?.data) ? lotesSync.data : prev.lotes,
        }));
      }

      if (fazendasSync?.status === 'success' && lotesSync?.status === 'success') {
        showToast({ type: 'success', message: 'Fazendas e lotes sincronizados com a nuvem.' });
      } else if (fazendasSync?.status === 'success' || lotesSync?.status === 'success') {
        showToast({ type: 'warning', message: 'SincronizaÃ§Ã£o parcial concluÃ­da. Parte dos dados permanece em modo local.' });
      } else {
        showToast({ type: 'warning', message: 'Falha na sincronizaÃ§Ã£o. O modo local continua ativo.' });
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
          safeMessage: primaryResult?.message || 'Falha ao sincronizar com a nuvem.',
          cooldownState: {
            fazendas: getCloudSyncCooldownState('fazendas'),
            lotes: getCloudSyncCooldownState('lotes'),
          },
        });
        console.groupEnd();
      }
    } catch {
      showToast({ type: 'warning', message: 'NÃ£o foi possÃ­vel sincronizar fazendas e lotes. Seus dados locais continuam disponÃ­veis.' });
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
        subtitle="GestÃ£o completa das propriedades e suas capacidades"
        actions={(
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button disabled={!hasPermission('fazendas:editar')} onClick={() => {
              if (!hasPermission('fazendas:editar')) {
                showToast({ type: 'error', message: mensagemSemPermissao });
                return;
              }
              setEditando(null);
              setOpenModal(true);
            }}
            >
              + Nova Fazenda
            </Button>
          </div>
        )}
      />

      {cards.length === 0 ? (
        <div className="ui-card empty-state">
          <strong>Nenhuma fazenda cadastrada.</strong>
          <span>Use o botÃ£o "Nova Fazenda" para comeÃ§ar.</span>
        </div>
      ) : (
        <div className="grid-3">
          {cards.map((fazenda) => (
            <FazendaCard
              key={fazenda.id}
              fazenda={fazenda}
              lotesVinculados={fazenda.lotesVinculados}
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
