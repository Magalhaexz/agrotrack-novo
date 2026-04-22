import { usePermissao } from '../hooks/usePermissao';
import BloqueadoPorPermissao from './BloqueadoPorPermissao';

export default function RotaProtegida({ permissao, children }) {
  const permitido = usePermissao(permissao);

  if (!permitido) {
    // Renderiza o componente de bloqueio se o usuário não tiver a permissão necessária.
    return <BloqueadoPorPermissao />;
  }

  // Renderiza o conteúdo da rota se o usuário tiver a permissão.
  return children;
}
