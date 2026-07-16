import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretarEdicaoCampo, resolverSlotPorNomeCampo, aplicarEdicaoPendente } from './edicaoPendente.js';
import { slotsDoCadastro, CATALOGO_CADASTROS } from './cadastros.js';
import { INTENCOES } from './interpretarComandoTelegram.js';

function db() {
  return {
    fazendas: [{ id: 1, nome: 'Fazenda Um' }],
    lotes: [{ id: 1, nome: 'Recria', faz_id: 1, status: 'ativo' }],
    pastagens: [
      { id: 5, nome: 'Pasto Norte', faz_id: 1 },
      { id: 6, nome: 'Pasto Sul', faz_id: 1 },
    ],
  };
}

test('interpretarEdicaoCampo reconhece padrões de troca', () => {
  assert.deepEqual(interpretarEdicaoCampo('Troque o pasto para Pasto Sul'), { campoBruto: 'pasto', valorBruto: 'Pasto Sul' });
  assert.deepEqual(interpretarEdicaoCampo('mude a quantidade para 30'), { campoBruto: 'quantidade', valorBruto: '30' });
  assert.deepEqual(interpretarEdicaoCampo('corrija o nome para Engorda 02'), { campoBruto: 'nome', valorBruto: 'Engorda 02' });
  assert.deepEqual(interpretarEdicaoCampo('remover pasto'), { campoBruto: 'pasto', valorBruto: '' });
  assert.deepEqual(interpretarEdicaoCampo('retirar o pasto'), { campoBruto: 'pasto', valorBruto: '' });
});

test('interpretarEdicaoCampo retorna null para mensagens comuns', () => {
  assert.equal(interpretarEdicaoCampo('cadastre um lote'), null);
  assert.equal(interpretarEdicaoCampo('/confirmar'), null);
  assert.equal(interpretarEdicaoCampo(''), null);
  assert.equal(interpretarEdicaoCampo('   '), null);
});

test('resolverSlotPorNomeCampo casa por nome exato', () => {
  const slots = slotsDoCadastro(INTENCOES.TROCAR_LOTE_PASTO);
  const r = resolverSlotPorNomeCampo(slots, 'pasto');
  assert.equal(r.status, 'ok');
  assert.equal(r.slot.nome, 'pasto');
});

test('resolverSlotPorNomeCampo casa sinônimo e campo composto', () => {
  const slots = slotsDoCadastro(INTENCOES.CADASTRAR_LOTE);
  assert.equal(resolverSlotPorNomeCampo(slots, 'cabeças').slot.nome, 'quantidade');
  assert.equal(resolverSlotPorNomeCampo(slots, 'nome').slot.nome, 'nome_lote');
  assert.equal(resolverSlotPorNomeCampo(slots, 'pastagem').slot.nome, 'pasto');
});

test('resolverSlotPorNomeCampo devolve ambíguo quando dois slots compostos colidem', () => {
  const slots = slotsDoCadastro(INTENCOES.CADASTRAR_MANEJO);
  const r = resolverSlotPorNomeCampo(slots, 'quantidade');
  assert.equal(r.status, 'ambiguo');
  assert.deepEqual(r.candidatos.sort(), ['quantidade_animais', 'quantidade_produto']);
});

test('resolverSlotPorNomeCampo não encontra campo inexistente', () => {
  const slots = slotsDoCadastro(INTENCOES.CADASTRAR_LOTE);
  assert.equal(resolverSlotPorNomeCampo(slots, 'banana').status, 'nao_encontrado');
});

test('aplicarEdicaoPendente corrige um campo e revalida (troca de pasto)', () => {
  const dadosAtuais = { nome_lote: 'Engorda 02', quantidade: 30, sexo: 'machos', pasto: 'Norte' };
  const r = aplicarEdicaoPendente({
    intencao: INTENCOES.CADASTRAR_LOTE,
    dadosAtuais,
    campoBruto: 'pasto',
    valorBruto: 'Sul',
    ctx: { db: db(), fazendaId: 1 },
  });
  assert.equal(r.ok, true);
  assert.equal(r.campo, 'pasto');
  assert.equal(r.dadosNovos.pasto, 'Sul');
  assert.equal(r.dadosNovos.nome_lote, 'Engorda 02');
  assert.equal(r.resultado.ok, true);
  assert.equal(r.resultado.rpc.params.p_pastagem_id, 6);
});

test('aplicarEdicaoPendente remove o pasto (slot opcional vira "")', () => {
  const dadosAtuais = { nome_lote: 'Engorda 02', quantidade: 30, sexo: 'machos', pasto: 'Norte' };
  const r = aplicarEdicaoPendente({
    intencao: INTENCOES.CADASTRAR_LOTE,
    dadosAtuais,
    campoBruto: 'pasto',
    valorBruto: '',
    ctx: { db: db(), fazendaId: 1 },
  });
  assert.equal(r.ok, true);
  assert.equal(r.dadosNovos.pasto, '');
  assert.equal(r.resultado.rpc.params.p_pastagem_id, null);
});

test('aplicarEdicaoPendente não altera dadosAtuais quando a revalidação falha', () => {
  const dadosAtuais = { nome_lote: 'Engorda 02', quantidade: 30, sexo: 'machos' };
  const r = aplicarEdicaoPendente({
    intencao: INTENCOES.CADASTRAR_LOTE,
    dadosAtuais,
    campoBruto: 'pasto',
    valorBruto: 'Nordeste', // não existe
    ctx: { db: db(), fazendaId: 1 },
  });
  assert.equal(r.ok, false);
  assert.equal(r.erro, 'PASTO_NAO_ENCONTRADO');
  assert.deepEqual(dadosAtuais, { nome_lote: 'Engorda 02', quantidade: 30, sexo: 'machos' });
});

test('aplicarEdicaoPendente devolve CAMPO_NAO_RECONHECIDO', () => {
  const r = aplicarEdicaoPendente({
    intencao: INTENCOES.CADASTRAR_LOTE,
    dadosAtuais: { nome_lote: 'X', quantidade: 10, sexo: 'macho' },
    campoBruto: 'cor dos olhos',
    valorBruto: 'azul',
    ctx: { db: db(), fazendaId: 1 },
  });
  assert.equal(r.ok, false);
  assert.equal(r.erro, 'CAMPO_NAO_RECONHECIDO');
});

test('aplicarEdicaoPendente devolve CADASTRO_DESCONHECIDO para intenção sem catálogo', () => {
  const r = aplicarEdicaoPendente({
    intencao: 'INTENCAO_INVENTADA',
    dadosAtuais: {},
    campoBruto: 'pasto',
    valorBruto: 'Sul',
    ctx: { db: db() },
  });
  assert.equal(r.ok, false);
  assert.equal(r.erro, 'CADASTRO_DESCONHECIDO');
});

test('sanity: CATALOGO_CADASTROS ainda expõe TROCAR_LOTE_PASTO usado no teste acima', () => {
  assert.ok(CATALOGO_CADASTROS[INTENCOES.TROCAR_LOTE_PASTO]);
});
