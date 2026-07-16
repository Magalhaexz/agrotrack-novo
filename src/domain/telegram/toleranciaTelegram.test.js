import test from 'node:test';
import assert from 'node:assert/strict';
import { distanciaLevenshtein, corrigirPalavra, aplicarToleranciaTelegram } from './toleranciaTelegram.js';

const DICIONARIO = ['pesagem', 'estoque', 'fazenda', 'transferir', 'cadastrar', 'consultar', 'lote', 'sal'];

test('distanciaLevenshtein casos básicos', () => {
  assert.equal(distanciaLevenshtein('', ''), 0);
  assert.equal(distanciaLevenshtein('a', ''), 1);
  assert.equal(distanciaLevenshtein('pesagem', 'pesagem'), 0);
  assert.equal(distanciaLevenshtein('pesajen', 'pesagem'), 2);
});

test('exemplos do spec: pesajen→pesagem, estoqe→estoque, faznda→fazenda, trasferir→transferir', () => {
  assert.equal(corrigirPalavra('pesajen', DICIONARIO).corrigida, 'pesagem');
  assert.equal(corrigirPalavra('estoqe', DICIONARIO).corrigida, 'estoque');
  assert.equal(corrigirPalavra('faznda', DICIONARIO).corrigida, 'fazenda');
  assert.equal(corrigirPalavra('trasferir', DICIONARIO).corrigida, 'transferir');
});

test('palavra já correta não é "corrigida" (devolve null)', () => {
  assert.equal(corrigirPalavra('pesagem', DICIONARIO), null);
});

test('nunca corrige números/valores/datas', () => {
  assert.equal(corrigirPalavra('500', DICIONARIO), null);
  assert.equal(corrigirPalavra('2.500', DICIONARIO), null);
  assert.equal(corrigirPalavra('15/07', DICIONARIO), null);
  assert.equal(corrigirPalavra('kg5', DICIONARIO), null); // tem dígito misturado — não mexe
});

test('não corrige quando nenhuma candidata está perto o bastante (evita adivinhar)', () => {
  // "banana" está muito longe de qualquer palavra do dicionário — não deve
  // ser forçado a virar "fazenda" só porque é a "menos distante"
  assert.equal(corrigirPalavra('banana', DICIONARIO), null);
});

test('não corrige palavras muito curtas (ambíguas demais)', () => {
  assert.equal(corrigirPalavra('lo', DICIONARIO), null);
});

test('aplicarToleranciaTelegram corrige múltiplas palavras e lista as correções feitas', () => {
  const r = aplicarToleranciaTelegram('registrar pesajen no lote da faznda', DICIONARIO);
  assert.match(r.texto, /pesagem/);
  assert.match(r.texto, /fazenda/);
  assert.equal(r.correcoes.length, 2);
});

test('texto sem nenhum erro não gera correções', () => {
  const r = aplicarToleranciaTelegram('consultar estoque da fazenda', DICIONARIO);
  assert.equal(r.correcoes.length, 0);
  assert.equal(r.texto, 'consultar estoque da fazenda');
});

test('preserva espaçamento original ao remontar o texto', () => {
  const r = aplicarToleranciaTelegram('registrar  pesajen', DICIONARIO);
  assert.equal(r.texto, 'registrar  pesagem');
});
