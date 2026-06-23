import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  construirHojeNaFazenda,
  construirResumoPastos,
  listarContasFinanceiras,
  listarEstoqueBaixo,
  listarLotesComGmdAbaixoDaMeta,
  listarLotesPorStatusDecisaoVenda,
  listarLotesSemPasto,
  listarLotesSemPesagemRecente,
} from './hojeNaFazenda.js';

function diasAtras(dias) {
  const data = new Date();
  data.setDate(data.getDate() - dias);
  return data.toISOString().slice(0, 10);
}

// ─── conta vazia ────────────────────────────────────────────────────────────

test('construirHojeNaFazenda em conta vazia não tem prioridades e não quebra', () => {
  const resultado = construirHojeNaFazenda({}, { alerts: [] });
  assert.deepEqual(resultado.prioridades, []);
  assert.equal(resultado.pastos.totalPastos, 0);
  assert.equal(resultado.pastos.pastosComLote, 0);
  assert.equal(resultado.pastos.pastosSemLote, 0);
  assert.equal(resultado.pastos.lotesSemPasto, 0);
});

// ─── conta com fazenda, pastos e lotes (tudo em dia) ───────────────────────

test('construirHojeNaFazenda com operação saudável não gera prioridades', () => {
  const db = {
    fazendas: [{ id: 1, nome: 'Fazenda A' }],
    pastagens: [{ id: 'p1', faz_id: 1, nome: 'Pasto 1', area_ha: 50, capacidade_suporte_ua_ha: 2 }],
    lotes: [{ id: 10, faz_id: 1, status: 'ativo', pastagem_id: 'p1', ultima_pesagem: diasAtras(5), qtd: 20 }],
  };
  const resultado = construirHojeNaFazenda(db, { alerts: [] });
  assert.deepEqual(resultado.prioridades, []);
  assert.equal(resultado.pastos.totalPastos, 1);
  assert.equal(resultado.pastos.pastosComLote, 1);
  assert.equal(resultado.pastos.pastosSemLote, 0);
  assert.equal(resultado.pastos.lotesSemPasto, 0);
});

// ─── lotes sem pesagem recente ──────────────────────────────────────────────

test('listarLotesSemPesagemRecente inclui lote nunca pesado e lote pesado há mais de 30 dias', () => {
  const db = {
    lotes: [
      { id: 1, status: 'ativo', ultima_pesagem: null },
      { id: 2, status: 'ativo', ultima_pesagem: diasAtras(45) },
      { id: 3, status: 'ativo', ultima_pesagem: diasAtras(5) },
    ],
  };
  const resultado = listarLotesSemPesagemRecente(db);
  assert.deepEqual(resultado.map((l) => l.id).sort(), [1, 2]);
});

test('listarLotesSemPesagemRecente ignora lotes inativos', () => {
  const db = {
    lotes: [{ id: 1, status: 'encerrado', ultima_pesagem: null }],
  };
  assert.deepEqual(listarLotesSemPesagemRecente(db), []);
});

test('construirHojeNaFazenda gera prioridade no plural para lotes sem pesagem', () => {
  const db = {
    lotes: [
      { id: 1, status: 'ativo', ultima_pesagem: null },
      { id: 2, status: 'ativo', ultima_pesagem: null },
    ],
  };
  const resultado = construirHojeNaFazenda(db, { alerts: [] });
  const item = resultado.prioridades.find((p) => p.id === 'lotes-sem-pesagem');
  assert.equal(item.texto, '2 lotes precisam de pesagem');
  assert.equal(item.rota, 'pesagens');
});

test('construirHojeNaFazenda usa singular para 1 lote sem pesagem', () => {
  const db = { lotes: [{ id: 1, status: 'ativo', ultima_pesagem: null }] };
  const resultado = construirHojeNaFazenda(db, { alerts: [] });
  const item = resultado.prioridades.find((p) => p.id === 'lotes-sem-pesagem');
  assert.equal(item.texto, '1 lote precisa de pesagem');
});

