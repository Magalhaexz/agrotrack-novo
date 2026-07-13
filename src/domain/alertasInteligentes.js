// Motor de Alertas Inteligentes do HERDON.
//
// Funções puras (sem UI, sem I/O) que respondem perguntas de gestão a partir
// do `db` operacional: GMD abaixo da meta, peso próximo do alvo, estoque
// perto de acabar, tarefa atrasada, sanidade próxima e custo acima do
// previsto. Base para "Decisões da Fazenda", Alertas Automáticos, Assistente
// HERDON, Saúde do Lote e Relatórios — nenhuma tela nova é criada aqui.
//
// Reaproveita regras já existentes e testadas (gmdAlerta.js, resumoLote.js,
// financeiroStatus.js, calcHelpers.js) em vez de duplicá-las: este motor só
// decide severidade/mensagem comercial a partir delas.
import { toNumber, toDateKey, daysBetween } from './calcHelpers.js';
import { getResumoLote } from './resumoLote.js';
import { avaliarDesempenhoGmd } from './gmdAlerta.js';
import { deveEntrarNoResultadoLote } from './financeiroStatus.js';

import { hojeLocalISO } from './dataCivil.js';
export const SEVERIDADE = {
  CRITICO: 'critico',
  ALTO: 'alto',
  MEDIO: 'medio',
  BAIXO: 'baixo',
};

const SEVERIDADE_ORDEM = {
  [SEVERIDADE.CRITICO]: 0,
  [SEVERIDADE.ALTO]: 1,
  [SEVERIDADE.MEDIO]: 2,
  [SEVERIDADE.BAIXO]: 3,
};

// GMD: percentual abaixo da meta que define a gravidade.
const GMD_PERCENTUAL_CRITICO = 0.20;
const GMD_PERCENTUAL_ALTO = 0.10;

// Peso alvo: percentual do peso atual em relação ao peso alvo do lote.
const PESO_ALVO_ATINGIDO = 1.0;
const PESO_ALVO_MUITO_PROXIMO = 0.95;
const PESO_ALVO_PROXIMO = 0.90;

// Estoque: janela de consumo e limites de dias restantes.
const JANELA_CONSUMO_ESTOQUE_DIAS = 30;
const ESTOQUE_DIAS_CRITICO = 7;
const ESTOQUE_DIAS_ATENCAO = 15;
const ESTOQUE_MULTIPLICADOR_ATENCAO = 1.5;

// Tarefas: dias de atraso que sobem a severidade.
const TAREFA_DIAS_ALTO = 2;
const TAREFA_DIAS_CRITICO = 7;
const TAREFA_PRIORIDADES_SEMPRE_CRITICAS = new Set(['alta', 'critica']);

// Sanidade: janela padrão de aviso quando o registro não define a própria.
const SANIDADE_DIAS_PADRAO_ANTES = 7;

// Custo: janela de comparação (mês atual x mês anterior) e limites de variação.
const JANELA_CUSTO_DIAS = 30;
const CUSTO_VARIACAO_MEDIO = 0.15;
const CUSTO_VARIACAO_ALTO = 0.30;
const CUSTO_VARIACAO_CRITICO = 0.50;

function hojeISO(agora = new Date()) {
  return toDateKey(agora) || hojeLocalISO();
}

function lotesAtivos(db) {
  return (Array.isArray(db?.lotes) ? db.lotes : []).filter((lote) => lote?.status === 'ativo');
}

function contarPesagens(db, loteId) {
  return (Array.isArray(db?.pesagens) ? db.pesagens : [])
    .filter((p) => toNumber(p?.lote_id) === toNumber(loteId)).length;
}

function formatarDataBR(dateKey) {
  const chave = toDateKey(dateKey);
  if (!chave) return '—';
  const [ano, mes, dia] = chave.split('-');
  return `${dia}/${mes}/${ano}`;
}

// Sprint 12 — `dataReferencia`/`loteId`/`loteNome` são aditivos: só expõem
// dado que cada detector já calculava internamente (ou já lia do próprio
// registro, como `lote.ultima_pesagem`), nunca um valor novo/inventado.
// Ausência de dado real mantém os três campos `null` — nenhum detector foi
// alterado em sua lógica de severidade/cálculo.
function buildAlerta({ id, tipo, severidade, titulo, descricao, entidade, acaoSugerida, pagina, dataReferencia = null, loteId = null, loteNome = null }) {
  return { id, tipo, severidade, titulo, descricao, entidade, acaoSugerida, pagina, dataReferencia, loteId, loteNome };
}

