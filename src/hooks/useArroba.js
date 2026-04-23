
import { useMemo } from 'react';

function toSafeNumber(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  return Number(String(value).replace(',', '.').trim()) || 0;
}

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
  const { arrobaViva, arrobaCarcaca, valorEstimado } = useMemo(() => {
    const p = toSafeNumber(peso);
    const rend = toSafeNumber(rendimento) / 100;
    const preco = toSafeNumber(precoPorArroba);

    const calcArrobaViva = p / 15; // 1 arroba = 15 kg
    const calcArrobaCarcaca = (p * rend) / 15;
    const calcValorEstimado = calcArrobaCarcaca * preco;

    return {
      arrobaViva: calcArrobaViva.toFixed(2),
      arrobaCarcaca: calcArrobaCarcaca.toFixed(2),
      valorEstimado: calcValorEstimado.toFixed(2),
    };
  }, [peso, rendimento, precoPorArroba]);

  return {
    arrobaViva,
    arrobaCarcaca,
    valorEstimado,
  };
}
