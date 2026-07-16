import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararCadastroFazenda, prepararRenomearFazenda, prepararExclusaoFazenda } from './cadastroFazenda.js';

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

// ── Exclusão de fazenda (Sprint Paridade 1, bloco 5) ────────────────────────
test('exclui fazenda sem vínculos', () => {
  const r = prepararExclusaoFazenda(db(), { fazenda: 'Dois' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.writes[0], { tabela: 'fazendas', tipo: 'delete', match: { id: 2 } });
});

test('recusa excluir fazenda com lotes, animais, financeiro, estoque ou sanitário vinculados', () => {
  const base = db();
  assert.equal(prepararExclusaoFazenda({ ...base, lotes: [{ id: 1, faz_id: 1 }] }, { fazenda: 'Um' }).erro, 'FAZENDA_COM_VINCULOS');
  assert.equal(prepararExclusaoFazenda({ ...base, animais: [{ id: 1, fazenda_id: 1 }] }, { fazenda: 'Um' }).erro, 'FAZENDA_COM_VINCULOS');
  assert.equal(prepararExclusaoFazenda({ ...base, movimentacoes_financeiras: [{ id: 1, fazenda_id: 1 }] }, { fazenda: 'Um' }).erro, 'FAZENDA_COM_VINCULOS');
  assert.equal(prepararExclusaoFazenda({ ...base, estoque: [{ id: 1, fazenda_id: 1 }] }, { fazenda: 'Um' }).erro, 'FAZENDA_COM_VINCULOS');
  assert.equal(prepararExclusaoFazenda({ ...base, sanitario: [{ id: 1, faz_id: 1 }] }, { fazenda: 'Um' }).erro, 'FAZENDA_COM_VINCULOS');
});

test('exclusão de fazenda rejeita vazia, inexistente e ambígua', () => {
  assert.equal(prepararExclusaoFazenda(db(), { fazenda: '' }).erro, 'FAZENDA_VAZIA');
  assert.equal(prepararExclusaoFazenda(db(), { fazenda: 'Inexistente' }).erro, 'FAZENDA_NAO_ENCONTRADA');
  const dbAmbiguo = { fazendas: [{ id: 1, nome: 'Fazenda Norte A' }, { id: 2, nome: 'Fazenda Norte B' }] };
  assert.equal(prepararExclusaoFazenda(dbAmbiguo, { fazenda: 'Norte' }).erro, 'FAZENDA_AMBIGUA');
});