// ─── lotes sem pasto ────────────────────────────────────────────────────────

test('listarLotesSemPasto inclui apenas lotes ativos sem pastagem_id', () => {
  const db = {
    lotes: [
      { id: 1, status: 'ativo', pastagem_id: null },
      { id: 2, status: 'ativo', pastagem_id: 'p1' },
      { id: 3, status: 'encerrado', pastagem_id: null },
    ],
  };
  assert.deepEqual(listarLotesSemPasto(db).map((l) => l.id), [1]);
});

// ─── GMD abaixo da meta ─────────────────────────────────────────────────────

test('listarLotesComGmdAbaixoDaMeta ignora lote sem gmd_meta configurado', () => {
  const db = {
    lotes: [{ id: 1, status: 'ativo', gmd_meta: 0 }],
    animais: [{ id: 1, lote_id: 1, qtd: 10, p_ini: 300, p_at: 320, status: 'ativo' }],
  };
  assert.deepEqual(listarLotesComGmdAbaixoDaMeta(db), []);
});

test('listarLotesComGmdAbaixoDaMeta ignora lote sem nenhum animal (sem dado de GMD real)', () => {
  const db = {
    lotes: [{ id: 1, status: 'ativo', gmd_meta: 1.2, entrada: '2020-01-01' }],
    animais: [],
  };
  assert.deepEqual(listarLotesComGmdAbaixoDaMeta(db), []);
});

test('listarLotesComGmdAbaixoDaMeta inclui lote com GMD real abaixo da meta', () => {
  const db = {
    lotes: [{ id: 1, status: 'ativo', gmd_meta: 1.2, entrada: '2020-01-01' }],
    animais: [{ id: 1, lote_id: 1, qtd: 10, p_ini: 300, p_at: 310, dias: 9999, status: 'ativo' }],
  };
  const resultado = listarLotesComGmdAbaixoDaMeta(db);
  assert.deepEqual(resultado.map((l) => l.id), [1]);
});

// ─── contas vencidas / próximas ─────────────────────────────────────────────

test('listarContasFinanceiras separa contas vencidas de contas próximas do vencimento', () => {
  const db = {
    movimentacoes_financeiras: [
      { id: 1, tipo: 'despesa', status: 'previsto', data_vencimento: diasAtras(2) }, // vencida
      { id: 2, tipo: 'despesa', status: 'previsto', data_vencimento: diasAtras(-2) }, // vence em 2 dias
      { id: 3, tipo: 'despesa', status: 'pago', data_vencimento: diasAtras(5) }, // já paga, ignorada
      { id: 4, tipo: 'receita', status: 'previsto', data_vencimento: diasAtras(1) }, // receita, ignorada
      { id: 5, tipo: 'despesa', status: 'cancelado', data_vencimento: diasAtras(1) }, // cancelada, ignorada
    ],
  };
  const { vencidas, proximas } = listarContasFinanceiras(db);
  assert.deepEqual(vencidas.map((m) => m.id), [1]);
  assert.deepEqual(proximas.map((m) => m.id), [2]);
});

test('construirHojeNaFazenda usa singular para 1 conta vencida', () => {
  const db = {
    movimentacoes_financeiras: [{ id: 1, tipo: 'despesa', status: 'previsto', data_vencimento: diasAtras(1) }],
  };
  const resultado = construirHojeNaFazenda(db, { alerts: [] });
  const item = resultado.prioridades.find((p) => p.id === 'contas-vencidas');
  assert.equal(item.texto, '1 conta está vencida');
  assert.equal(item.tom, 'critico');
});

// ─── estoque baixo ──────────────────────────────────────────────────────────

test('listarEstoqueBaixo inclui apenas itens com quantidade no mínimo ou abaixo', () => {
  const db = {
    estoque: [
      { id: 1, quantidade_atual: 5, quantidade_minima: 10 },
      { id: 2, quantidade_atual: 50, quantidade_minima: 10 },
      { id: 3, quantidade_atual: 0, quantidade_minima: 0 },
    ],
  };
  assert.deepEqual(listarEstoqueBaixo(db).map((i) => i.id), [1]);
});

