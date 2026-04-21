import { useMemo } from 'react';

/**
 * Hook para calcular valores relacionados à arroba (viva, carcaça e valor estimado).
 *
 * @param {object} props - As propriedades do hook.
 * @param {number|string} props.peso - O peso vivo em kg.
 * @param {number|string} [props.rendimento=52] - O rendimento de carcaça em porcentagem (ex: 52 para 52%).
 * @param {number|string} [props.precoPorArroba=0] - O preço por arroba da carcaça.
 * @returns {{arrobaViva: string, arrobaCarcaca: string, valorEstimado: string}} Um objeto com os valores calculados formatados para duas casas decimais.
 */
export function useArroba({ peso, rendimento = 52, precoPorArroba = 0 }) {
  // Use useMemo para memorizar os cálculos e evitar re-execuções desnecessárias
  const { arrobaViva, arrobaCarcaca, valorEstimado } = useMemo(() => {
    const p = Number(peso) || 0;
    const rend = Number(rendimento) / 100; // Converte porcentagem para decimal
    const preco = Number(precoPorArroba) || 0;

    const calcArrobaViva = p / 15; // 1 arroba = 15 kg
    const calcArrobaCarcaca = (p * rend) / 15;
    const calcValorEstimado = calcArrobaCarcaca * preco;

    return {
      arrobaViva: calcArrobaViva.toFixed(2),
      arrobaCarcaca: calcArrobaCarcaca.toFixed(2),
      valorEstimado: calcValorEstimado.toFixed(2),
    };
  }, [peso, rendimento, precoPorArroba]); // Dependências do useMemo

  return {
    arrobaViva,
    arrobaCarcaca,
    valorEstimado,
  };
}