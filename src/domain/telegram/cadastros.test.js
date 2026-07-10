import test from 'node:test';
import assert from 'node:assert/strict';
import { extrairDadosIniciais, interpretarResposta, prepararCadastro, slotsDoCadastro } from './cadastros.js';
import { INTENCOES } from './interpretarComandoTelegram.js';

const HOJE = new Date(Date.UTC(2026, 6, 10));
const db = () => ({
  lotes: [
    { id: 10, nome: 'Recria 01', status: 'ativo' },
    { id: 11, nome: 'Engorda 02', status: 'ativo' },
  ],
  estoque: [
    { id: 1, produto: 'Sal mineral', quantidade_atual: 7, unidade: 'sacos' },
    { id: 2, produto: 'Milho', quantidade_atual: 8400, unidade: 'kg' },
  ],
});
const ctx = () => ({ db: db(), hoje: HOJE });

test('extração inicial de pesagem por mensagem única', () => {
  const d = extrairDadosIniciais(INTENCOES.REGISTRAR_PESAGEM, 'registre pesagem de 425 kg no lote Engorda 02', ctx());
  assert.equal(d.peso, 425);
  assert.equal(d.lote, 'Engorda 02');
});

test('extração inicial de despesa', () => {
  const d = extrairDadosIniciais(INTENCOES.CADASTRAR_DESPESA, 'gastei 500 reais com sal mineral', ctx());
  assert.equal(d.valor, 500);
  assert.equal(d.descricao, 'sal mineral');
});

test('interpretarResposta por tipo de slot', () => {
  assert.equal(interpretarResposta('valor', '850 reais'), 850);
  assert.equal(interpretarResposta('peso', '425'), 425);
  assert.equal(interpretarResposta('data', 'hoje', { hoje: HOJE }), '2026-07-10');
  assert.equal(interpretarResposta('texto', 'Compra de sal'), 'Compra de sal');
  assert.equal(interpretarResposta('opcional_texto', 'não'), '');
  assert.equal(interpretarResposta('lote', 'Engorda 02'), 'Engorda 02');
});

test('slotsDoCadastro define perguntas', () => {
  const slots = slotsDoCadastro(INTENCOES.CADASTRAR_DESPESA);
  assert.equal(slots[0].nome, 'valor');
  assert.equal(slots[1].nome, 'descricao');
});

test('prepararCadastro pesagem gera insert em pesagens', () => {
  const r = prepararCadastro(INTENCOES.REGISTRAR_PESAGEM, { lote: 'Engorda 02', peso: 425 }, ctx());
  assert.equal(r.ok, true);
  assert.equal(r.writes[0].tabela, 'pesagens');
  assert.equal(r.writes[0].registro.lote_id, 11);
  assert.equal(r.writes[0].registro.peso_medio, 425);
  assert.equal(r.writes[0].registro.data, '2026-07-10');
});

test('pesagem exige lote resolvível e peso positivo', () => {
  assert.equal(prepararCadastro(INTENCOES.REGISTRAR_PESAGEM, { lote: 'Engorda 02', peso: 0 }, ctx()).erro, 'PESO_INVALIDO');
  assert.equal(prepararCadastro(INTENCOES.REGISTRAR_PESAGEM, { lote: 'Inexistente', peso: 425 }, ctx()).erro, 'LOTE_NAO_ENCONTRADO');
});

test('prepararCadastro despesa com lote opcional', () => {
  const r = prepararCadastro(INTENCOES.CADASTRAR_DESPESA, { valor: 500, descricao: 'Sal', lote: 'Recria 01' }, ctx());
  assert.equal(r.ok, true);
  assert.equal(r.tipo, 'despesa');
  assert.equal(r.writes[0].registro.tipo, 'despesa');
  assert.equal(r.writes[0].registro.valor, 500);
  assert.equal(r.writes[0].registro.lote_id, 10);
});

test('despesa sem lote vincula a nenhum', () => {
  const r = prepararCadastro(INTENCOES.CADASTRAR_DESPESA, { valor: 300, descricao: 'Combustível' }, ctx());
  assert.equal(r.ok, true);
  assert.equal(r.writes[0].registro.lote_id, null);
});

test('despesa valida valor e descrição', () => {
  assert.equal(prepararCadastro(INTENCOES.CADASTRAR_DESPESA, { valor: 0, descricao: 'x' }, ctx()).erro, 'VALOR_INVALIDO');
  assert.equal(prepararCadastro(INTENCOES.CADASTRAR_DESPESA, { valor: 100, descricao: '' }, ctx()).erro, 'DESCRICAO_VAZIA');
});

test('receita gera insert de receita', () => {
  const r = prepararCadastro(INTENCOES.CADASTRAR_RECEITA, { valor: 15000, descricao: 'Venda lote' }, ctx());
  assert.equal(r.writes[0].registro.tipo, 'receita');
  assert.equal(r.writes[0].registro.valor, 15000);
});

test('entrada de estoque resolve item e atualiza saldo', () => {
  const r = prepararCadastro(INTENCOES.REGISTRAR_ENTRADA_ESTOQUE, { item: 'sal', quantidade: 20 }, ctx());
  assert.equal(r.ok, true);
  assert.equal(r.writes.length, 2);
  assert.equal(r.writes[0].tabela, 'movimentacoes_estoque');
  assert.equal(r.writes[0].registro.quantidade, 20);
  assert.equal(r.writes[1].tabela, 'estoque');
  assert.equal(r.writes[1].patch.quantidade_atual, 27);
});

test('entrada de estoque item inexistente', () => {
  assert.equal(prepararCadastro(INTENCOES.REGISTRAR_ENTRADA_ESTOQUE, { item: 'inexistente', quantidade: 5 }, ctx()).erro, 'ITEM_NAO_ENCONTRADO');
});