// ─── alertas críticos ───────────────────────────────────────────────────────

test('construirHojeNaFazenda conta alertas críticos não cobertos por pesagem/financeiro/estoque', () => {
  const alerts = [
    { tipo: 'sanitario', nivel: 'critical' },
    { tipo: 'rotina', nivel: 'critical' },
    { tipo: 'pesagem', nivel: 'critical' }, // já coberto por "lotes sem pesagem"
    { tipo: 'estoque', nivel: 'warning' }, // não é crítico
  ];
  const resultado = construirHojeNaFazenda({}, { alerts });
  const item = resultado.prioridades.find((p) => p.id === 'alertas-criticos');
  assert.equal(item.texto, '2 alertas exigem atenção');
  assert.equal(resultado.detalhes.alertasCriticosTotal.length, 3);
});

// ─── pastos em uso ──────────────────────────────────────────────────────────

test('construirResumoPastos separa pastos com lote, sem lote e indica excesso de cabeças', () => {
  const db = {
    pastagens: [
      { id: 'p1', faz_id: 1, nome: 'Pasto 1', area_ha: 10, capacidade_suporte_ua_ha: 1 }, // capacidade 10
      { id: 'p2', faz_id: 1, nome: 'Pasto 2', area_ha: 5, capacidade_suporte_ua_ha: 1 },
    ],
    lotes: [
      { id: 1, status: 'ativo', pastagem_id: 'p1', qtd: 50 }, // 50 cabeças > capacidade 10
      { id: 2, status: 'ativo', pastagem_id: null },
    ],
  };
  const resumo = construirResumoPastos(db);
  assert.equal(resumo.totalPastos, 2);
  assert.equal(resumo.pastosComLote, 1);
  assert.equal(resumo.pastosSemLote, 1);
  assert.equal(resumo.lotesSemPasto, 1);
  assert.deepEqual(resumo.pastosComIndicioDeExcesso.map((p) => p.id), ['p1']);
});

test('construirResumoPastos não aponta excesso quando capacidade não está cadastrada', () => {
  const db = {
    pastagens: [{ id: 'p1', faz_id: 1, nome: 'Pasto 1', area_ha: 0, capacidade_suporte_ua_ha: 0 }],
    lotes: [{ id: 1, status: 'ativo', pastagem_id: 'p1', qtd: 999 }],
  };
  const resumo = construirResumoPastos(db);
  assert.deepEqual(resumo.pastosComIndicioDeExcesso, []);
});

// ─── ocupação de pastos (Sprint 25) ─────────────────────────────────────────

test('construirResumoPastos expõe pastosEmAtencao e pastosAcimaCapacidade via calcularOcupacaoPastos', () => {
  const db = {
    pastagens: [{ id: 'p1', faz_id: 1, nome: 'Pasto 1', area_ha: 10, capacidade_suporte_ua_ha: 1 }],
    lotes: [{ id: 1, status: 'ativo', pastagem_id: 'p1', qtd: 50 }],
    animais: [{ id: 100, lote_id: 1, qtd: 50, p_at: 450 }],
  };
  const resumo = construirResumoPastos(db);
  assert.deepEqual(resumo.pastosAcimaCapacidade.map((p) => p.id), ['p1']);
  assert.deepEqual(resumo.pastosEmAtencao, []);
});

test('construirHojeNaFazenda gera prioridade crítica para pasto acima da capacidade', () => {
  const db = {
    pastagens: [{ id: 'p1', faz_id: 1, nome: 'Pasto 1', area_ha: 10, capacidade_suporte_ua_ha: 1 }],
    lotes: [{ id: 1, status: 'ativo', pastagem_id: 'p1', qtd: 50 }],
    animais: [{ id: 100, lote_id: 1, qtd: 50, p_at: 450 }],
  };
  const resultado = construirHojeNaFazenda(db, { alerts: [] });
  const item = resultado.prioridades.find((p) => p.id === 'pastos-acima-capacidade');
  assert.ok(item);
  assert.equal(item.tom, 'critico');
  assert.equal(item.texto, '1 pasto está acima da capacidade');
});

