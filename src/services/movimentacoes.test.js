import test from 'node:test';
import assert from 'node:assert/strict';
import { registrarSaidaAnimal } from './movimentacoes.js';

// Seção 4 do sprint de fechamento — venda, morte/perda e transferência de
// saída. O saldo de validação (obterResumoLote) segue lote.qtd quando
// definido (fonte canônica, Seção 8), com fallback para a soma de
// animais.qtd em lotes legados sem esse campo. O peso médio ponderado
// continua vindo dos registros de animais.

function makeDb({ lotes = [], animais = [] } = {}) {
  return { lotes, animais, movimentacoes_animais: [], movimentacoes_financeiras: [] };
}

function makeLote(overrides = {}) {
  return { id: 1, nome: 'Lote A', qtd: 50, p_at: 400, ...overrides };
}

function makeAnimal(overrides = {}) {
  return { id: 1, lote_id: 1, qtd: 50, p_at: 400, ...overrides };
}

const hoje = '2026-07-11';

// ── Venda ─────────────────────────────────────────────────────────────────

test('venda: reduz o saldo do lote e cria histórico de movimentação', () => {
  const db = makeDb({ lotes: [makeLote()], animais: [makeAnimal()] });
  const r = registrarSaidaAnimal(db, {
    loteId: 1, qtd: 10, pesoMedio: 420, valorTotal: 15000, data: hoje, tipoSaida: 'venda', comprador: 'Frigorífico X',
  }, {}, { persist: false });

  const lote = r.lotes.find((l) => l.id === 1);
  assert.equal(lote.qtd, 40);
  assert.equal(r.movimentacoes_animais.length, 1);
  assert.equal(r.movimentacoes_animais[0].tipo, 'venda');
  assert.equal(r.movimentacoes_animais[0].qtd, 10);
});

test('venda: gera receita no financeiro (não vira morte, não finaliza automaticamente)', () => {
  const db = makeDb({ lotes: [makeLote()], animais: [makeAnimal()] });
  const r = registrarSaidaAnimal(db, {
    loteId: 1, qtd: 10, pesoMedio: 420, valorTotal: 15000, data: hoje, tipoSaida: 'venda', comprador: 'Frigorífico X',
  }, {}, { persist: false });

  assert.equal(r.movimentacoes_financeiras.length, 1);
  assert.equal(r.movimentacoes_financeiras[0].tipo, 'receita');
  assert.equal(r.movimentacoes_financeiras[0].categoria, 'venda_animal');
  assert.equal(r.movimentacoes_financeiras[0].valor, 15000);
  // Não altera o status do lote (venda parcial não finaliza automaticamente):
  const lote = r.lotes.find((l) => l.id === 1);
  assert.equal(lote.status ?? undefined, makeLote().status);
});

test('venda: impede saldo negativo (quantidade maior que o disponível)', () => {
  const db = makeDb({ lotes: [makeLote({ qtd: 5 })], animais: [makeAnimal({ qtd: 5 })] });
  assert.throws(
    () => registrarSaidaAnimal(db, { loteId: 1, qtd: 10, pesoMedio: 400, valorTotal: 5000, data: hoje, tipoSaida: 'venda' }, {}, { persist: false }),
    /excede a quantidade atual/
  );
});

// ── Morte/perda ───────────────────────────────────────────────────────────

test('morte/perda: reduz o saldo e cria movimentação própria, sem gerar receita', () => {
  const db = makeDb({ lotes: [makeLote()], animais: [makeAnimal()] });
  const r = registrarSaidaAnimal(db, {
    loteId: 1, qtd: 3, pesoMedio: 400, valorTotal: 0, data: hoje, tipoSaida: 'morte',
  }, {}, { persist: false });

  const lote = r.lotes.find((l) => l.id === 1);
  assert.equal(lote.qtd, 47);
  assert.equal(r.movimentacoes_animais[0].tipo, 'morte');
  assert.equal(r.movimentacoes_financeiras.length, 0, 'morte/perda não deve gerar receita');
});

test('morte/perda: não finaliza o lote automaticamente', () => {
  const db = makeDb({ lotes: [makeLote({ status: 'ativo' })], animais: [makeAnimal()] });
  const r = registrarSaidaAnimal(db, {
    loteId: 1, qtd: 3, pesoMedio: 400, valorTotal: 0, data: hoje, tipoSaida: 'morte',
  }, {}, { persist: false });
  assert.equal(r.lotes.find((l) => l.id === 1).status, 'ativo');
});

test('morte/perda: impede quantidade superior ao saldo', () => {
  const db = makeDb({ lotes: [makeLote({ qtd: 2 })], animais: [makeAnimal({ qtd: 2 })] });
  assert.throws(
    () => registrarSaidaAnimal(db, { loteId: 1, qtd: 5, pesoMedio: 400, valorTotal: 0, data: hoje, tipoSaida: 'morte' }, {}, { persist: false }),
    /excede a quantidade atual/
  );
});

// ── Transferência de saída ────────────────────────────────────────────────

