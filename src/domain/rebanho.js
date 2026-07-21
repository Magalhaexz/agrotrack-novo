// ─────────────────────────────────────────────────────────────────────────────
// REBANHO E LOTAÇÃO — FONTE ÚNICA do HERDON.
//
// Regra oficial (aprovada na Sprint 2 parte 2/7):
//
//   1. Cabeças de um lote  = `lote.qtd` (fonte canônica).
//   2. Fallback            = soma de `animais[].qtd` SÓ quando `lote.qtd` é
//                            null/undefined (lote legado, campo nunca definido).
//   3. `qtd = 0` é válido  — zero cabeças é um estado real (lote esvaziado).
//                            NUNCA substituir por 1.
//   4. Rebanho ativo       = soma de `lote.qtd` dos lotes com status ativo.
//   5. Lote vendido/encerrado/finalizado/inativo NÃO entra no rebanho atual
//      nem no cálculo de UA.
//   6. Quantidade nunca é negativa: valores < 0 são normalizados para 0 na
//      leitura, e as mutações validam saldo antes de gravar (ver
//      `validarBaixaRebanho`).
//
// Por que `lote.qtd` e não `animais[]`: venda, morte, transferência e ajuste de
// lotação atualizam `lote.qtd`, mas NÃO sincronizam `animais[].qtd`. Ler dos
// registros de animais devolve o rebanho de antes das movimentações.
//
// DIVERGÊNCIAS QUE ESTE MÓDULO ELIMINA (medidas na auditoria):
//   - venda parcial (10 → vendeu 2): Financeiro/Custos/Pastos mostravam 8,
//     Evolução e Painel Gerencial mostravam 10;
//   - lote finalizado: `computeIndicadoresEstrategicos` devolvia UA 25,333
//     contra 5,333 correto (4,75x), porque somava lote vendido e usava
//     `animal.qtd || 1`. Com capacidade de 20 UA a fazenda aparecia
//     "superlotada" tendo 73% de folga.
// ─────────────────────────────────────────────────────────────────────────────
import { toNumber, toNonNegativeNumber } from './calcHelpers.js';
import { calcularUaPorAnimal, calcularCapacidadeTotalUa } from './unidadeAnimal.js';

/** Status que tiram o lote do rebanho atual. */
const STATUS_INATIVOS = new Set(['vendido', 'encerrado', 'finalizado', 'inativo', 'cancelado']);

/** Chave usada para agrupar lotes sem fazenda na visão consolidada. */
export const SEM_FAZENDA = 'sem_fazenda';

