import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construirResumoModoCurral, obterMensagemEstadoVazio } from './modoCurral.js';

test('construirResumoModoCurral conta fazendas, lotes ativos e pastagens', () => {
  const db = {
    fazendas: [{ id: 1 }, { id: 2 }],
    lotes: [
      { id: 1, status: 'ativo' },
      { id: 2, status: 'encerrado' },
    ],
    pastagens: [{ id: 1 }],
  };
  const resumo = construirResumoModoCurral(db);
  assert.equal(resumo.temFazenda, true);
  assert.equal(resumo.totalFazendas, 2);
  assert.equal(resumo.temLoteAtivo, true);
  assert.equal(resumo.totalLotesAtivos, 1);
  assert.equal(resumo.temPasto, true);
  assert.equal(resumo.totalPastagens, 1);
});

test('construirResumoModoCurral não quebra com db nulo ou vazio', () => {
  assert.deepEqual(construirResumoModoCurral(), {
    temFazenda: false,
    temLoteAtivo: false,
    temPasto: false,
    totalFazendas: 0,
    totalLotesAtivos: 0,
    totalPastagens: 0,
  });
  assert.deepEqual(construirResumoModoCurral({ fazendas: null, lotes: undefined, pastagens: 'x' }), {
    temFazenda: false,
    temLoteAtivo: false,
    temPasto: false,
    totalFazendas: 0,
    totalLotesAtivos: 0,
    totalPastagens: 0,
  });
});

test('construirResumoModoCurral trata lote sem status como ativo', () => {
  const resumo = construirResumoModoCurral({ fazendas: [{ id: 1 }], lotes: [{ id: 1 }], pastagens: [] });
  assert.equal(resumo.temLoteAtivo, true);
});

test('obterMensagemEstadoVazio pede fazenda quando não há nenhuma, online', () => {
  const resumo = { temFazenda: false, temLoteAtivo: false, temPasto: false };
  assert.match(obterMensagemEstadoVazio(resumo, true), /cadastre sua fazenda/i);
});

test('obterMensagemEstadoVazio avisa sobre offline sem dados quando não há fazenda e está offline', () => {
  const resumo = { temFazenda: false, temLoteAtivo: false, temPasto: false };
  assert.match(obterMensagemEstadoVazio(resumo, false), /sem internet/i);
});

test('obterMensagemEstadoVazio pede lote quando há fazenda mas nenhum lote ativo', () => {
  const resumo = { temFazenda: true, temLoteAtivo: false, temPasto: false };
  assert.match(obterMensagemEstadoVazio(resumo, true), /cadastre um lote/i);
});

test('obterMensagemEstadoVazio retorna null quando há fazenda e lote ativo', () => {
  const resumo = { temFazenda: true, temLoteAtivo: true, temPasto: false };
  assert.equal(obterMensagemEstadoVazio(resumo, true), null);
});

test('obterMensagemEstadoVazio não quebra com resumo nulo', () => {
  assert.match(obterMensagemEstadoVazio(undefined, true), /cadastre sua fazenda/i);
});
