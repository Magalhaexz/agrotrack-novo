/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { mapProfileRowToUser, fetchUserProfile, isAccessModuleUnavailable } from '../services/userAccess';
import {
  HERDON_LOGOUT_CHANNEL,
  HERDON_LOGOUT_EVENT_KEY,
  limparPersistenciaSessao,
  supabase,
} from '../lib/supabase';
import { obterPerfilDoUsuario, usuarioTemPermissao } from './perfis';

const AuthContext = createContext(null);
const PROFILE_RETRY_ATTEMPTS = 2;
const PROFILE_RETRY_BASE_DELAY_MS = 300;
const PROFILE_RECENT_FAILURE_TTL_MS = 8000;

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function wait(ms) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function getErrorMessage(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  return error.message || error.details || error.hint || error.name || String(error);
}

function isTransientProfileError(error) {
  const message = getErrorMessage(error).toLowerCase();
  return [
    'err_http2_protocol_error',
    'err_connection_reset',
    'err_connection_closed',
    'failed to fetch',
    'timeout',
    'networkerror',
    'network error',
    'fetch failed',
  ].some((signature) => message.includes(signature));
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [profileReady, setProfileReady] = useState(true);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [ultimoLogoutAt, setUltimoLogoutAt] = useState(0);
  const profileInFlightRef = useRef(new Map());
  const profileFailureAtRef = useRef(new Map());

  const resetAuthState = useCallback(() => {
    setSession(null);
    setProfile(null);
    setProfileError(null);
    setProfileReady(true);
    setAuthError(null);
    setLoadingAuth(false);
  }, []);

  const registrarLogoutLocal = useCallback(() => {
    limparPersistenciaSessao();
    setUltimoLogoutAt(Date.now());
    resetAuthState();
  }, [resetAuthState]);

  useEffect(() => {
    let ativo = true;

    async function carregarProfile(userAtual) {
      const userId = String(userAtual?.id || '');
      const profileStart = nowMs();
      if (!userId) {
        if (ativo) {
          setProfile(null);
          setProfileError(null);
          setProfileReady(true);
        }
        return;
      }

      const lastFailureAt = profileFailureAtRef.current.get(userId) || 0;
      if (Date.now() - lastFailureAt < PROFILE_RECENT_FAILURE_TTL_MS) {
        if (import.meta.env.DEV) {
          console.warn('[HERDON_PROFILE_BOOT]', {
            userId,
            status: 'skip_recent_failure',
            hasSession: true,
            profileFallback: true,
          });
        }
        if (ativo) {
          setProfileReady(true);
        }
        return;
      }

      const existingRequest = profileInFlightRef.current.get(userId);
      if (existingRequest) {
        if (import.meta.env.DEV) {
          console.debug('[HERDON_PROFILE_BOOT]', {
            userId,
            status: 'reuse_in_flight',
            hasSession: true,
          });
        }
        await existingRequest;
        return;
      }

      if (ativo) {
        setProfileReady(false);
      }

      const request = (async () => {
        let lastError = null;
        for (let attempt = 1; attempt <= PROFILE_RETRY_ATTEMPTS + 1; attempt += 1) {
          const attemptStart = nowMs();
          try {
            const timeoutPromise = new Promise((_, reject) => {
              globalThis.setTimeout(() => reject(new Error('Timeout ao carregar perfil do usuario.')), 6000);
            });
            const { data, error } = await Promise.race([
              fetchUserProfile(userId),
              timeoutPromise,
            ]);

            if (error) {
              throw error;
            }

            if (!ativo) return;
            setProfile(data || null);
            setProfileError(null);
            setProfileReady(true);
            profileFailureAtRef.current.delete(userId);

            if (import.meta.env.DEV) {
              console.debug('[HERDON_PROFILE_BOOT]', {
                userId,
                attempt,
                status: 'success',
                hasSession: true,
                profileFallback: false,
                durationMs: Number((nowMs() - attemptStart).toFixed(1)),
              });
            }
            return;
          } catch (err) {
            lastError = err;
            const isTransient = isTransientProfileError(err);
            const finalAttempt = attempt > PROFILE_RETRY_ATTEMPTS || !isTransient;
            const knownAccessModuleIssue = isAccessModuleUnavailable(err);
            if (import.meta.env.DEV) {
              console.warn('[HERDON_PROFILE_BOOT]', {
                userId,
                attempt,
                status: finalAttempt ? 'failure_final' : 'failure_retrying',
                hasSession: true,
                profileFallback: true,
                transient: isTransient,
                accessModuleUnavailable: knownAccessModuleIssue,
                errorType: getErrorMessage(err) || 'profile_fetch_error',
                durationMs: Number((nowMs() - attemptStart).toFixed(1)),
              });
            }
            if (finalAttempt) {
              break;
            }
            await wait(PROFILE_RETRY_BASE_DELAY_MS * attempt);
          }
        }

        if (!ativo) return;
        profileFailureAtRef.current.set(userId, Date.now());
        setProfile(null);
        setProfileError(lastError);
        setProfileReady(true);
      })();

      profileInFlightRef.current.set(userId, request);

      try {
        await request;
      } finally {
        if (profileInFlightRef.current.get(userId) === request) {
          profileInFlightRef.current.delete(userId);
        }
        if (import.meta.env.DEV) {
          console.debug('[HERDON_AUTH_TIMING]', {
            stage: 'profile_finally',
            durationMs: Number((nowMs() - profileStart).toFixed(1)),
            hasUser: true,
          });
        }
      }
    }

    async function carregarSessao() {
      const bootstrapStart = nowMs();
      let hasSession = false;
      try {
        const getSessionStart = nowMs();
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise((_, reject) => {
            globalThis.setTimeout(() => reject(new Error('Timeout ao obter sessao de autenticacao.')), 4500);
          }),
        ]);
        const getSessionEnd = nowMs();
        const { data, error } = sessionResult;

        if (error) {
          console.error('Erro ao obter sessao:', error);
          if (ativo) {
            resetAuthState();
          }
          if (import.meta.env.DEV) {
            console.debug('[HERDON_AUTH_TIMING]', {
              stage: 'getSession',
              durationMs: Number((getSessionEnd - getSessionStart).toFixed(1)),
              hasSession: false,
              hasError: true,
            });
          }
          return;
        }

        if (!ativo) return;
        const sessaoAtual = data?.session ?? null;
        hasSession = Boolean(sessaoAtual?.user);
        setSession(sessaoAtual);
        setAuthError(null);
        setLoadingAuth(false);
        setProfileReady(true);
        if (import.meta.env.DEV) {
          console.debug('[HERDON_AUTH_BOOT]', {
            stage: 'session_bootstrap',
            hasSession,
            loadingAuth: false,
          });
        }
        if (import.meta.env.DEV) {
          console.debug('[HERDON_AUTH_TIMING]', {
            stage: 'getSession',
            durationMs: Number((getSessionEnd - getSessionStart).toFixed(1)),
            hasSession,
            hasError: false,
          });
        }

        if (sessaoAtual?.user) {
          void carregarProfile(sessaoAtual.user);
        } else {
          setProfile(null);
          setProfileError(null);
          setProfileReady(true);
        }
      } catch (err) {
        console.error('Erro inesperado ao obter sessao:', err);

        if (ativo) {
          setSession(null);
          setProfile(null);
          setProfileError(null);
          setProfileReady(true);
          setAuthError(err);
          setLoadingAuth(false);
        }
      } finally {
        if (import.meta.env.DEV) {
          const bootstrapEnd = nowMs();
          console.debug('[HERDON_AUTH_TIMING]', {
            stage: 'bootstrap_total',
            durationMs: Number((bootstrapEnd - bootstrapStart).toFixed(1)),
            hasSession,
          });
        }
      }
    }

    carregarSessao();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((eventName, sessionAtual) => {
      try {
        if (eventName === 'SIGNED_OUT' || !sessionAtual) {
          registrarLogoutLocal();
          return;
        }

        setSession(sessionAtual);
        setAuthError(null);
        setLoadingAuth(false);
        setProfileReady(true);
        if (import.meta.env.DEV) {
          console.debug('[HERDON_AUTH_BOOT]', {
            stage: 'auth_state_change',
            event: eventName,
            hasSession: Boolean(sessionAtual?.user),
            loadingAuth: false,
          });
        }
        if (sessionAtual?.user) {
          void carregarProfile(sessionAtual.user);
        }
      } catch (error) {
        console.error('Erro no listener de autenticacao:', error);
        if (ativo && !sessionAtual?.user) {
          resetAuthState();
        }
      }
    });

    async function validarSessaoAoRetornar() {
      if (document.visibilityState === 'hidden') return;

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        if (import.meta.env.DEV) {
          console.warn('[HERDON_AUTH_BOOT]', {
            stage: 'session_recheck_error',
            hasSession: Boolean(data?.session),
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
      registrarLogoutLocal();
    }

    let authChannel = null;
    function onBroadcast(event) {
      if (event?.data?.type !== 'logout') return;
      registrarLogoutLocal();
    }

    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', validarSessaoAoRetornar);
    document.addEventListener('visibilitychange', validarSessaoAoRetornar);

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

    setProfileReady(false);
    const { data, error } = await fetchUserProfile(userAtual.id);

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
