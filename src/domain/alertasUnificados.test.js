import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarAlertasUnificados } from './alertasUnificados.js';

const AGORA = new Date('2026-07-10T12:00:00Z');

function alertaPorTipo(alertas, tipo) {
  return alertas.find((a) => a.tipo === tipo);
}

test('gerarAlertasUnificados sinaliza saída de lote vencida e próxima (Sprint 9)', () => {
  const db = {
    lotes: [
      { id: 1, nome: 'Lote Vencido', status: 'ativo', saida: '2026-07-05' },
      { id: 2, nome: 'Lote Próximo', status: 'ativo', saida: '2026-07-14' },
      { id: 3, nome: 'Lote Longe', status: 'ativo', saida: '2026-09-01' },
      { id: 4, nome: 'Lote Inativo', status: 'inativo', saida: '2026-07-01' },
    ],
  };

  const alertas = gerarAlertasUnificados(db, { agora: AGORA });

  const vencida = alertaPorTipo(alertas, 'lote-saida-vencida');
  assert.ok(vencida, 'deveria gerar alerta de saída vencida');
  assert.equal(vencida.prioridade, 'critico');
  assert.match(vencida.descricao, /Lote Vencido/);

  const proxima = alertaPorTipo(alertas, 'lote-saida-proxima');
  assert.ok(proxima, 'deveria gerar alerta de saída próxima');
  assert.equal(proxima.prioridade, 'atencao');
  assert.match(proxima.descricao, /Lote Próximo/);
  assert.doesNotMatch(proxima.descricao, /Lote Longe/);
  assert.doesNotMatch(proxima.descricao, /Lote Inativo/);
});

test('gerarAlertasUnificados não sinaliza saída de lote quando não há data prevista', () => {
  const db = { lotes: [{ id: 1, nome: 'Sem saída', status: 'ativo' }] };
  const alertas = gerarAlertasUnificados(db, { agora: AGORA });
  assert.equal(alertaPorTipo(alertas, 'lote-saida-vencida'), undefined);
  assert.equal(alertaPorTipo(alertas, 'lote-saida-proxima'), undefined);
});

test('gerarAlertasUnificados sinaliza produto de estoque vencido e perto do vencimento (Sprint 9)', () => {
  const db = {
    estoque: [
      { id: 10, produto: 'Sal mineral', data_validade: '2026-07-01', alerta_dias_antes: 5 },
      { id: 11, produto: 'Vacina X', data_validade: '2026-07-13', alerta_dias_antes: 5 },
      { id: 12, produto: 'Ração', data_validade: '2026-12-31', alerta_dias_antes: 5 },
      { id: 13, produto: 'Sem validade' },
    ],
  };

  const alertas = gerarAlertasUnificados(db, { agora: AGORA });

  const vencido = alertaPorTipo(alertas, 'estoque-vencido');
  assert.ok(vencido, 'deveria gerar alerta de estoque vencido');
  assert.equal(vencido.prioridade, 'critico');
  assert.match(vencido.descricao, /Sal mineral/);

  const proximo = alertaPorTipo(alertas, 'estoque-validade-proxima');
  assert.ok(proximo, 'deveria gerar alerta de validade próxima');
  assert.equal(proximo.prioridade, 'atencao');
  assert.match(proximo.descricao, /Vacina X/);
  assert.doesNotMatch(proximo.descricao, /Ração/);
});

test('gerarAlertasUnificados não quebra com db vazio e não gera alertas de estoque/lote sem dados', () => {
  const alertas = gerarAlertasUnificados({}, { agora: AGORA });
  assert.deepEqual(alertas, []);
});
