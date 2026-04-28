import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { mapProfileRowToUser, fetchUserProfile, isAccessModuleUnavailable } from '../services/userAccess';
import { supabase } from '../lib/supabase';
import { obterPerfilDoUsuario, usuarioTemPermissao } from './perfis';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [profileReady, setProfileReady] = useState(true);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    let ativo = true;

    async function carregarProfile(userAtual) {
      const profileStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (!userAtual?.id) {
        if (ativo) {
          setProfile(null);
          setProfileError(null);
          setProfileReady(true);
        }
        return;
      }

      if (ativo) {
        setProfileReady(false);
      }

      try {
        const timeoutPromise = new Promise((_, reject) => {
          window.setTimeout(() => reject(new Error('Timeout ao carregar perfil do usuário.')), 6000);
        });
        const { data, error } = await Promise.race([
          fetchUserProfile(userAtual.id),
          timeoutPromise,
        ]);

        if (error) {
          if (!isAccessModuleUnavailable(error)) {
            console.error('Erro ao carregar profile do usuario:', error);
          }

          if (ativo) {
            setProfile(null);
            setProfileError(error);
            setProfileReady(true);
          }
          return;
        }

        if (ativo) {
          setProfile(data || null);
          setProfileError(null);
          setProfileReady(true);
        }
        if (import.meta.env.DEV) {
          const profileEnd = typeof performance !== 'undefined' ? performance.now() : Date.now();
          console.debug('[HERDON_AUTH_TIMING]', {
            stage: 'profile_success',
            durationMs: Number((profileEnd - profileStart).toFixed(1)),
          });
        }
      } catch (err) {
        console.error('Erro inesperado ao carregar profile:', err);

        if (ativo) {
          setProfile(null);
          setProfileError(err);
          setProfileReady(true);
        }
      } finally {
        if (import.meta.env.DEV) {
          const profileEnd = typeof performance !== 'undefined' ? performance.now() : Date.now();
          console.debug('[HERDON_AUTH_TIMING]', {
            stage: 'profile_finally',
            durationMs: Number((profileEnd - profileStart).toFixed(1)),
            hasUser: Boolean(userAtual?.id),
          });
        }
      }
    }

    async function carregarSessao() {
      const bootstrapStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
      let hasSession = false;
      try {
        const getSessionStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise((_, reject) => {
            window.setTimeout(() => reject(new Error('Timeout ao obter sessão de autenticação.')), 4500);
          }),
        ]);
        const getSessionEnd = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const { data, error } = sessionResult;

        if (error) {
          console.error('Erro ao obter sessão:', error);
          if (ativo) {
            setAuthError(error);
            setSession(null);
            setProfile(null);
            setProfileError(null);
            setProfileReady(true);
            setLoadingAuth(false);
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
        console.error('Erro inesperado ao obter sessão:', err);

        if (ativo) {
          setSession(null);
          setAuthError(err);
          setProfile(null);
          setProfileReady(true);
          setLoadingAuth(false);
        }
      } finally {
        if (import.meta.env.DEV) {
          const bootstrapEnd = typeof performance !== 'undefined' ? performance.now() : Date.now();
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
    } = supabase.auth.onAuthStateChange((_event, sessionAtual) => {
      try {
        setSession(sessionAtual ?? null);
        setAuthError(null);
        setLoadingAuth(false);
        if (sessionAtual?.user) {
          void carregarProfile(sessionAtual.user);
        } else {
          setProfile(null);
          setProfileError(null);
          setProfileReady(true);
        }
      } catch (error) {
        console.error('Erro no listener de autenticação:', error);
        if (ativo) {
          setSession(null);
          setProfile(null);
          setProfileReady(true);
          setLoadingAuth(false);
        }
      }
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, []);

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
      hasPermission: (permissao) => usuarioTemPermissao(user, permissao),
    };
  }, [session, profile, loadingAuth, authError, profileError, profileReady, refreshProfile]);

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
