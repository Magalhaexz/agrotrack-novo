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
