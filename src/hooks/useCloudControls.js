import { useRef, useState } from 'react';
import { resetSupabaseAuthLocally, supabase, validateSupabaseSessionForCloud } from '../lib/supabase';
import { runMinimalCloudDiagnostic } from '../services/supabaseDiagnostics';
import { processPendingSyncQueue } from '../services/operationalPersistence';

export function useCloudControls({ db, setDb, session, hasPermission, showToast, dismissToast, forceLocalSignOut }) {
  const [sincronizandoNuvem, setSincronizandoNuvem] = useState(false);
  const [diagnosticandoNuvem, setDiagnosticandoNuvem] = useState(false);
  const [reconectandoNuvem, setReconectandoNuvem] = useState(false);
  const loadingToastRef = useRef(null);
  const manualSyncRef = useRef({ inFlight: false, lastStartAt: 0 });

  async function testarConexaoNuvem() {
    if (!hasPermission('fazendas:editar')) { showToast({ type: 'error', message: 'Acesso restrito ao perfil autorizado.' }); return; }
    if (diagnosticandoNuvem) return;
    setDiagnosticandoNuvem(true);
    try {
      const result = await runMinimalCloudDiagnostic({ session, table: 'lotes', timeoutMs: 8000 });
      showToast({ type: result?.ok ? 'success' : 'warning', message: result?.conclusionMessage || 'Não foi possível verificar o status. Verifique a configuração.' });
      window.dispatchEvent(new CustomEvent('herdon-cloud-diagnostic-state', { detail: { verified: Boolean(result?.ok), message: result?.conclusionMessage || null, checkedAt: Date.now() } }));
    } catch {
      showToast({ type: 'warning', message: 'Não foi possível verificar o status. Verifique a configuração.' });
    } finally {
      setDiagnosticandoNuvem(false);
    }
  }

  async function reconectarNuvem() {
    if (!hasPermission('fazendas:editar')) { showToast({ type: 'error', message: 'Acesso restrito ao perfil autorizado.' }); return; }
    if (sincronizandoNuvem || diagnosticandoNuvem || reconectandoNuvem) return;
    setReconectandoNuvem(true);
    try {
      resetSupabaseAuthLocally();
      forceLocalSignOut?.();
      showToast({ type: 'info', message: 'Sessão limpa. Entre novamente para continuar.' });
    } catch {
      forceLocalSignOut?.();
      showToast({ type: 'warning', message: 'Sessão limpa. Entre novamente para continuar.' });
    } finally { setReconectandoNuvem(false); }
  }

  async function sincronizarNuvem() {
    if (!hasPermission('fazendas:editar')) { showToast({ type: 'error', message: 'Somente perfis autorizados podem editar este registro.' }); return; }
    const now = Date.now();
    if (sincronizandoNuvem || manualSyncRef.current.inFlight) return;
    if (now - manualSyncRef.current.lastStartAt < 1200) return;
    manualSyncRef.current = { inFlight: true, lastStartAt: now };
    if (!session?.user?.id) { showToast({ type: 'warning', message: 'Faça login para continuar.' }); manualSyncRef.current.inFlight = false; return; }
    const sessionValidation = await validateSupabaseSessionForCloud();
    if (!sessionValidation?.ok) { showToast({ type: 'warning', message: 'Sessão expirada. Entre novamente.' }); manualSyncRef.current.inFlight = false; return; }

    setSincronizandoNuvem(true);
    loadingToastRef.current = showToast({ id: 'global-cloud-sync-loading', type: 'info', message: 'Atualizando...', persist: true });
    try {
      const sessionResult = await supabase.auth.getSession();
      const accessToken = sessionResult?.data?.session?.access_token || null;
      const tokenLooksJwt = typeof accessToken === 'string' && accessToken.split('.').length === 3;
      if (!accessToken || !tokenLooksJwt) { showToast({ type: 'warning', message: 'Sessão inválida. Entre novamente.' }); return; }
      const response = await fetch('/api/cloud-sync', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ fazendas: db?.fazendas || [], lotes: db?.lotes || [] }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) { showToast({ type: 'warning', message: 'Falha na atualização. Tente novamente.' }); return; }
      const fazendasData = Array.isArray(payload?.fazendas?.data) ? payload.fazendas.data : null;
      const lotesData = Array.isArray(payload?.lotes?.data) ? payload.lotes.data : null;
      if (fazendasData || lotesData) setDb((prev) => ({ ...prev, fazendas: fazendasData || prev.fazendas, lotes: lotesData || prev.lotes }));
      if (payload?.fazendas?.status === 'success' && payload?.lotes?.status === 'success') showToast({ type: 'success', message: 'Fazendas e lotes atualizados com sucesso.' });
      else showToast({ type: 'warning', message: 'Falha na atualização. Tente novamente.' });
      const queueResult = await processPendingSyncQueue(session, { maxItems: 40, manual: true });
      if ((queueResult?.pendingCount || 0) === 0) {
        showToast({ type: 'success', message: 'Pendências atualizadas com sucesso.' });
      } else {
        const firstError = queueResult?.firstError;
        const safeCode = firstError?.code ? String(firstError.code) : null;
        const safeMessage = firstError?.message ? String(firstError.message) : null;
        const safeError = safeCode || safeMessage ? ` | ${safeCode || 'erro'}: ${safeMessage || 'pendência restante'}` : '';
        showToast({ type: 'info', message: `Atualização manual concluída: ${queueResult?.synced || 0} atualizadas, ${queueResult?.pendingCount || 0} pendentes${safeError}` });
      }
    } catch {
      showToast({ type: 'warning', message: 'Não foi possível atualizar fazendas e lotes. Seus dados locais continuam disponíveis.' });
    } finally {
      manualSyncRef.current.inFlight = false;
      if (loadingToastRef.current) dismissToast(loadingToastRef.current);
      loadingToastRef.current = null;
      setSincronizandoNuvem(false);
    }
  }

  return { sincronizandoNuvem, diagnosticandoNuvem, reconectandoNuvem, sincronizarNuvem, testarConexaoNuvem, reconectarNuvem };
}
