import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizarValorExportacao,
  gerarCsv,
  formatarMoedaExportacao,
  formatarNumeroExportacao,
  formatarDataExportacao,
  montarNomeArquivo,
  montarTabelaRelatorio,
} from './exportacaoRelatorios.js';

test('sanitizarValorExportacao trata null/undefined como string vazia', () => {
  assert.equal(sanitizarValorExportacao(null), '');
  assert.equal(sanitizarValorExportacao(undefined), '');
});

test('sanitizarValorExportacao remove NaN/Infinity de números', () => {
  assert.equal(sanitizarValorExportacao(NaN), '');
  assert.equal(sanitizarValorExportacao(Infinity), '');
  assert.equal(sanitizarValorExportacao(-Infinity), '');
  assert.equal(sanitizarValorExportacao(42), 42);
});

test('sanitizarValorExportacao preserva acentos e remove quebra de linha perigosa', () => {
  assert.equal(sanitizarValorExportacao('São João\nLinha 2\r\n'), 'São João Linha 2');
});

test('gerarCsv inclui cabeçalho com os labels das colunas', () => {
  const csv = gerarCsv({
    colunas: [{ key: 'nome', label: 'Nome' }, { key: 'idade', label: 'Idade' }],
    linhas: [{ nome: 'Bezerro 1', idade: 12 }],
  });
  const [cabecalho] = csv.split('\r\n');
  assert.equal(cabecalho, 'Nome;Idade');
});

test('gerarCsv escapa valores com aspas duplicando-as', () => {
  const csv = gerarCsv({
    colunas: [{ key: 'obs', label: 'Observação' }],
    linhas: [{ obs: 'disse "vender logo"' }],
  });
  assert.match(csv, /"disse ""vender logo"""/);
});

test('gerarCsv escapa valores com o delimitador (ponto e vírgula)', () => {
  const csv = gerarCsv({
    colunas: [{ key: 'obs', label: 'Observação' }],
    linhas: [{ obs: 'a; b' }],
  });
  assert.match(csv, /"a; b"/);
});

test('gerarCsv substitui quebra de linha dentro de uma célula por espaço (nunca quebra a linha do CSV)', () => {
  const csv = gerarCsv({
    colunas: [{ key: 'obs', label: 'Observação' }],
    linhas: [{ obs: 'linha 1\nlinha 2' }],
  });
  assert.equal(csv, 'Observação\r\nlinha 1 linha 2');
  assert.equal(csv.split('\r\n').length, 2);
});

test('gerarCsv aceita delimitador customizado', () => {
  const csv = gerarCsv({
    colunas: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }],
    linhas: [{ a: 1, b: 2 }],
    delimitador: ',',
  });
  assert.equal(csv, 'A,B\r\n1,2');
});

test('gerarCsv nunca produz "undefined"/"null" nem NaN/Infinity nas células', () => {
  const csv = gerarCsv({
    colunas: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }, { key: 'c', label: 'C' }],
    linhas: [{ a: undefined, b: null, c: NaN }],
  });
  const [, linha] = csv.split('\r\n');
  assert.equal(linha, ';;');
  assert.doesNotMatch(csv, /undefined|null|NaN|Infinity/);
});

test('gerarCsv aceita accessor de função por coluna', () => {
  const csv = gerarCsv({
    colunas: [{ key: 'total', label: 'Total', accessor: (linha) => linha.a + linha.b }],
    linhas: [{ a: 2, b: 3 }],
  });
  assert.equal(csv, 'Total\r\n5');
});

test('gerarCsv com lista de linhas vazia gera só o cabeçalho', () => {
  const csv = gerarCsv({ colunas: [{ key: 'a', label: 'A' }], linhas: [] });
  assert.equal(csv, 'A');
});

test('formatarMoedaExportacao formata em R$ pt-BR', () => {
  assert.equal(formatarMoedaExportacao(1234.5), 'R$ 1.234,50');
});

test('formatarMoedaExportacao não quebra com null/NaN', () => {
  assert.equal(formatarMoedaExportacao(null), 'R$ 0,00');
  assert.equal(formatarMoedaExportacao(NaN), 'R$ 0,00');
});

test('formatarNumeroExportacao formata em padrão brasileiro', () => {
  assert.equal(formatarNumeroExportacao(1234.5), '1.234,50');
});

test('formatarNumeroExportacao não quebra com valor inválido', () => {
  assert.equal(formatarNumeroExportacao(undefined), '0');
  assert.equal(formatarNumeroExportacao('abc'), '0');
});

test('formatarDataExportacao formata data válida como dd/mm/aaaa', () => {
  assert.equal(formatarDataExportacao('2026-07-07'), '07/07/2026');
});

test('formatarDataExportacao devolve vazio para data inválida ou ausente', () => {
  assert.equal(formatarDataExportacao(null), '');
  assert.equal(formatarDataExportacao(''), '');
  assert.equal(formatarDataExportacao('não é data'), '');
});

test('montarNomeArquivo gera nome seguro com prefixo, fazenda e data', () => {
  const nome = montarNomeArquivo({ prefixo: 'Resultado por Lote', fazendaNome: 'Fazenda São João', data: '2026-07-07' });
  assert.equal(nome, 'herdon-resultado-por-lote-fazenda-sao-joao-2026-07-07.csv');
});

test('montarNomeArquivo funciona sem fazenda e sem data (usa hoje)', () => {
  const nome = montarNomeArquivo({ prefixo: 'Estoque' });
  assert.match(nome, /^herdon-estoque-\d{4}-\d{2}-\d{2}\.csv$/);
});

test('montarTabelaRelatorio devolve objeto padronizado com defaults seguros', () => {
  const tabela = montarTabelaRelatorio({ colunas: [{ key: 'a', label: 'A' }], linhas: [{ a: 1 }] });
  assert.equal(tabela.titulo, 'Relatório HERDON');
  assert.equal(tabela.subtitulo, '');
  assert.deepEqual(tabela.metadados, {});
  assert.equal(tabela.linhas.length, 1);
});
