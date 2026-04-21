import { createContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { obterPerfilDoUsuario, usuarioTemPermissao } from './perfis';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    let ativo = true;

    async function carregarSessao() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Erro ao obter sessão:', error);
        }

        if (ativo) {
          setSession(data?.session ?? null);
          setLoadingAuth(false);
        }
      } catch (err) {
        console.error('Erro inesperado ao obter sessão:', err);

        if (ativo) {
          setSession(null);
          setLoadingAuth(false);
        }
      }
    }

    carregarSessao();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, sessionAtual) => {
      setSession(sessionAtual ?? null);
      setLoadingAuth(false);
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;
  const perfil = obterPerfilDoUsuario(user);

  const value = useMemo(
    () => ({
      session,
      user,
      perfil,
      loadingAuth,
      hasPermission: (permissao) => usuarioTemPermissao(user, permissao),
    }),
    [session, user, perfil, loadingAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext };
