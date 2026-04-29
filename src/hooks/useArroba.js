import { useMemo } from 'react';
import { calcularIndicadoresArroba } from '../domain/arroba';

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
  const { arrobaViva, arrobaCarcaca, valorEstimado, temPesoValido } = useMemo(
    () => calcularIndicadoresArroba({ peso, rendimento, precoPorArroba }),
    [peso, rendimento, precoPorArroba]
  );

  return {
    temPesoValido,
    arrobaViva,
    arrobaCarcaca,
    valorEstimado,
  };
}
