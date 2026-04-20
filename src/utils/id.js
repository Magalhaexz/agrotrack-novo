export const gerarNovoId = (lista) => {
  if (!lista || lista.length === 0) return 1;
  return Math.max(...lista.map((item) => Number(item.id) || 0)) + 1;
};
