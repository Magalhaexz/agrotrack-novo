import test from 'node:test';
import assert from 'node:assert/strict';
import { construirChecklistPrimeirosPassos } from '../src/domain/guiaCriador.js';

function itemPorId(checklist, id) {
  return checklist.itens.find((item) => item.id === id);
}

test('conta vazia: nenhum item concluído e próximo passo é cadastrar fazenda', () => {
  const checklist = construirChecklistPrimeirosPassos({});
  assert.equal(checklist.totalConcluido, 0);
  assert.equal(checklist.concluido, false);
  assert.equal(checklist.proximoPasso.id, 'fazenda');
  assert.equal(itemPorId(checklist, 'fazenda').concluido, false);
});

test('conta com fazenda: marca "fazenda" concluído e sugere "pastos" como próximo passo', () => {
  const db = { fazendas: [{ id: 1, nome: 'Fazenda A' }] };
  const checklist = construirChecklistPrimeirosPassos(db);
  assert.equal(itemPorId(checklist, 'fazenda').concluido, true);
  assert.equal(checklist.proximoPasso.id, 'pastos');
});

test('conta com fazenda e pastos: marca os dois itens e segue para lotes', () => {
  const db = {
    fazendas: [{ id: 1, nome: 'Fazenda A' }],
    pastagens: [{ id: 1, nome: 'Pasto 1' }],
  };
  const checklist = construirChecklistPrimeirosPassos(db);
  assert.equal(itemPorId(checklist, 'fazenda').concluido, true);
  assert.equal(itemPorId(checklist, 'pastos').concluido, true);
  assert.equal(checklist.proximoPasso.id, 'lotes');
});

test('conta com lotes ativos: marca "lotes" concluído; lote inativo não conta', () => {
  const db = {
    lotes: [
      { id: 1, status: 'ativo' },
      { id: 2, status: 'encerrado' },
    ],
  };
  const checklist = construirChecklistPrimeirosPassos(db);
  assert.equal(itemPorId(checklist, 'lotes').concluido, true);

  const dbSoInativo = { lotes: [{ id: 2, status: 'encerrado' }] };
  const checklistInativo = construirChecklistPrimeirosPassos(dbSoInativo);
  assert.equal(itemPorId(checklistInativo, 'lotes').concluido, false);
});

test('conta com pesagens: marca "pesagens" concluído', () => {
  const db = { pesagens: [{ id: 1, lote_id: 1, peso_medio: 300 }] };
  const checklist = construirChecklistPrimeirosPassos(db);
  assert.equal(itemPorId(checklist, 'pesagens').concluido, true);
});

test('conta com financeiro: marca "financeiro" concluído', () => {
  const db = { movimentacoes_financeiras: [{ id: 1, tipo: 'receita', valor: 100 }] };
  const checklist = construirChecklistPrimeirosPassos(db);
  assert.equal(itemPorId(checklist, 'financeiro').concluido, true);
});

test('"hoje" só conclui com fazenda e lote ativo juntos; "relatorios" só com pesagem e financeiro juntos', () => {
  const dbParcial = {
    fazendas: [{ id: 1 }],
    pesagens: [{ id: 1 }],
  };
  const checklistParcial = construirChecklistPrimeirosPassos(dbParcial);
  assert.equal(itemPorId(checklistParcial, 'hoje').concluido, false);
  assert.equal(itemPorId(checklistParcial, 'relatorios').concluido, false);

  const dbCompleto = {
    fazendas: [{ id: 1 }],
    lotes: [{ id: 1, status: 'ativo' }],
    pesagens: [{ id: 1 }],
    movimentacoes_financeiras: [{ id: 1, tipo: 'receita', valor: 100 }],
  };
  const checklistCompleto = construirChecklistPrimeirosPassos(dbCompleto);
  assert.equal(itemPorId(checklistCompleto, 'hoje').concluido, true);
  assert.equal(itemPorId(checklistCompleto, 'relatorios').concluido, true);
});

test('próximo passo sugerido é sempre o primeiro item ainda não concluído, na ordem do checklist', () => {
  const db = {
    fazendas: [{ id: 1 }],
    pastagens: [{ id: 1 }],
    lotes: [{ id: 1, status: 'ativo' }],
  };
  const checklist = construirChecklistPrimeirosPassos(db);
  assert.equal(checklist.proximoPasso.id, 'pesagens');
});

test('checklist completo: concluido=true e proximoPasso=null', () => {
  const db = {
    fazendas: [{ id: 1 }],
    pastagens: [{ id: 1 }],
    lotes: [{ id: 1, status: 'ativo' }],
    pesagens: [{ id: 1 }],
    movimentacoes_financeiras: [{ id: 1, tipo: 'receita', valor: 100 }],
  };
  const checklist = construirChecklistPrimeirosPassos(db);
  assert.equal(checklist.concluido, true);
  assert.equal(checklist.proximoPasso, null);
  assert.equal(checklist.totalConcluido, checklist.totalItens);
});

test('não quebra com db nulo, undefined ou com coleções nulas', () => {
  assert.doesNotThrow(() => construirChecklistPrimeirosPassos());
  assert.doesNotThrow(() => construirChecklistPrimeirosPassos(null));
  assert.doesNotThrow(() => construirChecklistPrimeirosPassos(undefined));

  const checklist = construirChecklistPrimeirosPassos({
    fazendas: null,
    pastagens: undefined,
    lotes: null,
    pesagens: null,
    movimentacoes_financeiras: null,
  });
  assert.equal(checklist.totalConcluido, 0);
  assert.equal(checklist.proximoPasso.id, 'fazenda');
});
