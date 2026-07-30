/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  mapProfileRowToUser,
  resolveUserRoleFromAuthAndCache,
  ensureUserProfile,
  fetchUserProfile,
  isAccessModuleUnavailable,
  readCachedProfile,
  writeCachedProfile,
} from '../services/userAccess';
import {
  limparPersistenciaSessao,
  supabase,
} from '../lib/supabase';
import { clearOperationalSnapshotsLocal } from '../hooks/useOperationalData';
import { obterPerfilDoUsuario, usuarioTemPermissao } from './perfis';

const AuthContext = createContext(null);
const PROFILE_FAILURE_COOLDOWN_MS = 120000;
const profileBootLogs = new Set();

function getErrorMessage(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  return error.message || error.details || error.hint || error.name || String(error);
}

function logProfileBootOnce(stage, payload = {}, level = 'debug') {
  if (!import.meta.env.DEV) return;
  const key = `${stage}:${payload?.userId || payload?.generationId || 'global'}`;
  if (profileBootLogs.has(key)) return;
  profileBootLogs.add(key);
  const logger = level === 'warn' ? console.warn : console.debug;
  logger('[HERDON_PROFILE_BOOT]', { stage, ...payload });
}

function buildFallbackProfile(userAtual, cachedProfile = null) {
  if (!userAtual) return null;
  const resolvedRole = resolveUserRoleFromAuthAndCache(userAtual, cachedProfile);

  return {
    id: userAtual.id || cachedProfile?.id || null,
    email: cachedProfile?.email || userAtual.email || '',
    nome:
      cachedProfile?.nome
      || userAtual?.user_metadata?.nome
      || userAtual?.user_metadata?.nome_completo
      || userAtual?.user_metadata?.name
      || userAtual?.email?.split('@')[0]
      || 'Usuario',
    perfil: resolvedRole.perfil,
    roleSource: resolvedRole.source,
    owner_user_id: cachedProfile?.owner_user_id ?? (resolvedRole.perfil === 'proprietario' ? userAtual.id : null),
    foto_url: cachedProfile?.foto_url ?? userAtual?.user_metadata?.avatar_url ?? null,
    telefone: cachedProfile?.telefone ?? userAtual?.user_metadata?.telefone ?? '',
    cargo: cachedProfile?.cargo ?? userAtual?.user_metadata?.cargo ?? '',
    fazenda_id: cachedProfile?.fazenda_id ?? null,
    profile: cachedProfile || null,
  };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [profileReady, setProfileReady] = useState(true);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [ultimoLogoutAt, setUltimoLogoutAt] = useState(0);
  const authGenerationRef = useRef(0);
  const activeUserIdRef = useRef(null);
  const profileFailureAtRef = useRef(new Map());
  const profileInFlightRef = useRef(new Map());
  const resetAuthState = useCallback(() => {
    setSession(null);
    setProfile(null);
    setProfileError(null);
    setProfileReady(true);
    setAuthError(null);
    setLoadingAuth(false);
    activeUserIdRef.current = null;
  }, []);

  const registrarLogoutLocal = useCallback(() => {
    authGenerationRef.current += 1;
    clearOperationalSnapshotsLocal({ userId: activeUserIdRef.current || null });
    limparPersistenciaSessao();
    profileInFlightRef.current.clear();
    profileFailureAtRef.current.clear();
    setUltimoLogoutAt(Date.now());
    if (import.meta.env.DEV) {
      console.debug('[HERDON_SYNC_GUARD]', {
        stage: 'logout_reset',
        generationId: authGenerationRef.current,
      });
    }
    resetAuthState();
  }, [resetAuthState]);

  const aplicarProfileFallback = useCallback((userAtual, generationId) => {
    const userId = String(userAtual?.id || '');
    const cachedProfile = readCachedProfile(userId);
    const fallbackProfile = buildFallbackProfile(userAtual, cachedProfile);
    const resolvedRole = resolveUserRoleFromAuthAndCache(userAtual, cachedProfile);

    if (cachedProfile) {
      logProfileBootOnce('using_cached_profile', {
        userId,
        generationId,
      });
    } else if (fallbackProfile) {
      logProfileBootOnce('using_auth_metadata_profile', {
        userId,
        generationId,
      });
    }
    if (import.meta.env.DEV) {
      console.debug('[HERDON_ROLE_BOOT]', {
        source: resolvedRole.source,
        resolvedPerfil: resolvedRole.perfil,
        userEmail: userAtual?.email || null,
      });
    }

    setProfile(fallbackProfile);
    setProfileError(null);
    setProfileReady(true);
  }, []);

  const acceptSession = useCallback((sessionAtual, options = {}) => {
    const generationId = authGenerationRef.current + 1;
    authGenerationRef.current = generationId;
    const authUser = sessionAtual?.user ?? null;
    const userId = authUser?.id || null;

    activeUserIdRef.current = userId;
    if (userId) {
      profileFailureAtRef.current.delete(userId);
    }

    setSession(sessionAtual || null);
    setAuthError(null);
    setLoadingAuth(false);
    setProfileReady(true);

    if (import.meta.env.DEV) {
      console.debug('[HERDON_AUTH_BOOT]', {
        stage: 'accept_session',
        generationId,
        hasSession: Boolean(authUser),
        hasUserId: Boolean(userId),
        source: options?.source || 'manual',
      });
    }

    if (authUser) {
      aplicarProfileFallback(authUser, generationId);
      void options?.deferProfileSync?.(authUser, generationId);
      return;
    }

    setProfile(null);
    setProfileError(null);
    logProfileBootOnce('profile_sync_skipped_signed_out', {
      generationId,
    });
  }, [aplicarProfileFallback]);

  useEffect(() => {
    let ativo = true;

    async function carregarProfile(userAtual, generationId) {
      const userId = String(userAtual?.id || '');
      if (!userId) {
        if (ativo && authGenerationRef.current === generationId) {
          setProfile(null);
          setProfileError(null);
          setProfileReady(true);
        }
        return;
      }

      logProfileBootOnce('profile_bootstrap_fetch', {
        userId,
        generationId,
      });

      const lastFailure = profileFailureAtRef.current.get(userId) || 0;
      if (Date.now() - lastFailure < PROFILE_FAILURE_COOLDOWN_MS) {
        logProfileBootOnce('skip_recent_failure', {
          userId,
          generationId,
        }, 'warn');
        if (ativo && authGenerationRef.current === generationId) {
          aplicarProfileFallback(userAtual, generationId);
        }
        return;
      }

      const existingProfileRequest = profileInFlightRef.current.get(userId);
      if (existingProfileRequest) {
        if (import.meta.env.DEV) {
          console.debug('[HERDON_PROFILE_BOOT]', {
            stage: 'reuse_in_flight',
            generationId,
            hasUserId: true,
          });
        }
        await existingProfileRequest;
        return;
      }

      if (ativo && authGenerationRef.current === generationId) {
        setProfileReady(false);
      }

      const request = (async () => {
        let { data, error } = await fetchUserProfile(userId);

        if (!error && !data) {
          // Usuario autenticado sem profile (ex.: gatilho on_auth_user_created falhou ou
          // ainda nao rodou para este login). Garante o profile no app e tenta de novo.
          logProfileBootOnce('profile_missing_ensuring', {
            userId,
            generationId,
          }, 'warn');
          const { error: ensureError } = await ensureUserProfile(userAtual);
          if (ensureError) {
            logProfileBootOnce('ensure_profile_failed', {
              userId,
              generationId,
              errorType: getErrorMessage(ensureError) || 'ensure_profile_error',
            }, 'warn');
          } else {
            ({ data, error } = await fetchUserProfile(userId));
          }
        }

        const isCurrent = ativo && authGenerationRef.current === generationId && activeUserIdRef.current === userId;
        if (!isCurrent) {
          logProfileBootOnce('stale_profile_ignored', {
            userId,
            generationId,
          });
          return;
        }

        if (error) {
          profileFailureAtRef.current.set(userId, Date.now());
          if (!isAccessModuleUnavailable(error)) {
            logProfileBootOnce('profile_error', {
              userId,
              generationId,
              errorType: getErrorMessage(error) || 'profile_error',
            }, 'warn');
          }
          aplicarProfileFallback(userAtual, generationId);
          setProfileError(error);
          return;
        }

        profileFailureAtRef.current.delete(userId);
        writeCachedProfile(userId, data || null);
        setProfile(data || null);
        setProfileError(null);
        setProfileReady(true);
      })().catch((error) => {
        const isCurrent = ativo && authGenerationRef.current === generationId && activeUserIdRef.current === userId;
        if (!isCurrent) return;
        profileFailureAtRef.current.set(userId, Date.now());
        logProfileBootOnce('profile_exception', {
          userId,
          generationId,
          errorType: getErrorMessage(error) || 'profile_exception',
        }, 'warn');
        aplicarProfileFallback(userAtual, generationId);
        setProfileError(error);
      }).finally(() => {
        if (profileInFlightRef.current.get(userId) === request) {
          profileInFlightRef.current.delete(userId);
        }
      });

      profileInFlightRef.current.set(userId, request);
      try {
        await request;
      } catch {
        // Erro tratado no catch interno de request
      }
    }

    async function carregarSessao() {
      const generationId = authGenerationRef.current + 1;
      authGenerationRef.current = generationId;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!ativo || authGenerationRef.current !== generationId) return;

        if (error) {
          if (import.meta.env.DEV) {
            console.warn('[HERDON_AUTH_BOOT]', {
              stage: 'get_session_error',
              generationId,
              hasSession: false,
              errorType: getErrorMessage(error) || 'get_session_error',
            });
          }
          resetAuthState();
          return;
        }

        const sessaoAtual = data?.session ?? null;
        if (import.meta.env.DEV) {
          console.debug('[HERDON_AUTH_BOOT]', {
            stage: 'session_bootstrap',
            generationId,
            hasSession: Boolean(sessaoAtual?.user),
          });
        }

        acceptSession(sessaoAtual, {
          source: 'session_bootstrap',
          deferProfileSync: carregarProfile,
        });
      } catch (error) {
        if (!ativo || authGenerationRef.current !== generationId) return;
        resetAuthState();
        setAuthError(error);
      }
    }

    carregarSessao();

    return () => {
      ativo = false;
    };
  }, [acceptSession, aplicarProfileFallback, registrarLogoutLocal, resetAuthState]);

  const refreshProfile = useCallback(async () => {
    const userAtual = session?.user ?? null;
    if (!userAtual?.id) {
      setProfile(null);
      setProfileReady(true);
      logProfileBootOnce('profile_sync_skipped_signed_out', {
        generationId: authGenerationRef.current,
      });
      return null;
    }

    const existingProfileRequest = profileInFlightRef.current.get(userAtual.id);
    if (existingProfileRequest) {
      await existingProfileRequest;
    }
    const generationId = authGenerationRef.current;

    const lastFailure = profileFailureAtRef.current.get(userAtual.id) || 0;
    if (Date.now() - lastFailure < PROFILE_FAILURE_COOLDOWN_MS) {
      aplicarProfileFallback(userAtual, generationId);
      logProfileBootOnce('skip_recent_failure', {
        userId: userAtual.id,
        generationId,
      }, 'warn');
      return null;
    }

    const request = fetchUserProfile(userAtual.id).finally(() => {
      if (profileInFlightRef.current.get(userAtual.id) === request) {
        profileInFlightRef.current.delete(userAtual.id);
      }
    });
    profileInFlightRef.current.set(userAtual.id, request);
    const { data, error } = await request;
    const isCurrent = authGenerationRef.current === generationId && activeUserIdRef.current === userAtual.id;
    if (!isCurrent) return null;

    if (error) {
      profileFailureAtRef.current.set(userAtual.id, Date.now());
      aplicarProfileFallback(userAtual, generationId);
      setProfileError(error);
      setProfileReady(true);
      return null;
    }

    profileFailureAtRef.current.delete(userAtual.id);
    writeCachedProfile(userAtual.id, data || null);
    setProfile(data || null);
    setProfileError(null);
    setProfileReady(true);
    return data || null;
  }, [aplicarProfileFallback, session]);

  const value = useMemo(() => {
    const authUser = session?.user ?? null;
    const user = mapProfileRowToUser(authUser, profile);
    const perfil = obterPerfilDoUsuario(user);

    return {
      session,
      user,
      profile,
      perfil,
      loadingAuth,
      authError,
      profileError,
      profileReady,
      refreshProfile,
      acceptSession,
      forceLocalSignOut: registrarLogoutLocal,
      ultimoLogoutAt,
      hasPermission: (permissao) => usuarioTemPermissao(user, permissao),
    };
  }, [session, profile, loadingAuth, authError, profileError, profileReady, refreshProfile, acceptSession, registrarLogoutLocal, ultimoLogoutAt]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }

  return context;
}

export { AuthContext };
