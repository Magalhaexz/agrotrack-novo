// Painel de Saúde do Lote (Sprint 3): score de 0 a 100 por lote, a partir de
// 8 fatores de manejo/financeiro/sanidade. Função pura — sem UI, sem I/O.
//
// Reaproveita o que já existe e já foi testado em vez de recalcular:
// - detectarLotesAbaixoGmd / detectarLotesProximosPesoAlvo / detectarTarefasAtrasadas /
//   detectarSanidadeProxima / detectarEstoqueBaixo (alertasInteligentes.js, Sprint 1) —
//   fornecem a severidade já calculada; este arquivo só converte severidade em pontos.
// - getResumoLote (resumoLote.js) — custo, receita, peso, GMD realizado.
// - LIMIAR_CUSTO_ALTO_PCT / PRECO_ARROBA_PADRAO (decisaoVenda.js) — mesmo limiar
//   de "custo alto" já usado na decisão de venda, não um novo threshold inventado.
//
// Modelo: começa em 100 pontos (saúde plena) e SUBTRAI por problema encontrado.
// Um fator "em dia" nunca soma pontos acima de 100 — só aumenta a confiança do
// score (ver exemplo do enunciado: "Sanidade em dia aumentou confiança").
// Fator sem dado suficiente NÃO penaliza — fica de fora da conta e reduz a
// confiabilidade geral do score.
import { toNumber, toDateKey, daysBetween } from './calcHelpers.js';
import { getResumoLote } from './resumoLote.js';
import {
  SEVERIDADE,
  detectarLotesAbaixoGmd,
  detectarLotesProximosPesoAlvo,
  detectarTarefasAtrasadas,
  detectarSanidadeProxima,
  detectarEstoqueBaixo,
} from './alertasInteligentes.js';
import { LIMIAR_CUSTO_ALTO_PCT, PRECO_ARROBA_PADRAO } from './decisaoVenda.js';

import { hojeLocalISO } from './dataCivil.js';
export const SAUDE_LOTE_CLASSIFICACAO = {
  SAUDAVEL: 'saudavel',
  ATENCAO: 'atencao',
  RISCO: 'risco',
  CRITICO: 'critico',
};

const CLASSIFICACAO_LABEL = {
  [SAUDE_LOTE_CLASSIFICACAO.SAUDAVEL]: 'Saudável',
  [SAUDE_LOTE_CLASSIFICACAO.ATENCAO]: 'Atenção',
  [SAUDE_LOTE_CLASSIFICACAO.RISCO]: 'Risco',
  [SAUDE_LOTE_CLASSIFICACAO.CRITICO]: 'Crítico',
};

const TOTAL_FATORES = 8;
const PESAGEM_DIAS_ATENCAO = 30;
const PESAGEM_DIAS_CRITICO = 45;
const MORTALIDADE_TAXA_ALTA = 0.10;
const MORTALIDADE_TAXA_MEDIA = 0.05;
const PERDA_TIPOS = new Set(['morte', 'descarte']);
const SAIDA_TIPOS_TOTAL = new Set(['venda', 'abate', 'morte', 'descarte']);

const PONTOS_GMD = { [SEVERIDADE.CRITICO]: -20, [SEVERIDADE.ALTO]: -12, [SEVERIDADE.MEDIO]: -8, [SEVERIDADE.BAIXO]: -4 };
const PONTOS_TAREFA = { [SEVERIDADE.CRITICO]: -10, [SEVERIDADE.ALTO]: -7, [SEVERIDADE.MEDIO]: -4, [SEVERIDADE.BAIXO]: -2 };
const PONTOS_SANIDADE = { [SEVERIDADE.CRITICO]: -15, [SEVERIDADE.ALTO]: -10, [SEVERIDADE.MEDIO]: -6, [SEVERIDADE.BAIXO]: -3 };
const PONTOS_ESTOQUE = { [SEVERIDADE.CRITICO]: -10, [SEVERIDADE.ALTO]: -7, [SEVERIDADE.MEDIO]: -4, [SEVERIDADE.BAIXO]: -2 };
const PONTOS_CUSTO_ALTO = -15;

function hojeISO(agora = new Date()) {
  return toDateKey(agora) || hojeLocalISO();
}

function pluralizar(quantidade, singular, plural) {
  return quantidade === 1 ? singular : plural;
}

