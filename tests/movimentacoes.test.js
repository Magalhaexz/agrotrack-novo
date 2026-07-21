import test from 'node:test';
import assert from 'node:assert/strict';
import { registrarEntradaAnimal, registrarSaidaAnimal } from '../src/services/movimentacoes.js';
import { makeBaseDb } from './fixtures.js';

function baseMovDb() {
  const db = makeBaseDb();
  db.movimentacoes_animais = [];
  db.movimentacoes_financeiras = [];
  db.animais = [{ id: 100, lote_id: 10, qtd: 10, p_at: 300 }];
  db.lotes = [
    { id: 10, nome: 'Lote 10', qtd: 10, p_at: 300 },
    { id: 11, nome: 'Lote 11', qtd: 5, p_at: 290 },
  ];
  return db;
}

test('registrarEntradaAnimal aceita payload camelCase e cria despesa para compra > 0', () => {
  const db = baseMovDb();
  const out = registrarEntradaAnimal(db, {
    loteId: 10,
    qtd: 2,
    pesoMedio: 290,
    valorTotal: 500,
    data: '2026-03-01',
    tipoEntrada: 'compra',
  });

  assert.equal(out.movimentacoes_animais.at(-1).tipo, 'compra');
  assert.equal(out.movimentacoes_financeiras.length, 1);
  assert.equal(out.movimentacoes_financeiras[0].tipo, 'despesa');
});

test('registrarEntradaAnimal aceita aliases snake_case', () => {
  const db = baseMovDb();
  const out = registrarEntradaAnimal(db, {
    lote_id: 10,
    quantidade: 1,
    peso_medio: 280,
    valor_total: 0,
    data: '2026-03-02',
    tipo: 'nascimento',
  });

  assert.equal(out.movimentacoes_animais.at(-1).tipo, 'nascimento');
});

test('nascimento/transferencia_entrada não criam despesa', () => {
  const db1 = baseMovDb();
  const out1 = registrarEntradaAnimal(db1, {
    loteId: 10, qtd: 1, pesoMedio: 280, valorTotal: 100, data: '2026-03-03', tipoEntrada: 'nascimento',
  });
  assert.equal(out1.movimentacoes_financeiras.length, 0);

  const db2 = baseMovDb();
  const out2 = registrarEntradaAnimal(db2, {
    loteId: 10, qtd: 1, pesoMedio: 280, valorTotal: 100, data: '2026-03-03', tipoEntrada: 'transferencia_entrada',
  });
  assert.equal(out2.movimentacoes_financeiras.length, 0);
});

// Sprint 3: venda e morte saíram deste caminho e passaram para a RPC
// transacional (services/saidaLoteTransacional.js, com testes próprios).
// `descarte` continua aqui — não tem entrada na UI web e não gera receita.
test('registrarSaidaAnimal recusa venda e morte, que migraram para a RPC transacional', () => {
  const db = baseMovDb();
  assert.throws(() => registrarSaidaAnimal(db, {
    lote_id: 10, quantidade: 2, peso_medio: 300, valor_total: 900, data: '2026-03-04', tipo: 'venda',
  }), /registrarSaidaLoteTransacional/);

  assert.throws(() => registrarSaidaAnimal(db, {
    loteId: 10, qtd: 1, pesoMedio: 280, valorTotal: 200, data: '2026-03-05', tipoSaida: 'morte',
  }), /registrarSaidaLoteTransacional/);
});

test('descarte não cria receita', () => {
  const dbDescarte = baseMovDb();
  const outDescarte = registrarSaidaAnimal(dbDescarte, {
    loteId: 10, qtd: 1, pesoMedio: 280, valorTotal: 200, data: '2026-03-05', tipoSaida: 'descarte',
  });
  assert.equal(outDescarte.movimentacoes_financeiras.length, 0);
});

test('validação segura de quantidade/peso/lote inválidos', () => {
  const db = baseMovDb();

  assert.throws(() => registrarEntradaAnimal(db, {
    loteId: 999, qtd: 1, pesoMedio: 280, valorTotal: 0, data: '2026-03-06', tipoEntrada: 'compra',
  }), /Lote 999 não encontrado/);

  assert.throws(() => registrarEntradaAnimal(db, {
    loteId: 10, qtd: 0, pesoMedio: 280, valorTotal: 0, data: '2026-03-06', tipoEntrada: 'compra',
  }), /Valor inválido para quantidade/);

  assert.throws(() => registrarSaidaAnimal(db, {
    loteId: 10, qtd: 1, pesoMedio: 0, valorTotal: 0, data: '2026-03-06', tipoSaida: 'descarte',
  }), /Valor inválido para peso médio/);
});
