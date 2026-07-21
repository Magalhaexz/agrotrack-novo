import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SEVERIDADE,
  detectarLotesAbaixoGmd,
  detectarLotesProximosPesoAlvo,
  detectarEstoqueBaixo,
  detectarTarefasAtrasadas,
  detectarSanidadeProxima,
  detectarCustoAcimaDoPrevisto,
  gerarAlertasPriorizados,
} from './alertasInteligentes.js';
import { hojeLocalISO } from './dataCivil.js';

// GMD e peso alvo passam por getResumoLote/calcLote, que usam a data REAL do
// sistema como referência (não recebem `agora` injetado) — por isso essas
// datas são relativas a `new Date()`, igual ao padrão já usado em
// hojeNaFazenda.test.js.
function diasAtras(dias) {
  return hojeLocalISO(new Date(Date.now() - dias * 864e5));
}

// Estoque/tarefas/sanidade/custo recebem `agora` explícito — usamos uma data
// fixa para determinismo total.
const AGORA = new Date('2026-07-02T12:00:00Z');
function diasAtrasDe(agora, dias) {
  const data = new Date(agora);
  data.setUTCDate(data.getUTCDate() - dias);
  return data.toISOString().slice(0, 10);
}
function diasAFrenteDe(agora, dias) {
  return diasAtrasDe(agora, -dias);
}

// ─── 1. GMD abaixo da meta ──────────────────────────────────────────────────

test('detectarLotesAbaixoGmd marca crítico quando o GMD fica 50% abaixo da meta', () => {
  const db = {
    lotes: [{ id: 1, nome: 'Lote Nelore', status: 'ativo', gmd_meta: 1.0 }],
    animais: [{ id: 1, lote_id: 1, qtd: 10, sexo: 'macho', p_ini: 300, p_at: 320, data_entrada: diasAtras(40) }],
    pesagens: [
      { id: 1, lote_id: 1, data: diasAtras(30), peso_medio: 305 },
      { id: 2, lote_id: 1, data: diasAtras(5), peso_medio: 320 },
    ],
  };
  const alertas = detectarLotesAbaixoGmd(db);
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].severidade, SEVERIDADE.CRITICO);
  assert.equal(alertas[0].tipo, 'gmd');
  assert.match(alertas[0].titulo, /Lote Nelore está abaixo do GMD esperado/);
  assert.deepEqual(alertas[0].entidade, { tipo: 'lote', id: 1, nome: 'Lote Nelore' });
  assert.equal(alertas[0].pagina, 'resultados');
});

test('detectarLotesAbaixoGmd marca médio para desvio pequeno (abaixo de 10%)', () => {
  const db = {
    // `entrada`/`p_ini` do lote são a base oficial do GMD de vida
    // (domain/gmd.js). Sem eles o cálculo cairia para a 1ª pesagem e mediria
    // só 55 dias em vez dos 100 reais — lote de verdade sempre tem entrada.
    lotes: [{ id: 2, nome: 'Lote Recria', status: 'ativo', gmd_meta: 1.0, entrada: diasAtras(100), p_ini: 300 }],
    animais: [{ id: 1, lote_id: 2, qtd: 5, sexo: 'macho', p_ini: 300, p_at: 392, data_entrada: diasAtras(100) }],
    pesagens: [
      { id: 1, lote_id: 2, data: diasAtras(60), peso_medio: 350 },
      { id: 2, lote_id: 2, data: diasAtras(5), peso_medio: 392 },
    ],
  };
  const alertas = detectarLotesAbaixoGmd(db);
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].severidade, SEVERIDADE.MEDIO);
});

