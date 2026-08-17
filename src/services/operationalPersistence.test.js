import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOperationalCreatePayload } from './operationalPersistence.js';

// Bug bash BB-01: id local (gerarNovoId, baseado numa lista em memória que
// começa vazia numa conta nova) colidia com a sequence real do banco,
// derrubando o INSERT com 23505 (duplicate key) sem nenhum feedback ao
// usuário. Toda tabela com tratamento especial já removia `id` do payload de
// criação — só o caminho padrão (usado por movimentacoes_financeiras e
// qualquer tabela sem branch dedicado) esquecia.
test('buildOperationalCreatePayload remove id gerado no cliente para tabelas sem tratamento especial', () => {
  const payload = buildOperationalCreatePayload('movimentacoes_financeiras', {
    id: 1,
    tipo: 'receita',
    valor: 5000,
  }, 'user-1');

  assert.equal('id' in payload, false);
  assert.equal(payload.owner_user_id, 'user-1');
  assert.equal(payload.valor, 5000);
});

test('buildOperationalCreatePayload remove id para qualquer tabela sem branch dedicado (custos, sanitario, etc.)', () => {
  for (const table of ['custos', 'sanitario', 'tarefas', 'suplementacao', 'rotinas']) {
    const payload = buildOperationalCreatePayload(table, { id: 42, nome: 'x' }, 'user-1');
    assert.equal('id' in payload, false, `tabela ${table} nao deveria manter id`);
  }
});

test('buildOperationalCreatePayload mantem o comportamento de upsert de configuracoes (id preservado quando informado)', () => {
  const payload = buildOperationalCreatePayload('configuracoes', { id: 7, geral: {} }, 'user-1');
  assert.equal(payload.id, 7);
});

// Bug P1 (auditoria 2026-08-13): peso_atual/peso_medio_atual eram descartados
// em silêncio pelo whitelist de `lotes` (só p_at sobrevivia), mesmo com
// PesagensPage.jsx e ImportacaoPage.jsx enviando os três juntos após cada
// pesagem — a coluna `lotes.peso_atual` nunca sincronizava no banco.
test('buildOperationalCreatePayload preserva p_at, peso_atual e peso_medio_atual para lotes', () => {
  const payload = buildOperationalCreatePayload('lotes', {
    id: 60,
    nome: 'Lote Teste',
    faz_id: 699,
    p_at: 215,
    peso_atual: 215,
    peso_medio_atual: 215,
  }, 'user-1');

  assert.equal(payload.p_at, 215);
  assert.equal(payload.peso_atual, 215, 'peso_atual precisa sobreviver ao whitelist de lotes');
  assert.equal(payload.peso_medio_atual, 215, 'peso_medio_atual precisa sobreviver ao whitelist de lotes');
});
