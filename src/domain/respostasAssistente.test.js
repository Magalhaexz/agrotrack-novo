import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  responderPerguntaHerdon,
  listarPerguntasAssistente,
  avaliarProntidaoAssistente,
} from './respostasAssistente.js';
import { hojeLocalISO } from './dataCivil.js';

// GMD depende de getResumoLote/calcLote, que usa a data REAL do sistema (não
// recebe `agora` injetado) — mesmo padrão de saudeLote.test.js/relatorioLote.test.js.
function diasAtras(dias) {
  return hojeLocalISO(new Date(Date.now() - dias * 864e5));
}

// Demais funções (sanidade, tarefas, estoque, custo) recebem `agora` explícito.
const AGORA = new Date('2026-07-02T12:00:00Z');
function diasAtrasDe(agora, dias) {
  const data = new Date(agora);
  data.setUTCDate(data.getUTCDate() - dias);
  return data.toISOString().slice(0, 10);
}
function diasFrenteDe(agora, dias) {
  return diasAtrasDe(agora, -dias);
}

// ─── 1. sem dado nenhum → orienta o que cadastrar ──────────────────────────

test('sem nenhum lote, lote_pior_desempenho orienta a cadastrar um lote', () => {
  const resposta = responderPerguntaHerdon({}, 'lote_pior_desempenho', { agora: AGORA });
  assert.equal(resposta.dadosInsuficientes, true);
  assert.match(resposta.resposta, /cadastr/i);
});

test('lote existente mas sem nenhuma pesagem pede para cadastrar pesagem antes de comparar desempenho', () => {
  const db = { lotes: [{ id: 1, nome: 'Lote Novo', status: 'ativo' }] };
  const resposta = responderPerguntaHerdon(db, 'lote_pior_desempenho', { agora: AGORA });
  assert.equal(resposta.dadosInsuficientes, true);
  assert.match(resposta.resposta, /pesagens? suficientes|cadastre/i);
});

// ─── 2. lote com pior saúde é apontado corretamente ────────────────────────

function dbDoisLotes() {
  return {
    fazendas: [{ id: 1, nome: 'Fazenda Teste' }],
    lotes: [
      { id: 1, nome: 'Lote Saudável', status: 'ativo', faz_id: 1, gmd_meta: 1.0, peso_alvo: 500, preco_arroba: 270, qtd: 10 },
      { id: 2, nome: 'Lote Nelore Engorda', status: 'ativo', faz_id: 1, gmd_meta: 1.0, peso_alvo: 500, preco_arroba: 270, qtd: 10 },
    ],
    animais: [
      { id: 1, lote_id: 1, qtd: 10, p_ini: 300, p_at: 340, data_entrada: diasAtras(40) },
      { id: 2, lote_id: 2, qtd: 10, p_ini: 300, p_at: 320, data_entrada: diasAtras(40) },
    ],
    pesagens: [
      { id: 1, lote_id: 1, data: diasAtrasDe(AGORA, 20), peso_medio: 330 },
      { id: 2, lote_id: 1, data: diasAtrasDe(AGORA, 5), peso_medio: 340 },
      { id: 3, lote_id: 2, data: diasAtrasDe(AGORA, 20), peso_medio: 310 },
      { id: 4, lote_id: 2, data: diasAtrasDe(AGORA, 5), peso_medio: 320 },
    ],
    tarefas: [
      { id: 1, lote_id: 2, titulo: 'Revisar suplementação', status: 'pendente', prioridade: 'media', data_vencimento: diasAtrasDe(AGORA, 5) },
    ],
    sanitario: [],
    consumo_suplementacao: [],
    estoque: [],
    movimentacoes_financeiras: [{ id: 1, tipo: 'despesa', lote_id: 1, valor: 1000, data: diasAtrasDe(AGORA, 10) }],
    movimentacoes_animais: [],
  };
}

test('lote_pior_desempenho aponta o lote com GMD abaixo da meta e tarefa atrasada, citando a ação sugerida', () => {
  const resposta = responderPerguntaHerdon(dbDoisLotes(), 'lote_pior_desempenho', { agora: AGORA });
  assert.equal(resposta.dadosInsuficientes, false);
  assert.match(resposta.resposta, /Lote Nelore Engorda/);
  assert.match(resposta.resposta, /GMD abaixo da meta/);
  assert.match(resposta.resposta, /tarefa atrasada/);
  assert.match(resposta.resposta, /Ação sugerida:/);
  assert.ok(resposta.acoesSugeridas.length > 0);
});

