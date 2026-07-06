import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classificarPrazo,
  sugerirAcao,
  normalizarAlertaCentral,
  filtrarAlertasCentral,
  ordenarAlertasCentral,
  resumirCentralAlertas,
  PRAZO,
} from './centralAlertas.js';

const HOJE = new Date('2026-07-10T12:00:00Z');

function alerta(overrides = {}) {
  return {
    id: 'unificado-teste-1',
    tipo: 'estoque',
    prioridade: 'atencao',
    origem: 'estoque',
    titulo: 'Alerta de teste',
    descricao: 'Descrição de teste',
    acaoSugerida: 'Ação original do motor',
    pageId: 'estoque',
    dataReferencia: null,
    ...overrides,
  };
}

test('classificarPrazo usa dataReferencia quando presente', () => {
  assert.equal(classificarPrazo(alerta({ dataReferencia: '2026-07-05' }), HOJE), PRAZO.VENCIDO);
  assert.equal(classificarPrazo(alerta({ dataReferencia: '2026-07-10' }), HOJE), PRAZO.HOJE);
  assert.equal(classificarPrazo(alerta({ dataReferencia: '2026-07-14' }), HOJE), PRAZO.PROXIMOS_7_DIAS);
  assert.equal(classificarPrazo(alerta({ dataReferencia: '2026-07-30' }), HOJE), PRAZO.PROXIMOS_30_DIAS);
  assert.equal(classificarPrazo(alerta({ dataReferencia: '2026-12-01' }), HOJE), PRAZO.SEM_PRAZO);
});

test('classificarPrazo cai para o mapa por tipo quando não há dataReferencia', () => {
  assert.equal(classificarPrazo(alerta({ tipo: 'financeiro-vencido', prioridade: 'critico' }), HOJE), PRAZO.VENCIDO);
  assert.equal(classificarPrazo(alerta({ tipo: 'financeiro-vence-hoje' }), HOJE), PRAZO.HOJE);
  assert.equal(classificarPrazo(alerta({ tipo: 'lote-saida-proxima' }), HOJE), PRAZO.PROXIMOS_7_DIAS);
  assert.equal(classificarPrazo(alerta({ tipo: 'estoque-validade-proxima' }), HOJE), PRAZO.PROXIMOS_30_DIAS);
});

test('classificarPrazo cai para prioridade quando tipo é desconhecido/sem data', () => {
  assert.equal(classificarPrazo(alerta({ tipo: 'gmd', prioridade: 'critico' }), HOJE), PRAZO.VENCIDO);
  assert.equal(classificarPrazo(alerta({ tipo: 'gmd', prioridade: 'atencao' }), HOJE), PRAZO.SEM_PRAZO);
});

test('normalizarAlertaCentral não quebra com alerta incompleto/legado', () => {
  const normalizado = normalizarAlertaCentral({}, { hoje: HOJE });
  assert.equal(normalizado.titulo, 'Alerta do sistema');
  assert.equal(normalizado.origem, 'geral');
  assert.equal(normalizado.loteId, null);
  assert.equal(normalizado.loteNome, null);
  assert.equal(typeof normalizado.acaoRecomendada, 'string');
  assert.ok(normalizado.acaoRecomendada.length > 0);
  assert.deepEqual(normalizado.alertaOriginal, {});

  const semCampos = normalizarAlertaCentral(null, { hoje: HOJE });
  assert.equal(semCampos.titulo, 'Alerta do sistema');
  assert.equal(semCampos.alertaOriginal, null);
});

test('normalizarAlertaCentral preserva o alerta original e deriva pesoDecisao', () => {
  const original = alerta({ prioridade: 'critico', tipo: 'financeiro-vencido' });
  const normalizado = normalizarAlertaCentral(original, { hoje: HOJE });
  assert.deepEqual(normalizado.alertaOriginal, original);
  assert.equal(normalizado.prazoCategoria, PRAZO.VENCIDO);
  assert.equal(normalizado.pesoDecisao, 100 + 30);
});

test('normalizarAlertaCentral só vincula lote quando exatamente um nome bate', () => {
  const lotes = [{ id: 1, nome: 'Lote A' }, { id: 2, nome: 'Lote B' }];

  const umLote = normalizarAlertaCentral(alerta({ descricao: 'Lote A está sem pesagem' }), { hoje: HOJE, lotes });
  assert.equal(umLote.loteId, 1);
  assert.equal(umLote.loteNome, 'Lote A');

  const doisLotes = normalizarAlertaCentral(alerta({ descricao: 'Lote A · Lote B' }), { hoje: HOJE, lotes });
  assert.equal(doisLotes.loteId, null);

  const nenhumLote = normalizarAlertaCentral(alerta({ descricao: 'Sem menção a lote' }), { hoje: HOJE, lotes });
  assert.equal(nenhumLote.loteId, null);
});

