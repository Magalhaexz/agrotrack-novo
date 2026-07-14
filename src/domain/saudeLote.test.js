import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SAUDE_LOTE_CLASSIFICACAO,
  calcularSaudeLote,
  classificarScore,
  listarSaudeLotes,
} from './saudeLote.js';
import { hojeLocalISO } from './dataCivil.js';

// GMD e peso alvo dependem de getResumoLote/calcLote, que usam a data REAL do
// sistema (não recebem `agora` injetado) — mesmo padrão já usado em
// alertasInteligentes.test.js/hojeNaFazenda.test.js.
function diasAtras(dias) {
  return hojeLocalISO(new Date(Date.now() - dias * 864e5));
}

// Pesagem/tarefa/sanidade/estoque/custo/mortalidade recebem `agora` explícito.
const AGORA = new Date('2026-07-02T12:00:00Z');
function diasAtrasDe(agora, dias) {
  const data = new Date(agora);
  data.setUTCDate(data.getUTCDate() - dias);
  return data.toISOString().slice(0, 10);
}

// ─── classificação (Entrega 3) ──────────────────────────────────────────────

test('classificarScore aplica as faixas exatas do enunciado', () => {
  assert.equal(classificarScore(100), SAUDE_LOTE_CLASSIFICACAO.SAUDAVEL);
  assert.equal(classificarScore(85), SAUDE_LOTE_CLASSIFICACAO.SAUDAVEL);
  assert.equal(classificarScore(84), SAUDE_LOTE_CLASSIFICACAO.ATENCAO);
  assert.equal(classificarScore(70), SAUDE_LOTE_CLASSIFICACAO.ATENCAO);
  assert.equal(classificarScore(69), SAUDE_LOTE_CLASSIFICACAO.RISCO);
  assert.equal(classificarScore(50), SAUDE_LOTE_CLASSIFICACAO.RISCO);
  assert.equal(classificarScore(49), SAUDE_LOTE_CLASSIFICACAO.CRITICO);
  assert.equal(classificarScore(0), SAUDE_LOTE_CLASSIFICACAO.CRITICO);
});

// ─── lote não encontrado / sem dado nenhum ──────────────────────────────────

test('calcularSaudeLote retorna dados insuficientes quando o lote não existe', () => {
  const resultado = calcularSaudeLote({ lotes: [] }, 999, AGORA);
  assert.equal(resultado.encontrado, false);
  assert.equal(resultado.score, null);
  assert.equal(resultado.classificacao, null);
  assert.equal(resultado.dadosInsuficientes, true);
});

test('calcularSaudeLote retorna dados insuficientes quando o lote existe mas não há nenhum dado vinculado', () => {
  const db = { lotes: [{ id: 1, nome: 'Lote Vazio', status: 'ativo' }] };
  const resultado = calcularSaudeLote(db, 1, AGORA);
  assert.equal(resultado.encontrado, true);
  assert.equal(resultado.score, null);
  assert.equal(resultado.dadosInsuficientes, true);
  assert.equal(resultado.fatoresAvaliados, 0);
  assert.equal(resultado.fatoresSemDados.length, 8);
  assert.deepEqual(resultado.explicacoes, []);
});

// ─── caminho feliz: lote saudável ───────────────────────────────────────────

function dbLoteSaudavel() {
  return {
    lotes: [{ id: 1, nome: 'Lote Nelore', status: 'ativo', gmd_meta: 1.0, peso_alvo: 500, preco_arroba: 270, qtd: 10 }],
    animais: [{ id: 1, lote_id: 1, qtd: 10, p_ini: 300, p_at: 340, data_entrada: diasAtras(40) }],
    pesagens: [
      { id: 1, lote_id: 1, data: diasAtrasDe(AGORA, 20), peso_medio: 330 },
      { id: 2, lote_id: 1, data: diasAtrasDe(AGORA, 5), peso_medio: 340 },
    ],
    tarefas: [{ id: 1, lote_id: 1, titulo: 'Vacinar', status: 'concluida', data_vencimento: diasAtrasDe(AGORA, 10) }],
    sanitario: [{ id: 1, lote_id: 1, tipo: 'Vacina', proxima: null }],
    consumo_suplementacao: [{ id: 1, lote_id: 1, item_estoque_id: 1, data: diasAtrasDe(AGORA, 5), quantidade: 10 }],
    estoque: [{ id: 1, produto: 'Sal mineral', quantidade_atual: 500, quantidade_minima: 50 }],
    movimentacoes_financeiras: [{ id: 1, tipo: 'despesa', lote_id: 1, valor: 1000, data: diasAtrasDe(AGORA, 10) }],
    movimentacoes_animais: [],
  };
}

