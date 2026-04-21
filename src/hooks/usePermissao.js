import { useAuth } from '../auth/useAuth';

/**
 * Hook para verificar se o usuário autenticado possui uma permissão específica.
 * Utiliza o contexto de autenticação para acessar a função de verificação de permissões.
 *
 * @param {string} permissao - A string que representa a permissão a ser verificada (ex: 'admin', 'editar_lote').
 * @returns {boolean} True se o usuário possui a permissão, false caso contrário.
 */
export function usePermissao(permissao) {
  const { hasPermission } = useAuth();
  // Chama a função hasPermission do contexto de autenticação.
  // Não é necessário usar useMemo aqui, pois hasPermission é geralmente uma operação rápida
  // e o resultado é uma função pura das permissões do usuário e da permissão solicitada.
  return hasPermission(permissao);
}