/**
 * 1. Lotes ativos com GMD (ganho médio diário) abaixo da meta cadastrada.
 * Usa `avaliarDesempenhoGmd` (gmdAlerta.js) para a regra de comparação e
 * `getResumoLote` (resumoLote.js) para o GMD realizado — sem duplicar cálculo.
 */
export function detectarLotesAbaixoGmd(db = {}) {
  return lotesAtivos(db).flatMap((lote) => {
    const meta = toNumber(lote.gmd_meta);
    if (meta <= 0) return [];

    const resumo = getResumoLote(db, lote.id);
    const qtdPesagens = contarPesagens(db, lote.id);
    const avaliacao = avaliarDesempenhoGmd({ gmdMeta: meta, gmdReal: resumo.gmdMedio, qtdPesagens });
    if (avaliacao.status !== 'abaixo') return [];

    const percentualAbaixo = meta > 0 ? Math.abs(avaliacao.diferenca) / meta : 0;
    const severidade = percentualAbaixo >= GMD_PERCENTUAL_CRITICO
      ? SEVERIDADE.CRITICO
      : percentualAbaixo >= GMD_PERCENTUAL_ALTO
        ? SEVERIDADE.ALTO
        : SEVERIDADE.MEDIO;

    const nome = lote.nome || `Lote ${lote.id}`;
    return [buildAlerta({
      id: `gmd-abaixo-${lote.id}`,
      tipo: 'gmd',
      severidade,
      titulo: `${nome} está abaixo do GMD esperado`,
      descricao: `GMD atual de ${avaliacao.gmdReal.toFixed(2)} kg/dia, ${(percentualAbaixo * 100).toFixed(0)}% abaixo da meta de ${meta.toFixed(2)} kg/dia.`,
      entidade: { tipo: 'lote', id: lote.id, nome },
      acaoSugerida: 'Revisar suplementação, sanidade e pastagem do lote.',
      pagina: 'resultados',
      // `ultima_pesagem` já é um campo do próprio lote (denormalizado, usado
      // por `listarLotesSemPesagemRecente` em hojeNaFazenda.js) — não é um
      // novo cálculo, só a data que já existia no registro.
      dataReferencia: toDateKey(lote.ultima_pesagem) || null,
      loteId: lote.id,
      loteNome: nome,
    })];
  });
}

/**
 * 2. Lotes ativos com peso médio atual próximo (ou acima) do peso alvo
 * cadastrado — sinal de que o lote está perto do ponto de decisão de venda.
 */
export function detectarLotesProximosPesoAlvo(db = {}) {
  return lotesAtivos(db).flatMap((lote) => {
    const pesoAlvo = toNumber(lote.peso_alvo);
    if (pesoAlvo <= 0) return [];

    const resumo = getResumoLote(db, lote.id);
    const pesoAtual = toNumber(resumo.pesoAtualMedio);
    if (pesoAtual <= 0) return [];

    const percentual = pesoAtual / pesoAlvo;
    if (percentual < PESO_ALVO_PROXIMO) return [];

    const nome = lote.nome || `Lote ${lote.id}`;
    const percentualLabel = `${(percentual * 100).toFixed(0)}%`;

    if (percentual >= PESO_ALVO_ATINGIDO) {
      return [buildAlerta({
        id: `peso-alvo-atingido-${lote.id}`,
        tipo: 'peso_alvo',
        severidade: SEVERIDADE.ALTO,
        titulo: `${nome} atingiu o peso alvo`,
        descricao: `Peso médio atual de ${pesoAtual.toFixed(0)} kg alcançou ou superou o peso alvo de ${pesoAlvo.toFixed(0)} kg (${percentualLabel}).`,
        entidade: { tipo: 'lote', id: lote.id, nome },
        acaoSugerida: 'Avaliar a venda do lote.',
        pagina: 'resultados',
        dataReferencia: toDateKey(lote.ultima_pesagem) || null,
        loteId: lote.id,
        loteNome: nome,
      })];
    }

    const severidade = percentual >= PESO_ALVO_MUITO_PROXIMO ? SEVERIDADE.MEDIO : SEVERIDADE.BAIXO;
    return [buildAlerta({
      id: `peso-alvo-proximo-${lote.id}`,
      tipo: 'peso_alvo',
      severidade,
      titulo: `${nome} está próximo do peso alvo`,
      descricao: `Peso médio atual de ${pesoAtual.toFixed(0)} kg equivale a ${percentualLabel} do peso alvo de ${pesoAlvo.toFixed(0)} kg.`,
      entidade: { tipo: 'lote', id: lote.id, nome },
      acaoSugerida: 'Planejar pesagem de acompanhamento e decisão de venda.',
      pagina: 'resultados',
      dataReferencia: toDateKey(lote.ultima_pesagem) || null,
      loteId: lote.id,
      loteNome: nome,
    })];
  });
}

