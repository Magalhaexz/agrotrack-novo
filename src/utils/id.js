/**
 * Gera um novo ID único para um item em uma lista.
 * O ID gerado é o maior ID existente na lista + 1.
 * Se a lista estiver vazia ou não for fornecida, retorna 1.
 * Assume que cada item na lista possui uma propriedade 'id' que pode ser convertida para número.
 *
 * @param {Array<object>} lista - A lista de objetos para a qual gerar um novo ID.
 * @returns {number} O próximo ID disponível.
 */
export const gerarNovoId = (lista) => {
  // Se a lista for nula, indefinida ou vazia, o primeiro ID será 1.
  if (!lista || lista.length === 0) return 1;

  // Mapeia a lista para obter apenas os IDs, convertendo-os para número.
  // Usa 0 como fallback caso item.id não seja um número válido.
  const ids = lista.map((item) => Number(item.id) || 0);

  // Encontra o maior ID na lista e adiciona 1 para obter o próximo ID.
  return Math.max(...ids) + 1;
};
