import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarAlertasUnificados } from './alertasUnificados.js';
import { hojeLocalISO } from './dataCivil.js';

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
  // Sprint 12 — bucket com 1 lote só: dataReferencia/loteId/loteNome preenchidos.
  assert.equal(vencida.dataReferencia, '2026-07-05');
  assert.equal(vencida.loteId, 1);
  assert.equal(vencida.loteNome, 'Lote Vencido');

  const proxima = alertaPorTipo(alertas, 'lote-saida-proxima');
  assert.ok(proxima, 'deveria gerar alerta de saída próxima');
  assert.equal(proxima.prioridade, 'atencao');
  assert.match(proxima.descricao, /Lote Próximo/);
  assert.doesNotMatch(proxima.descricao, /Lote Longe/);
  assert.doesNotMatch(proxima.descricao, /Lote Inativo/);
  assert.equal(proxima.dataReferencia, '2026-07-14');
  assert.equal(proxima.loteId, 2);
  assert.equal(proxima.loteNome, 'Lote Próximo');
});

test('gerarAlertasUnificados de saída de lote mantém loteId/loteNome null quando o grupo tem mais de um lote', () => {
  const db = {
    lotes: [
      { id: 1, nome: 'Lote A', status: 'ativo', saida: '2026-07-05' },
      { id: 2, nome: 'Lote B', status: 'ativo', saida: '2026-07-06' },
    ],
  };
  const alertas = gerarAlertasUnificados(db, { agora: AGORA });
  const vencida = alertaPorTipo(alertas, 'lote-saida-vencida');
  assert.ok(vencida);
  assert.equal(vencida.loteId, null);
  assert.equal(vencida.loteNome, null);
  // Mesmo ambíguo quanto ao lote, a data mais urgente (mínima) do grupo é real.
  assert.equal(vencida.dataReferencia, '2026-07-05');
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
  assert.equal(vencido.dataReferencia, '2026-07-01');
  // Estoque não é vinculado a lote (Sprint 12) — sempre null.
  assert.equal(vencido.loteId, null);
  assert.equal(vencido.loteNome, null);

  const proximo = alertaPorTipo(alertas, 'estoque-validade-proxima');
  assert.ok(proximo, 'deveria gerar alerta de validade próxima');
  assert.equal(proximo.prioridade, 'atencao');
  assert.match(proximo.descricao, /Vacina X/);
  assert.doesNotMatch(proximo.descricao, /Ração/);
  assert.equal(proximo.dataReferencia, '2026-07-13');
});

test('gerarAlertasUnificados não quebra com db vazio e não gera alertas de estoque/lote sem dados', () => {
  const alertas = gerarAlertasUnificados({}, { agora: AGORA });
  assert.deepEqual(alertas, []);
});

test('gerarAlertasUnificados sinaliza carência ativa e carência vencendo em breve (Sprint 10)', () => {
  const db = {
    lotes: [
      { id: 1, nome: 'Lote Carência Longa' },
      { id: 2, nome: 'Lote Carência Vencendo' },
    ],
    sanitario: [
      { id: 100, tipo: 'medicamento', desc: 'Antibiótico', lote_id: 1, data_fim_carencia: '2026-07-20' },
      { id: 101, tipo: 'medicamento', desc: 'Antiparasitário', lote_id: 2, data_fim_carencia: '2026-07-12' },
      { id: 102, tipo: 'medicamento', desc: 'Carência já terminada', lote_id: 1, data_fim_carencia: '2026-07-01' },
    ],
  };

  const alertas = gerarAlertasUnificados(db, { agora: AGORA });

  const ativa = alertaPorTipo(alertas, 'carencia-ativa');
  assert.ok(ativa, 'deveria gerar alerta de carência ativa');
  assert.equal(ativa.prioridade, 'atencao');
  assert.equal(ativa.origem, 'sanidade');
  assert.match(ativa.descricao, /Lote Carência Longa/);
  assert.doesNotMatch(ativa.descricao, /Vencendo/);
  // Sprint 12 — bucket com 1 registro só: dataReferencia = data_fim_carencia, lote identificado.
  assert.equal(ativa.dataReferencia, '2026-07-20');
  assert.equal(ativa.loteId, 1);
  assert.equal(ativa.loteNome, 'Lote Carência Longa');
  assert.equal(ativa.acaoSugerida, 'Não vender ou abater até o fim da carência.');

  const vencendo = alertaPorTipo(alertas, 'carencia-vencendo');
  assert.ok(vencendo, 'deveria gerar alerta de carência vencendo em breve');
  assert.match(vencendo.descricao, /Lote Carência Vencendo/);
  assert.equal(vencendo.dataReferencia, '2026-07-12');
  assert.equal(vencendo.loteId, 2);
  assert.equal(vencendo.loteNome, 'Lote Carência Vencendo');
});

