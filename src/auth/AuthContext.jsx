import { createContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { obterPerfilDoUsuario, usuarioTemPermissao } from './perfis';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
<<<<<<< HEAD
  const [authError, setAuthError] = useState(null);
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d

  useEffect(() => {
    let ativo = true;

    async function carregarSessao() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Erro ao obter sessão:', error);
<<<<<<< HEAD
          if (ativo) {
            setAuthError(error);
            setSession(null);
            setLoadingAuth(false);
          }
          return;
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
        }

        if (ativo) {
          setSession(data?.session ?? null);
<<<<<<< HEAD
          setAuthError(null);
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
          setLoadingAuth(false);
        }
      } catch (err) {
        console.error('Erro inesperado ao obter sessão:', err);

        if (ativo) {
          setSession(null);
<<<<<<< HEAD
          setAuthError(err);
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
          setLoadingAuth(false);
        }
      }
    }

    carregarSessao();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, sessionAtual) => {
      setSession(sessionAtual ?? null);
<<<<<<< HEAD
      setAuthError(null);
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
      setLoadingAuth(false);
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, []);

<<<<<<< HEAD
  const value = useMemo(() => {
    const user = session?.user ?? null;
    const perfil = obterPerfilDoUsuario(user);

    return {
=======
  const user = session?.user ?? null;
  const perfil = obterPerfilDoUsuario(user);

  const value = useMemo(
    () => ({
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
      session,
      user,
      perfil,
      loadingAuth,
<<<<<<< HEAD
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
=======
      hasPermission: (permissao) => usuarioTemPermissao(user, permissao),
    }),
    [session, user, perfil, loadingAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext };
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
