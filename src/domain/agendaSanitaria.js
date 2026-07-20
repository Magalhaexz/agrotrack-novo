// Agenda Sanitária (Sprint 10) — visão de leitura sobre `db.sanitario`, para
// o produtor navegar todos os manejos por janela de vencimento. Não recalcula
// nada que já exista: só bucketiza os mesmos campos (`proxima`,
// `data_fim_carencia`, `data_aplic`) que os detectores de alerta já leem.
import { toDateKey, daysBetween, toNumber } from './calcHelpers.js';

const JANELA_HOJE = 0;
const JANELA_7_DIAS = 7;
const JANELA_30_DIAS = 30;
const REALIZADOS_LIMITE = 10;

function nomeDoLote(lotesMap, loteId) {
  const lote = lotesMap.get(toNumber(loteId));
  return lote?.nome || (loteId ? `Lote ${loteId}` : 'Sem lote vinculado');
}

function montarItem(registro, lotesMap, { dataPrevista, status, acaoSugerida }) {
  return {
    id: registro.id,
    tipo: registro.tipo || 'outro',
    produto: registro.desc || 'Manejo sanitário',
    loteNome: nomeDoLote(lotesMap, registro.lote_id),
    dataPrevista: dataPrevista || null,
    status,
    acaoSugerida,
  };
}

function ordenarPorData(lista) {
  return lista.slice().sort((a, b) => String(a.dataPrevista || '').localeCompare(String(b.dataPrevista || '')));
}

/**
 * Bucketiza `db.sanitario` em 6 janelas para a Agenda Sanitária:
 * vencidos, vencendoHoje, proximos7Dias, proximos30Dias, realizados, emCarencia.
 * `data_fim_carencia` é opcional (campo novo do Sprint 10) — registros sem
 * esse campo simplesmente não entram em `emCarencia`.
 */
export function construirAgendaSanitaria(db = {}, opcoes = {}) {
  const agora = opcoes.agora || new Date();
  const hoje = toDateKey(agora);
  const registros = Array.isArray(db?.sanitario) ? db.sanitario : [];
  const lotesMap = new Map((Array.isArray(db?.lotes) ? db.lotes : []).map((l) => [toNumber(l.id), l]));

  const vencidos = [];
  const vencendoHoje = [];
  const proximos7Dias = [];
  const proximos30Dias = [];
  const emCarencia = [];

  registros.forEach((registro) => {
    if (registro?.proxima) {
      const proxima = toDateKey(registro.proxima);
      if (proxima) {
        const dias = daysBetween(hoje, proxima);
        if (dias < 0) {
          vencidos.push(montarItem(registro, lotesMap, { dataPrevista: proxima, status: 'vencido', acaoSugerida: 'Regularizar o manejo o quanto antes.' }));
        } else if (dias === JANELA_HOJE) {
          vencendoHoje.push(montarItem(registro, lotesMap, { dataPrevista: proxima, status: 'vence_hoje', acaoSugerida: 'Executar o manejo hoje.' }));
        } else if (dias <= JANELA_7_DIAS) {
          proximos7Dias.push(montarItem(registro, lotesMap, { dataPrevista: proxima, status: 'proximo_7_dias', acaoSugerida: 'Programar o manejo nos próximos dias.' }));
        } else if (dias <= JANELA_30_DIAS) {
          proximos30Dias.push(montarItem(registro, lotesMap, { dataPrevista: proxima, status: 'proximo_30_dias', acaoSugerida: 'Planejar o manejo dentro do mês.' }));
        }
      }
    }

    if (registro?.data_fim_carencia) {
      const fimCarencia = toDateKey(registro.data_fim_carencia);
      if (fimCarencia && daysBetween(hoje, fimCarencia) >= 0) {
        emCarencia.push(montarItem(registro, lotesMap, { dataPrevista: fimCarencia, status: 'em_carencia', acaoSugerida: 'Não vender ou abater até o fim da carência.' }));
      }
    }
  });

  const realizados = registros
    .filter((registro) => Boolean(registro?.data_aplic))
    .slice()
    .sort((a, b) => (toDateKey(b.data_aplic) || '').localeCompare(toDateKey(a.data_aplic) || ''))
    .slice(0, REALIZADOS_LIMITE)
    .map((registro) => montarItem(registro, lotesMap, { dataPrevista: toDateKey(registro.data_aplic), status: 'realizado', acaoSugerida: null }));

  return {
    vencidos: ordenarPorData(vencidos),
    vencendoHoje: ordenarPorData(vencendoHoje),
    proximos7Dias: ordenarPorData(proximos7Dias),
    proximos30Dias: ordenarPorData(proximos30Dias),
    realizados,
    emCarencia: ordenarPorData(emCarencia),
  };
}

/**
 * Verifica se um LOTE tem carência sanitária ativa numa data de referência —
 * mesma condição do bucket `emCarencia` acima, extraída para ser reaproveitada
 * por quem precisa BLOQUEAR uma venda (não só exibir um aviso informativo):
 * `src/services/movimentacoes.js` (venda de lote e venda individual) e o bot
 * do Telegram, antes de confirmar a operação.
 *
 * Quando há mais de um manejo com carência ativa no lote, usa o de data-fim
 * mais distante (o mais restritivo).
 */
export function verificarCarenciaAtivaLote(sanitarioRegistros, loteId, dataReferencia) {
  if (loteId == null) return { ativa: false, produto: null, dataFim: null };
  const registros = Array.isArray(sanitarioRegistros) ? sanitarioRegistros : [];
  const hoje = toDateKey(dataReferencia) || toDateKey(new Date());

  const ativos = registros
    .filter((registro) => Number(registro?.lote_id) === Number(loteId) && registro?.data_fim_carencia)
    .map((registro) => ({
      produto: registro.desc || 'tratamento sanitário',
      fimCarencia: toDateKey(registro.data_fim_carencia),
    }))
    .filter((item) => item.fimCarencia && daysBetween(hoje, item.fimCarencia) >= 0)
    .sort((a, b) => (b.fimCarencia || '').localeCompare(a.fimCarencia || ''));

  if (!ativos.length) return { ativa: false, produto: null, dataFim: null };
  const maisRestritivo = ativos[0];
  return { ativa: true, produto: maisRestritivo.produto, dataFim: maisRestritivo.fimCarencia };
}
