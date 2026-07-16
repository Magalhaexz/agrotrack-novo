import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararTrocaLotePasto, prepararRetirarLotePasto } from './acoesPasto.js';

const db = {
  lotes: [
    { id: 1, nome: 'Recria 2026', status: 'ativo', faz_id: 100, pastagem_id: 'pasto-a' },
    { id: 2, nome: 'Confinamento 01', status: 'vendido', faz_id: 100, pastagem_id: 'pasto-a' },
    { id: 3, nome: 'Sem Fazenda', status: 'ativo', faz_id: null, pastagem_id: null },
  ],
  pastagens: [
    { id: 'pasto-a', nome: 'Capim Sul', faz_id: 100 },
    { id: 'pasto-b', nome: 'Capim Norte', faz_id: 100 },
    { id: 'pasto-c', nome: 'Outra Fazenda', faz_id: 200 },
  ],
};

test('move lote para pasto diferente da mesma fazenda', () => {
  const r = prepararTrocaLotePasto(db, { lote: 'Recria', pasto: 'Capim Norte' });
  assert.equal(r.ok, true);
  const hist = r.writes.find((w) => w.tabela === 'lote_pastagens_historico');
  const upd = r.writes.find((w) => w.tabela === 'lotes');
  assert.equal(hist.registro.pastagem_origem_id, 'pasto-a');
  assert.equal(hist.registro.pastagem_destino_id, 'pasto-b');
  assert.equal(hist.registro.faz_id, 100);
  assert.equal(upd.patch.pastagem_id, 'pasto-b');
});

test('não altera a quantidade do lote (só o pasto)', () => {
  const r = prepararTrocaLotePasto(db, { lote: 'Recria', pasto: 'Capim Norte' });
  const upd = r.writes.find((w) => w.tabela === 'lotes');
  assert.equal('qtd' in upd.patch, false);
});

test('lote encerrado/vendido é bloqueado', () => {
  const r = prepararTrocaLotePasto(db, { lote: 'Confinamento', pasto: 'Capim Norte' });
  assert.equal(r.erro, 'LOTE_BLOQUEADO');
});

test('lote sem fazenda é bloqueado', () => {
  const r = prepararTrocaLotePasto(db, { lote: 'Sem Fazenda', pasto: 'Capim Norte' });
  assert.equal(r.erro, 'LOTE_SEM_FAZENDA');
});

test('pasto de outra fazenda é rejeitado', () => {
  const r = prepararTrocaLotePasto(db, { lote: 'Recria', pasto: 'Outra Fazenda' });
  assert.equal(r.erro, 'PASTO_OUTRA_FAZENDA');
});

test('mesmo pasto sem motivo é rejeitado; com motivo é aceito', () => {
  const semMotivo = prepararTrocaLotePasto(db, { lote: 'Recria', pasto: 'Capim Sul' });
  assert.equal(semMotivo.erro, 'MESMO_PASTO_SEM_MOTIVO');
  const comMotivo = prepararTrocaLotePasto(db, { lote: 'Recria', pasto: 'Capim Sul', motivo: 'Recontagem' });
  assert.equal(comMotivo.ok, true);
});

test('pasto não encontrado', () => {
  const r = prepararTrocaLotePasto(db, { lote: 'Recria', pasto: 'Pasto Inexistente' });
  assert.equal(r.erro, 'PASTO_NAO_ENCONTRADO');
});

test('quantidade de cabeças opcional, mas se informada deve ser positiva', () => {
  assert.equal(prepararTrocaLotePasto(db, { lote: 'Recria', pasto: 'Capim Norte', quantidade_cabecas: 0 }).erro, 'QUANTIDADE_INVALIDA');
  const ok = prepararTrocaLotePasto(db, { lote: 'Recria', pasto: 'Capim Norte', quantidade_cabecas: 15 });
  assert.equal(ok.writes[0].registro.quantidade_cabecas, 15);
});

// ── Retirar lote do pasto ────────────────────────────────────────────────────
test('retira lote do pasto sem vincular a um novo, nunca altera qtd', () => {
  const r = prepararRetirarLotePasto(db, { lote: 'Recria' });
  assert.equal(r.ok, true);
  const hist = r.writes.find((w) => w.tabela === 'lote_pastagens_historico');
  assert.equal(hist.registro.pastagem_origem_id, 'pasto-a');
  assert.equal(hist.registro.pastagem_destino_id, null);
  const upd = r.writes.find((w) => w.tabela === 'lotes');
  assert.equal(upd.patch.pastagem_id, null);
  assert.equal('qtd' in upd.patch, false);
});

test('retirar rejeita lote sem pasto, bloqueado ou inexistente', () => {
  const dbSemPasto = { ...db, lotes: [...db.lotes, { id: 4, nome: 'Sem Pasto', status: 'ativo', faz_id: 100, pastagem_id: null }] };
  assert.equal(prepararRetirarLotePasto(dbSemPasto, { lote: 'Sem Pasto' }).erro, 'LOTE_SEM_PASTO');
  assert.equal(prepararRetirarLotePasto(db, { lote: 'Confinamento' }).erro, 'LOTE_BLOQUEADO');
  assert.equal(prepararRetirarLotePasto(db, { lote: 'Inexistente' }).erro, 'LOTE_NAO_ENCONTRADO');
});
