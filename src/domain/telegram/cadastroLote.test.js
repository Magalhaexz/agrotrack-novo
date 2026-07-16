import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararCadastroLote } from './cadastroLote.js';

function db() {
  return {
    fazendas: [{ id: 1, nome: 'Fazenda Um' }, { id: 2, nome: 'Fazenda Dois' }],
    lotes: [{ id: 1, nome: 'Recria', faz_id: 1, status: 'ativo' }],
    pastagens: [
      { id: 5, nome: 'Pasto Norte', faz_id: 1 },
      { id: 6, nome: 'Pasto Sul', faz_id: 2 },
    ],
  };
}

test('cadastra lote mínimo (nome, quantidade e sexo)', () => {
  const r = prepararCadastroLote(db(), { nome: 'Engorda 02', quantidade: 30, sexo: 'machos' }, { fazendaId: 1 });
  assert.equal(r.ok, true);
  assert.equal(r.writes[0].tabela, 'lotes');
  assert.equal(r.writes[0].registro.nome, 'Engorda 02');
  assert.equal(r.writes[0].registro.faz_id, 1);
  assert.equal(r.writes[0].registro.qtd, 30);
  assert.equal(r.writes[0].registro.sexo, 'macho');
  assert.equal(r.writes[0].registro.pastagem_id, null);
});

test('resolve pasto quando informado, na mesma fazenda', () => {
  const r = prepararCadastroLote(db(), { nome: 'Novo', quantidade: 10, sexo: 'femeas', peso: 380, pasto: 'Norte' }, { fazendaId: 1 });
  assert.equal(r.ok, true);
  assert.equal(r.writes[0].registro.pastagem_id, 5);
  assert.equal(r.writes[0].registro.sistema, 'pasto');
  assert.equal(r.writes[0].registro.p_ini, 380);
});

test('rejeita pasto de outra fazenda', () => {
  const r = prepararCadastroLote(db(), { nome: 'Novo', quantidade: 10, sexo: 'misto', pasto: 'Sul' }, { fazendaId: 1 });
  assert.equal(r.erro, 'PASTO_OUTRA_FAZENDA');
});

test('rejeita pasto inexistente', () => {
  const r = prepararCadastroLote(db(), { nome: 'Novo', quantidade: 10, sexo: 'misto', pasto: 'Inexistente' }, { fazendaId: 1 });
  assert.equal(r.erro, 'PASTO_NAO_ENCONTRADO');
});

test('rejeita nome vazio, quantidade inválida e sexo inválido', () => {
  assert.equal(prepararCadastroLote(db(), { nome: '  ', quantidade: 10, sexo: 'macho' }, { fazendaId: 1 }).erro, 'NOME_VAZIO');
  assert.equal(prepararCadastroLote(db(), { nome: 'X', quantidade: 0, sexo: 'macho' }, { fazendaId: 1 }).erro, 'QUANTIDADE_INVALIDA');
  assert.equal(prepararCadastroLote(db(), { nome: 'X', quantidade: 10, sexo: 'invalido' }, { fazendaId: 1 }).erro, 'SEXO_INVALIDO');
});

test('rejeita nome duplicado de lote ativo na mesma fazenda', () => {
  const r = prepararCadastroLote(db(), { nome: 'Recria', quantidade: 10, sexo: 'macho' }, { fazendaId: 1 });
  assert.equal(r.erro, 'NOME_DUPLICADO');
});

test('permite nome duplicado em outra fazenda', () => {
  const r = prepararCadastroLote(db(), { nome: 'Recria', quantidade: 10, sexo: 'macho' }, { fazendaId: 2 });
  assert.equal(r.ok, true);
});

test('resolve fazenda única automaticamente quando ctx.fazendaId não é informado', () => {
  const dbUmaFazenda = { fazendas: [{ id: 9, nome: 'Única' }], lotes: [], pastagens: [] };
  const r = prepararCadastroLote(dbUmaFazenda, { nome: 'X', quantidade: 5, sexo: 'macho' }, {});
  assert.equal(r.ok, true);
  assert.equal(r.writes[0].registro.faz_id, 9);
});

test('rejeita quando não há fazenda definida e a conta tem mais de uma', () => {
  const r = prepararCadastroLote(db(), { nome: 'X', quantidade: 5, sexo: 'macho' }, {});
  assert.equal(r.erro, 'FAZENDA_NAO_DEFINIDA');
});
