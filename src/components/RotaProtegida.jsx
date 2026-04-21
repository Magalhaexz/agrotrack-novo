import { usePermissao } from '../hooks/usePermissao';
import BloqueadoPorPermissao from './BloqueadoPorPermissao';

export default function RotaProtegida({ permissao, children }) {
  const permitido = usePermissao(permissao);

  if (!permitido) {
    return <BloqueadoPorPermissao />;
  }

  return children;
}