test('lote saudável recebe score alto, classificação saudável e confiança alta', () => {
  const resultado = calcularSaudeLote(dbLoteSaudavel(), 1, AGORA);
  assert.equal(resultado.dadosInsuficientes, false);
  assert.ok(resultado.score >= 85, `esperado score >= 85, recebido ${resultado.score}`);
  assert.equal(resultado.classificacao, SAUDE_LOTE_CLASSIFICACAO.SAUDAVEL);
  assert.equal(resultado.confiabilidade, 'alta');
  assert.equal(resultado.mensagem, null);
  assert.ok(resultado.explicacoes.some((linha) => /confiança/.test(linha)));
});

// ─── fator 1: GMD ────────────────────────────────────────────────────────────

test('GMD muito abaixo da meta (30%+) reduz 20 pontos com a explicação esperada', () => {
  const db = dbLoteSaudavel();
  // GMD real = (340-300)/40 = 1.0 no fixture saudável; forço para bem abaixo:
  db.animais = [{ id: 1, lote_id: 1, qtd: 10, p_ini: 300, p_at: 328, data_entrada: diasAtras(40) }]; // 0.7 kg/dia, 30% abaixo de 1.0
  const resultado = calcularSaudeLote(db, 1, AGORA);
  const fatorGmd = resultado.fatores.find((f) => f.chave === 'gmd');
  assert.equal(fatorGmd.pontos, -20);
  assert.equal(fatorGmd.descricao, 'GMD abaixo da meta reduziu 20 pontos.');
});

test('GMD sem meta cadastrada ou sem pesagens suficientes fica indisponível', () => {
  const semMeta = { lotes: [{ id: 1, nome: 'A', status: 'ativo', gmd_meta: 0 }], animais: [{ id: 1, lote_id: 1, qtd: 1, p_ini: 300, p_at: 400, data_entrada: diasAtras(30) }] };
  const r1 = calcularSaudeLote(semMeta, 1, AGORA);
  assert.equal(r1.fatores.find((f) => f.chave === 'gmd').disponivel, false);

  const semPesagens = { lotes: [{ id: 1, nome: 'A', status: 'ativo', gmd_meta: 1.0 }], animais: [{ id: 1, lote_id: 1, qtd: 1, p_ini: 300, p_at: 320, data_entrada: diasAtras(40) }], pesagens: [{ id: 1, lote_id: 1, data: diasAtrasDe(AGORA, 1) }] };
  const r2 = calcularSaudeLote(semPesagens, 1, AGORA);
  assert.equal(r2.fatores.find((f) => f.chave === 'gmd').disponivel, false);
});

// ─── fator 2: frequência de pesagem ─────────────────────────────────────────

test('sem pesagem recente (>30 dias) reduz 10 pontos — exemplo literal do enunciado', () => {
  const db = dbLoteSaudavel();
  db.pesagens = [
    { id: 1, lote_id: 1, data: diasAtrasDe(AGORA, 60), peso_medio: 330 },
    { id: 2, lote_id: 1, data: diasAtrasDe(AGORA, 35), peso_medio: 335 },
  ];
  const resultado = calcularSaudeLote(db, 1, AGORA);
  const fator = resultado.fatores.find((f) => f.chave === 'pesagem');
  assert.equal(fator.pontos, -10);
  assert.equal(fator.descricao, 'Sem pesagem recente reduziu 10 pontos.');
});