function piorSeveridade(alertas = []) {
  const ordem = { [SEVERIDADE.CRITICO]: 0, [SEVERIDADE.ALTO]: 1, [SEVERIDADE.MEDIO]: 2, [SEVERIDADE.BAIXO]: 3 };
  if (!alertas.length) return null;
  return alertas.reduce(
    (pior, alerta) => (ordem[alerta.severidade] < ordem[pior] ? alerta.severidade : pior),
    alertas[0].severidade
  );
}

function contarPesagensDoLote(db, loteId) {
  return (Array.isArray(db?.pesagens) ? db.pesagens : [])
    .filter((p) => toNumber(p?.lote_id) === toNumber(loteId)).length;
}

/** 1. GMD em relação à meta — severidade vem de detectarLotesAbaixoGmd. */
function fatorGmd(db, lote) {
  const label = 'GMD em relação à meta';
  const meta = toNumber(lote?.gmd_meta);
  const qtdPesagens = contarPesagensDoLote(db, lote?.id);
  if (meta <= 0 || qtdPesagens < 2) {
    return { chave: 'gmd', label, disponivel: false, pontos: 0, descricao: null };
  }
  const alerta = detectarLotesAbaixoGmd(db).find((a) => toNumber(a?.entidade?.id) === toNumber(lote?.id));
  if (!alerta) {
    return { chave: 'gmd', label, disponivel: true, pontos: 0, descricao: 'GMD dentro ou acima da meta aumentou a confiança do score.' };
  }
  const pontos = PONTOS_GMD[alerta.severidade] ?? -8;
  return { chave: 'gmd', label, disponivel: true, pontos, descricao: `GMD abaixo da meta reduziu ${Math.abs(pontos)} pontos.` };
}

/**
 * 2. Frequência de pesagem — quanto tempo desde a última pesagem do lote.
 * Só entra na conta se o lote já tem cabeças (`heads`): um lote com zero
 * animais ainda não começou a operar, então "nunca foi pesado" não é um
 * sinal de saúde real — é só "ainda não tem o que pesar".
 */
function fatorPesagemFrequencia(db, lote, agora, heads) {
  const label = 'Frequência de pesagem';
  const pesagensDoLote = (Array.isArray(db?.pesagens) ? db.pesagens : [])
    .filter((p) => toNumber(p?.lote_id) === toNumber(lote?.id));

  if (pesagensDoLote.length === 0) {
    if (heads <= 0) {
      return { chave: 'pesagem', label, disponivel: false, pontos: 0, descricao: null };
    }
    return { chave: 'pesagem', label, disponivel: true, pontos: -15, descricao: 'Lote nunca foi pesado, reduziu 15 pontos.' };
  }

  const ultimaData = pesagensDoLote.map((p) => toDateKey(p?.data)).filter(Boolean).sort().pop();
  if (!ultimaData) {
    if (heads <= 0) {
      return { chave: 'pesagem', label, disponivel: false, pontos: 0, descricao: null };
    }
    return { chave: 'pesagem', label, disponivel: true, pontos: -15, descricao: 'Lote nunca foi pesado, reduziu 15 pontos.' };
  }

  const dias = daysBetween(ultimaData, hojeISO(agora));
  if (dias > PESAGEM_DIAS_CRITICO) {
    return { chave: 'pesagem', label, disponivel: true, pontos: -12, descricao: 'Sem pesagem há mais de 45 dias reduziu 12 pontos.' };
  }
  if (dias > PESAGEM_DIAS_ATENCAO) {
    return { chave: 'pesagem', label, disponivel: true, pontos: -10, descricao: 'Sem pesagem recente reduziu 10 pontos.' };
  }
  return { chave: 'pesagem', label, disponivel: true, pontos: 0, descricao: 'Pesagem recente aumentou a confiança do score.' };
}

/** 3. Tarefas atrasadas vinculadas ao lote — severidade vem de detectarTarefasAtrasadas. */
function fatorTarefas(db, lote, agora) {
  const label = 'Tarefas atrasadas';
  const tarefas = Array.isArray(db?.tarefas) ? db.tarefas : [];
  const idsDoLote = new Set(tarefas.filter((t) => toNumber(t?.lote_id) === toNumber(lote?.id)).map((t) => t.id));
  if (idsDoLote.size === 0) {
    return { chave: 'tarefas', label, disponivel: false, pontos: 0, descricao: null };
  }
  const atrasadas = detectarTarefasAtrasadas(db, agora).filter((a) => idsDoLote.has(a?.entidade?.id));
  if (atrasadas.length === 0) {
    return { chave: 'tarefas', label, disponivel: true, pontos: 0, descricao: 'Nenhuma tarefa atrasada aumentou a confiança do score.' };
  }
  const pontos = PONTOS_TAREFA[piorSeveridade(atrasadas)] ?? -4;
  const rotulo = pluralizar(atrasadas.length, 'tarefa atrasada', 'tarefas atrasadas');
  const verbo = pluralizar(atrasadas.length, 'reduziu', 'reduziram');
  return { chave: 'tarefas', label, disponivel: true, pontos, descricao: `${atrasadas.length} ${rotulo} ${verbo} ${Math.abs(pontos)} pontos.` };
}

