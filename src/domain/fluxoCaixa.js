import { toNumber } from './calcHelpers.js';
import { hojeLocalISO } from './dataCivil.js';
import {
  deveEntrarNoFluxoCaixa,
  getDataVencimento,
} from './financeiroStatus.js';

function round2(value) {
  const safe = toNumber(value);
  return Math.round(safe * 100) / 100;
}

/**
 * Calcula fluxo de caixa a partir das movimentações financeiras.
 *
 * Fluxo de caixa = apenas movimentações pagas ou legado sem status e sem campo pago.
 * Contas a receber = receitas realizadas não pagas.
 * Contas a pagar = despesas realizadas não pagas.
 * Previsto futuro = movimentações com status 'previsto'.
 * Vencido = movimentações com data_vencimento anterior a hoje e não pagas.
 *
 * @param {object[]} movimentacoes - Array de movimentacoes_financeiras
 * @param {{ hoje?: string, loteId?: number }} opcoes
 * @returns {{ totalRecebido, totalPago, saldoCaixa, contasAReceber, contasAPagar, previstoFuturo, vencido }}
 */
export function calcularFluxoCaixa(movimentacoes, opcoes = {}) {
  const lista = Array.isArray(movimentacoes) ? movimentacoes : [];
  const hoje = opcoes.hoje || hojeLocalISO();
  const loteId = opcoes.loteId != null ? Number(opcoes.loteId) : null;

  const filtradas = loteId != null
    ? lista.filter((mov) => Number(mov?.lote_id) === loteId)
    : lista;

  let totalRecebido = 0;
  let totalPago = 0;
  let contasAReceber = 0;
  let contasAPagar = 0;
  let previstoFuturo = 0;
  let vencido = 0;

  for (const mov of filtradas) {
    const valor = toNumber(mov?.valor);
    const tipo = mov?.tipo;
    const status = mov?.status;
    const dataVencimento = getDataVencimento(mov);
    const entraCaixa = deveEntrarNoFluxoCaixa(mov);

    if (status === 'previsto') {
      previstoFuturo += valor;
      continue;
    }

    if (status === 'cancelado') {
      continue;
    }

    if (entraCaixa) {
      if (tipo === 'receita') {
        totalRecebido += valor;
      } else if (tipo === 'despesa') {
        totalPago += valor;
      }
    } else {
      // Realizado mas não pago → contas a receber / a pagar
      if (tipo === 'receita') {
        contasAReceber += valor;
        if (dataVencimento && dataVencimento < hoje) {
          vencido += valor;
        }
      } else if (tipo === 'despesa') {
        contasAPagar += valor;
        if (dataVencimento && dataVencimento < hoje) {
          vencido += valor;
        }
      }
    }
  }

  return {
    totalRecebido: round2(totalRecebido),
    totalPago: round2(totalPago),
    saldoCaixa: round2(totalRecebido - totalPago),
    contasAReceber: round2(contasAReceber),
    contasAPagar: round2(contasAPagar),
    previstoFuturo: round2(previstoFuturo),
    vencido: round2(vencido),
  };
}