test('construirHojeNaFazenda gera prioridade de atenção para pasto em 80-100% da capacidade', () => {
  const db = {
    pastagens: [{ id: 'p1', faz_id: 1, nome: 'Pasto 1', area_ha: 10, capacidade_suporte_ua_ha: 1 }],
    lotes: [{ id: 1, status: 'ativo', pastagem_id: 'p1', qtd: 10 }],
    animais: [{ id: 100, lote_id: 1, qtd: 10, p_at: 405 }],
  };
  const resultado = construirHojeNaFazenda(db, { alerts: [] });
  const item = resultado.prioridades.find((p) => p.id === 'pastos-em-atencao');
  assert.ok(item);
  assert.equal(item.tom, 'atencao');
});

test('construirHojeNaFazenda não quebra com pastagens/lotes/animais nulos', () => {
  const resultado = construirHojeNaFazenda({ pastagens: null, lotes: null, animais: null }, { alerts: [] });
  assert.deepEqual(resultado.prioridades, []);
  assert.equal(resultado.pastos.totalPastos, 0);
});

// ─── decisão de venda (Sprint 32) ───────────────────────────────────────────

test('listarLotesPorStatusDecisaoVenda classifica lote pronto para avaliar venda', () => {
  const db = {
    lotes: [{ id: 1, status: 'ativo', preco_arroba: 270, gmd_meta: 1 }],
    animais: [{ id: 1, lote_id: 1, qtd: 10, p_ini: 300, p_at: 480, data_entrada: diasAtras(45), status: 'ativo' }],
    movimentacoes_financeiras: [
      { id: 1, tipo: 'despesa', categoria: 'compra_animal', lote_id: 1, valor: 10000 },
      { id: 2, tipo: 'receita', categoria: 'venda_animal', lote_id: 1, valor: 40000 },
    ],
  };
  const resultado = listarLotesPorStatusDecisaoVenda(db);
  assert.deepEqual(resultado.prontosParaAvaliar.map((item) => item.lote.id), [1]);
  assert.deepEqual(resultado.custoAlto, []);
});

test('listarLotesPorStatusDecisaoVenda classifica lote com custo alto por arroba', () => {
  const db = {
    lotes: [{ id: 1, status: 'ativo', preco_arroba: 270 }],
    animais: [{ id: 1, lote_id: 1, qtd: 10, p_ini: 300, p_at: 480, data_entrada: diasAtras(45), status: 'ativo' }],
    movimentacoes_financeiras: [
      { id: 1, tipo: 'despesa', categoria: 'compra_animal', lote_id: 1, valor: 40000 },
    ],
  };
  const resultado = listarLotesPorStatusDecisaoVenda(db);
  assert.deepEqual(resultado.custoAlto.map((item) => item.lote.id), [1]);
  assert.deepEqual(resultado.prontosParaAvaliar, []);
});

test('construirHojeNaFazenda gera prioridade de avaliação de venda quando há lote pronto', () => {
  const db = {
    lotes: [{ id: 1, status: 'ativo', preco_arroba: 270, gmd_meta: 1 }],
    animais: [{ id: 1, lote_id: 1, qtd: 10, p_ini: 300, p_at: 480, data_entrada: diasAtras(45), status: 'ativo' }],
    movimentacoes_financeiras: [
      { id: 1, tipo: 'despesa', categoria: 'compra_animal', lote_id: 1, valor: 10000 },
      { id: 2, tipo: 'receita', categoria: 'venda_animal', lote_id: 1, valor: 40000 },
    ],
  };
  const resultado = construirHojeNaFazenda(db, { alerts: [] });
  const item = resultado.prioridades.find((p) => p.id === 'lotes-prontos-venda');
  assert.equal(item.texto, '1 lote precisa de avaliação de venda');
  assert.equal(item.rota, 'resultados');
});