test('detectarLotesAbaixoGmd não alerta sem meta cadastrada, com GMD ok ou sem pesagens suficientes', () => {
  const semMeta = { lotes: [{ id: 1, nome: 'A', status: 'ativo', gmd_meta: 0 }], animais: [{ id: 1, lote_id: 1, qtd: 1, p_ini: 300, p_at: 400, data_entrada: diasAtras(30) }], pesagens: [{ id: 1, lote_id: 1, data: diasAtras(10) }, { id: 2, lote_id: 1, data: diasAtras(1) }] };
  assert.deepEqual(detectarLotesAbaixoGmd(semMeta), []);

  const gmdOk = { lotes: [{ id: 1, nome: 'A', status: 'ativo', gmd_meta: 1.0 }], animais: [{ id: 1, lote_id: 1, qtd: 1, p_ini: 300, p_at: 340, data_entrada: diasAtras(40) }], pesagens: [{ id: 1, lote_id: 1, data: diasAtras(10) }, { id: 2, lote_id: 1, data: diasAtras(1) }] };
  assert.deepEqual(detectarLotesAbaixoGmd(gmdOk), []);

  const semPesagens = { lotes: [{ id: 1, nome: 'A', status: 'ativo', gmd_meta: 1.0 }], animais: [{ id: 1, lote_id: 1, qtd: 1, p_ini: 300, p_at: 320, data_entrada: diasAtras(40) }], pesagens: [{ id: 1, lote_id: 1, data: diasAtras(1) }] };
  assert.deepEqual(detectarLotesAbaixoGmd(semPesagens), []);
});

test('detectarLotesAbaixoGmd ignora lote inativo', () => {
  const db = {
    lotes: [{ id: 1, nome: 'A', status: 'encerrado', gmd_meta: 1.0 }],
    animais: [{ id: 1, lote_id: 1, qtd: 1, p_ini: 300, p_at: 310, data_entrada: diasAtras(40) }],
    pesagens: [{ id: 1, lote_id: 1, data: diasAtras(10) }, { id: 2, lote_id: 1, data: diasAtras(1) }],
  };
  assert.deepEqual(detectarLotesAbaixoGmd(db), []);
});

// ─── 2. Peso próximo do alvo ────────────────────────────────────────────────

function dbComPeso(pesoAtual, pesoAlvo) {
  return {
    lotes: [{ id: 1, nome: 'Lote Nelore', status: 'ativo', peso_alvo: pesoAlvo }],
    animais: [{ id: 1, lote_id: 1, qtd: 10, p_ini: 300, p_at: pesoAtual, data_entrada: diasAtras(30) }],
  };
}

test('detectarLotesProximosPesoAlvo marca alto quando o peso atingiu ou superou o alvo', () => {
  const alertas = detectarLotesProximosPesoAlvo(dbComPeso(420, 400));
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].severidade, SEVERIDADE.ALTO);
  assert.match(alertas[0].titulo, /Lote Nelore atingiu o peso alvo/);
  assert.equal(alertas[0].acaoSugerida, 'Avaliar a venda do lote.');
});

test('detectarLotesProximosPesoAlvo marca médio quando está muito próximo (>=95%)', () => {
  const alertas = detectarLotesProximosPesoAlvo(dbComPeso(380, 400));
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].severidade, SEVERIDADE.MEDIO);
  assert.match(alertas[0].titulo, /está próximo do peso alvo/);
});

test('detectarLotesProximosPesoAlvo marca baixo entre 90% e 95%', () => {
  const alertas = detectarLotesProximosPesoAlvo(dbComPeso(365, 400));
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].severidade, SEVERIDADE.BAIXO);
});

test('detectarLotesProximosPesoAlvo não alerta abaixo de 90% ou sem peso alvo cadastrado', () => {
  assert.deepEqual(detectarLotesProximosPesoAlvo(dbComPeso(300, 400)), []);
  assert.deepEqual(detectarLotesProximosPesoAlvo(dbComPeso(380, 0)), []);
});

// ─── 3. Estoque baixo / previsão de esgotamento ─────────────────────────────

test('detectarEstoqueBaixo marca crítico para estoque zerado', () => {
  const db = { estoque: [{ id: 1, produto: 'Sal mineral', quantidade_atual: 0, quantidade_minima: 10 }] };
  const alertas = detectarEstoqueBaixo(db, AGORA);
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].severidade, SEVERIDADE.CRITICO);
  assert.match(alertas[0].titulo, /estoque zerado/);
});

