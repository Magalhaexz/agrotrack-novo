import { usePermissao } from '../hooks/usePermissao';
import BloqueadoPorPermissao from './BloqueadoPorPermissao';

export default function RotaProtegida({ permissao, children }) {
  const permitido = usePermissao(permissao);

  if (!permitido) {
<<<<<<< HEAD
    // Renderiza o componente de bloqueio se o usuário não tiver a permissão necessária.
    return <BloqueadoPorPermissao />;
  }

  // Renderiza o conteúdo da rota se o usuário tiver a permissão.
  return children;
}
=======
    return <BloqueadoPorPermissao />;
  }

  return children;
}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