test('gerarAlertasUnificados não sinaliza carência quando não há data_fim_carencia', () => {
  const db = { sanitario: [{ id: 1, tipo: 'vacina', lote_id: 1 }] };
  const alertas = gerarAlertasUnificados(db, { agora: AGORA });
  assert.equal(alertaPorTipo(alertas, 'carencia-ativa'), undefined);
  assert.equal(alertaPorTipo(alertas, 'carencia-vencendo'), undefined);
});

// ── Sprint 12 — qualificação de dataReferencia/loteId/loteNome/acaoSugerida ──

test('gerarAlertasUnificados alerta de sanidade próxima traz dataReferencia e lote (Sprint 12)', () => {
  const db = {
    lotes: [{ id: 3, nome: 'Lote Vacina', status: 'ativo' }],
    sanitario: [{ id: 50, tipo: 'vacina', lote_id: 3, proxima: '2026-07-09', alerta_dias_antes: 5 }],
  };
  const alertas = gerarAlertasUnificados(db, { agora: AGORA });
  const sanidade = alertaPorTipo(alertas, 'sanidade');
  assert.ok(sanidade, 'deveria gerar alerta de sanidade');
  assert.equal(sanidade.dataReferencia, '2026-07-09');
  assert.equal(sanidade.loteId, 3);
  assert.equal(sanidade.loteNome, 'Lote Vacina');
  assert.ok(sanidade.acaoSugerida, 'deveria ter ação sugerida');
});

test('gerarAlertasUnificados alerta de tarefa atrasada traz dataReferencia e lote quando existir (Sprint 12)', () => {
  const db = {
    lotes: [{ id: 4, nome: 'Lote Tarefa' }],
    tarefas: [{ id: 7, titulo: 'Vacinar', status: 'pendente', data_vencimento: '2026-07-05', lote_id: 4 }],
  };
  const alertas = gerarAlertasUnificados(db, { agora: AGORA });
  const tarefa = alertaPorTipo(alertas, 'tarefa');
  assert.ok(tarefa, 'deveria gerar alerta de tarefa atrasada');
  assert.equal(tarefa.dataReferencia, '2026-07-05');
  assert.equal(tarefa.loteId, 4);
  assert.equal(tarefa.loteNome, 'Lote Tarefa');
});

test('gerarAlertasUnificados alerta de GMD abaixo da meta traz dataReferencia (última pesagem) e lote (Sprint 12)', () => {
  const db = {
    lotes: [{ id: 1, nome: 'Lote Nelore', status: 'ativo', gmd_meta: 1.0, ultima_pesagem: '2026-07-05' }],
    animais: [{ id: 1, lote_id: 1, qtd: 10, sexo: 'macho', p_ini: 300, p_at: 320, data_entrada: '2026-06-01' }],
    pesagens: [
      { id: 1, lote_id: 1, data: '2026-06-10', peso_medio: 305 },
      { id: 2, lote_id: 1, data: '2026-07-05', peso_medio: 320 },
    ],
  };
  const alertas = gerarAlertasUnificados(db, { agora: AGORA });
  const gmd = alertaPorTipo(alertas, 'gmd');
  assert.ok(gmd, 'deveria gerar alerta de GMD abaixo da meta');
  assert.equal(gmd.dataReferencia, '2026-07-05');
  assert.equal(gmd.loteId, 1);
  assert.equal(gmd.loteNome, 'Lote Nelore');
  assert.ok(gmd.acaoSugerida, 'deveria ter ação sugerida');
});