test('detectarEstoqueBaixo prevê esgotamento em 7 dias pelo consumo recente (crítico)', () => {
  const db = {
    estoque: [{ id: 1, produto: 'Sal mineral', quantidade_atual: 70, unidade: 'kg', quantidade_minima: 0 }],
    movimentacoes_estoque: [
      { item_estoque_id: 1, tipo: 'saida', quantidade: 100, data: diasAtrasDe(AGORA, 5) },
      { item_estoque_id: 1, tipo: 'saida', quantidade: 100, data: diasAtrasDe(AGORA, 15) },
      { item_estoque_id: 1, tipo: 'saida', quantidade: 100, data: diasAtrasDe(AGORA, 25) },
    ],
  };
  const alertas = detectarEstoqueBaixo(db, AGORA);
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].severidade, SEVERIDADE.CRITICO);
  assert.match(alertas[0].titulo, /Sal mineral pode acabar em 7 dias/);
});

test('detectarEstoqueBaixo marca médio quando a previsão é de 8 a 15 dias', () => {
  const db = {
    estoque: [{ id: 1, produto: 'Ração', quantidade_atual: 150, quantidade_minima: 0 }],
    movimentacoes_estoque: [
      { item_estoque_id: 1, tipo: 'saida', quantidade: 100, data: diasAtrasDe(AGORA, 5) },
      { item_estoque_id: 1, tipo: 'saida', quantidade: 200, data: diasAtrasDe(AGORA, 20) },
    ],
  };
  const alertas = detectarEstoqueBaixo(db, AGORA);
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].severidade, SEVERIDADE.MEDIO);
});

test('detectarEstoqueBaixo marca alto quando está abaixo do mínimo (sem dado de consumo)', () => {
  const db = { estoque: [{ id: 1, produto: 'Vacina X', quantidade_atual: 8, quantidade_minima: 10 }] };
  const alertas = detectarEstoqueBaixo(db, AGORA);
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].severidade, SEVERIDADE.ALTO);
});

test('detectarEstoqueBaixo marca baixo quando está próximo do mínimo (até 1,5x)', () => {
  const db = { estoque: [{ id: 1, produto: 'Vacina X', quantidade_atual: 140, quantidade_minima: 100 }] };
  const alertas = detectarEstoqueBaixo(db, AGORA);
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].severidade, SEVERIDADE.BAIXO);
});

test('detectarEstoqueBaixo não alerta com estoque confortável e sem dado de consumo', () => {
  const db = { estoque: [{ id: 1, produto: 'Vacina X', quantidade_atual: 500, quantidade_minima: 0 }] };
  assert.deepEqual(detectarEstoqueBaixo(db, AGORA), []);
});

// ─── 4. Tarefas atrasadas ───────────────────────────────────────────────────

test('detectarTarefasAtrasadas escala a severidade pelos dias de atraso', () => {
  const base = { id: 1, titulo: 'Vacinar bezerros', status: 'pendente', prioridade: 'media' };
  const medio = detectarTarefasAtrasadas({ tarefas: [{ ...base, data_vencimento: diasAtrasDe(AGORA, 1) }] }, AGORA);
  assert.equal(medio[0].severidade, SEVERIDADE.MEDIO);

  const alto = detectarTarefasAtrasadas({ tarefas: [{ ...base, data_vencimento: diasAtrasDe(AGORA, 3) }] }, AGORA);
  assert.equal(alto[0].severidade, SEVERIDADE.ALTO);

  const critico = detectarTarefasAtrasadas({ tarefas: [{ ...base, data_vencimento: diasAtrasDe(AGORA, 10) }] }, AGORA);
  assert.equal(critico[0].severidade, SEVERIDADE.CRITICO);
});

test('detectarTarefasAtrasadas trata prioridade alta/crítica como crítico mesmo com pouco atraso', () => {
  const db = { tarefas: [{ id: 1, titulo: 'Comprar sal mineral', status: 'pendente', prioridade: 'alta', data_vencimento: diasAtrasDe(AGORA, 1) }] };
  const alertas = detectarTarefasAtrasadas(db, AGORA);
  assert.equal(alertas[0].severidade, SEVERIDADE.CRITICO);
});