test('sugerirAcao prefere acaoSugerida existente e só sintetiza no que falta', () => {
  assert.equal(sugerirAcao(alerta({ acaoSugerida: 'Texto do motor' })), 'Texto do motor');
  assert.equal(sugerirAcao(alerta({ acaoSugerida: '', origem: 'sanidade', tipo: 'carencia-ativa' })), 'Verificar carência antes de movimentar ou vender animais.');
  assert.equal(sugerirAcao(alerta({ acaoSugerida: '', origem: 'sanidade', tipo: 'sanidade' })), 'Reprogramar manejo e registrar execução.');
  assert.equal(sugerirAcao(alerta({ acaoSugerida: '', origem: 'estoque', tipo: 'estoque' })), 'Avaliar compra ou reposição do insumo.');
  assert.equal(sugerirAcao(alerta({ acaoSugerida: '', origem: 'financeiro', tipo: 'financeiro-vencido' })), 'Conferir pagamento e regularizar lançamento.');
  assert.equal(sugerirAcao(alerta({ acaoSugerida: '', origem: 'rebanho', tipo: 'gmd' })), 'Revisar desempenho do lote e investigar manejo/nutrição.');
  assert.equal(sugerirAcao(alerta({ acaoSugerida: '', origem: 'algo-novo', tipo: 'x' })), 'Analisar ocorrência e definir responsável pela tratativa.');
});

function construirLista() {
  return [
    normalizarAlertaCentral(alerta({ id: 'a1', origem: 'financeiro', prioridade: 'critico', tipo: 'financeiro-vencido', titulo: 'Conta vencida' }), { hoje: HOJE }),
    normalizarAlertaCentral(alerta({ id: 'a2', origem: 'estoque', prioridade: 'atencao', tipo: 'estoque', titulo: 'Estoque baixo de ração' }), { hoje: HOJE }),
    normalizarAlertaCentral(alerta({ id: 'a3', origem: 'rebanho', prioridade: 'atencao', tipo: 'gmd', titulo: 'Lote X abaixo do GMD', descricao: 'Lote X' }), { hoje: HOJE, lotes: [{ id: 9, nome: 'Lote X' }] }),
    normalizarAlertaCentral(alerta({ id: 'a4', origem: 'decisao', prioridade: 'decisao', tipo: 'pronto-venda', titulo: 'Lote pronto para venda' }), { hoje: HOJE }),
  ];
}

test('filtrarAlertasCentral filtra por origem, prioridade, lote e texto livre', () => {
  const lista = construirLista();

  assert.equal(filtrarAlertasCentral(lista, { origem: 'estoque' }).length, 1);
  assert.equal(filtrarAlertasCentral(lista, { prioridade: 'atencao' }).length, 2);
  assert.equal(filtrarAlertasCentral(lista, { loteId: 9 }).length, 1);
  assert.equal(filtrarAlertasCentral(lista, { loteNome: 'Lote X' }).length, 1);
  assert.equal(filtrarAlertasCentral(lista, { busca: 'ração' }).length, 1);
  assert.equal(filtrarAlertasCentral(lista, { somenteCriticos: true }).length, 1);
  assert.equal(filtrarAlertasCentral(lista, { origem: 'estoque', prioridade: 'critico' }).length, 0);
});

test('resumirCentralAlertas conta por origem/prioridade e por prazo', () => {
  const lista = construirLista();
  const resumo = resumirCentralAlertas(lista);
  assert.equal(resumo.total, 4);
  assert.equal(resumo.criticos, 1);
  assert.equal(resumo.porOrigem.estoque, 1);
  assert.equal(resumo.porPrioridade.atencao, 2);
});

test('ordenarAlertasCentral ordena por prioridade e depois por prazo', () => {
  const lista = [
    normalizarAlertaCentral(alerta({ id: 'baixa', prioridade: 'informativo' }), { hoje: HOJE }),
    normalizarAlertaCentral(alerta({ id: 'critica', prioridade: 'critico', tipo: 'financeiro-vencido' }), { hoje: HOJE }),
    normalizarAlertaCentral(alerta({ id: 'atencao-hoje', prioridade: 'atencao', tipo: 'financeiro-vence-hoje' }), { hoje: HOJE }),
    normalizarAlertaCentral(alerta({ id: 'atencao-7-dias', prioridade: 'atencao', tipo: 'financeiro-vence-7-dias' }), { hoje: HOJE }),
  ];

  const ordenado = ordenarAlertasCentral(lista);
  assert.deepEqual(ordenado.map((a) => a.id), ['critica', 'atencao-hoje', 'atencao-7-dias', 'baixa']);
});

// ── Sprint 12 — campos estruturados vindos do motor único ───────────────────

