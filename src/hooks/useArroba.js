import { useMemo } from 'react';
import { parseNumeroEntrada } from '../utils/formatters';

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
  const { arrobaViva, arrobaCarcaca, valorEstimado, temPesoValido } = useMemo(() => {
    const pesoNormalizado = parseNumeroEntrada(peso);
    const rendimentoNormalizado = parseNumeroEntrada(rendimento);
    const precoNormalizado = parseNumeroEntrada(precoPorArroba);

    const p = Number.isFinite(pesoNormalizado) ? pesoNormalizado : 0;
    const rend = Number.isFinite(rendimentoNormalizado) ? rendimentoNormalizado / 100 : 0;
    const preco = Number.isFinite(precoNormalizado) ? precoNormalizado : 0;

    const calcArrobaViva = p / 15; // 1 arroba = 15 kg
    const calcArrobaCarcaca = (p * rend) / 15;
    const calcValorEstimado = calcArrobaCarcaca * preco;

    return {
      temPesoValido: p > 0,
      arrobaViva: calcArrobaViva.toFixed(2),
      arrobaCarcaca: calcArrobaCarcaca.toFixed(2),
      valorEstimado: calcValorEstimado.toFixed(2),
    };
  }, [peso, rendimento, precoPorArroba]);

  return {
    temPesoValido,
    arrobaViva,
    arrobaCarcaca,
    valorEstimado,
  };
}