test('lote nunca pesado reduz 15 pontos', () => {
  const db = dbLoteSaudavel();
  db.pesagens = [];
  const resultado = calcularSaudeLote(db, 1, AGORA);
  const fator = resultado.fatores.find((f) => f.chave === 'pesagem');
  assert.equal(fator.pontos, -15);
  assert.equal(fator.disponivel, true);
  assert.match(fator.descricao, /nunca foi pesado/);
});

test('pesagem há mais de 45 dias reduz 12 pontos', () => {
  const db = dbLoteSaudavel();
  db.pesagens = [
    { id: 1, lote_id: 1, data: diasAtrasDe(AGORA, 90), peso_medio: 320 },
    { id: 2, lote_id: 1, data: diasAtrasDe(AGORA, 50), peso_medio: 335 },
  ];
  const resultado = calcularSaudeLote(db, 1, AGORA);
  assert.equal(resultado.fatores.find((f) => f.chave === 'pesagem').pontos, -12);
});

// ─── fator 3: tarefas atrasadas ──────────────────────────────────────────────

test('tarefas atrasadas reduzem pontos com singular/plural corretos', () => {
  const db = dbLoteSaudavel();
  db.tarefas = [{ id: 1, lote_id: 1, titulo: 'Vacinar', status: 'pendente', prioridade: 'media', data_vencimento: diasAtrasDe(AGORA, 3) }];
  const r1 = calcularSaudeLote(db, 1, AGORA);
  const f1 = r1.fatores.find((f) => f.chave === 'tarefas');
  assert.ok(f1.pontos < 0);
  assert.match(f1.descricao, /^1 tarefa atrasada reduziu \d+ pontos\.$/);

  db.tarefas = [
    { id: 1, lote_id: 1, titulo: 'A', status: 'pendente', prioridade: 'media', data_vencimento: diasAtrasDe(AGORA, 3) },
    { id: 2, lote_id: 1, titulo: 'B', status: 'pendente', prioridade: 'alta', data_vencimento: diasAtrasDe(AGORA, 1) },
  ];
  const r2 = calcularSaudeLote(db, 1, AGORA);
  const f2 = r2.fatores.find((f) => f.chave === 'tarefas');
  assert.match(f2.descricao, /^2 tarefas atrasadas reduziram \d+ pontos\.$/);
});

test('sem tarefa vinculada ao lote, o fator fica indisponível', () => {
  const db = dbLoteSaudavel();
  db.tarefas = [];
  const resultado = calcularSaudeLote(db, 1, AGORA);
  assert.equal(resultado.fatores.find((f) => f.chave === 'tarefas').disponivel, false);
});

// ─── fator 4: sanidade pendente ─────────────────────────────────────────────

test('sanidade em dia aumenta a confiança do score — exemplo literal do enunciado', () => {
  const resultado = calcularSaudeLote(dbLoteSaudavel(), 1, AGORA);
  const fator = resultado.fatores.find((f) => f.chave === 'sanidade');
  assert.equal(fator.pontos, 0);
  assert.equal(fator.descricao, 'Sanidade em dia aumentou a confiança do score.');
});

test('sanidade vencida reduz pontos', () => {
  const db = dbLoteSaudavel();
  db.sanitario = [{ id: 1, lote_id: 1, tipo: 'Vacina', proxima: diasAtrasDe(AGORA, 5) }];
  const resultado = calcularSaudeLote(db, 1, AGORA);
  const fator = resultado.fatores.find((f) => f.chave === 'sanidade');
  assert.equal(fator.pontos, -15);
});

// ─── fator 5: estoque/suplementação vinculada ───────────────────────────────

test('produto vinculado zerado no estoque reduz pontos', () => {
  const db = dbLoteSaudavel();
  db.estoque = [{ id: 1, produto: 'Sal mineral', quantidade_atual: 0, quantidade_minima: 50 }];
  const resultado = calcularSaudeLote(db, 1, AGORA);
  const fator = resultado.fatores.find((f) => f.chave === 'estoque');
  assert.equal(fator.pontos, -10);
});

