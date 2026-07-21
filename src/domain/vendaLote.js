// ─────────────────────────────────────────────────────────────────────────────
// VENDA E RESULTADO DO LOTE — FONTE ÚNICA (Sprint 4/7).
//
// Antes desta sprint, "arrobas vendidas" e "preço por arroba" tinham duas
// implementações inline, em bases diferentes, sem que nenhuma das telas
// dissesse qual base usava:
//
//   - RelatorioVendas.jsx      → peso VIVO ÷ 15
//   - indicadoresEstrategicos  → peso de CARCAÇA ÷ 15
//
// No mesmo lote, mesmo período: 240,00 @ contra 124,80 @ (+92,3%), e preço
// médio de R$ 180,00 contra R$ 346,15. Duas telas, o mesmo rótulo, quase o
// dobro de diferença.
//
// REGRA OFICIAL (alinhada a docs/DECISAO_CALCULO_ARROBA_HERDON.md): toda
// decisão econômica — venda, custo/@, lucro/@, preço/@ — usa ARROBA DE CARCAÇA.
// Arroba de peso vivo continua disponível, mas só como leitura física, e
// sempre rotulada como tal.
//
// BASE DAS MÉTRICAS "POR CABEÇA" E "POR ARROBA" — mudança desta sprint:
// antes o denominador era só o rebanho REMANESCENTE. Num lote 100% vendido o
// remanescente é zero, então `custoPorArroba`, `lucroPorArroba` e
// `lucroPorCabeca` viravam **0** mesmo com lucro real — exatamente o "valor
// ausente virando zero silenciosamente" que esta sprint proíbe. Medido: lote
// vendido por inteiro com lucro de R$ 37.440 exibia lucro/@ = 0,00.
//
// A base passa a ser REMANESCENTE + VENDIDO, ou seja, tudo o que o lote
// carregou economicamente. É contínua (não salta quando a última cabeça sai) e
// coerente com o custo acumulado, que é do lote inteiro e não só do que sobrou.
// Efeito medido no mesmo lote: custo/@ vai de R$ 384,62 (parcial) → 0,00
// (total) para R$ 230,77 → R$ 227,73.
// ─────────────────────────────────────────────────────────────────────────────
import { safeDivide, toNumber, toNonNegativeNumber, isAnimalAtivo } from './calcHelpers.js';
import { calcularArrobasCarcaca, calcularArrobasPesoVivo, normalizarRendimentoCarcaca } from './arroba.js';
import { qtdCabecasDoLote } from './rebanho.js';

/** Tipos de movimentação que representam saída por venda (geram receita). */
export const TIPOS_VENDA = Object.freeze(['venda', 'abate']);

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function pertenceAoLote(item, loteId) {
  return toNumber(item?.lote_id) === toNumber(loteId);
}

function normalizarTipo(valor) {
  return String(valor || '').trim().toLowerCase();
}

/**
 * Remove a MESMA linha repetida — um reload ou uma sincronização que reanexe um
 * lançamento já presente em memória não pode dobrar a receita nem o custo
 * ("receita não duplica após recarregar ou sincronizar").
 *
 * Duas salvaguardas deliberadas, porque descartar um lançamento real é pior do
 * que somar um duplicado:
 *
 *  1. A chave NÃO é só o `id`. Ids locais gerados por `gerarNovoId()` já
 *     colidiram com a sequence do banco neste projeto (ver
 *     operationalPersistence.js), então dois lançamentos DIFERENTES podem
 *     carregar o mesmo id em memória. A impressão digital inclui os campos que
 *     definem o lançamento; só sai de cena quem repete todos eles.
 *  2. Linhas sem `id` (ainda não confirmadas pelo banco) nunca são descartadas:
 *     não há como saber se são a mesma.
 */