test('transferência: reduz a origem e aumenta o destino de forma atômica (mesma fazenda)', () => {
  const db = makeDb({
    lotes: [makeLote({ id: 1, qtd: 50, p_at: 400 }), makeLote({ id: 2, nome: 'Lote B', qtd: 20, p_at: 350 })],
    animais: [makeAnimal({ id: 1, lote_id: 1, qtd: 50, p_at: 400 }), makeAnimal({ id: 2, lote_id: 2, qtd: 20, p_at: 350 })],
  });
  const r = registrarSaidaAnimal(db, {
    loteId: 1, destinoLoteId: 2, qtd: 10, pesoMedio: 400, valorTotal: 0, data: hoje, tipoSaida: 'transferencia_saida',
  }, {}, { persist: false });

  const origem = r.lotes.find((l) => l.id === 1);
  const destino = r.lotes.find((l) => l.id === 2);
  assert.equal(origem.qtd, 40);
  assert.equal(destino.qtd, 30);
  // peso ponderado do destino: (20*350 + 10*400) / 30
  assert.ok(Math.abs(destino.p_at - (20 * 350 + 10 * 400) / 30) < 1e-9);
});

test('transferência: histórico preservado (uma movimentação registrada com o lote de destino)', () => {
  const db = makeDb({
    lotes: [makeLote({ id: 1 }), makeLote({ id: 2, nome: 'Lote B' })],
    animais: [makeAnimal({ id: 1, lote_id: 1 }), makeAnimal({ id: 2, lote_id: 2, qtd: 0 })],
  });
  const r = registrarSaidaAnimal(db, {
    loteId: 1, destinoLoteId: 2, qtd: 5, pesoMedio: 400, valorTotal: 0, data: hoje, tipoSaida: 'transferencia_saida',
  }, {}, { persist: false });
  assert.equal(r.movimentacoes_animais.length, 1);
  assert.equal(r.movimentacoes_animais[0].tipo, 'transferencia_saida');
  assert.equal(r.movimentacoes_animais[0].lote_id, 1);
});

test('transferência: exige origem e destino diferentes', () => {
  const db = makeDb({ lotes: [makeLote()], animais: [makeAnimal()] });
  assert.throws(
    () => registrarSaidaAnimal(db, { loteId: 1, destinoLoteId: 1, qtd: 5, pesoMedio: 400, valorTotal: 0, data: hoje, tipoSaida: 'transferencia_saida' }, {}, { persist: false }),
    /origem e destino devem ser diferentes/
  );
});

test('transferência: exige lote de destino existente na mesma conta', () => {
  const db = makeDb({ lotes: [makeLote()], animais: [makeAnimal()] });
  assert.throws(
    () => registrarSaidaAnimal(db, { loteId: 1, destinoLoteId: 999, qtd: 5, pesoMedio: 400, valorTotal: 0, data: hoje, tipoSaida: 'transferencia_saida' }, {}, { persist: false }),
    /não encontrado para transferência/
  );
});

test('transferência: não confunde com troca de pasto (não altera pastagem_id)', () => {
  const db = makeDb({
    lotes: [makeLote({ id: 1, pastagem_id: 'pasto-a' }), makeLote({ id: 2, nome: 'Lote B', pastagem_id: 'pasto-b' })],
    animais: [makeAnimal({ id: 1, lote_id: 1 }), makeAnimal({ id: 2, lote_id: 2, qtd: 0 })],
  });
  const r = registrarSaidaAnimal(db, {
    loteId: 1, destinoLoteId: 2, qtd: 5, pesoMedio: 400, valorTotal: 0, data: hoje, tipoSaida: 'transferencia_saida',
  }, {}, { persist: false });
  assert.equal(r.lotes.find((l) => l.id === 1).pastagem_id, 'pasto-a');
  assert.equal(r.lotes.find((l) => l.id === 2).pastagem_id, 'pasto-b');
});

// Seção 8 (auditoria lote.qtd) — o saldo de validação segue lote.qtd, mesmo
// quando diverge de animais.qtd (ex.: após um Ajuste de lotação que só
// atualiza lote.qtd, sem tocar em animais.qtd).
test('registrarSaidaAnimal: saldo de validação segue lote.qtd (canônico), não animais.qtd desatualizado', () => {
  // Ajuste de lotação reduziu para 40, mas animais.qtd ainda mostra 50 (não sincronizado).
  const db = makeDb({ lotes: [makeLote({ qtd: 40 })], animais: [makeAnimal({ qtd: 50 })] });

  // Vender 45 deveria falhar (só há 40 cabeças reais), mesmo animais.qtd dizendo 50:
  assert.throws(
    () => registrarSaidaAnimal(db, { loteId: 1, qtd: 45, pesoMedio: 400, valorTotal: 0, data: hoje, tipoSaida: 'venda' }, {}, { persist: false }),
    /excede a quantidade atual/
  );

  // Vender 40 (o saldo real canônico) deve funcionar e zerar o lote:
  const r = registrarSaidaAnimal(db, { loteId: 1, qtd: 40, pesoMedio: 400, valorTotal: 12000, data: hoje, tipoSaida: 'venda' }, {}, { persist: false });
  assert.equal(r.lotes.find((l) => l.id === 1).qtd, 0);
});

test('registrarSaidaAnimal: lote sem lote.qtd definido (legado) cai para animais.qtd', () => {
  const db = makeDb({ lotes: [makeLote({ qtd: undefined })], animais: [makeAnimal({ qtd: 50 })] });
  const r = registrarSaidaAnimal(db, { loteId: 1, qtd: 10, pesoMedio: 400, valorTotal: 0, data: hoje, tipoSaida: 'morte' }, {}, { persist: false });
  assert.equal(r.lotes.find((l) => l.id === 1).qtd, 40);
});
