import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretarSelecaoFazenda } from './selecaoFazendaPendente.js';

const opcoes = [
  { indice: 1, fazenda_id: 10, nome: 'yellowstone' },
  { indice: 2, fazenda_id: 20, nome: 'Olhos D’água' },
];

test('numero puro seleciona pelo indice', () => {
  const r1 = interpretarSelecaoFazenda('1', opcoes);
  assert.equal(r1.status, 'ok');
  assert.equal(r1.opcao.fazenda_id, 10);

  const r2 = interpretarSelecaoFazenda('2', opcoes);
  assert.equal(r2.status, 'ok');
  assert.equal(r2.opcao.fazenda_id, 20);
});

test('variantes com prefixo numérico: opção/opcao/fazenda/usar', () => {
  for (const texto of ['opção 1', 'opcao 1', 'fazenda 1', 'usar 1', 'usar fazenda 1']) {
    const r = interpretarSelecaoFazenda(texto, opcoes);
    assert.equal(r.status, 'ok', `falhou para "${texto}"`);
    assert.equal(r.opcao.fazenda_id, 10);
  }
});

test('nome exato, sem acento, caixa diferente, com prefixos', () => {
  for (const texto of ['yellowstone', 'YELLOWSTONE', 'usar fazenda yellowstone', 'usar yellowstone', 'fazenda yellowstone']) {
    const r = interpretarSelecaoFazenda(texto, opcoes);
    assert.equal(r.status, 'ok', `falhou para "${texto}"`);
    assert.equal(r.opcao.fazenda_id, 10);
  }
  const semAcento = interpretarSelecaoFazenda('olhos d’agua', opcoes);
  assert.equal(semAcento.status, 'ok');
  assert.equal(semAcento.opcao.fazenda_id, 20);
});

test('numero fora da faixa, zero e decimal são inválidos (nunca escolhem silenciosamente)', () => {
  assert.equal(interpretarSelecaoFazenda('3', opcoes).status, 'invalido');
  assert.equal(interpretarSelecaoFazenda('0', opcoes).status, 'invalido');
  assert.notEqual(interpretarSelecaoFazenda('1.5', opcoes).status, 'ok');
  assert.notEqual(interpretarSelecaoFazenda('-1', opcoes).status, 'ok');
});

test('nomes semelhantes pedem confirmação em vez de escolher silenciosamente', () => {
  const semelhantes = [
    { indice: 1, fazenda_id: 1, nome: 'Fazenda Olhos D’água' },
    { indice: 2, fazenda_id: 2, nome: 'Fazenda Olhos D’água II' },
  ];
  // Nenhum candidato casa exatamente com o prefixo comum → ambíguo (mesma
  // regra de `resolverFazendaPorNome`: exato vence, prefixo só decide quando
  // nenhum é exato).
  const r = interpretarSelecaoFazenda('Fazenda Olhos', semelhantes);
  assert.equal(r.status, 'ambiguo');
  assert.equal(r.candidatos.length, 2);
});

test('texto que não bate em nada devolve nao_reconhecido', () => {
  assert.equal(interpretarSelecaoFazenda('blablabla', opcoes).status, 'nao_reconhecido');
  assert.equal(interpretarSelecaoFazenda('', opcoes).status, 'nao_reconhecido');
});