test('detectarTarefasAtrasadas ignora tarefa concluída, sem vencimento ou ainda não vencida', () => {
  const concluida = { tarefas: [{ id: 1, titulo: 'A', status: 'concluida', data_vencimento: diasAtrasDe(AGORA, 5) }] };
  assert.deepEqual(detectarTarefasAtrasadas(concluida, AGORA), []);

  const semData = { tarefas: [{ id: 1, titulo: 'A', status: 'pendente' }] };
  assert.deepEqual(detectarTarefasAtrasadas(semData, AGORA), []);

  const futura = { tarefas: [{ id: 1, titulo: 'A', status: 'pendente', data_vencimento: diasAFrenteDe(AGORA, 2) }] };
  assert.deepEqual(detectarTarefasAtrasadas(futura, AGORA), []);
});

// ─── 5. Sanidade próxima ────────────────────────────────────────────────────

test('detectarSanidadeProxima marca alto quando vence amanhã', () => {
  const db = {
    lotes: [{ id: 1, nome: 'Lote Recria' }],
    sanitario: [{ id: 1, tipo: 'Vacinação', lote_id: 1, proxima: diasAFrenteDe(AGORA, 1) }],
  };
  const alertas = detectarSanidadeProxima(db, AGORA);
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].severidade, SEVERIDADE.ALTO);
  assert.equal(alertas[0].titulo, 'Vacinação do Lote Recria vence amanhã');
});

test('detectarSanidadeProxima marca crítico quando já venceu', () => {
  const db = {
    lotes: [{ id: 1, nome: 'Lote Recria' }],
    sanitario: [{ id: 1, tipo: 'Vermífugo', lote_id: 1, proxima: diasAtrasDe(AGORA, 2) }],
  };
  const alertas = detectarSanidadeProxima(db, AGORA);
  assert.equal(alertas[0].severidade, SEVERIDADE.CRITICO);
  assert.match(alertas[0].titulo, /venceu há 2 dias/);
});

test('detectarSanidadeProxima respeita alerta_dias_antes customizado e ignora fora da janela', () => {
  const dentroDaJanela = {
    sanitario: [{ id: 1, tipo: 'Exame', lote_id: null, proxima: diasAFrenteDe(AGORA, 5), alerta_dias_antes: 10 }],
  };
  const alertasDentro = detectarSanidadeProxima(dentroDaJanela, AGORA);
  assert.equal(alertasDentro.length, 1);
  assert.equal(alertasDentro[0].severidade, SEVERIDADE.MEDIO);
  assert.match(alertasDentro[0].titulo, /sem lote vinculado/);

  const foraDaJanela = {
    sanitario: [{ id: 1, tipo: 'Exame', proxima: diasAFrenteDe(AGORA, 10) }],
  };
  assert.deepEqual(detectarSanidadeProxima(foraDaJanela, AGORA), []);
});

// ─── 6. Custo acima do previsto ─────────────────────────────────────────────

function movDespesa(valor, diasAtrasN, extra = {}) {
  return { tipo: 'despesa', valor, data: diasAtrasDe(AGORA, diasAtrasN), ...extra };
}

test('detectarCustoAcimaDoPrevisto marca crítico para alta de 50% ou mais', () => {
  const db = {
    movimentacoes_financeiras: [
      movDespesa(1000, 5), movDespesa(500, 20), // janela atual: 1500
      movDespesa(700, 35), movDespesa(300, 50), // janela anterior: 1000
    ],
  };
  const alertas = detectarCustoAcimaDoPrevisto(db, AGORA);
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].severidade, SEVERIDADE.CRITICO);
  assert.equal(alertas[0].tipo, 'custo');
  assert.equal(alertas[0].titulo, 'Custo da fazenda subiu nos últimos 30 dias');
});

