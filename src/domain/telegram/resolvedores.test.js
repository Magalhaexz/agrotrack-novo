import test from 'node:test';
import assert from 'node:assert/strict';
import { resolverFazendaPorNome, resolverLotePorNome, normalizarChave } from './resolvedores.js';

const fazendas = [
  { id: 1, nome: 'Fazenda Santa Clara' },
  { id: 2, nome: 'Fazenda Boa Vista' },
  { id: 3, nome: 'Fazenda São José' },
];

test('normalizarChave remove acento e caixa', () => {
  assert.equal(normalizarChave('São José'), 'sao jose');
  assert.equal(normalizarChave('  Recria   01 '), 'recria 01');
});

test('fazenda exata (acento-insensível)', () => {
  const r = resolverFazendaPorNome(fazendas, 'fazenda sao jose');
  assert.equal(r.status, 'ok');
  assert.equal(r.fazenda.id, 3);
});

test('fazenda por prefixo único', () => {
  const r = resolverFazendaPorNome(fazendas, 'Fazenda Boa');
  assert.equal(r.status, 'ok');
  assert.equal(r.fazenda.id, 2);
});

test('fazendas com nomes semelhantes → ambíguo', () => {
  const semelhantes = [
    { id: 1, nome: 'Fazenda São João' },
    { id: 2, nome: 'Fazenda São João II' },
  ];
  const r = resolverFazendaPorNome(semelhantes, 'Fazenda São João');
  // "São João" casa exato com id 1 apenas → ok; prefixo pega os dois mas exato vence
  assert.equal(r.status, 'ok');
  assert.equal(r.fazenda.id, 1);
  // prefixo ambíguo quando nenhum é exato:
  const r2 = resolverFazendaPorNome(semelhantes, 'Fazenda São');
  assert.equal(r2.status, 'ambiguo');
  assert.equal(r2.candidatas.length, 2);
});

test('fazenda não encontrada', () => {
  assert.equal(resolverFazendaPorNome(fazendas, 'Inexistente').status, 'nao_encontrado');
  assert.equal(resolverFazendaPorNome(fazendas, '').status, 'nao_encontrado');
});

const lotes = [
  { id: 10, nome: 'Recria 01', status: 'ativo' },
  { id: 11, nome: 'Engorda 02', status: 'ativo' },
  { id: 12, nome: 'Lote A', status: 'ativo' },
  { id: 13, nome: 'Recria 01 Antigo', status: 'encerrado' },
];

test('lote exato', () => {
  const r = resolverLotePorNome(lotes, 'Engorda 02');
  assert.equal(r.status, 'ok');
  assert.equal(r.lote.id, 11);
});

test('lote "A" casa com "Lote A" (prefixo lote reconstruído)', () => {
  const r = resolverLotePorNome(lotes, 'A');
  assert.equal(r.status, 'ok');
  assert.equal(r.lote.id, 12);
});

test('somenteAtivos ignora lotes encerrados', () => {
  // "Recria 01" casa exato com id 10; encerrado id 13 tem nome diferente
  const r = resolverLotePorNome(lotes, 'Recria 01', { somenteAtivos: true });
  assert.equal(r.status, 'ok');
  assert.equal(r.lote.id, 10);
});

test('lote inexistente e ambíguo', () => {
  assert.equal(resolverLotePorNome(lotes, 'Nao existe').status, 'nao_encontrado');
  const ambiguos = [
    { id: 1, nome: 'Pasto Norte' },
    { id: 2, nome: 'Pasto Norte 2' },
  ];
  // "Pasto" não é exato em nenhum → parcial pega os dois → ambíguo
  assert.equal(resolverLotePorNome(ambiguos, 'Pasto').status, 'ambiguo');
});
