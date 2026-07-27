import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveTipoPesagem,
  resolverUltimaPesagemLote,
  recalcularPesoAtualLote,
  calcularPesoMedioIndividual,
} from './pesagensLote.js';

test('resolveTipoPesagem distingue lote de animal', () => {
  assert.equal(resolveTipoPesagem({ tipo: 'animal' }), 'animal');
  assert.equal(resolveTipoPesagem({ origem: 'animal' }), 'animal');
  assert.equal(resolveTipoPesagem({}), 'lote');
  assert.equal(resolveTipoPesagem({ tipo: 'lote' }), 'lote');
});

test('resolverUltimaPesagemLote pega a mais recente por data, empate por id maior', () => {
  const pesagens = [
    { id: 1, data: '2026-07-01', peso_medio: 300 },
    { id: 2, data: '2026-07-10', peso_medio: 320 },
    { id: 3, data: '2026-07-10', peso_medio: 325 },
  ];
  const r = resolverUltimaPesagemLote(pesagens);
  assert.equal(r.id, 3);
});

test('resolverUltimaPesagemLote retorna null para lista vazia', () => {
  assert.equal(resolverUltimaPesagemLote([]), null);
});

test('recalcularPesoAtualLote usa a última pesagem de lote', () => {
  const db = { animais: [] };
  const pesagens = [
    { id: 1, lote_id: 10, data: '2026-07-01', peso_medio: 300 },
    { id: 2, lote_id: 10, data: '2026-07-10', peso_medio: 320 },
  ];
  const r = recalcularPesoAtualLote(db, 10, pesagens);
  assert.equal(r.pesoAtual, 320);
  assert.equal(r.ultimaPesagem, '2026-07-10');
});

test('recalcularPesoAtualLote cai para média de animais quando não há pesagem de lote', () => {
  const db = { animais: [{ lote_id: 10, qtd: 2, p_at: 300 }, { lote_id: 10, qtd: 2, p_at: 340 }] };
  const r = recalcularPesoAtualLote(db, 10, []);
  assert.equal(r.pesoAtual, 320);
  assert.equal(r.ultimaPesagem, null);
});

test('recalcularPesoAtualLote ignora pesagens de outros lotes e de animal individual', () => {
  const db = { animais: [] };
  const pesagens = [
    { id: 1, lote_id: 99, data: '2026-07-15', peso_medio: 999 },
    { id: 2, lote_id: 10, tipo: 'animal', data: '2026-07-14', peso_medio: 111 },
    { id: 3, lote_id: 10, data: '2026-07-01', peso_medio: 300 },
  ];
  const r = recalcularPesoAtualLote(db, 10, pesagens);
  assert.equal(r.pesoAtual, 300);
});

test('calcularPesoMedioIndividual reproduz o exemplo da Sprint Funcional 15 (350/370/380 -> 366.67)', () => {
  const r = calcularPesoMedioIndividual([350, 370, 380]);
  assert.equal(r.soma, 1100);
  assert.equal(r.quantidade, 3);
  assert.equal(r.media, 366.67);
});

test('calcularPesoMedioIndividual retorna média null e zerado para lista vazia', () => {
  assert.deepEqual(calcularPesoMedioIndividual([]), { soma: 0, quantidade: 0, media: null });
  assert.deepEqual(calcularPesoMedioIndividual(undefined), { soma: 0, quantidade: 0, media: null });
});

test('calcularPesoMedioIndividual ignora vazio, não numérico, zero e negativo', () => {
  const r = calcularPesoMedioIndividual(['', null, undefined, NaN, 0, -50, '300']);
  assert.equal(r.quantidade, 1);
  assert.equal(r.soma, 300);
  assert.equal(r.media, 300);
});

test('calcularPesoMedioIndividual aceita vírgula decimal (entrada digitada)', () => {
  const r = calcularPesoMedioIndividual(['350,5', '370,25']);
  assert.equal(r.quantidade, 2);
  assert.equal(r.soma, 720.75);
  assert.equal(r.media, 360.38);
});

test('calcularPesoMedioIndividual com 1 cabeça', () => {
  const r = calcularPesoMedioIndividual([412.5]);
  assert.equal(r.quantidade, 1);
  assert.equal(r.media, 412.5);
});

test('calcularPesoMedioIndividual com 200 cabeças', () => {
  const pesos = Array.from({ length: 200 }, (_, i) => 300 + i);
  const r = calcularPesoMedioIndividual(pesos);
  assert.equal(r.quantidade, 200);
  assert.equal(r.soma, pesos.reduce((total, valor) => total + valor, 0));
});

test('calcularPesoMedioIndividual com 500 cabeças (mesmo peso)', () => {
  const pesos = Array.from({ length: 500 }, () => 350);
  const r = calcularPesoMedioIndividual(pesos);
  assert.equal(r.quantidade, 500);
  assert.equal(r.soma, 175000);
  assert.equal(r.media, 350);
});

