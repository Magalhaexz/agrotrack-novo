export function useArroba({ peso, rendimento = 52, precoPorArroba = 0 }) {
  const p = Number(peso) || 0;
  const rend = Number(rendimento) / 100;
  const preco = Number(precoPorArroba) || 0;

  const arrobaViva = p / 15;
  const arrobaCarcaca = (p * rend) / 15;
  const valorEstimado = arrobaCarcaca * preco;

  return {
    arrobaViva: arrobaViva.toFixed(2),
    arrobaCarcaca: arrobaCarcaca.toFixed(2),
    valorEstimado: valorEstimado.toFixed(2),
  };
}
