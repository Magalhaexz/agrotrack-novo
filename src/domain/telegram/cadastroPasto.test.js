import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararCadastroPasto, prepararEdicaoPasto } from './cadastroPasto.js';

function db() {
  return {
    fazendas: [{ id: 1, nome: 'Fazenda Um' }, { id: 2, nome: 'Fazenda Dois' }],
    pastagens: [{ id: 5, nome: 'Pasto Norte', faz_id: 1 }],
  };
}

test('cadastra pasto mínimo (só nome)', () => {
  const r = prepararCadastroPasto(db(), { nome: 'Pasto Sul' }, { fazendaId: 1 });
  assert.equal(r.ok, true);
  assert.equal(r.writes[0].tabela, 'pastagens');
  assert.equal(r.writes[0].registro.nome, 'Pasto Sul');
  assert.equal(r.writes[0].registro.faz_id, 1);
  assert.equal(r.writes[0].registro.area_ha, 0);
  assert.equal(r.writes[0].registro.status, 'ativo');
});

test('cadastra com área e capacidade', () => {
  const r = prepararCadastroPasto(db(), { nome: 'Pasto Sul', area: 18, capacidade: 40 }, { fazendaId: 1 });
  assert.equal(r.ok, true);
  assert.equal(r.writes[0].registro.area_ha, 18);
  assert.equal(r.writes[0].registro.capacidade_suporte_ua_ha, 40);
});

test('rejeita nome vazio', () => {
  assert.equal(prepararCadastroPasto(db(), { nome: '' }, { fazendaId: 1 }).erro, 'NOME_VAZIO');
});

test('rejeita nome duplicado na mesma fazenda, permite em outra', () => {
  assert.equal(prepararCadastroPasto(db(), { nome: 'Pasto Norte' }, { fazendaId: 1 }).erro, 'NOME_DUPLICADO');
  assert.equal(prepararCadastroPasto(db(), { nome: 'Pasto Norte' }, { fazendaId: 2 }).ok, true);
});

test('rejeita sem fazenda definida quando há mais de uma', () => {
  assert.equal(prepararCadastroPasto(db(), { nome: 'X' }, {}).erro, 'FAZENDA_NAO_DEFINIDA');
});

// ── Edição de pasto ──────────────────────────────────────────────────────────
test('edita área/capacidade/observação de um pasto existente', () => {
  const r = prepararEdicaoPasto(db(), { pasto: 'Norte', area: 25, capacidade: 3, obs: 'Reformado' });
  assert.equal(r.ok, true);
  assert.equal(r.writes[0].patch.area_ha, 25);
  assert.equal(r.writes[0].patch.capacidade_suporte_ua_ha, 3);
  assert.equal(r.writes[0].patch.observacoes, 'Reformado');
});

test('edição de pasto altera só o campo informado', () => {
  const r = prepararEdicaoPasto(db(), { pasto: 'Norte', area: 30 });
  assert.deepEqual(r.writes[0].patch, { area_ha: 30 });
});

test('edição de pasto rejeita nenhum campo, pasto vazio/inexistente', () => {
  assert.equal(prepararEdicaoPasto(db(), { pasto: 'Norte' }).erro, 'NENHUM_CAMPO_INFORMADO');
  assert.equal(prepararEdicaoPasto(db(), { pasto: '', area: 10 }).erro, 'PASTO_VAZIO');
  assert.equal(prepararEdicaoPasto(db(), { pasto: 'Inexistente', area: 10 }).erro, 'PASTO_NAO_ENCONTRADO');
});
