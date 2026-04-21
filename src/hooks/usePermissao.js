import { useAuth } from '../auth/useAuth';

export function usePermissao(permissao) {
  const { hasPermission } = useAuth();
  return hasPermission(permissao);
}
