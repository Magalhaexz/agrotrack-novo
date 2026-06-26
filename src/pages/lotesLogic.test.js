import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGrupoAnimaisAutoPatch } from './lotesLogic.js';

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