test('lote_prioritario também aponta o lote com alerta crítico/alto pendente', () => {
  const resposta = responderPerguntaHerdon(dbDoisLotes(), 'lote_prioritario', { agora: AGORA });
  assert.equal(resposta.dadosInsuficientes, false);
  assert.match(resposta.resposta, /Lote Nelore Engorda/);
});

// ─── 3. produto do estoque prestes a acabar ────────────────────────────────

function dbEstoqueCritico() {
  return {
    estoque: [{ id: 1, produto: 'Sal mineral', quantidade_atual: 7, quantidade_minima: 20 }],
    movimentacoes_estoque: [
      { id: 1, item_estoque_id: 1, tipo: 'saida', quantidade: 10, data: diasAtrasDe(AGORA, 3) },
      { id: 2, item_estoque_id: 1, tipo: 'saida', quantidade: 10, data: diasAtrasDe(AGORA, 10) },
      { id: 3, item_estoque_id: 1, tipo: 'saida', quantidade: 10, data: diasAtrasDe(AGORA, 20) },
    ],
  };
}

test('produto_acabando identifica o produto certo e a severidade crítica', () => {
  const resposta = responderPerguntaHerdon(dbEstoqueCritico(), 'produto_acabando', { agora: AGORA });
  assert.equal(resposta.dadosInsuficientes, false);
  assert.match(resposta.resposta, /Sal mineral/);
  assert.equal(resposta.severidade, 'critico');
});

// ─── 4. sanidade próxima aponta o manejo certo ─────────────────────────────

function dbSanidadeProxima() {
  return {
    lotes: [{ id: 1, nome: 'Lote Recria', status: 'ativo' }],
    sanitario: [{ id: 1, lote_id: 1, tipo: 'Vacina Aftosa', proxima: diasFrenteDe(AGORA, 2) }],
  };
}

test('sanidade_pendente identifica o manejo e o lote corretos', () => {
  const resposta = responderPerguntaHerdon(dbSanidadeProxima(), 'sanidade_pendente', { agora: AGORA });
  assert.equal(resposta.dadosInsuficientes, false);
  assert.match(resposta.resposta, /Vacina Aftosa/);
  assert.match(resposta.resposta, /Lote Recria/);
});

// ─── 5. tarefa atrasada aparece em "atenção hoje" ──────────────────────────

test('atencao_hoje traz a tarefa atrasada com severidade coerente', () => {
  const db = {
    lotes: [{ id: 1, nome: 'Lote X', status: 'ativo' }],
    tarefas: [{ id: 1, lote_id: 1, titulo: 'Vacinar bezerros', status: 'pendente', prioridade: 'media', data_vencimento: diasAtrasDe(AGORA, 3) }],
  };
  const resposta = responderPerguntaHerdon(db, 'atencao_hoje', { agora: AGORA });
  assert.equal(resposta.dadosInsuficientes, false);
  assert.match(resposta.resposta, /Vacinar bezerros/);
  assert.equal(resposta.severidade, 'alto');
});

// ─── 6. custo em alta aparece na pergunta de custo ─────────────────────────

function dbCustoSubindo() {
  return {
    movimentacoes_financeiras: [
      { id: 1, tipo: 'despesa', categoria: 'Suplementação', valor: 3000, data: diasAtrasDe(AGORA, 5) },
      { id: 2, tipo: 'despesa', categoria: 'Combustível', valor: 500, data: diasAtrasDe(AGORA, 10) },
      { id: 3, tipo: 'despesa', categoria: 'Suplementação', valor: 1500, data: diasAtrasDe(AGORA, 35) },
      { id: 4, tipo: 'despesa', categoria: 'Combustível', valor: 500, data: diasAtrasDe(AGORA, 40) },
    ],
  };
}

test('custo_mais_pesado aponta a categoria que mais pesou quando o custo sobe', () => {
  const resposta = responderPerguntaHerdon(dbCustoSubindo(), 'custo_mais_pesado', { agora: AGORA });
  assert.equal(resposta.dadosInsuficientes, false);
  assert.match(resposta.resposta, /Suplementação/);
  assert.equal(resposta.severidade, 'critico');
});

test('custo_mais_pesado sem nenhuma despesa lançada orienta o cadastro', () => {
  const resposta = responderPerguntaHerdon({}, 'custo_mais_pesado', { agora: AGORA });
  assert.equal(resposta.dadosInsuficientes, true);
  assert.match(resposta.resposta, /cadastr/i);
});