/** 4. Sanidade pendente vinculada ao lote — severidade vem de detectarSanidadeProxima. */
function fatorSanidade(db, lote, agora) {
  const label = 'Sanidade pendente';
  const registros = Array.isArray(db?.sanitario) ? db.sanitario : [];
  const idsDoLote = new Set(registros.filter((r) => toNumber(r?.lote_id) === toNumber(lote?.id)).map((r) => r.id));
  if (idsDoLote.size === 0) {
    return { chave: 'sanidade', label, disponivel: false, pontos: 0, descricao: null };
  }
  const pendentes = detectarSanidadeProxima(db, agora).filter((a) => idsDoLote.has(a?.entidade?.id));
  if (pendentes.length === 0) {
    return { chave: 'sanidade', label, disponivel: true, pontos: 0, descricao: 'Sanidade em dia aumentou a confiança do score.' };
  }
  const pontos = PONTOS_SANIDADE[piorSeveridade(pendentes)] ?? -6;
  return { chave: 'sanidade', label, disponivel: true, pontos, descricao: `Manejo sanitário pendente reduziu ${Math.abs(pontos)} pontos.` };
}

/**
 * 5. Estoque/suplementação vinculada ao lote: descobre os itens de estoque
 * que o lote realmente consome (via consumo_suplementacao) e verifica se
 * algum deles está em alerta em detectarEstoqueBaixo.
 */
function fatorEstoqueVinculado(db, lote, agora) {
  const label = 'Estoque/suplementação vinculada';
  const consumos = Array.isArray(db?.consumo_suplementacao) ? db.consumo_suplementacao : [];
  const itemIds = new Set(
    consumos
      .filter((c) => toNumber(c?.lote_id) === toNumber(lote?.id) && c?.item_estoque_id != null)
      .map((c) => toNumber(c.item_estoque_id))
  );
  if (itemIds.size === 0) {
    return { chave: 'estoque', label, disponivel: false, pontos: 0, descricao: null };
  }
  const alertasEstoque = detectarEstoqueBaixo(db, agora).filter((a) => itemIds.has(toNumber(a?.entidade?.id)));
  if (alertasEstoque.length === 0) {
    return { chave: 'estoque', label, disponivel: true, pontos: 0, descricao: 'Suprimento vinculado em dia aumentou a confiança do score.' };
  }
  const pontos = PONTOS_ESTOQUE[piorSeveridade(alertasEstoque)] ?? -4;
  return { chave: 'estoque', label, disponivel: true, pontos, descricao: `Produto vinculado em risco de estoque reduziu ${Math.abs(pontos)} pontos.` };
}

/**
 * 6. Custo por cabeça: usa o mesmo limiar de "custo alto" de decisaoVenda.js
 * (custo por arroba vs. preço-alvo da arroba) — não inventa um novo limiar
 * absoluto de R$/cabeça, que não existiria em lugar nenhum do app.
 */
function fatorCusto(db, lote, resumo) {
  const label = 'Custo por cabeça';
  if (toNumber(resumo.totalAnimais) <= 0 || toNumber(resumo.custoTotal) <= 0) {
    return { chave: 'custo', label, disponivel: false, pontos: 0, descricao: null };
  }
  if (toNumber(resumo.arrobasCarcaca) <= 0) {
    return { chave: 'custo', label, disponivel: true, pontos: 0, descricao: 'Custo do lote registrado, mas ainda sem base de comparação por arroba.' };
  }
  const precoArroba = toNumber(lote?.preco_arroba) || PRECO_ARROBA_PADRAO;
  const custoPorArroba = toNumber(resumo.custoPorArroba);
  if (custoPorArroba >= precoArroba * LIMIAR_CUSTO_ALTO_PCT) {
    return { chave: 'custo', label, disponivel: true, pontos: PONTOS_CUSTO_ALTO, descricao: `Custo por arroba acima do esperado reduziu ${Math.abs(PONTOS_CUSTO_ALTO)} pontos.` };
  }
  return { chave: 'custo', label, disponivel: true, pontos: 0, descricao: 'Custo dentro do esperado aumentou a confiança do score.' };
}

