import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGrupoAnimaisAutoPatch, buildPesagemInicialPatch } from './lotesLogic.js';

// Sprint 37.1: editar um lote (ex.: cabeças) não atualizava o grupo
// correspondente em `animais` criado automaticamente no cadastro (Sprint 35),
// deixando UA/Resultado/Decisão de Venda desatualizados (eles leem `animais`,
// nunca `lotes.qtd`). buildGrupoAnimaisAutoPatch é reusado tanto na criação
// quanto na sincronização pós-edição em LotesPage.jsx.

test('buildGrupoAnimaisAutoPatch reflete qtd atualizada do lote editado', () => {
  const loteEditado = {
    id: 21,
    nome: 'QA371 Lote Teste',
    faz_id: 641,
    qtd: 12,
    p_ini: 300,
    p_at: 320,
    entrada: '2026-06-25',
  };

  const patch = buildGrupoAnimaisAutoPatch(loteEditado);

  assert.equal(patch.qtd, 12);
  assert.equal(patch.p_ini, 300);
  assert.equal(patch.p_at, 320);
  assert.equal(patch.lote_id, 21);
  assert.equal(patch.nome, 'QA371 Lote Teste');
});

test('buildGrupoAnimaisAutoPatch retorna null quando qtd cai a zero', () => {
  const loteSemCabecas = { id: 21, nome: 'QA371 Lote Teste', faz_id: 641, qtd: 0, p_ini: 300 };
  assert.equal(buildGrupoAnimaisAutoPatch(loteSemCabecas), null);
});

test('buildGrupoAnimaisAutoPatch usa p_ini como p_at quando peso atual não informado', () => {
  const lote = { id: 21, nome: 'Lote X', faz_id: 1, qtd: 5, p_ini: 280 };
  const patch = buildGrupoAnimaisAutoPatch(lote);
  assert.equal(patch.p_at, 280);
});

// Bug 3.2 — a primeira pesagem do histórico deve corresponder ao peso médio
// de entrada informado no cadastro do lote.
test('buildPesagemInicialPatch usa peso de entrada e data de entrada do lote', () => {
  const lote = { id: 21, entrada: '2026-06-25', p_ini: 405 };
  const patch = buildPesagemInicialPatch(lote);
  assert.equal(patch.lote_id, 21);
  assert.equal(patch.peso_medio, 405);
  assert.equal(patch.data, '2026-06-25');
  assert.equal(patch.tipo, 'lote');
});

test('buildPesagemInicialPatch retorna null sem peso de entrada informado', () => {
  assert.equal(buildPesagemInicialPatch({ id: 21, entrada: '2026-06-25', p_ini: 0 }), null);
  assert.equal(buildPesagemInicialPatch({ id: 21, entrada: '2026-06-25' }), null);
});

test('buildPesagemInicialPatch cai para a data de hoje quando o lote não tem entrada', () => {
  const patch = buildPesagemInicialPatch({ id: 21, p_ini: 300 });
  assert.equal(patch.data, new Date().toISOString().slice(0, 10));
});