// ─── 7. lote sem pesagem pede nova pesagem ─────────────────────────────────

test('proxima_pesagem indica o lote sem pesagem recente', () => {
  const db = { lotes: [{ id: 1, nome: 'Lote Recria Teste', status: 'ativo', qtd: 5 }], pesagens: [] };
  const resposta = responderPerguntaHerdon(db, 'proxima_pesagem', { agora: AGORA });
  assert.equal(resposta.dadosInsuficientes, false);
  assert.match(resposta.resposta, /Lote Recria Teste/);
  assert.match(resposta.resposta, /sem pesagem recente/);
});

// ─── 8. não inventar lucro sem preço/custo ─────────────────────────────────

test('vale_a_pena_lote nunca inventa lucro quando falta custo/preço de venda', () => {
  const db = { lotes: [{ id: 1, nome: 'Lote Sem Preço', status: 'ativo' }] };
  const resposta = responderPerguntaHerdon(db, 'vale_a_pena_lote', { agora: AGORA });
  assert.equal(resposta.dadosInsuficientes, true);
  assert.doesNotMatch(resposta.resposta, /lucro estimado de/i);
});

// ─── 9. links apontam para a página correta ────────────────────────────────

test('links de cada resposta apontam para páginas existentes e coerentes', () => {
  const produtoAcabando = responderPerguntaHerdon(dbEstoqueCritico(), 'produto_acabando', { agora: AGORA });
  assert.ok(produtoAcabando.links.some((l) => l.page === 'estoque'));

  const sanidade = responderPerguntaHerdon(dbSanidadeProxima(), 'sanidade_pendente', { agora: AGORA });
  assert.ok(sanidade.links.some((l) => l.page === 'sanitario'));

  const piorDesempenho = responderPerguntaHerdon(dbDoisLotes(), 'lote_pior_desempenho', { agora: AGORA });
  assert.ok(piorDesempenho.links.some((l) => l.page === 'relatorioLote'));

  const custo = responderPerguntaHerdon(dbCustoSubindo(), 'custo_mais_pesado', { agora: AGORA });
  assert.ok(custo.links.some((l) => l.page === 'financeiro'));
});

// ─── 10. severidade coerente com a pior severidade dos alertas ─────────────

test('severidade da resposta acompanha a severidade real do alerta mais urgente', () => {
  const dbCritico = {
    lotes: [{ id: 1, nome: 'Lote Y', status: 'ativo' }],
    tarefas: [{ id: 1, lote_id: 1, titulo: 'Tratar animal doente', status: 'pendente', prioridade: 'critica', data_vencimento: diasAtrasDe(AGORA, 1) }],
  };
  const resposta = responderPerguntaHerdon(dbCritico, 'atencao_hoje', { agora: AGORA });
  assert.equal(resposta.severidade, 'critico');

  const dbSemUrgencia = { lotes: [{ id: 1, nome: 'Lote Z', status: 'ativo' }] };
  const respostaOk = responderPerguntaHerdon(dbSemUrgencia, 'atencao_hoje', { agora: AGORA });
  assert.equal(respostaOk.severidade, 'baixo');
});

// ─── estrutura: lista de perguntas e prontidão de dados ────────────────────

test('listarPerguntasAssistente esconde perguntas de lote quando não há nenhum lote cadastrado', () => {
  const semLote = listarPerguntasAssistente({});
  assert.ok(!semLote.some((p) => p.id === 'lote_pior_desempenho'));
  assert.ok(semLote.some((p) => p.id === 'atencao_hoje'));

  const comLote = listarPerguntasAssistente({ lotes: [{ id: 1 }] });
  assert.ok(comLote.some((p) => p.id === 'lote_pior_desempenho'));
  assert.equal(comLote.length, 8);
});

test('avaliarProntidaoAssistente aponta o que falta cadastrar quando o banco está vazio', () => {
  const prontidao = avaliarProntidaoAssistente({});
  assert.equal(prontidao.pronto, false);
  assert.ok(prontidao.pendencias.every((p) => p.feito === false));

  const pronto = avaliarProntidaoAssistente({ fazendas: [{ id: 1 }], lotes: [{ id: 1 }] });
  assert.equal(pronto.pronto, true);
});

test('pergunta desconhecida não quebra e avisa que não foi reconhecida', () => {
  const resposta = responderPerguntaHerdon({}, 'pergunta_que_nao_existe', { agora: AGORA });
  assert.equal(resposta.dadosInsuficientes, true);
  assert.match(resposta.resposta, /não reconhecida/i);
});
