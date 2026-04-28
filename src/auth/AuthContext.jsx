/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { mapProfileRowToUser, fetchUserProfile, isAccessModuleUnavailable } from '../services/userAccess';
import {
  HERDON_LOGOUT_CHANNEL,
  HERDON_LOGOUT_EVENT_KEY,
  HERDON_LOGIN_ATTEMPT_KEY,
  limparPersistenciaSessao,
  obterLogoutEmAndamentoAt,
  supabase,
} from '../lib/supabase';
import { obterPerfilDoUsuario, usuarioTemPermissao } from './perfis';

const AuthContext = createContext(null);
const PROFILE_FAILURE_COOLDOWN_MS = 120000;
const LOGIN_ATTEMPT_IGNORE_WINDOW_MS = 7000;

function getErrorMessage(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  return error.message || error.details || error.hint || error.name || String(error);
}

function getRecentLoginAttemptAt() {
  try {
    const raw = localStorage.getItem(HERDON_LOGIN_ATTEMPT_KEY);
    const value = Number(raw);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function hasRecentLoginAttempt() {
  return Date.now() - getRecentLoginAttemptAt() < LOGIN_ATTEMPT_IGNORE_WINDOW_MS;
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

      const lastFailure = profileFailureAtRef.current.get(userId) || 0;
      if (Date.now() - lastFailure < PROFILE_FAILURE_COOLDOWN_MS) {
        if (import.meta.env.DEV) {
          console.warn('[HERDON_PROFILE_BOOT]', {
            stage: 'skip_recent_failure',
            hasUserId: true,
            generationId,
          });
        }
        if (ativo && authGenerationRef.current === generationId) {
          setProfileReady(true);
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
        const { data, error } = await fetchUserProfile(userId);
        const isCurrent = ativo && authGenerationRef.current === generationId && activeUserIdRef.current === userId;
        if (!isCurrent) {
          if (import.meta.env.DEV) {
            console.debug('[HERDON_PROFILE_BOOT]', {
              stage: 'profile_result_ignored_stale',
              hasUserId: true,
              generationId,
            });
          }
          return;
        }

        if (error) {
          profileFailureAtRef.current.set(userId, Date.now());
          if (!isAccessModuleUnavailable(error) && import.meta.env.DEV) {
            console.warn('[HERDON_PROFILE_BOOT]', {
              stage: 'profile_error',
              generationId,
              errorType: getErrorMessage(error) || 'profile_error',
            });
          }
          setProfile(null);
          setProfileError(error);
          setProfileReady(true);
          return;
        }

        profileFailureAtRef.current.delete(userId);
        setProfile(data || null);
        setProfileError(null);
        setProfileReady(true);
      })().catch((error) => {
        const isCurrent = ativo && authGenerationRef.current === generationId && activeUserIdRef.current === userId;
        if (!isCurrent) return;
        profileFailureAtRef.current.set(userId, Date.now());
        if (import.meta.env.DEV) {
          console.warn('[HERDON_PROFILE_BOOT]', {
            stage: 'profile_exception',
            generationId,
            errorType: getErrorMessage(error) || 'profile_exception',
          });
        }
        setProfile(null);
        setProfileError(error);
        setProfileReady(true);
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
        activeUserIdRef.current = sessaoAtual?.user?.id || null;
        setSession(sessaoAtual);
        setAuthError(null);
        setLoadingAuth(false);
        setProfileReady(true);

        if (import.meta.env.DEV) {
          console.debug('[HERDON_AUTH_BOOT]', {
            stage: 'session_bootstrap',
            generationId,
            hasSession: Boolean(sessaoAtual?.user),
          });
        }

        if (sessaoAtual?.user) {
          void carregarProfile(sessaoAtual.user, generationId);
        } else {
          setProfile(null);
          setProfileError(null);
          setProfileReady(true);
        }
      } catch (error) {
        if (!ativo || authGenerationRef.current !== generationId) return;
        resetAuthState();
        setAuthError(error);
      }
    }

    carregarSessao();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((eventName, sessionAtual) => {
      const generationId = authGenerationRef.current + 1;
      authGenerationRef.current = generationId;

      if (eventName === 'SIGNED_OUT' || !sessionAtual) {
        const shouldIgnoreStaleSignOut = hasRecentLoginAttempt();
        if (shouldIgnoreStaleSignOut) {
          if (import.meta.env.DEV) {
            console.debug('[HERDON_AUTH_BOOT]', {
              stage: 'ignore_stale_signed_out',
              generationId,
            });
          }
          return;
        }
        registrarLogoutLocal();
        profileInFlightRef.current.clear();
        return;
      }

      activeUserIdRef.current = sessionAtual?.user?.id || null;
      if (activeUserIdRef.current) {
        profileFailureAtRef.current.delete(activeUserIdRef.current);
      }
      setSession(sessionAtual);
      setAuthError(null);
      setLoadingAuth(false);
      setProfileReady(true);
      if (import.meta.env.DEV) {
        console.debug('[HERDON_AUTH_BOOT]', {
          stage: 'auth_state_change',
          generationId,
          eventName,
          hasSession: Boolean(sessionAtual?.user),
        });
      }
      if (sessionAtual?.user) {
        void carregarProfile(sessionAtual.user, generationId);
      }
    });

    async function validarSessaoAoRetornar() {
      if (document.visibilityState === 'hidden') return;
      if (hasRecentLoginAttempt()) {
        if (import.meta.env.DEV) {
          console.debug('[HERDON_AUTH_BOOT]', {
            stage: 'session_recheck_skipped_login_attempt',
          });
        }
        return;
      }
      if (Date.now() - obterLogoutEmAndamentoAt() < LOGIN_ATTEMPT_IGNORE_WINDOW_MS) {
        if (import.meta.env.DEV) {
          console.debug('[HERDON_AUTH_BOOT]', {
            stage: 'session_recheck_skipped_logout_in_progress',
          });
        }
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        if (import.meta.env.DEV) {
          console.warn('[HERDON_AUTH_BOOT]', {
            stage: 'session_recheck_error',
            hasSession: Boolean(activeUserIdRef.current),
            errorType: getErrorMessage(error) || 'session_recheck_error',
          });
        }
        return;
      }

      if (!data?.session) {
        registrarLogoutLocal();
      }
    }

    function onStorage(event) {
      if (event.key !== HERDON_LOGOUT_EVENT_KEY || !event.newValue) return;
      if (hasRecentLoginAttempt()) {
        if (import.meta.env.DEV) {
          console.debug('[HERDON_AUTH_BOOT]', {
            stage: 'storage_logout_ignored_recent_login',
          });
        }
        return;
      }
      registrarLogoutLocal();
    }

    let authChannel = null;
    function onBroadcast(event) {
      if (event?.data?.type !== 'logout') return;
      if (hasRecentLoginAttempt()) {
        if (import.meta.env.DEV) {
          console.debug('[HERDON_AUTH_BOOT]', {
            stage: 'broadcast_logout_ignored_recent_login',
          });
        }
        return;
      }
      registrarLogoutLocal();
    }

    function onLoginAttemptReset() {
      authGenerationRef.current += 1;
      profileInFlightRef.current.clear();
      profileFailureAtRef.current.clear();
      setAuthError(null);
      setProfileError(null);
      setProfileReady(true);
      if (import.meta.env.DEV) {
        console.debug('[HERDON_AUTH_BOOT]', {
          stage: 'login_attempt_reset',
          generationId: authGenerationRef.current,
        });
      }
    }

    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', validarSessaoAoRetornar);
    document.addEventListener('visibilitychange', validarSessaoAoRetornar);
    window.addEventListener('herdon-login-attempt', onLoginAttemptReset);

    try {
      authChannel = new BroadcastChannel(HERDON_LOGOUT_CHANNEL);
      authChannel.addEventListener('message', onBroadcast);
    } catch {
      authChannel = null;
    }

    return () => {
      ativo = false;
      subscription.unsubscribe();
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', validarSessaoAoRetornar);
      document.removeEventListener('visibilitychange', validarSessaoAoRetornar);
      window.removeEventListener('herdon-login-attempt', onLoginAttemptReset);
      if (authChannel) {
        authChannel.removeEventListener('message', onBroadcast);
        authChannel.close();
      }
    };
  }, [registrarLogoutLocal, resetAuthState]);

  const refreshProfile = useCallback(async () => {
    const userAtual = session?.user ?? null;
    if (!userAtual?.id) {
      setProfile(null);
      setProfileReady(true);
      return null;
    }

    const existingProfileRequest = profileInFlightRef.current.get(userAtual.id);
    if (existingProfileRequest) {
      await existingProfileRequest;
    }
    const generationId = authGenerationRef.current;
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
      setProfileError(error);
      setProfileReady(true);
      return null;
    }

    setProfile(data || null);
    setProfileError(null);
    setProfileReady(true);
    return data || null;
  }, [session]);

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
      forceLocalSignOut: registrarLogoutLocal,
      ultimoLogoutAt,
      hasPermission: (permissao) => usuarioTemPermissao(user, permissao),
    };
  }, [session, profile, loadingAuth, authError, profileError, profileReady, refreshProfile, registrarLogoutLocal, ultimoLogoutAt]);

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