test('gerarAlertasUnificados lote sem pesagem nenhuma mantém dataReferencia null mesmo com loteId/loteNome preenchidos (Sprint 12)', () => {
  const db = { lotes: [{ id: 1, nome: 'Lote Novo', status: 'ativo' }] };
  const alertas = gerarAlertasUnificados(db, { agora: AGORA });
  const semPesagem = alertaPorTipo(alertas, 'sem-pesagem');
  assert.ok(semPesagem, 'deveria gerar alerta de lote sem pesagem');
  assert.equal(semPesagem.dataReferencia, null);
  assert.equal(semPesagem.loteId, 1);
  assert.equal(semPesagem.loteNome, 'Lote Novo');
});

test('gerarAlertasUnificados lote sem pasto (estado, sem data por natureza) mantém dataReferencia null', () => {
  const db = { lotes: [{ id: 1, nome: 'Lote Sem Pasto', status: 'ativo', ultima_pesagem: '2026-07-05' }] };
  const alertas = gerarAlertasUnificados(db, { agora: AGORA });
  const semPasto = alertaPorTipo(alertas, 'sem-pasto');
  assert.ok(semPasto, 'deveria gerar alerta de lote sem pasto (sem data por natureza)');
  assert.equal(semPasto.dataReferencia, null);
  assert.equal(semPasto.loteId, 1);
});

test('gerarAlertasUnificados alerta financeiro vencido traz dataReferencia e lote quando único (Sprint 12)', () => {
  // `listarContasFinanceiras` (hojeNaFazenda.js) usa `new Date()` interno,
  // não a opção `agora` — por isso este teste usa uma data relativa ao
  // "agora" real do momento em que os testes rodam, não à data fixa AGORA
  // usada no restante deste arquivo.
  const dataVencimento = hojeLocalISO(new Date(Date.now() - 3 * 864e5));

  const db = {
    lotes: [{ id: 9, nome: 'Lote Frete' }],
    movimentacoes_financeiras: [
      { id: 1, tipo: 'despesa', descricao: 'Frete', data_vencimento: dataVencimento, lote_id: 9 },
    ],
  };
  const alertas = gerarAlertasUnificados(db, {});
  const financeiro = alertaPorTipo(alertas, 'financeiro-vencido');
  assert.ok(financeiro, 'deveria gerar alerta financeiro vencido');
  assert.equal(financeiro.dataReferencia, dataVencimento);
  assert.equal(financeiro.loteId, 9);
  assert.equal(financeiro.loteNome, 'Lote Frete');
});

test('gerarAlertasUnificados preenche acaoSugerida em todos os principais tipos de alerta', () => {
  const db = {
    lotes: [
      { id: 1, nome: 'Lote A', status: 'ativo', saida: '2026-07-05' },
    ],
    estoque: [
      { id: 1, produto: 'Ração', data_validade: '2026-07-01', alerta_dias_antes: 5 },
    ],
    sanitario: [
      { id: 1, tipo: 'vacina', lote_id: 1, proxima: '2026-07-09', alerta_dias_antes: 5 },
      { id: 2, tipo: 'medicamento', lote_id: 1, data_fim_carencia: '2026-07-15' },
    ],
    tarefas: [
      { id: 1, titulo: 'Vacinar', status: 'pendente', data_vencimento: '2026-07-05', lote_id: 1 },
    ],
  };
  const alertas = gerarAlertasUnificados(db, { agora: AGORA });
  assert.ok(alertas.length > 0);
  alertas.forEach((alerta) => {
    assert.ok(String(alerta.acaoSugerida || '').trim().length > 0, `alerta "${alerta.tipo}" deveria ter acaoSugerida`);
  });
});

test('gerarAlertasUnificados não duplica alertas (ids únicos) mesmo com vários sinais simultâneos', () => {
  const db = {
    lotes: [
      { id: 1, nome: 'Lote A', status: 'ativo', saida: '2026-07-05' },
      { id: 2, nome: 'Lote B', status: 'ativo' },
    ],
    estoque: [
      { id: 1, produto: 'Ração', data_validade: '2026-07-01', alerta_dias_antes: 5 },
    ],
    sanitario: [
      { id: 1, tipo: 'medicamento', lote_id: 1, data_fim_carencia: '2026-07-15' },
    ],
    tarefas: [
      { id: 1, titulo: 'Vacinar', status: 'pendente', data_vencimento: '2026-07-10', lote_id: 2 },
    ],
  };
  const alertas = gerarAlertasUnificados(db, { agora: AGORA });
  const ids = alertas.map((alerta) => alerta.id);
  assert.equal(new Set(ids).size, ids.length, 'não deveria haver ids duplicados');
});
