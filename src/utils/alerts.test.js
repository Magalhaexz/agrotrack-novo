import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildAlerts } from './alerts.js';
import { hojeLocalISO } from '../domain/dataCivil.js';

function isoRelativo(dias) {
  return hojeLocalISO(new Date(Date.now() + dias * 864e5));
}

const ONTEM = isoRelativo(-1);
const HA_50_DIAS = isoRelativo(-50);
const HA_35_DIAS = isoRelativo(-35);
const HA_2_DIAS = isoRelativo(-2);
const EM_2_DIAS = isoRelativo(2);
const EM_10_DIAS = isoRelativo(10);

describe('buildAlerts', () => {
  it('retorna array vazio para db vazio', () => {
    assert.deepEqual(buildAlerts({}), []);
  });

  it('retorna array vazio para db com listas vazias', () => {
    assert.deepEqual(buildAlerts({ estoque: [], lotes: [], pesagens: [] }), []);
  });

  // --- Estoque ---

  it('gera alerta crítico quando estoque está abaixo do mínimo', () => {
    const db = {
      estoque: [{ id: 1, produto: 'Sal', unidade: 'kg', quantidade_atual: 5, quantidade_minima: 10 }],
    };
    const alerts = buildAlerts(db);
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].nivel, 'critical');
    assert.equal(alerts[0].tipo, 'estoque');
    assert.equal(alerts[0].titulo, 'Estoque crítico');
    assert.ok(alerts[0].mensagem.includes('Sal'));
  });

  it('gera alerta warning quando estoque está entre mínimo e 1.5x mínimo', () => {
    const db = {
      estoque: [{ id: 2, produto: 'Ração', unidade: 'kg', quantidade_atual: 14, quantidade_minima: 10 }],
    };
    const alerts = buildAlerts(db);
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].nivel, 'warning');
    assert.equal(alerts[0].titulo, 'Estoque baixo');
  });

  it('não gera alerta quando estoque está acima de 1.5x o mínimo', () => {
    const db = {
      estoque: [{ id: 3, produto: 'Vacina', unidade: 'dose', quantidade_atual: 20, quantidade_minima: 10 }],
    };
    assert.deepEqual(buildAlerts(db), []);
  });

  it('gera alerta crítico para produto vencido', () => {
    const db = {
      estoque: [{ id: 4, produto: 'Vermífugo', unidade: 'ml', quantidade_atual: 50, quantidade_minima: 0, data_validade: ONTEM, alerta_dias_antes: 5 }],
    };
    const alerts = buildAlerts(db);
    const alertVencido = alerts.find((a) => a.titulo === 'Produto vencido no estoque');
    assert.ok(alertVencido, 'Deve gerar alerta de produto vencido');
    assert.equal(alertVencido.nivel, 'critical');
  });

  // --- Pesagem ---

  it('gera alerta crítico para lote ativo sem pesagem', () => {
    const db = {
      lotes: [{ id: 10, nome: 'Lote A', status: 'ativo' }],
      pesagens: [],
    };
    const alerts = buildAlerts(db);
    const alertPes = alerts.find((a) => a.tipo === 'pesagem');
    assert.ok(alertPes, 'Deve gerar alerta de pesagem');
    assert.equal(alertPes.nivel, 'critical');
    assert.equal(alertPes.titulo, 'Lote sem pesagem');
    assert.ok(alertPes.mensagem.includes('Lote A'));
  });

  it('gera alerta crítico para pesagem há mais de 45 dias', () => {
    const db = {
      lotes: [{ id: 11, nome: 'Lote B', status: 'ativo' }],
      pesagens: [{ id: 1, lote_id: 11, data: HA_50_DIAS }],
    };
    const alerts = buildAlerts(db);
    const alertPes = alerts.find((a) => a.tipo === 'pesagem');
    assert.ok(alertPes);
    assert.equal(alertPes.nivel, 'critical');
    assert.equal(alertPes.titulo, 'Pesagem muito atrasada');
  });

  it('gera alerta warning para pesagem há mais de 30 dias', () => {
    const db = {
      lotes: [{ id: 12, nome: 'Lote C', status: 'ativo' }],
      pesagens: [{ id: 2, lote_id: 12, data: HA_35_DIAS }],
    };
    const alerts = buildAlerts(db);
    const alertPes = alerts.find((a) => a.tipo === 'pesagem');
    assert.ok(alertPes);
    assert.equal(alertPes.nivel, 'warning');
    assert.equal(alertPes.titulo, 'Pesagem pendente');
  });

  it('não gera alerta de pesagem para lote inativo', () => {
    const db = {
      lotes: [{ id: 13, nome: 'Lote D', status: 'encerrado' }],
      pesagens: [],
    };
    const alerts = buildAlerts(db).filter((a) => a.tipo === 'pesagem');
    assert.equal(alerts.length, 0);
  });

  // --- Saída de Lote ---

  it('gera alerta crítico para saída de lote vencida', () => {
    const db = {
      lotes: [{ id: 20, nome: 'Lote Venda', status: 'ativo', saida: ONTEM }],
    };
    const alerts = buildAlerts(db);
    const alertLote = alerts.find((a) => a.tipo === 'lote');
    assert.ok(alertLote);
    assert.equal(alertLote.nivel, 'critical');
    assert.equal(alertLote.titulo, 'Saída de lote vencida');
  });

  it('gera alerta warning para saída de lote em até 7 dias', () => {
    const db = {
      lotes: [{ id: 21, nome: 'Lote Prox', status: 'ativo', saida: EM_2_DIAS }],
    };
    const alerts = buildAlerts(db);
    const alertLote = alerts.find((a) => a.tipo === 'lote');
    assert.ok(alertLote);
    assert.equal(alertLote.nivel, 'warning');
    assert.equal(alertLote.titulo, 'Saída de lote próxima');
  });

  it('não gera alerta de saída para lote com saída em mais de 7 dias', () => {
    const db = {
      lotes: [{ id: 22, nome: 'Lote Futuro', status: 'ativo', saida: EM_10_DIAS }],
    };
    const alerts = buildAlerts(db).filter((a) => a.tipo === 'lote');
    assert.equal(alerts.length, 0);
  });

  // --- Financeiro ---

  it('gera alerta crítico para despesa com vencimento passado', () => {
    const db = {
      movimentacoes_financeiras: [
        { id: 100, tipo: 'despesa', status: 'previsto', descricao: 'Ração bovina', valor: 3000, data_vencimento: HA_2_DIAS },
      ],
    };
    const alerts = buildAlerts(db);
    const alertFin = alerts.find((a) => a.tipo === 'financeiro');
    assert.ok(alertFin);
    assert.equal(alertFin.nivel, 'critical');
    assert.equal(alertFin.titulo, 'Pagamento vencido');
    assert.ok(alertFin.mensagem.includes('Ração bovina'));
  });

  it('gera alerta warning para despesa com vencimento em até 3 dias', () => {
    const db = {
      movimentacoes_financeiras: [
        { id: 101, tipo: 'despesa', status: 'previsto', descricao: 'Suplemento mineral', valor: 1500, data_vencimento: EM_2_DIAS },
      ],
    };
    const alerts = buildAlerts(db);
    const alertFin = alerts.find((a) => a.tipo === 'financeiro');
    assert.ok(alertFin);
    assert.equal(alertFin.nivel, 'warning');
    assert.equal(alertFin.titulo, 'Pagamento próximo do vencimento');
  });

  it('não gera alerta financeiro para despesa paga', () => {
    const db = {
      movimentacoes_financeiras: [
        { id: 102, tipo: 'despesa', status: 'pago', descricao: 'Vacina', valor: 500, data_vencimento: HA_2_DIAS },
      ],
    };
    const alerts = buildAlerts(db).filter((a) => a.tipo === 'financeiro');
    assert.equal(alerts.length, 0);
  });

  it('não gera alerta financeiro para receita vencida', () => {
    const db = {
      movimentacoes_financeiras: [
        { id: 103, tipo: 'receita', status: 'previsto', descricao: 'Venda de gado', valor: 50000, data_vencimento: HA_2_DIAS },
      ],
    };
    const alerts = buildAlerts(db).filter((a) => a.tipo === 'financeiro');
    assert.equal(alerts.length, 0);
  });

  it('não gera alerta financeiro para despesa cancelada', () => {
    const db = {
      movimentacoes_financeiras: [
        { id: 104, tipo: 'despesa', status: 'cancelado', descricao: 'Medicamento', valor: 200, data_vencimento: HA_2_DIAS },
      ],
    };
    const alerts = buildAlerts(db).filter((a) => a.tipo === 'financeiro');
    assert.equal(alerts.length, 0);
  });

  // --- Ordenação ---

  it('ordena alertas critical antes de warning', () => {
    const db = {
      estoque: [
        { id: 1, produto: 'A', unidade: 'kg', quantidade_atual: 14, quantidade_minima: 10 }, // warning
        { id: 2, produto: 'B', unidade: 'kg', quantidade_atual: 5, quantidade_minima: 10 },  // critical
      ],
    };
    const alerts = buildAlerts(db);
    assert.equal(alerts[0].nivel, 'critical');
    assert.equal(alerts[1].nivel, 'warning');
  });

  it('todos os alertas possuem id, ackKey, tipo, titulo, mensagem, pagina', () => {
    const db = {
      estoque: [{ id: 1, produto: 'Sal', unidade: 'kg', quantidade_atual: 0, quantidade_minima: 10 }],
      lotes: [{ id: 10, nome: 'Lote A', status: 'ativo' }],
      movimentacoes_financeiras: [
        { id: 50, tipo: 'despesa', status: 'previsto', descricao: 'Teste', valor: 100, data_vencimento: HA_2_DIAS },
      ],
    };
    const alerts = buildAlerts(db);
    assert.ok(alerts.length > 0);
    for (const a of alerts) {
      assert.ok(a.id, `Alerta ${JSON.stringify(a)} deve ter id`);
      assert.ok(a.ackKey, `Alerta deve ter ackKey`);
      assert.ok(a.tipo, `Alerta deve ter tipo`);
      assert.ok(a.titulo, `Alerta deve ter titulo`);
      assert.ok(a.mensagem, `Alerta deve ter mensagem`);
      assert.ok(a.pagina, `Alerta deve ter pagina`);
    }
  });

  // --- Ocupação de Pastos (Sprint 25) ---

  it('gera alerta crítico para pasto acima da capacidade', () => {
    const db = {
      pastagens: [{ id: 1, nome: 'Pasto 1', area_ha: 10, capacidade_suporte_ua_ha: 1 }],
      lotes: [{ id: 10, status: 'ativo', pastagem_id: 1, qtd: 50 }],
      animais: [{ id: 100, lote_id: 10, qtd: 50, p_at: 450 }],
    };
    const alerts = buildAlerts(db).filter((a) => a.tipo === 'pasto');
    const alerta = alerts.find((a) => a.id === 'pasto-acima-capacidade-1');
    assert.ok(alerta);
    assert.equal(alerta.nivel, 'critical');
    assert.ok(alerta.mensagem.includes('Pasto 1'));
  });

  it('gera alerta de aviso para pasto em atenção (80% a 100% da capacidade)', () => {
    const db = {
      pastagens: [{ id: 1, nome: 'Pasto 1', area_ha: 10, capacidade_suporte_ua_ha: 1 }],
      lotes: [{ id: 10, status: 'ativo', pastagem_id: 1, qtd: 10 }],
      animais: [{ id: 100, lote_id: 10, qtd: 10, p_at: 405 }],
    };
    const alerta = buildAlerts(db).find((a) => a.id === 'pasto-atencao-1');
    assert.ok(alerta);
    assert.equal(alerta.nivel, 'warning');
  });

  it('gera alerta informativo para pasto com lote mas sem área/capacidade', () => {
    const db = {
      pastagens: [{ id: 1, nome: 'Pasto 1' }],
      lotes: [{ id: 10, status: 'ativo', pastagem_id: 1, qtd: 10 }],
    };
    const alerta = buildAlerts(db).find((a) => a.id === 'pasto-sem-dados-1');
    assert.ok(alerta);
    assert.equal(alerta.nivel, 'info');
  });

  it('não gera alerta de pasto para pasto vazio (sem lote ativo)', () => {
    const db = {
      pastagens: [{ id: 1, nome: 'Pasto 1' }],
      lotes: [],
    };
    const alertasPasto = buildAlerts(db).filter((a) => a.tipo === 'pasto');
    assert.deepEqual(alertasPasto, []);
  });

  it('gera alerta de aviso para lote ativo sem pasto definido', () => {
    const db = {
      lotes: [{ id: 10, nome: 'Lote A', status: 'ativo', pastagem_id: null }],
    };
    const alerta = buildAlerts(db).find((a) => a.id === 'lote-sem-pasto-10');
    assert.ok(alerta);
    assert.equal(alerta.nivel, 'warning');
    assert.ok(alerta.mensagem.includes('Lote A'));
  });
});
