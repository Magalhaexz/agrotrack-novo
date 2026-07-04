import { usePermissao } from '../hooks/usePermissao';
import BloqueadoPorPermissao from './BloqueadoPorPermissao';
import BloqueadoPorPlano from './BloqueadoPorPlano';

/**
 * `moduleBloqueado`/`moduleMensagem` (Sprint 7): cobre o caso em que o papel
 * TEM permissão para a página, mas o PLANO da conta não inclui o módulo —
 * fecha o mesmo gap que já existia só no clique de navegação
 * (`navigateWithPermission`, App.jsx), agora também para carregamento direto
 * de rota/URL e refresh de página.
 */
export default function RotaProtegida({ permissao, moduleBloqueado = false, moduleMensagem = null, onIrParaAssinatura = null, children }) {
  const permitido = usePermissao(permissao);

  if (!permitido) {
    // Renderiza o componente de bloqueio se o usuário não tiver a permissão necessária.
    return <BloqueadoPorPermissao />;
  }

  if (moduleBloqueado) {
    return <BloqueadoPorPlano mensagem={moduleMensagem} onIrParaAssinatura={onIrParaAssinatura} />;
  }

  // Renderiza o conteúdo da rota se o usuário tiver a permissão.
  return children;
}