/** Consumo médio diário do item no estoque, a partir das saídas dos últimos `janelaDias`. */
function calcularConsumoDiarioEstoque(db, itemEstoqueId, agora, janelaDias = JANELA_CONSUMO_ESTOQUE_DIAS) {
  const hoje = hojeISO(agora);
  const movimentos = Array.isArray(db?.movimentacoes_estoque) ? db.movimentacoes_estoque : [];

  const totalSaidas = movimentos.reduce((soma, mov) => {
    if (String(mov?.tipo || '').toLowerCase() !== 'saida') return soma;
    if (toNumber(mov?.item_estoque_id) !== toNumber(itemEstoqueId)) return soma;
    const dias = daysBetween(mov?.data, hoje);
    if (dias < 0 || dias >= janelaDias) return soma;
    return soma + toNumber(mov?.quantidade);
  }, 0);

  return totalSaidas > 0 ? totalSaidas / janelaDias : null;
}

/**
 * 3. Itens de estoque com risco de faltar: zerados, abaixo do mínimo
 * cadastrado, ou com previsão de esgotar em poucos dias pelo ritmo de
 * consumo recente (saídas registradas em `movimentacoes_estoque`).
 */
export function detectarEstoqueBaixo(db = {}, agora = new Date()) {
  const itens = Array.isArray(db?.estoque) ? db.estoque : [];

  return itens.flatMap((item) => {
    const nome = item.produto || item.nome || 'Produto sem nome';
    const unidade = item.unidade || item.unidade_medida || 'un';
    const qtdAtual = toNumber(item.quantidade_atual ?? item.quantidade);
    const qtdMinima = toNumber(item.quantidade_minima);
    const consumoDiario = calcularConsumoDiarioEstoque(db, item.id, agora);
    const diasRestantes = consumoDiario ? qtdAtual / consumoDiario : null;

    let severidade = null;
    let titulo = null;
    let descricao = null;

    if (qtdAtual <= 0) {
      severidade = SEVERIDADE.CRITICO;
      titulo = `${nome} está com estoque zerado`;
      descricao = `Não há saldo disponível de ${nome} no estoque.`;
    } else if (diasRestantes !== null && diasRestantes <= ESTOQUE_DIAS_CRITICO) {
      const dias = Math.max(0, Math.round(diasRestantes));
      severidade = SEVERIDADE.CRITICO;
      titulo = `${nome} pode acabar em ${dias} dia${dias === 1 ? '' : 's'}`;
      descricao = `No ritmo de consumo atual, o estoque de ${nome} (${qtdAtual.toFixed(0)} ${unidade}) deve se esgotar em cerca de ${dias} dia${dias === 1 ? '' : 's'}.`;
    } else if (qtdMinima > 0 && qtdAtual <= qtdMinima) {
      severidade = SEVERIDADE.ALTO;
      titulo = `${nome} está abaixo do estoque mínimo`;
      descricao = `Saldo atual de ${qtdAtual.toFixed(0)} ${unidade} está abaixo do mínimo configurado de ${qtdMinima.toFixed(0)} ${unidade}.`;
    } else if (diasRestantes !== null && diasRestantes <= ESTOQUE_DIAS_ATENCAO) {
      const dias = Math.round(diasRestantes);
      severidade = SEVERIDADE.MEDIO;
      titulo = `${nome} pode acabar em ${dias} dias`;
      descricao = `No ritmo de consumo atual, o estoque de ${nome} deve durar mais cerca de ${dias} dias.`;
    } else if (qtdMinima > 0 && qtdAtual <= qtdMinima * ESTOQUE_MULTIPLICADOR_ATENCAO) {
      severidade = SEVERIDADE.BAIXO;
      titulo = `${nome} está se aproximando do estoque mínimo`;
      descricao = `Saldo atual de ${qtdAtual.toFixed(0)} ${unidade} está próximo do mínimo configurado de ${qtdMinima.toFixed(0)} ${unidade}.`;
    } else {
      return [];
    }

    return [buildAlerta({
      id: `estoque-baixo-${item.id}`,
      tipo: 'estoque',
      severidade,
      titulo,
      descricao,
      entidade: { tipo: 'estoque', id: item.id, nome },
      acaoSugerida: 'Programar reposição do produto no estoque.',
      pagina: 'estoque',
    })];
  });
}