test('normalizarAlertaCentral prioriza loteId/loteNome/dataReferencia/acaoSugerida vindos do alerta', () => {
  const original = alerta({
    loteId: 42,
    loteNome: 'Lote Estruturado',
    dataReferencia: '2026-07-05',
    acaoSugerida: 'Ação vinda do motor único',
    descricao: 'Nenhum nome de lote aparece aqui',
  });
  // Sem `opcoes.lotes` — a heurística de texto nem teria como achar o lote
  // pela descrição; ainda assim loteId/loteNome vêm preenchidos direto do alerta.
  const normalizado = normalizarAlertaCentral(original, { hoje: HOJE });
  assert.equal(normalizado.loteId, 42);
  assert.equal(normalizado.loteNome, 'Lote Estruturado');
  assert.equal(normalizado.dataReferencia, '2026-07-05');
  assert.equal(normalizado.prazoCategoria, PRAZO.VENCIDO);
  assert.equal(normalizado.acaoRecomendada, 'Ação vinda do motor único');
});

test('normalizarAlertaCentral cai para fallback quando alerta legado não tem loteId/loteNome/dataReferencia', () => {
  const legado = { id: 'legado-1', tipo: 'estoque', prioridade: 'atencao', origem: 'estoque', titulo: 'Alerta legado', descricao: 'Sem campos novos' };
  const normalizado = normalizarAlertaCentral(legado, { hoje: HOJE });
  assert.equal(normalizado.loteId, null);
  assert.equal(normalizado.loteNome, null);
  assert.equal(normalizado.dataReferencia, null);
  assert.equal(normalizado.prazoCategoria, PRAZO.SEM_PRAZO);
  assert.ok(normalizado.acaoRecomendada);
});

test('normalizarAlertaCentral não quebra com dataReferencia inválida', () => {
  const normalizado = normalizarAlertaCentral(alerta({ dataReferencia: 'data-invalida' }), { hoje: HOJE });
  assert.equal(normalizado.dataReferencia, null);
  assert.equal(normalizado.prazoCategoria, PRAZO.SEM_PRAZO);
});

test('filtrarAlertasCentral filtra por loteId e loteNome estruturados (sem depender de heurística de texto)', () => {
  const lista = [
    normalizarAlertaCentral(alerta({ id: 'l1', loteId: 5, loteNome: 'Lote Cinco' }), { hoje: HOJE }),
    normalizarAlertaCentral(alerta({ id: 'l2', loteId: 6, loteNome: 'Lote Seis' }), { hoje: HOJE }),
  ];
  assert.deepEqual(filtrarAlertasCentral(lista, { loteId: 5 }).map((a) => a.id), ['l1']);
  assert.deepEqual(filtrarAlertasCentral(lista, { loteNome: 'Lote Seis' }).map((a) => a.id), ['l2']);
});

test('filtrarAlertasCentral filtra por prazo usando dataReferencia real', () => {
  const lista = [
    normalizarAlertaCentral(alerta({ id: 'vencido', dataReferencia: '2026-07-05' }), { hoje: HOJE }),
    normalizarAlertaCentral(alerta({ id: 'proximo', dataReferencia: '2026-07-12' }), { hoje: HOJE }),
  ];
  assert.deepEqual(filtrarAlertasCentral(lista, { prazoCategoria: PRAZO.VENCIDO }).map((a) => a.id), ['vencido']);
  assert.deepEqual(filtrarAlertasCentral(lista, { prazoCategoria: PRAZO.PROXIMOS_7_DIAS }).map((a) => a.id), ['proximo']);
});

test('resumirCentralAlertas conta vencidos/vencendo hoje/próximos 7 dias a partir de dataReferencia real', () => {
  const lista = [
    normalizarAlertaCentral(alerta({ id: 'v1', dataReferencia: '2026-07-01' }), { hoje: HOJE }),
    normalizarAlertaCentral(alerta({ id: 'v2', dataReferencia: '2026-07-08' }), { hoje: HOJE }),
    normalizarAlertaCentral(alerta({ id: 'hoje1', dataReferencia: '2026-07-10' }), { hoje: HOJE }),
    normalizarAlertaCentral(alerta({ id: 'prox1', dataReferencia: '2026-07-15' }), { hoje: HOJE }),
  ];
  const resumo = resumirCentralAlertas(lista);
  assert.equal(resumo.vencidos, 2);
  assert.equal(resumo.vencendoHoje, 1);
  assert.equal(resumo.proximos7Dias, 1);
});

test('ordenarAlertasCentral usa dataReferencia real como desempate — vencido mais antigo primeiro', () => {
  const lista = [
    normalizarAlertaCentral(alerta({ id: 'vencido-recente', prioridade: 'critico', dataReferencia: '2026-07-09' }), { hoje: HOJE }),
    normalizarAlertaCentral(alerta({ id: 'vencido-antigo', prioridade: 'critico', dataReferencia: '2026-07-01' }), { hoje: HOJE }),
  ];
  const ordenado = ordenarAlertasCentral(lista);
  assert.deepEqual(ordenado.map((a) => a.id), ['vencido-antigo', 'vencido-recente']);
});