// ── Revisão crítica pré-commit: mesma regra de recálculo usada pela RPC
// transacional (registrar_pesagem_individual/excluir_pesagem_individual, ver
// supabase/migrations/20260727120000_rpcs_transacionais_pesagem_individual.sql)
// — "order by data desc, id desc limit 1", nunca assume que o registro
// tocado por último é o mais recente. Estes testes exercitam a MESMA lógica
// em JS (recalcularPesoAtualLote); não substituem execução real da RPC contra
// Postgres, que não foi possível nesta sprint (sem branch/Docker disponível).
test('editar a pesagem MAIS RECENTE atualiza o peso atual do lote', () => {
  const db = { animais: [] };
  const antes = [
    { id: 1, lote_id: 10, data: '2026-07-01', peso_medio: 300 },
    { id: 2, lote_id: 10, data: '2026-07-10', peso_medio: 320 },
  ];
  assert.equal(recalcularPesoAtualLote(db, 10, antes).pesoAtual, 320);

  // Edita a pesagem id=2 (a mais recente), mesmo id, novo peso.
  const depois = antes.map((item) => (item.id === 2 ? { ...item, peso_medio: 335 } : item));
  const r = recalcularPesoAtualLote(db, 10, depois);
  assert.equal(r.pesoAtual, 335);
  assert.equal(r.ultimaPesagem, '2026-07-10');
});

test('editar uma pesagem ANTIGA não altera o peso atual quando existe uma posterior', () => {
  const db = { animais: [] };
  const antes = [
    { id: 1, lote_id: 10, data: '2026-07-01', peso_medio: 300 },
    { id: 2, lote_id: 10, data: '2026-07-10', peso_medio: 320 },
  ];
  // Edita a pesagem id=1 (mais antiga) — o peso atual do lote continua vindo
  // da id=2, que segue sendo a mais recente por data.
  const depois = antes.map((item) => (item.id === 1 ? { ...item, peso_medio: 999 } : item));
  const r = recalcularPesoAtualLote(db, 10, depois);
  assert.equal(r.pesoAtual, 320);
  assert.equal(r.ultimaPesagem, '2026-07-10');
});

test('excluir a pesagem MAIS RECENTE recupera a anterior como peso atual', () => {
  const db = { animais: [] };
  const antes = [
    { id: 1, lote_id: 10, data: '2026-07-01', peso_medio: 300 },
    { id: 2, lote_id: 10, data: '2026-07-10', peso_medio: 320 },
  ];
  // Exclusão = chamador filtra o registro fora da lista antes de recalcular.
  const depois = antes.filter((item) => item.id !== 2);
  const r = recalcularPesoAtualLote(db, 10, depois);
  assert.equal(r.pesoAtual, 300);
  assert.equal(r.ultimaPesagem, '2026-07-01');
});

test('excluir a ÚNICA pesagem do lote deixa o lote coerente (fallback dos animais, nunca erro/NaN)', () => {
  const dbComAnimais = { animais: [{ lote_id: 10, qtd: 1, p_at: 280 }] };
  const r1 = recalcularPesoAtualLote(dbComAnimais, 10, []);
  assert.equal(r1.pesoAtual, 280);
  assert.equal(r1.ultimaPesagem, null);

  // Sem nenhuma pesagem e sem nenhum animal no lote: cai em 0, nunca NaN.
  const dbVazio = { animais: [] };
  const r2 = recalcularPesoAtualLote(dbVazio, 10, []);
  assert.equal(r2.pesoAtual, 0);
  assert.equal(r2.ultimaPesagem, null);
});

test('duas pesagens de LOTE na mesma data continuam distintas (empate resolvido por id, nunca mescladas)', () => {
  // Regressão do risco identificado na revisão: duas pesagens do mesmo lote
  // no mesmo dia (dois eventos reais, ex. reponderação) não podem ser
  // tratadas como uma só — resolverUltimaPesagemLote precisa reportar
  // exatamente UM vencedor determinístico (maior id), preservando o outro
  // registro intacto na lista (nunca some).
  const pesagens = [
    { id: 10, lote_id: 1, data: '2026-07-20', peso_medio: 400 },
    { id: 11, lote_id: 1, data: '2026-07-20', peso_medio: 410 },
  ];
  const r = recalcularPesoAtualLote({ animais: [] }, 1, pesagens);
  assert.equal(r.pesoAtual, 410);
  const ultima = resolverUltimaPesagemLote(pesagens);
  assert.equal(ultima.id, 11);
  // O outro evento (id=10) continua presente na lista de entrada — nada foi
  // descartado ou fundido pela função de recálculo.
  assert.equal(pesagens.length, 2);
  assert.ok(pesagens.some((item) => item.id === 10 && item.peso_medio === 400));
});
