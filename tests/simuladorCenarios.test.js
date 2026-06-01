import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularProjecaoCenario } from '../src/domain/simuladorCenarios.js';

function makeDb() {
  return {
    pastagens: [{ id: 1, area_ha: 100, capacidade_suporte_ua_ha: 1.2 }],
    lotes: [{ id: 1, nome: 'Lote A', p_at: 450, rendimento_carcaca: 52 }],
    animais: [{ id: 1, lote_id: 1, qtd: 100, p_at: 450, status: 'ativo' }],
    pesagens: [],
    movimentacoes_animais: [],
    movimentacoes_financeiras: [
      { id: 1, tipo: 'receita', valor: 10000, data: '2026-01-10', lote_id: 1 },
      { id: 2, tipo: 'despesa', valor: 6000, data: '2026-01-11', lote_id: 1 },
    ],
  };
}

test('calcularProjecaoCenario calcula estoque e margem projetada com seguranca', () => {
  const db = makeDb();
  const cenario = {
    compras_simuladas: 10,
    vendas_simuladas: 20,
    mortalidade_pct: 2,
    natalidade_pct: 5,
    valor_medio_venda: 2000,
    custo_medio_compra: 1200,
    capacidade_suporte_ua: 140,
    area_pastagem_ha: 100,
  };

  const result = calcularProjecaoCenario(db, '2026-01-01', '2026-01-31', cenario);
  assert.equal(result.projecao.estoque_final_projetado, 93);
  assert.equal(result.projecao.receita_projetada, 50000);
  assert.equal(result.projecao.custo_projetado, 18000);
  assert.equal(result.projecao.margem_bruta_projetada, 32000);
  assert.equal(Number.isFinite(result.projecao.ua_projetada), true);
  assert.equal(result.projecao.status_capacidade, 'dentro_da_capacidade');
});