test('sem consumo_suplementacao vinculado ao lote, o fator fica indisponível', () => {
  const db = dbLoteSaudavel();
  db.consumo_suplementacao = [];
  const resultado = calcularSaudeLote(db, 1, AGORA);
  assert.equal(resultado.fatores.find((f) => f.chave === 'estoque').disponivel, false);
});

// ─── fator 6: custo por cabeça ──────────────────────────────────────────────

test('custo por arroba acima do esperado reduz 15 pontos', () => {
  const db = dbLoteSaudavel();
  db.movimentacoes_financeiras = [{ id: 1, tipo: 'despesa', lote_id: 1, valor: 50000, data: diasAtrasDe(AGORA, 10) }];
  const resultado = calcularSaudeLote(db, 1, AGORA);
  const fator = resultado.fatores.find((f) => f.chave === 'custo');
  assert.equal(fator.pontos, -15);
  assert.match(fator.descricao, /Custo por arroba acima do esperado reduziu 15 pontos\./);
});

test('sem custo nenhum lançado, o fator fica indisponível', () => {
  const db = dbLoteSaudavel();
  db.movimentacoes_financeiras = [];
  const resultado = calcularSaudeLote(db, 1, AGORA);
  assert.equal(resultado.fatores.find((f) => f.chave === 'custo').disponivel, false);
});

// ─── fator 7: proximidade do peso alvo ──────────────────────────────────────

test('lote sem peso alvo cadastrado deixa o fator indisponível, sem penalizar', () => {
  const db = dbLoteSaudavel();
  db.lotes[0].peso_alvo = 0;
  const resultado = calcularSaudeLote(db, 1, AGORA);
  const fator = resultado.fatores.find((f) => f.chave === 'peso_alvo');
  assert.equal(fator.disponivel, false);
  assert.equal(fator.pontos, 0);
});

test('lote longe do peso alvo não penaliza, só descreve o estágio', () => {
  const db = dbLoteSaudavel();
  db.lotes[0].peso_alvo = 900; // bem longe do peso atual (~340kg)
  const resultado = calcularSaudeLote(db, 1, AGORA);
  const fator = resultado.fatores.find((f) => f.chave === 'peso_alvo');
  assert.equal(fator.pontos, 0);
  assert.equal(fator.disponivel, true);
  assert.match(fator.descricao, /fase de crescimento/);
});

// ─── fator 8: mortalidade/perdas ────────────────────────────────────────────

test('sem nenhum movimento de animal e sem qtd, o fator de mortalidade fica indisponível', () => {
  const db = dbLoteSaudavel();
  db.lotes[0].qtd = 0;
  db.animais = [];
  db.movimentacoes_animais = [];
  const resultado = calcularSaudeLote(db, 1, AGORA);
  assert.equal(resultado.fatores.find((f) => f.chave === 'mortalidade').disponivel, false);
});

test('taxa de perdas alta (>=10%) reduz 20 pontos', () => {
  const db = dbLoteSaudavel();
  db.lotes[0].qtd = 9;
  db.movimentacoes_animais = [{ id: 1, lote_id: 1, tipo: 'morte', qtd: 1, data: diasAtrasDe(AGORA, 5) }];
  const resultado = calcularSaudeLote(db, 1, AGORA);
  const fator = resultado.fatores.find((f) => f.chave === 'mortalidade');
  assert.equal(fator.pontos, -20);
  assert.match(fator.descricao, /acima de 10%/);
});

test('taxa de perdas média (5% a 10%) reduz 12 pontos', () => {
  const db = dbLoteSaudavel();
  db.lotes[0].qtd = 19;
  db.movimentacoes_animais = [{ id: 1, lote_id: 1, tipo: 'descarte', qtd: 1, data: diasAtrasDe(AGORA, 5) }];
  const resultado = calcularSaudeLote(db, 1, AGORA);
  const fator = resultado.fatores.find((f) => f.chave === 'mortalidade');
  assert.equal(fator.pontos, -12);
});

