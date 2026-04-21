import { createContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { obterPerfilDoUsuario, usuarioTemPermissao } from './perfis';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    let ativo = true;

    async function carregarSessao() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Erro ao obter sessão:', error);
          if (ativo) {
            setAuthError(error);
            setSession(null);
            setLoadingAuth(false);
          }
          return;
        }

        if (ativo) {
          setSession(data?.session ?? null);
          setAuthError(null);
          setLoadingAuth(false);
        }
      } catch (err) {
        console.error('Erro inesperado ao obter sessão:', err);

        if (ativo) {
          setSession(null);
          setAuthError(err);
          setLoadingAuth(false);
        }
      }
    }

    carregarSessao();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, sessionAtual) => {
      setSession(sessionAtual ?? null);
      setAuthError(null);
      setLoadingAuth(false);
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => {
    const user = session?.user ?? null;
    const perfil = obterPerfilDoUsuario(user);

    return {
      session,
      user,
      perfil,
      loadingAuth,
      authError,
      hasPermission: (permissao) => usuarioTemPermissao(user, permissao),
    };
  }, [session, loadingAuth, authError]);

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