test('detectarCustoAcimaDoPrevisto inclui custo por cabeça quando há lotes ativos', () => {
  // Seção 8 (auditoria lote.qtd): cabeças ativas somam lote.qtd dos lotes
  // ativos (fonte canônica), não animais.qtd.
  const db = {
    lotes: [{ id: 1, status: 'ativo', qtd: 10 }],
    movimentacoes_financeiras: [movDespesa(1500, 5), movDespesa(1000, 35)],
  };
  const alertas = detectarCustoAcimaDoPrevisto(db, AGORA);
  assert.equal(alertas[0].titulo, 'Custo por cabeça subiu nos últimos 30 dias');
  assert.match(alertas[0].descricao, /R\$ 100\.00 para R\$ 150\.00/);
});

test('detectarCustoAcimaDoPrevisto classifica alto (30-49%) e médio (15-29%)', () => {
  const alto = detectarCustoAcimaDoPrevisto({ movimentacoes_financeiras: [movDespesa(1350, 5), movDespesa(1000, 35)] }, AGORA);
  assert.equal(alto[0].severidade, SEVERIDADE.ALTO);

  const medio = detectarCustoAcimaDoPrevisto({ movimentacoes_financeiras: [movDespesa(1200, 5), movDespesa(1000, 35)] }, AGORA);
  assert.equal(medio[0].severidade, SEVERIDADE.MEDIO);
});

test('detectarCustoAcimaDoPrevisto não alerta com alta pequena ou sem janela anterior', () => {
  const altaPequena = detectarCustoAcimaDoPrevisto({ movimentacoes_financeiras: [movDespesa(1050, 5), movDespesa(1000, 35)] }, AGORA);
  assert.deepEqual(altaPequena, []);

  const semAnterior = detectarCustoAcimaDoPrevisto({ movimentacoes_financeiras: [movDespesa(5000, 5)] }, AGORA);
  assert.deepEqual(semAnterior, []);
});

test('detectarCustoAcimaDoPrevisto ignora receitas e despesas canceladas/previstas', () => {
  const db = {
    movimentacoes_financeiras: [
      movDespesa(1500, 5), movDespesa(1000, 35),
      { tipo: 'receita', valor: 99999, data: diasAtrasDe(AGORA, 5) },
      movDespesa(99999, 5, { status: 'cancelado' }),
      movDespesa(99999, 5, { status: 'previsto' }),
    ],
  };
  const alertas = detectarCustoAcimaDoPrevisto(db, AGORA);
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].severidade, SEVERIDADE.CRITICO);
});

// ─── 7. Lista priorizada ────────────────────────────────────────────────────

const RANK = { [SEVERIDADE.CRITICO]: 0, [SEVERIDADE.ALTO]: 1, [SEVERIDADE.MEDIO]: 2, [SEVERIDADE.BAIXO]: 3 };

test('gerarAlertasPriorizados combina todos os detectores ordenados por severidade', () => {
  const db = {
    tarefas: [
      { id: 1, titulo: 'Tarefa crítica', status: 'pendente', prioridade: 'media', data_vencimento: diasAtrasDe(AGORA, 10) },
      { id: 2, titulo: 'Tarefa média', status: 'pendente', prioridade: 'media', data_vencimento: diasAtrasDe(AGORA, 1) },
    ],
    estoque: [{ id: 1, produto: 'Sal mineral', quantidade_atual: 0 }],
    sanitario: [{ id: 1, tipo: 'Vacina', proxima: diasAFrenteDe(AGORA, 1) }],
  };
  const alertas = gerarAlertasPriorizados(db, AGORA);
  assert.equal(alertas.length, 4);
  for (let i = 1; i < alertas.length; i += 1) {
    assert.ok(RANK[alertas[i - 1].severidade] <= RANK[alertas[i].severidade], 'ordem de severidade deve ser não-decrescente');
  }
  assert.equal(alertas[0].severidade, SEVERIDADE.CRITICO);
});

test('gerarAlertasPriorizados não quebra com db vazio', () => {
  assert.deepEqual(gerarAlertasPriorizados({}, AGORA), []);
  assert.deepEqual(gerarAlertasPriorizados(undefined, AGORA), []);
});