/**
 * 7. Proximidade do peso alvo — nunca penaliza (ficar longe do alvo é só
 * "ainda crescendo", não é um problema de saúde). Reaproveita
 * detectarLotesProximosPesoAlvo só para saber se o lote já está perto/no alvo.
 */
function fatorPesoAlvo(db, lote, resumo) {
  const label = 'Proximidade do peso alvo';
  const pesoAlvo = toNumber(lote?.peso_alvo);
  const pesoAtual = toNumber(resumo.pesoAtualMedio);
  if (pesoAlvo <= 0 || pesoAtual <= 0) {
    return { chave: 'peso_alvo', label, disponivel: false, pontos: 0, descricao: null };
  }
  const alerta = detectarLotesProximosPesoAlvo(db).find((a) => toNumber(a?.entidade?.id) === toNumber(lote?.id));
  if (alerta) {
    return { chave: 'peso_alvo', label, disponivel: true, pontos: 0, descricao: 'Lote próximo ou no peso alvo aumentou a confiança do score.' };
  }
  return { chave: 'peso_alvo', label, disponivel: true, pontos: 0, descricao: 'Lote ainda em fase de crescimento em relação ao peso alvo.' };
}

/**
 * 8. Mortalidade/perdas, se houver campo disponível: usa o histórico de
 * `movimentacoes_animais` (tipo morte/descarte = perda; venda/abate = saída
 * normal) contra o total que já passou pelo lote. `lote.qtd` é usado como
 * cabeças atuais — é o campo que o app mantém sincronizado a cada saída
 * (ver registrarSaidaAnimal em services/movimentacoes.js); `animais` (tabela
 * de grupos) não é decrementada nas saídas, então não é uma base confiável
 * para "quantas cabeças restam" — por isso não é usada aqui como fonte
 * primária, só como fallback quando o lote não informa `qtd`.
 */
function fatorMortalidade(db, lote, resumo) {
  const label = 'Mortalidade/perdas';
  const qtdAtual = toNumber(lote?.qtd) || toNumber(resumo.totalAnimais);
  const movimentos = (Array.isArray(db?.movimentacoes_animais) ? db.movimentacoes_animais : [])
    .filter((m) => toNumber(m?.lote_id) === toNumber(lote?.id));

  const saidasTotais = movimentos
    .filter((m) => SAIDA_TIPOS_TOTAL.has(String(m?.tipo || '').toLowerCase()))
    .reduce((soma, m) => soma + toNumber(m?.qtd), 0);
  const perdas = movimentos
    .filter((m) => PERDA_TIPOS.has(String(m?.tipo || '').toLowerCase()))
    .reduce((soma, m) => soma + toNumber(m?.qtd), 0);
  const totalHistorico = qtdAtual + saidasTotais;

  if (totalHistorico <= 0) {
    return { chave: 'mortalidade', label, disponivel: false, pontos: 0, descricao: null };
  }
  if (perdas <= 0) {
    return { chave: 'mortalidade', label, disponivel: true, pontos: 0, descricao: 'Nenhuma perda registrada aumentou a confiança do score.' };
  }

  const taxa = perdas / totalHistorico;
  if (taxa >= MORTALIDADE_TAXA_ALTA) {
    return { chave: 'mortalidade', label, disponivel: true, pontos: -20, descricao: 'Taxa de perdas acima de 10% reduziu 20 pontos.' };
  }
  if (taxa >= MORTALIDADE_TAXA_MEDIA) {
    return { chave: 'mortalidade', label, disponivel: true, pontos: -12, descricao: 'Taxa de perdas entre 5% e 10% reduziu 12 pontos.' };
  }
  return { chave: 'mortalidade', label, disponivel: true, pontos: -5, descricao: 'Houve alguma perda registrada, reduziu 5 pontos.' };
}

export function classificarScore(score) {
  if (score >= 85) return SAUDE_LOTE_CLASSIFICACAO.SAUDAVEL;
  if (score >= 70) return SAUDE_LOTE_CLASSIFICACAO.ATENCAO;
  if (score >= 50) return SAUDE_LOTE_CLASSIFICACAO.RISCO;
  return SAUDE_LOTE_CLASSIFICACAO.CRITICO;
}

