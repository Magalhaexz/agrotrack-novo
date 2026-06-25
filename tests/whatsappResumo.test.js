import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gerarResumoLoteTexto,
  gerarResumoPesagensTexto,
  gerarResumoFinanceiroTexto,
  gerarResumoPastagensTexto,
  gerarResumoGeralTexto,
} from '../src/domain/whatsappResumo.js';
import { buildRelatorioLote } from '../src/domain/relatorios.js';
import { makeBaseDb } from './fixtures.js';

test('gerarResumoLoteTexto inclui nome do lote e status', () => {
  const db = makeBaseDb();
  const relatorio = buildRelatorioLote(db, 10);
  const texto = gerarResumoLoteTexto(relatorio);

  assert.match(texto, /HERDON — Resumo do Lote/);
  assert.match(texto, /Lote 10/);
  assert.match(texto, /Status:/);
});

test('gerarResumoLoteTexto inclui linha de custo/lucro por arroba e status de decisão de venda (Sprint 32)', () => {
  const db = makeBaseDb();
  const relatorio = buildRelatorioLote(db, 10);
  const texto = gerarResumoLoteTexto(relatorio);

  assert.match(texto, /Custo\/@: R\$ \d/);
  assert.match(texto, /Lucro\/@: R\$ -?\d/);
  assert.match(texto, /Status: (Pronto para avaliar venda|Acompanhar por mais alguns dias|Abaixo da meta de ganho|Custo alto por arroba|Dados insuficientes)$/m);
});

test('gerarResumoLoteTexto inclui linha "Manejo: sem registros suficientes." quando não há sanidade nem suplementação (Sprint 33)', () => {
  const db = makeBaseDb();
  const relatorio = buildRelatorioLote(db, 10);
  const texto = gerarResumoLoteTexto(relatorio);

  assert.match(texto, /Manejo: sem registros suficientes\.$/m);
});

test('gerarResumoLoteTexto inclui custo de suplemento por cabeça quando há registro (Sprint 33)', () => {
  const db = makeBaseDb();
  const hoje = new Date().toISOString().slice(0, 10);
  db.sanitario = [{ lote_id: 10, data_aplic: hoje, tipo: 'vacina' }];
  db.consumo_suplementacao = [{ lote_id: 10, custo_total: 720, quantidade_total: 100, data: hoje }];
  const relatorio = buildRelatorioLote(db, 10);
  const texto = gerarResumoLoteTexto(relatorio);

  assert.match(texto, /Manejo: Sanidade em dia · Suplemento: R\$ \d.*\/cab/);
});

test('gerarResumoLoteTexto não quebra quando relatório não tem decisaoVenda (compatibilidade)', () => {
  const texto = gerarResumoLoteTexto({
    encontrado: true,
    lote: { nome: 'Lote X' },
    totalAnimais: 5,
    pesoAtualMedio: 300,
    gmdMedio: 1,
    lucroTotal: 100,
    situacao: 'Em lucro',
    fazendaNome: 'Fazenda X',
  });
  assert.match(texto, /Lote X/);
  assert.doesNotMatch(texto, /Custo\/@/);
});

test('gerarResumoLoteTexto trata lote inexistente sem quebrar', () => {
  const texto = gerarResumoLoteTexto({ encontrado: false });
  assert.match(texto, /não encontrado/);
});

test('gerarResumoPesagensTexto trata lista vazia (estado vazio)', () => {
  const texto = gerarResumoPesagensTexto([]);
  assert.match(texto, /Ainda não há pesagens/);
});

test('gerarResumoPesagensTexto formata última pesagem', () => {
  const texto = gerarResumoPesagensTexto([
    { data: '2026-02-01', pesoMedio: 320, gmdEntrePesagens: 1.2 },
  ], { loteNome: 'Lote 10' });

  assert.match(texto, /Lote 10/);
  assert.match(texto, /320,0 kg/);
});

test('gerarResumoFinanceiroTexto trata ausência de dados (estado vazio)', () => {
  const texto = gerarResumoFinanceiroTexto(null);
  assert.match(texto, /Ainda não há lançamentos financeiros/);
});

test('gerarResumoFinanceiroTexto formata valores monetários em pt-BR', () => {
  const texto = gerarResumoFinanceiroTexto({
    entrou: 2500, saiu: 1500, saldo: 1000, maioresCategorias: [], contasVencidas: [],
  });
  assert.match(texto, /R\$ 2\.500,00/);
});

test('gerarResumoPastagensTexto trata ausência de pastos (estado vazio)', () => {
  const texto = gerarResumoPastagensTexto(null);
  assert.match(texto, /Cadastre os pastos/);
});

test('gerarResumoPastagensTexto inclui pastos acima da capacidade e em atenção', () => {
  const texto = gerarResumoPastagensTexto({
    totalPastos: 3,
    pastosComLote: 2,
    pastosSemLote: 1,
    lotesSemPasto: 1,
    pastosAcimaCapacidade: [{ id: 1, nome: 'Pasto 1' }],
    pastosEmAtencao: [{ id: 2, nome: 'Pasto 2' }],
  });
  assert.match(texto, /Pastos acima da capacidade: 1/);
  assert.match(texto, /Pastos em atenção: 1/);
});

test('gerarResumoGeralTexto não quebra com dados nulos', () => {
  const texto = gerarResumoGeralTexto(null);
  assert.match(texto, /Sem dados suficientes/);
});

test('gerarResumoGeralTexto formata totais', () => {
  const texto = gerarResumoGeralTexto({
    totalFazendas: 2, totalPastos: 5, totalLotesAtivos: 3, totalCabecas: 120,
    pesoMedioGeral: 340.5, lucroTotalFazenda: 18500, alertasCriticos: [],
  });
  assert.match(texto, /Fazendas: 2/);
  assert.match(texto, /R\$ 18\.500,00/);
});