/** 4. Tarefas com vencimento no passado e status ainda não concluído. */
export function detectarTarefasAtrasadas(db = {}, agora = new Date()) {
  const hoje = hojeISO(agora);
  const tarefas = Array.isArray(db?.tarefas) ? db.tarefas : [];
  const lotesMap = new Map((Array.isArray(db?.lotes) ? db.lotes : []).map((l) => [toNumber(l.id), l]));

  return tarefas.flatMap((tarefa) => {
    if (!tarefa) return [];
    const status = String(tarefa.status || 'pendente').toLowerCase();
    if (status === 'concluida') return [];

    const vencimento = toDateKey(tarefa.data_vencimento);
    if (!vencimento) return [];

    const diasAtraso = daysBetween(vencimento, hoje);
    if (diasAtraso <= 0) return [];

    const prioridade = String(tarefa.prioridade || 'media').toLowerCase();
    const severidade = diasAtraso >= TAREFA_DIAS_CRITICO || TAREFA_PRIORIDADES_SEMPRE_CRITICAS.has(prioridade)
      ? SEVERIDADE.CRITICO
      : diasAtraso >= TAREFA_DIAS_ALTO
        ? SEVERIDADE.ALTO
        : SEVERIDADE.MEDIO;

    const titulo = tarefa.titulo || 'Tarefa sem título';
    const loteDaTarefa = tarefa.lote_id != null ? lotesMap.get(toNumber(tarefa.lote_id)) : null;
    return [buildAlerta({
      id: `tarefa-atrasada-${tarefa.id}`,
      tipo: 'tarefa',
      severidade,
      titulo: `Tarefa atrasada: ${titulo}`,
      descricao: `"${titulo}" está atrasada há ${diasAtraso} dia${diasAtraso === 1 ? '' : 's'} (vencimento em ${formatarDataBR(vencimento)}).`,
      entidade: { tipo: 'tarefa', id: tarefa.id, nome: titulo },
      acaoSugerida: 'Concluir ou reagendar a tarefa.',
      pagina: 'tarefas',
      dataReferencia: vencimento,
      loteId: loteDaTarefa?.id ?? null,
      loteNome: loteDaTarefa?.nome ?? null,
    })];
  });
}

/** 5. Manejos sanitários com próxima aplicação vencida ou dentro da janela de aviso. */
export function detectarSanidadeProxima(db = {}, agora = new Date()) {
  const hoje = hojeISO(agora);
  const registros = Array.isArray(db?.sanitario) ? db.sanitario : [];
  const lotesMap = new Map((Array.isArray(db?.lotes) ? db.lotes : []).map((l) => [toNumber(l.id), l]));

  return registros.flatMap((item) => {
    if (!item?.proxima) return [];
    const proxima = toDateKey(item.proxima);
    if (!proxima) return [];

    const diasAte = daysBetween(hoje, proxima);
    const diasAntes = toNumber(item.alerta_dias_antes) || SANIDADE_DIAS_PADRAO_ANTES;
    if (diasAte > diasAntes) return [];

    const lote = lotesMap.get(toNumber(item.lote_id));
    const loteNome = lote?.nome || (item.lote_id ? `Lote ${item.lote_id}` : 'sem lote vinculado');
    const tipoLabel = item.tipo || item.nome || 'Manejo sanitário';

    const severidade = diasAte < 0
      ? SEVERIDADE.CRITICO
      : diasAte <= 1
        ? SEVERIDADE.ALTO
        : SEVERIDADE.MEDIO;

    const situacao = diasAte < 0
      ? `venceu há ${Math.abs(diasAte)} dia${Math.abs(diasAte) === 1 ? '' : 's'}`
      : diasAte === 0
        ? 'vence hoje'
        : diasAte === 1
          ? 'vence amanhã'
          : `vence em ${diasAte} dias`;

    return [buildAlerta({
      id: `sanidade-proxima-${item.id}`,
      tipo: 'sanidade',
      severidade,
      titulo: `${tipoLabel} do ${loteNome} ${situacao}`,
      descricao: `${tipoLabel} programado(a) para ${formatarDataBR(proxima)}, referente ao ${loteNome}.`,
      entidade: { tipo: 'sanidade', id: item.id, nome: loteNome },
      acaoSugerida: 'Agendar ou confirmar a execução do manejo sanitário.',
      pagina: 'sanitario',
      dataReferencia: proxima,
      loteId: lote?.id ?? null,
      loteNome: lote?.nome ?? null,
    })];
  });
}

