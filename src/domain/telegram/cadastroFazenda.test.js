import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararCadastroFazenda, prepararRenomearFazenda } from './cadastroFazenda.js';

function db() {
  return {
    fazendas: [
      { id: 1, nome: 'Fazenda Um' },
      { id: 2, nome: 'Fazenda Dois' },
    ],
  };
}

test('cadastra fazenda mínima (só nome)', () => {
  const r = prepararCadastroFazenda(db(), { nome: 'Boa Esperança' });
  assert.equal(r.ok, true);
  assert.equal(r.writes[0].tabela, 'fazendas');
  assert.equal(r.writes[0].registro.nome, 'Boa Esperança');
  assert.equal(r.writes[0].registro.estado, 'MG');
});

test('cadastra fazenda com cidade e estado', () => {
  const r = prepararCadastroFazenda(db(), { nome: 'Boa Esperança', cidade: 'Uberlândia', estado: 'mg' });
  assert.equal(r.ok, true);
  assert.equal(r.writes[0].registro.cidade, 'Uberlândia');
  assert.equal(r.writes[0].registro.estado, 'MG');
});

test('rejeita nome vazio e nome duplicado', () => {
  assert.equal(prepararCadastroFazenda(db(), { nome: '  ' }).erro, 'NOME_VAZIO');
  assert.equal(prepararCadastroFazenda(db(), { nome: 'Fazenda Um' }).erro, 'NOME_DUPLICADO');
});

test('renomeia fazenda existente resolvida por nome parcial', () => {
  const r = prepararRenomearFazenda(db(), { fazendaAtual: 'Um', novoNome: 'Fazenda São João' });
  assert.equal(r.ok, true);
  assert.equal(r.writes[0].tabela, 'fazendas');
  assert.equal(r.writes[0].match.id, 1);
  assert.equal(r.writes[0].patch.nome, 'Fazenda São João');
});

test('renomear rejeita fazenda inexistente, nome vazio, igual e duplicado', () => {
  assert.equal(prepararRenomearFazenda(db(), { fazendaAtual: 'Inexistente', novoNome: 'X' }).erro, 'FAZENDA_NAO_ENCONTRADA');
  assert.equal(prepararRenomearFazenda(db(), { fazendaAtual: 'Um', novoNome: '' }).erro, 'NOME_VAZIO');
  assert.equal(prepararRenomearFazenda(db(), { fazendaAtual: 'Um', novoNome: 'Fazenda Um' }).erro, 'NOME_IGUAL');
  assert.equal(prepararRenomearFazenda(db(), { fazendaAtual: 'Um', novoNome: 'Fazenda Dois' }).erro, 'NOME_DUPLICADO');
});

test('renomear rejeita nome ambíguo (duas fazendas com trecho parecido)', () => {
  const dbAmbiguo = { fazendas: [{ id: 1, nome: 'Fazenda Norte A' }, { id: 2, nome: 'Fazenda Norte B' }] };
  const r = prepararRenomearFazenda(dbAmbiguo, { fazendaAtual: 'Norte', novoNome: 'X' });
  assert.equal(r.erro, 'FAZENDA_AMBIGUA');
  assert.equal(r.candidatos.length, 2);
});