function classificarConfiabilidade(fatoresAvaliados, totalFatores) {
  const proporcao = totalFatores > 0 ? fatoresAvaliados / totalFatores : 0;
  if (proporcao >= 0.75) return 'alta';
  if (proporcao >= 0.5) return 'media';
  return 'baixa';
}

/**
 * Calcula o score de saúde (0-100) de um lote. Retorna `score: null` e
 * `dadosInsuficientes: true` quando o lote não existe ou nenhum dos 8
 * fatores tem dado suficiente para ser avaliado — nunca mostra um número
 * "inventado" sem base real.
 */
export function calcularSaudeLote(db = {}, loteId, agora = new Date()) {
  const lote = (Array.isArray(db?.lotes) ? db.lotes : []).find((item) => toNumber(item.id) === toNumber(loteId));

  if (!lote) {
    return {
      loteId: toNumber(loteId),
      encontrado: false,
      nome: null,
      score: null,
      classificacao: null,
      classificacaoLabel: null,
      confiabilidade: null,
      dadosInsuficientes: true,
      mensagem: 'Lote não encontrado.',
      fatoresAvaliados: 0,
      totalFatores: TOTAL_FATORES,
      explicacoes: [],
      fatoresSemDados: [],
      fatores: [],
    };
  }

  // Calculado uma única vez e repassado aos fatores que precisam de
  // custo/peso/cabeças, em vez de cada um chamar getResumoLote por conta própria.
  const resumo = getResumoLote(db, lote.id);
  const heads = toNumber(lote?.qtd) || toNumber(resumo.totalAnimais);

  const fatores = [
    fatorGmd(db, lote),
    fatorPesagemFrequencia(db, lote, agora, heads),
    fatorTarefas(db, lote, agora),
    fatorSanidade(db, lote, agora),
    fatorEstoqueVinculado(db, lote, agora),
    fatorCusto(db, lote, resumo),
    fatorPesoAlvo(db, lote, resumo),
    fatorMortalidade(db, lote, resumo),
  ];

  const disponiveis = fatores.filter((f) => f.disponivel);
  const fatoresSemDados = fatores.filter((f) => !f.disponivel).map((f) => f.label);

  if (disponiveis.length === 0) {
    return {
      loteId: toNumber(loteId),
      encontrado: true,
      nome: lote.nome || `Lote ${lote.id}`,
      score: null,
      classificacao: null,
      classificacaoLabel: null,
      confiabilidade: null,
      dadosInsuficientes: true,
      mensagem: 'Ainda não há dados suficientes para avaliar a saúde deste lote.',
      fatoresAvaliados: 0,
      totalFatores: TOTAL_FATORES,
      explicacoes: [],
      fatoresSemDados,
      fatores,
    };
  }

  const penalidadeTotal = disponiveis.reduce((soma, f) => soma + f.pontos, 0);
  const score = Math.max(0, Math.min(100, 100 + penalidadeTotal));
  const classificacao = classificarScore(score);
  const confiabilidade = classificarConfiabilidade(disponiveis.length, TOTAL_FATORES);

  return {
    loteId: toNumber(loteId),
    encontrado: true,
    nome: lote.nome || `Lote ${lote.id}`,
    score,
    classificacao,
    classificacaoLabel: CLASSIFICACAO_LABEL[classificacao],
    confiabilidade,
    dadosInsuficientes: false,
    mensagem: confiabilidade === 'baixa'
      ? 'Poucos dados disponíveis para este lote — o score pode não refletir a situação real.'
      : null,
    fatoresAvaliados: disponiveis.length,
    totalFatores: TOTAL_FATORES,
    explicacoes: disponiveis.map((f) => f.descricao).filter(Boolean),
    fatoresSemDados,
    fatores,
  };
}

/**
 * Saúde de todos os lotes ativos, ordenada do pior para o melhor score
 * (lotes com dados insuficientes vão para o final). Usada em telas que
 * precisam de um ranking (ex.: Decisões da Fazenda).
 */
export function listarSaudeLotes(db = {}, agora = new Date()) {
  const lotes = (Array.isArray(db?.lotes) ? db.lotes : []).filter((lote) => lote?.status === 'ativo');
  return lotes
    .map((lote) => calcularSaudeLote(db, lote.id, agora))
    .sort((a, b) => {
      const scoreA = a.score === null ? Infinity : a.score;
      const scoreB = b.score === null ? Infinity : b.score;
      return scoreA - scoreB;
    });
}