test('venda e abate não contam como perda de saúde', () => {
  const db = dbLoteSaudavel();
  db.lotes[0].qtd = 8;
  db.movimentacoes_animais = [{ id: 1, lote_id: 1, tipo: 'venda', qtd: 2, data: diasAtrasDe(AGORA, 5) }];
  const resultado = calcularSaudeLote(db, 1, AGORA);
  const fator = resultado.fatores.find((f) => f.chave === 'mortalidade');
  assert.equal(fator.pontos, 0);
  assert.match(fator.descricao, /Nenhuma perda registrada/);
});

// ─── confiabilidade ──────────────────────────────────────────────────────────

test('confiabilidade cai para média/baixa conforme faltam fatores, e mensagem some quando não é baixa', () => {
  const soLoteEqtd = {
    lotes: [{ id: 1, nome: 'Lote Novo', status: 'ativo', qtd: 10 }],
    movimentacoes_animais: [{ id: 1, lote_id: 1, tipo: 'morte', qtd: 1, data: diasAtrasDe(AGORA, 1) }],
    pesagens: [],
  };
  const resultado = calcularSaudeLote(soLoteEqtd, 1, AGORA);
  // Disponíveis aqui: pesagem (nunca pesado) e mortalidade = 2 de 8 → baixa.
  assert.equal(resultado.fatoresAvaliados, 2);
  assert.equal(resultado.confiabilidade, 'baixa');
  assert.match(resultado.mensagem, /Poucos dados/);

  const saudavel = calcularSaudeLote(dbLoteSaudavel(), 1, AGORA);
  assert.equal(saudavel.confiabilidade, 'alta');
  assert.equal(saudavel.mensagem, null);
});

// ─── listarSaudeLotes ────────────────────────────────────────────────────────

test('listarSaudeLotes ordena do pior para o melhor score e deixa dados insuficientes por último', () => {
  const dbBase = dbLoteSaudavel();
  const dbMultiplo = {
    ...dbBase,
    lotes: [
      ...dbBase.lotes,
      { id: 2, nome: 'Lote Vazio', status: 'ativo' },
      { id: 3, nome: 'Lote Critico', status: 'ativo', gmd_meta: 1.0, qtd: 10 },
    ],
    animais: [
      ...dbBase.animais,
      { id: 2, lote_id: 3, qtd: 10, p_ini: 300, p_at: 310, data_entrada: diasAtras(50) },
    ],
    pesagens: [
      ...dbBase.pesagens,
      { id: 3, lote_id: 3, data: diasAtrasDe(AGORA, 1), peso_medio: 310 },
      { id: 4, lote_id: 3, data: diasAtrasDe(AGORA, 40), peso_medio: 305 },
    ],
    movimentacoes_animais: [
      ...(dbBase.movimentacoes_animais || []),
      { id: 1, lote_id: 3, tipo: 'morte', qtd: 2, data: diasAtrasDe(AGORA, 2) },
    ],
  };
  const ranking = listarSaudeLotes(dbMultiplo, AGORA);
  assert.equal(ranking.length, 3);
  assert.equal(ranking[ranking.length - 1].loteId, 2); // "Lote Vazio" (dados insuficientes) por último
  assert.equal(ranking[ranking.length - 1].dadosInsuficientes, true);
  assert.ok(ranking[0].score <= ranking[1].score, 'primeiro deve ter o pior (menor) score');
});

test('listarSaudeLotes ignora lotes que não estão ativos e não quebra com db vazio', () => {
  const db = { lotes: [{ id: 1, nome: 'Encerrado', status: 'encerrado', gmd_meta: 1.0 }] };
  assert.deepEqual(listarSaudeLotes(db, AGORA), []);
  assert.deepEqual(listarSaudeLotes({}, AGORA), []);
  assert.deepEqual(listarSaudeLotes(undefined, AGORA), []);
});
