import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarResumoRelatorioLote } from './relatorioLote.js';
import { gerarResumoLoteTexto } from './whatsappResumo.js';
import { hojeLocalISO } from './dataCivil.js';

// GMD/peso alvo dependem de getResumoLote/calcLote (data REAL do sistema) —
// mesmo padrão de saudeLote.test.js/alertasInteligentes.test.js.
function diasAtras(dias) {
  return hojeLocalISO(new Date(Date.now() - dias * 864e5));
}

const AGORA = new Date('2026-07-02T12:00:00Z');
function diasAtrasDe(agora, dias) {
  const data = new Date(agora);
  data.setUTCDate(data.getUTCDate() - dias);
  return data.toISOString().slice(0, 10);
}

function dbCompleto() {
  return {
    lotes: [{ id: 1, nome: 'Lote Nelore', status: 'ativo', faz_id: 1, gmd_meta: 1.0, peso_alvo: 400, preco_arroba: 270, qtd: 10 }],
    fazendas: [{ id: 1, nome: 'Fazenda Teste' }],
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

// ─── 1. Lote com dados completos ───────────────────────────────────────────

test('lote com dados completos gera relatório sem "dados insuficientes" e com saúde/alertas/decisões', () => {
  const resultado = gerarResumoRelatorioLote(dbCompleto(), 1, { agora: AGORA });
  assert.equal(resultado.encontrado, true);
  assert.equal(resultado.dadosInsuficientes, false);
  assert.equal(resultado.lote?.nome, 'Lote Nelore');
  assert.equal(resultado.fazenda, 'Fazenda Teste');
  assert.equal(resultado.cabecas, 10);
  assert.ok(resultado.custoTotal > 0);
  assert.ok(resultado.saudeLote && !resultado.saudeLote.dadosInsuficientes);
  assert.ok(typeof resultado.saudeLote.score === 'number');
  assert.ok(Array.isArray(resultado.alertas));
  assert.ok(Array.isArray(resultado.decisoes));
});

// ─── 2. Lote sem pesagens suficientes ───────────────────────────────────────

test('lote com poucas pesagens (menos de 2) fica com gmdStatus "sem_dados" sem travar o resto do relatório', () => {
  const db = dbCompleto();
  db.pesagens = [{ id: 1, lote_id: 1, data: diasAtrasDe(AGORA, 5), peso_medio: 340 }];
  const resultado = gerarResumoRelatorioLote(db, 1, { agora: AGORA });
  assert.equal(resultado.dadosInsuficientes, false);
  assert.equal(resultado.gmdStatus, 'sem_dados');
});

test('lote totalmente vazio (sem animais, pesagens ou custo) mostra dados insuficientes e não quebra', () => {
  const db = { lotes: [{ id: 1, nome: 'Lote Vazio', status: 'ativo' }] };
  const resultado = gerarResumoRelatorioLote(db, 1, { agora: AGORA });
  assert.equal(resultado.encontrado, true);
  assert.equal(resultado.dadosInsuficientes, true);
  assert.ok(resultado.mensagemDadosInsuficientes);
  assert.equal(resultado.receitaPrevista, null);
  assert.equal(resultado.lucroEstimado, null);
});

// ─── 3. Lote sem custos ─────────────────────────────────────────────────────

test('lote sem nenhum custo lançado mostra "custo ainda não informado" e não inventa valores', () => {
  const db = dbCompleto();
  db.movimentacoes_financeiras = [];
  const resultado = gerarResumoRelatorioLote(db, 1, { agora: AGORA });
  assert.equal(resultado.custoIndisponivel, true);
  assert.equal(resultado.custoTotal, null);
  assert.equal(resultado.custoPorCabeca, null);
  assert.equal(resultado.custoPorArroba, null);
  // Sem custo, a decisão de venda também fica sem base — não inventa lucro:
  assert.equal(resultado.dadosInsuficientes, true);
  assert.equal(resultado.receitaPrevista, null);
  assert.equal(resultado.lucroEstimado, null);
});

// ─── 4. Lote com GMD abaixo da meta ─────────────────────────────────────────

test('lote com GMD abaixo da meta aparece como "abaixo", com alerta e decisão correspondentes', () => {
  const db = dbCompleto();
  db.animais = [{ id: 1, lote_id: 1, qtd: 10, p_ini: 300, p_at: 328, data_entrada: diasAtras(40) }]; // 0.7 kg/dia vs meta 1.0
  const resultado = gerarResumoRelatorioLote(db, 1, { agora: AGORA });
  assert.equal(resultado.gmdStatus, 'abaixo');
  assert.ok(resultado.gmdDiferenca < 0);
  assert.ok(resultado.alertas.some((a) => a.chave === 'gmd'));
  assert.ok(resultado.decisoes.some((d) => /pesagem/i.test(d) || /suplementação/i.test(d)));
});

// ─── 5. Lote com saúde em risco ─────────────────────────────────────────────

test('lote com múltiplos problemas cai na faixa de risco/crítico', () => {
  const db = dbCompleto();
  db.animais = [{ id: 1, lote_id: 1, qtd: 10, p_ini: 300, p_at: 328, data_entrada: diasAtras(40) }]; // GMD abaixo
  db.pesagens = [
    { id: 1, lote_id: 1, data: diasAtrasDe(AGORA, 90), peso_medio: 320 },
    { id: 2, lote_id: 1, data: diasAtrasDe(AGORA, 50), peso_medio: 328 }, // sem pesagem recente
  ];
  db.sanitario = [{ id: 1, lote_id: 1, tipo: 'Vacina', proxima: diasAtrasDe(AGORA, 5) }]; // sanidade vencida
  const resultado = gerarResumoRelatorioLote(db, 1, { agora: AGORA });
  assert.ok(['risco', 'critico'].includes(resultado.saudeLote.classificacao), `esperado risco/crítico, recebido ${resultado.saudeLote.classificacao}`);
  assert.ok(resultado.alertas.length >= 2);
});

// ─── 6. Texto de WhatsApp usa os novos dados ────────────────────────────────

test('gerarResumoLoteTexto inclui saúde do lote e alerta/ação quando o relatório enriquecido é usado', () => {
  const db = dbCompleto();
  db.animais = [{ id: 1, lote_id: 1, qtd: 10, p_ini: 300, p_at: 328, data_entrada: diasAtras(40) }];
  const resultado = gerarResumoRelatorioLote(db, 1, { agora: AGORA });
  const texto = gerarResumoLoteTexto(resultado);

  assert.match(texto, /Saúde do lote: \d+\/100/);
  assert.match(texto, /Alerta: Lote abaixo da meta de GMD\./);
  assert.match(texto, /Ação sugerida: /);
});

// ─── 7. Dados insuficientes não quebra o texto de WhatsApp ─────────────────

test('gerarResumoLoteTexto não quebra e não mostra saúde/alerta quando os dados são insuficientes', () => {
  const db = { lotes: [{ id: 1, nome: 'Lote Vazio', status: 'ativo' }] };
  const resultado = gerarResumoRelatorioLote(db, 1, { agora: AGORA });
  const texto = gerarResumoLoteTexto(resultado);
  assert.match(texto, /Lote Vazio/);
  assert.doesNotMatch(texto, /Saúde do lote/);
  assert.doesNotMatch(texto, /Alerta:/);
});

test('gerarResumoLoteTexto trata lote genuinamente inexistente sem quebrar', () => {
  const resultado = gerarResumoRelatorioLote({ lotes: [] }, 999, { agora: AGORA });
  const texto = gerarResumoLoteTexto(resultado);
  assert.match(texto, /não encontrado/);
});

test('gerarResumoRelatorioLote trata lote inexistente sem quebrar', () => {
  const resultado = gerarResumoRelatorioLote({ lotes: [] }, 999, { agora: AGORA });
  assert.equal(resultado.encontrado, false);
  assert.equal(resultado.dadosInsuficientes, true);
  assert.deepEqual(resultado.alertas, []);
  assert.deepEqual(resultado.decisoes, []);
});

// ─── 8. Não inventa lucro sem preço/receita ─────────────────────────────────

test('sem custo/decisão de venda calculável, receita prevista e lucro estimado ficam null (nunca 0 ou NaN)', () => {
  const db = dbCompleto();
  db.movimentacoes_financeiras = [];
  const resultado = gerarResumoRelatorioLote(db, 1, { agora: AGORA });
  assert.equal(resultado.receitaPrevista, null);
  assert.equal(resultado.lucroEstimado, null);
  assert.equal(resultado.receitaIndisponivel, true);
});

test('com dados completos, receita prevista/lucro estimado vêm da simulação de venda já existente (sem duplicar cálculo)', () => {
  const resultado = gerarResumoRelatorioLote(dbCompleto(), 1, { agora: AGORA });
  assert.equal(typeof resultado.receitaPrevista, 'number');
  assert.equal(typeof resultado.lucroEstimado, 'number');
  assert.equal(resultado.receitaPrevista, resultado.relatorio.simulacaoVenda.vendaHoje.receita);
  assert.equal(resultado.lucroEstimado, resultado.relatorio.simulacaoVenda.vendaHoje.lucro);
});
