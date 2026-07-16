import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararCadastroPasto, prepararEdicaoPasto, prepararExclusaoPasto } from './cadastroPasto.js';

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

// ── Exclusão de pasto (Sprint Paridade 1, bloco 5) ──────────────────────────
test('exclui pasto sem lote ocupando', () => {
  const r = prepararExclusaoPasto(db(), { pasto: 'Norte' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.writes[0], { tabela: 'pastagens', tipo: 'delete', match: { id: 5 } });
});

test('recusa excluir pasto com lote ativo vinculado (guarda que o app não tem)', () => {
  const dbComLote = { ...db(), lotes: [{ id: 10, nome: 'Recria', status: 'ativo', pastagem_id: 5 }] };
  const r = prepararExclusaoPasto(dbComLote, { pasto: 'Norte' });
  assert.equal(r.erro, 'PASTO_OCUPADO');
  assert.equal(r.candidatos[0].id, 10);
});

test('permite excluir pasto cujo único lote vinculado já está encerrado', () => {
  const dbLoteEncerrado = { ...db(), lotes: [{ id: 10, nome: 'Recria', status: 'encerrado', pastagem_id: 5 }] };
  assert.equal(prepararExclusaoPasto(dbLoteEncerrado, { pasto: 'Norte' }).ok, true);
});

test('exclusão de pasto rejeita vazio, inexistente e ambíguo', () => {
  assert.equal(prepararExclusaoPasto(db(), { pasto: '' }).erro, 'PASTO_VAZIO');
  assert.equal(prepararExclusaoPasto(db(), { pasto: 'Inexistente' }).erro, 'PASTO_NAO_ENCONTRADO');
  const dbAmbiguo = { pastagens: [{ id: 1, nome: 'Pasto Norte A' }, { id: 2, nome: 'Pasto Norte B' }], lotes: [] };
  assert.equal(prepararExclusaoPasto(dbAmbiguo, { pasto: 'Norte' }).erro, 'PASTO_AMBIGUO');
});