export function deduplicarLancamentos(linhas) {
  const vistos = new Set();
  return arr(linhas).filter((linha) => {
    const id = linha?.id;
    if (id === undefined || id === null || id === '') return true;
    const chave = [
      id, linha?.lote_id, linha?.tipo, linha?.categoria,
      linha?.valor ?? linha?.valor_total, linha?.data, linha?.qtd, linha?.origem_id,
    ].map((parte) => String(parte ?? '')).join('|');
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

/**
 * Consolida TUDO que foi vendido de um lote, a partir de `movimentacoes_animais`.
 *
 * "Venda parcial considera somente a quantidade vendida": todos os totais aqui
 * vêm das movimentações de venda/abate — nunca do rebanho remanescente.
 *
 * `rendimentoCarcaca` vem do lote (padrão de mercado 52% quando ausente).
 * Nenhum valor é arredondado: arredondamento é só de exibição.
 */
export function calcularVendasDoLote(db, loteId) {
  const lote = arr(db?.lotes).find((item) => toNumber(item.id) === toNumber(loteId)) || null;
  const rendimento = lote?.rendimento_carcaca;

  const vendas = deduplicarLancamentos(
    arr(db?.movimentacoes_animais).filter(
      (mov) => TIPOS_VENDA.includes(normalizarTipo(mov?.tipo)) && pertenceAoLote(mov, loteId)
    )
  );

  const cabecasVendidas = vendas.reduce((soma, mov) => soma + toNonNegativeNumber(mov?.qtd), 0);
  const pesoVivoVendidoKg = vendas.reduce(
    (soma, mov) => soma + toNonNegativeNumber(mov?.qtd) * toNumber(mov?.peso_medio),
    0
  );

  // Valor BRUTO da venda, direto das movimentações.
  const valorBruto = vendas.reduce((soma, mov) => soma + toNumber(mov?.valor_total), 0);

  // Deduções (frete, comissão, desconto) NÃO existem no fluxo de venda do
  // HERDON — não há coluna para elas em `movimentacoes_animais` nem em
  // `movimentacoes_financeiras` (verificado no schema). Os únicos campos de
  // frete do projeto vivem no simulador de cenários, que não alimenta o
  // resultado realizado. Mantemos o campo explícito e zerado para que a
  // distinção bruto/líquido exista na fonte única quando o fluxo for criado —
  // e para que nenhuma tela precise assumir que bruto == líquido por conta
  // própria. Ver pendência registrada na matriz de indicadores.
  const deducoes = 0;
  const valorLiquido = valorBruto - deducoes;

  const arrobasCarcacaVendidas = calcularArrobasCarcaca(pesoVivoVendidoKg, rendimento);
  const arrobasVivasVendidas = calcularArrobasPesoVivo(pesoVivoVendidoKg);

  return {
    lote,
    quantidadeVendas: vendas.length,
    cabecasVendidas,
    pesoVivoVendidoKg,
    pesoCarcacaVendidoKg: pesoVivoVendidoKg * normalizarRendimentoCarcaca(rendimento),
    arrobasCarcacaVendidas,
    arrobasVivasVendidas,
    valorBruto,
    deducoes,
    valorLiquido,
    // Preço realizado por @ de carcaça — padrão de mercado. `null` (não 0)
    // quando não houve venda: zero aqui significaria "vendeu de graça".
    precoPorArrobaCarcaca: arrobasCarcacaVendidas > 0
      ? safeDivide(valorLiquido, arrobasCarcacaVendidas)
      : null,
    precoPorArrobaViva: arrobasVivasVendidas > 0
      ? safeDivide(valorLiquido, arrobasVivasVendidas)
      : null,
    precoMedioPorCabeca: cabecasVendidas > 0 ? safeDivide(valorLiquido, cabecasVendidas) : null,
    houveVenda: vendas.length > 0,
  };
}

/**
 * Base de rateio do resultado do lote: o que o lote carregou economicamente,
 * somando o rebanho remanescente e tudo que já saiu por venda.
 *
 * Existe porque o custo acumulado é do LOTE INTEIRO. Dividi-lo só pelo que
 * sobrou faz o indicador explodir na última venda e depois zerar.
 */
export function calcularBaseResultadoLote(db, loteId) {
  const lote = arr(db?.lotes).find((item) => toNumber(item.id) === toNumber(loteId)) || null;
  const animais = arr(db?.animais);
  const vendas = calcularVendasDoLote(db, loteId);

  // Rebanho remanescente, na ordem canônica da Sprint 2: `lote.qtd` manda; sem
  // ele (lote legado, ou registro do lote ainda não carregado no `db`), soma os
  // animais ATIVOS do lote. O filtro de status importa no fallback — sem ele um
  // animal já vendido/morto voltaria a inflar a base (regra F-02).
  const animaisAtivosDoLote = animais.filter(
    (item) => pertenceAoLote(item, loteId) && isAnimalAtivo(item)
  );
  const qtdAtivosRegistrados = animaisAtivosDoLote.reduce(
    (soma, item) => soma + toNonNegativeNumber(item?.qtd), 0
  );
  const cabecasRemanescentes = lote?.qtd != null
    ? qtdCabecasDoLote(lote, animais)
    : qtdAtivosRegistrados;

  // Peso médio: `lote.p_at` é a fonte; sem ele, média ponderada dos ativos.
  const pesoMedioRegistrado = qtdAtivosRegistrados
    ? safeDivide(
        animaisAtivosDoLote.reduce(
          (soma, item) => soma + toNumber(item?.p_at) * toNonNegativeNumber(item?.qtd), 0
        ),
        qtdAtivosRegistrados
      )
    : 0;
  const pesoMedioRemanescente = toNumber(lote?.p_at) || pesoMedioRegistrado;
  const pesoVivoRemanescenteKg = cabecasRemanescentes * pesoMedioRemanescente;
  const arrobasCarcacaRemanescente = calcularArrobasCarcaca(pesoVivoRemanescenteKg, lote?.rendimento_carcaca);

  const cabecasBase = cabecasRemanescentes + vendas.cabecasVendidas;
  const arrobasCarcacaBase = arrobasCarcacaRemanescente + vendas.arrobasCarcacaVendidas;

  return {
    cabecasRemanescentes,
    cabecasVendidas: vendas.cabecasVendidas,
    cabecasBase,
    pesoVivoRemanescenteKg,
    pesoVivoVendidoKg: vendas.pesoVivoVendidoKg,
    arrobasCarcacaRemanescente,
    arrobasCarcacaVendidas: vendas.arrobasCarcacaVendidas,
    arrobasCarcacaBase,
    // `true` quando o lote não tem mais rebanho e já vendeu — resultado final.
    vendaTotal: cabecasRemanescentes === 0 && vendas.cabecasVendidas > 0,
    houveVenda: vendas.houveVenda,
  };
}