export function loteEstaAtivo(lote) {
  const status = String(lote?.status ?? 'ativo').trim().toLowerCase();
  return !STATUS_INATIVOS.has(status);
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Cabeças de UM lote, pela regra canônica.
 * Não olha status: quem decide se o lote entra no total é o chamador
 * (o histórico precisa contar cabeças de lote encerrado).
 * @returns {number} sempre >= 0
 */
export function qtdCabecasDoLote(lote, animais = []) {
  if (!lote) return 0;

  // `!= null` cobre null e undefined, mas preserva 0 — que é quantidade válida.
  if (lote.qtd != null) return Math.max(toNumber(lote.qtd), 0);

  // Fallback: lote legado, sem o campo agregado.
  return arr(animais)
    .filter((a) => Number(a?.lote_id) === Number(lote.id))
    .reduce((soma, a) => soma + toNonNegativeNumber(a?.qtd), 0);
}

/** Lotes ativos do db, opcionalmente de uma fazenda. */
export function lotesAtivos(db, fazendaId = null) {
  return arr(db?.lotes)
    .filter(loteEstaAtivo)
    .filter((l) => (fazendaId == null ? true : Number(l?.faz_id) === Number(fazendaId)));
}

/**
 * Rebanho ativo total. Com `fazendaId`, restringe à fazenda; sem ele, é o
 * consolidado ("Todas as fazendas") — cada lote contado UMA vez.
 */
export function rebanhoAtivo(db, fazendaId = null) {
  const animais = arr(db?.animais);
  return lotesAtivos(db, fazendaId)
    .reduce((soma, lote) => soma + qtdCabecasDoLote(lote, animais), 0);
}

/**
 * Rebanho ativo por fazenda + órfãos.
 * Lotes sem `faz_id` aparecem SEPARADOS na chave `SEM_FAZENDA`, sem serem
 * duplicados nem descartados silenciosamente.
 *
 * Invariante garantida: `total === soma(porFazenda) + semFazenda`.
 */
export function rebanhoPorFazenda(db) {
  const animais = arr(db?.animais);
  const porFazenda = new Map();
  let semFazenda = 0;

  lotesAtivos(db).forEach((lote) => {
    const cabecas = qtdCabecasDoLote(lote, animais);
    const fazId = lote?.faz_id;
    if (fazId == null || Number.isNaN(Number(fazId))) {
      semFazenda += cabecas;
      return;
    }
    const key = Number(fazId);
    porFazenda.set(key, (porFazenda.get(key) || 0) + cabecas);
  });

  const totalFazendas = [...porFazenda.values()].reduce((s, v) => s + v, 0);
  return { porFazenda, semFazenda, total: totalFazendas + semFazenda };
}

// ─── Unidade Animal ──────────────────────────────────────────────────────────

/** Peso médio do lote: pesagem via `lote.p_at`, com fallback nos animais. */
function pesoMedioDoLote(lote, animais) {
  const doLote = arr(animais).filter((a) => Number(a?.lote_id) === Number(lote?.id));
  const somaQtd = doLote.reduce((s, a) => s + toNonNegativeNumber(a?.qtd), 0);
  if (somaQtd > 0) {
    const somaPeso = doLote.reduce(
      (s, a) => s + toNumber(a?.p_at || a?.peso_vivo_kg || a?.p_ini) * toNonNegativeNumber(a?.qtd),
      0
    );
    return somaPeso / somaQtd;
  }
  return toNumber(lote?.p_at || lote?.p_ini);
}

/** UA de um lote = UA(peso médio) × cabeças canônicas. */
export function uaDoLote(lote, animais = []) {
  const cabecas = qtdCabecasDoLote(lote, animais);
  if (cabecas <= 0) return 0;
  return calcularUaPorAnimal(pesoMedioDoLote(lote, animais)) * cabecas;
}

/** UA total — SÓ lotes ativos. Lote vendido/encerrado não ocupa pasto. */
export function uaTotalAtiva(db, fazendaId = null) {
  const animais = arr(db?.animais);
  return lotesAtivos(db, fazendaId).reduce((soma, lote) => soma + uaDoLote(lote, animais), 0);
}

// ─── Lotação de pastos ───────────────────────────────────────────────────────

function pastoEstaAtivo(pastagem) {
  const status = String(pastagem?.status ?? 'ativo').trim().toLowerCase();
  return status !== 'inativo' && status !== 'desativado';
}

/**
 * Ocupação por pasto. Considera só lotes ATIVOS alocados ao pasto.
 * `taxaOcupacao` é fração da capacidade (1 = 100%); `null` quando não há
 * capacidade cadastrada — não inventa 0, que leria como "vazio".
 */
export function lotacaoDosPastos(db, fazendaId = null) {
  const animais = arr(db?.animais);
  const ativos = lotesAtivos(db, fazendaId);

  return arr(db?.pastagens)
    .filter((p) => (fazendaId == null ? true : Number(p?.fazenda_id) === Number(fazendaId)))
    .map((pastagem) => {
      const lotesNoPasto = ativos.filter((l) => String(l?.pastagem_id ?? '') === String(pastagem?.id ?? '#'));
      const cabecas = lotesNoPasto.reduce((s, l) => s + qtdCabecasDoLote(l, animais), 0);
      const uaOcupada = lotesNoPasto.reduce((s, l) => s + uaDoLote(l, animais), 0);
      const capacidadeUa = calcularCapacidadeTotalUa([pastagem]);
      return {
        pastagem_id: pastagem?.id ?? null,
        nome: pastagem?.nome || 'Pasto',
        ativo: pastoEstaAtivo(pastagem),
        lotes: lotesNoPasto.map((l) => ({ id: l.id, nome: l.nome })),
        cabecas,
        uaOcupada,
        capacidadeUa,
        saldoUa: capacidadeUa > 0 ? capacidadeUa - uaOcupada : null,
        taxaOcupacao: capacidadeUa > 0 ? uaOcupada / capacidadeUa : null,
        superlotado: capacidadeUa > 0 ? uaOcupada > capacidadeUa : false,
      };
    });
}

// ─── Segurança de mutação ────────────────────────────────────────────────────

/**
 * Valida uma baixa de rebanho (venda, morte, transferência, ajuste negativo)
 * ANTES de gravar. Regra: nenhum fluxo pode concluir deixando `lote.qtd < 0`.
 *
 * Vive no domínio (não só na UI) para valer também no bot do Telegram e em
 * qualquer chamada de serviço.
 *
 * @returns {{ok: boolean, saldoAtual: number, saldoFinal: number, erro: string|null}}
 */
export function validarBaixaRebanho(lote, quantidade, animais = []) {
  const saldoAtual = qtdCabecasDoLote(lote, animais);
  const qtd = toNumber(quantidade);

  if (!lote) {
    return { ok: false, saldoAtual: 0, saldoFinal: 0, erro: 'Lote não encontrado.' };
  }
  if (!Number.isFinite(qtd) || qtd <= 0) {
    return { ok: false, saldoAtual, saldoFinal: saldoAtual, erro: 'Informe uma quantidade maior que zero.' };
  }
  if (qtd > saldoAtual) {
    return {
      ok: false,
      saldoAtual,
      saldoFinal: saldoAtual,
      erro: `Quantidade indisponível: o lote tem ${saldoAtual} cabeça(s) e a operação pede ${qtd}.`,
    };
  }
  return { ok: true, saldoAtual, saldoFinal: saldoAtual - qtd, erro: null };
}

/** Aplica a baixa já validada, com piso em 0 (defesa contra corrida/repetição). */
export function aplicarBaixaRebanho(lote, quantidade, animais = []) {
  const validacao = validarBaixaRebanho(lote, quantidade, animais);
  if (!validacao.ok) return { ...validacao, qtdFinal: qtdCabecasDoLote(lote, animais) };
  return { ...validacao, qtdFinal: Math.max(validacao.saldoFinal, 0) };
}
