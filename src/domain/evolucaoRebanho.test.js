import test from 'node:test';
import assert from 'node:assert/strict';
import { computeEvolucaoRebanho } from './evolucaoRebanho.js';

// Seção 8 (auditoria lote.qtd) — o "Ajuste de lotação" (Seção 2) grava
// movimentacoes_animais tipo 'ajuste' com qtd JÁ ASSINADA (positiva ou
// negativa), diferente dos demais tipos (sempre positivos, sinal decidido
// pelo tipo). Sem suporte a esse tipo, o evento era silenciosamente
// ignorado e a evolução do rebanho divergia de lote.qtd.

function makeDb(movimentacoes) {
  return { animais: [], movimentacoes_animais: movimentacoes };
}

test('ajuste negativo (recontagem para baixo) entra no resumo e reduz o estoque final', () => {
  const db = makeDb([
    { id: 1, tipo: 'ajuste', qtd: -4, data: '2026-07-05', lote_id: 1, obs: 'Recontagem física (82 → 78 cabeças)' },
  ]);
  const { resumo, movimentosPeriodo } = computeEvolucaoRebanho(db, '2026-07-01', '2026-07-31');
  assert.equal(resumo.ajustes, -4);
  assert.equal(resumo.variacao_inventario, -4);
  assert.equal(movimentosPeriodo.length, 1);
  assert.equal(movimentosPeriodo[0].delta, -4);
  assert.equal(movimentosPeriodo[0].qtd, 4, 'qtd exibida é o valor absoluto');
});

test('ajuste positivo (animal esquecido no cadastro) aumenta o estoque final', () => {
  const db = makeDb([
    { id: 1, tipo: 'ajuste', qtd: 3, data: '2026-07-05', lote_id: 1, obs: 'Animal não registrado' },
  ]);
  const { resumo } = computeEvolucaoRebanho(db, '2026-07-01', '2026-07-31');
  assert.equal(resumo.ajustes, 3);
  assert.equal(resumo.variacao_inventario, 3);
});

test('ajuste fora do período ainda afeta o estoque_final via netAfterEnd', () => {
  const db = makeDb([
    { id: 1, tipo: 'ajuste', qtd: -4, data: '2026-08-15', lote_id: 1 }, // depois do período
  ]);
  const { resumo } = computeEvolucaoRebanho(db, '2026-07-01', '2026-07-31');
  // o ajuste não entra no resumo do período (não é 'within'), mas influencia
  // o estoque_final via netAfterEnd (estoqueAtual - netAfterEnd):
  assert.equal(resumo.ajustes, 0);
  assert.equal(resumo.estoque_final, 0 - (-4)); // estoqueAtual (0, sem animais) - (-4)
});

test('venda/morte continuam funcionando normalmente ao lado de um ajuste', () => {
  const db = makeDb([
    { id: 1, tipo: 'compra', qtd: 50, data: '2026-07-01' },
    { id: 2, tipo: 'venda', qtd: 10, data: '2026-07-10' },
    { id: 3, tipo: 'ajuste', qtd: -2, data: '2026-07-15', obs: 'Correção de contagem' },
  ]);
  const { resumo } = computeEvolucaoRebanho(db, '2026-07-01', '2026-07-31');
  assert.equal(resumo.compras, 50);
  assert.equal(resumo.vendas, 10);
  assert.equal(resumo.ajustes, -2);
  assert.equal(resumo.variacao_inventario, 50 - 10 - 2);
});