/**
 * 6. Custo da fazenda acima do previsto: compara as despesas dos últimos
 * `JANELA_CUSTO_DIAS` dias com os `JANELA_CUSTO_DIAS` dias anteriores. Exige
 * despesa nas duas janelas para evitar falso positivo por falta de dado.
 * O custo por cabeça usa o total de cabeças ativas ATUAL como divisor das
 * duas janelas (simplificação assumida: não há histórico de plantel por
 * data) — documentado para quem for evoluir esta função.
 */
export function detectarCustoAcimaDoPrevisto(db = {}, agora = new Date()) {
  const hoje = hojeISO(agora);
  const movimentos = Array.isArray(db?.movimentacoes_financeiras) ? db.movimentacoes_financeiras : [];
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];

  const despesas = movimentos.filter((mov) => mov?.tipo === 'despesa' && deveEntrarNoResultadoLote(mov));

  const somarJanela = (inicioDias, fimDias) => despesas.reduce((soma, mov) => {
    const dias = daysBetween(mov?.data_competencia || mov?.data, hoje);
    if (dias < inicioDias || dias >= fimDias) return soma;
    return soma + toNumber(mov?.valor);
  }, 0);

  const custoAtual = somarJanela(0, JANELA_CUSTO_DIAS);
  const custoAnterior = somarJanela(JANELA_CUSTO_DIAS, JANELA_CUSTO_DIAS * 2);
  if (custoAnterior <= 0 || custoAtual <= 0) return [];

  const variacao = (custoAtual - custoAnterior) / custoAnterior;
  if (variacao < CUSTO_VARIACAO_MEDIO) return [];

  const severidade = variacao >= CUSTO_VARIACAO_CRITICO
    ? SEVERIDADE.CRITICO
    : variacao >= CUSTO_VARIACAO_ALTO
      ? SEVERIDADE.ALTO
      : SEVERIDADE.MEDIO;

  // Seção 8 (auditoria lote.qtd): soma lote.qtd dos lotes ativos — fonte
  // canônica de cabeças (Parte 1.3) — em vez de somar animais.qtd, que pode
  // divergir após vendas/mortes/transferências que não sincronizam o grupo.
  const cabecasAtivas = lotes
    .filter((lote) => String(lote?.status || 'ativo').toLowerCase() === 'ativo')
    .reduce((soma, lote) => soma + toNumber(lote?.qtd), 0);
  const percentualLabel = `${(variacao * 100).toFixed(0)}%`;
  const descricaoPorCabeca = cabecasAtivas > 0
    ? ` Custo por cabeça foi de R$ ${(custoAnterior / cabecasAtivas).toFixed(2)} para R$ ${(custoAtual / cabecasAtivas).toFixed(2)}.`
    : '';

  return [buildAlerta({
    id: 'custo-acima-previsto',
    tipo: 'custo',
    severidade,
    titulo: cabecasAtivas > 0 ? 'Custo por cabeça subiu nos últimos 30 dias' : 'Custo da fazenda subiu nos últimos 30 dias',
    descricao: `As despesas da fazenda subiram ${percentualLabel} nos últimos 30 dias em relação aos 30 dias anteriores.${descricaoPorCabeca}`,
    entidade: { tipo: 'financeiro', id: null, nome: 'Fazenda' },
    acaoSugerida: 'Revisar despesas recentes e identificar a causa do aumento.',
    pagina: 'financeiro',
  })];
}

const TODOS_DETECTORES = [
  detectarLotesAbaixoGmd,
  detectarLotesProximosPesoAlvo,
  detectarEstoqueBaixo,
  detectarTarefasAtrasadas,
  detectarSanidadeProxima,
  detectarCustoAcimaDoPrevisto,
];

/**
 * 7. Roda todos os detectores e devolve a lista priorizada: crítico → alto →
 * médio → baixo; dentro da mesma severidade, ordena por id para saída estável.
 */
export function gerarAlertasPriorizados(db = {}, agora = new Date()) {
  const alertas = TODOS_DETECTORES.flatMap((detector) => detector(db, agora));
  return alertas.slice().sort((a, b) => {
    const ordemA = SEVERIDADE_ORDEM[a.severidade] ?? 99;
    const ordemB = SEVERIDADE_ORDEM[b.severidade] ?? 99;
    if (ordemA !== ordemB) return ordemA - ordemB;
    return String(a.id).localeCompare(String(b.id));
  });
}
