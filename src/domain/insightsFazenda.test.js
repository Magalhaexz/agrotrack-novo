import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIAS_TIPOS_DECISAO,
  SAUDE_FAZENDA,
  agruparAlertasPorTipo,
  construirInsightsFazenda,
  construirResumoTextoInsights,
  listarAtencaoImediata,
} from './insightsFazenda.js';

const AGORA = new Date('2026-07-02T12:00:00Z');
function diasAtrasDe(agora, dias) {
  const data = new Date(agora);
  data.setUTCDate(data.getUTCDate() - dias);
  return data.toISOString().slice(0, 10);
}

function tarefaAtrasada(dias, prioridade = 'media') {
  return {
    tarefas: [{ id: 1, titulo: 'Tarefa de teste', status: 'pendente', prioridade, data_vencimento: diasAtrasDe(AGORA, dias) }],
  };
}

test('construirInsightsFazenda em conta vazia retorna saúde ótima e nenhum alerta', () => {
  const insights = construirInsightsFazenda({}, AGORA);
  assert.equal(insights.totalAlertas, 0);
  assert.equal(insights.saude, SAUDE_FAZENDA.OTIMA);
  assert.deepEqual(insights.topAlertas, []);
  assert.deepEqual(insights.alertas, []);
});

test('construirInsightsFazenda marca saúde crítica quando há alerta crítico', () => {
  const insights = construirInsightsFazenda(tarefaAtrasada(10), AGORA);
  assert.equal(insights.saude, SAUDE_FAZENDA.CRITICA);
  assert.equal(insights.porSeveridade.critico, 1);
  assert.equal(insights.totalAlertas, 1);
});

test('construirInsightsFazenda marca saúde de atenção quando o pior alerta é alto', () => {
  const insights = construirInsightsFazenda(tarefaAtrasada(3), AGORA);
  assert.equal(insights.saude, SAUDE_FAZENDA.ATENCAO);
  assert.equal(insights.porSeveridade.alto, 1);
  assert.equal(insights.porSeveridade.critico, 0);
});

test('construirInsightsFazenda marca saúde boa quando o pior alerta é médio ou baixo', () => {
  const insights = construirInsightsFazenda(tarefaAtrasada(1), AGORA);
  assert.equal(insights.saude, SAUDE_FAZENDA.BOA);
  assert.equal(insights.porSeveridade.medio, 1);
});

test('construirInsightsFazenda agrupa por tipo e limita topAlertas a 5', () => {
  const db = {
    tarefas: [
      { id: 1, titulo: 'T1', status: 'pendente', data_vencimento: diasAtrasDe(AGORA, 10) },
      { id: 2, titulo: 'T2', status: 'pendente', data_vencimento: diasAtrasDe(AGORA, 9) },
      { id: 3, titulo: 'T3', status: 'pendente', data_vencimento: diasAtrasDe(AGORA, 8) },
    ],
    estoque: [
      { id: 1, produto: 'Sal mineral', quantidade_atual: 0 },
      { id: 2, produto: 'Ração', quantidade_atual: 0 },
      { id: 3, produto: 'Vacina X', quantidade_atual: 0 },
    ],
  };
  const insights = construirInsightsFazenda(db, AGORA);
  assert.equal(insights.totalAlertas, 6);
  assert.equal(insights.porTipo.tarefa, 3);
  assert.equal(insights.porTipo.estoque, 3);
  assert.equal(insights.topAlertas.length, 5);
});

test('construirResumoTextoInsights descreve "nenhum alerta" quando a fazenda está em dia', () => {
  const insights = construirInsightsFazenda({}, AGORA);
  const resumo = construirResumoTextoInsights(insights);
  assert.equal(resumo.length, 1);
  assert.match(resumo[0], /Nenhum alerta pendente/);
});

test('construirResumoTextoInsights resume quantidade por severidade em texto', () => {
  const db = {
    tarefas: [
      { id: 1, titulo: 'Crítica', status: 'pendente', data_vencimento: diasAtrasDe(AGORA, 10) },
      { id: 2, titulo: 'Alta', status: 'pendente', data_vencimento: diasAtrasDe(AGORA, 3) },
    ],
  };
  const insights = construirInsightsFazenda(db, AGORA);
  const resumo = construirResumoTextoInsights(insights);
  assert.equal(resumo.length, 1);
  assert.match(resumo[0], /2 alertas encontrados: 1 crítico, 1 de alta prioridade\./);
});

