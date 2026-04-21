import { useContext } from 'react';
import { AuthContext } from './AuthContext';

export function useAuth() {
  const contexto = useContext(AuthContext);
<<<<<<< HEAD

  if (!contexto) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }

  return contexto;
}
=======
  if (!contexto) {
    throw new Error('useAuth deve ser utilizado dentro de AuthProvider');
  }
  return contexto;
}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