test('construirResumoTextoInsights não quebra com insights indefinido', () => {
  assert.deepEqual(construirResumoTextoInsights(undefined), ['Nenhum alerta pendente. A fazenda está em dia.']);
});

// ─── agrupamento por tipo (Sprint 2 — "Decisões da Fazenda") ────────────────

function alerta(tipo, severidade, id = `${tipo}-${severidade}`) {
  return { id, tipo, severidade, titulo: id, descricao: '', entidade: {}, acaoSugerida: '', pagina: '' };
}

test('agruparAlertasPorTipo separa os alertas nas categorias esperadas e preserva a ordem', () => {
  const alertas = [
    alerta('gmd', 'critico', 'g1'),
    alerta('estoque', 'critico', 'e1'),
    alerta('gmd', 'medio', 'g2'),
    alerta('peso_alvo', 'alto', 'p1'),
  ];
  const grupos = agruparAlertasPorTipo(alertas);
  assert.deepEqual(Object.keys(grupos), CATEGORIAS_TIPOS_DECISAO);
  assert.deepEqual(grupos.gmd.map((a) => a.id), ['g1', 'g2']);
  assert.deepEqual(grupos.estoque.map((a) => a.id), ['e1']);
  assert.deepEqual(grupos.peso_alvo.map((a) => a.id), ['p1']);
  assert.deepEqual(grupos.sanidade, []);
  assert.deepEqual(grupos.tarefa, []);
  assert.deepEqual(grupos.custo, []);
});

test('agruparAlertasPorTipo não quebra com lista vazia ou indefinida', () => {
  const vazio = agruparAlertasPorTipo([]);
  CATEGORIAS_TIPOS_DECISAO.forEach((tipo) => assert.deepEqual(vazio[tipo], []));
  const indefinido = agruparAlertasPorTipo(undefined);
  CATEGORIAS_TIPOS_DECISAO.forEach((tipo) => assert.deepEqual(indefinido[tipo], []));
});

// ─── atenção imediata (Sprint 2) ────────────────────────────────────────────

test('listarAtencaoImediata inclui apenas crítico/alto e exclui oportunidades (peso_alvo)', () => {
  const alertas = [
    alerta('gmd', 'critico', 'g1'),
    alerta('peso_alvo', 'alto', 'p1'),
    alerta('estoque', 'alto', 'e1'),
    alerta('tarefa', 'medio', 't1'),
    alerta('sanidade', 'baixo', 's1'),
  ];
  const resultado = listarAtencaoImediata(alertas);
  assert.deepEqual(resultado.map((a) => a.id), ['g1', 'e1']);
});

test('listarAtencaoImediata respeita o limite e não quebra com lista vazia', () => {
  const alertas = Array.from({ length: 8 }, (_, i) => alerta('gmd', 'critico', `g${i}`));
  assert.equal(listarAtencaoImediata(alertas).length, 5);
  assert.equal(listarAtencaoImediata(alertas, 2).length, 2);
  assert.deepEqual(listarAtencaoImediata([]), []);
  assert.deepEqual(listarAtencaoImediata(undefined), []);
});

test('listarAtencaoImediata mantém a ordem de prioridade já calculada pelo motor', () => {
  const db = {
    tarefas: [
      { id: 1, titulo: 'Tarefa crítica', status: 'pendente', data_vencimento: diasAtrasDe(AGORA, 10) },
      { id: 2, titulo: 'Tarefa alta', status: 'pendente', data_vencimento: diasAtrasDe(AGORA, 3) },
    ],
    estoque: [{ id: 1, produto: 'Sal mineral', quantidade_atual: 0 }],
  };
  const insights = construirInsightsFazenda(db, AGORA);
  const resultado = listarAtencaoImediata(insights.alertas);
  assert.equal(resultado.length, 3);
  assert.equal(resultado[0].severidade, 'critico');
});
