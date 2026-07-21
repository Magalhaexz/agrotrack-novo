import test from 'node:test';
import assert from 'node:assert/strict';
import { registrarSaidaAnimal, registrarEntradaAnimal, registrarSaidaEstoque, registrarEntradaEstoque, registrarSaidaAnimalIndividual, isAnimalIndividualAtivo } from './movimentacoes.js';

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

// ── Regressão P0: venda/morte/transferência não sincronizavam `animais[].qtd`
// (só `lote.qtd`) — a linha "grupo" de `animais`, lida diretamente pela
// página Animais (resumo "Total de cabeças" e aba "Grupos"), ficava com a
// quantidade antiga mesmo após a venda, inclusive após reload (persistido). ──

test('venda: sincroniza também a linha "grupo" de animais (não só lote.qtd) — regressão do bug relatado', () => {
  const db = makeDb({ lotes: [makeLote()], animais: [makeAnimal()] });
  const r = registrarSaidaAnimal(db, {
    loteId: 1, qtd: 10, pesoMedio: 420, valorTotal: 15000, data: hoje, tipoSaida: 'venda', comprador: 'Frigorífico X',
  }, {}, { persist: false });

  const animal = r.animais.find((a) => a.id === 1);
  assert.equal(animal.qtd, 40, 'a linha de animais precisa refletir a venda, não só o lote');
});

test('venda total: lote e animais chegam a zero', () => {
  const db = makeDb({ lotes: [makeLote({ qtd: 20 })], animais: [makeAnimal({ qtd: 20 })] });
  const r = registrarSaidaAnimal(db, {
    loteId: 1, qtd: 20, pesoMedio: 420, valorTotal: 30000, data: hoje, tipoSaida: 'venda',
  }, {}, { persist: false });
  assert.equal(r.lotes.find((l) => l.id === 1).qtd, 0);
  assert.equal(r.animais.find((a) => a.id === 1).qtd, 0);
});

test('morte/perda: também sincroniza a linha "grupo" de animais', () => {
  const db = makeDb({ lotes: [makeLote()], animais: [makeAnimal()] });
  const r = registrarSaidaAnimal(db, {
    loteId: 1, qtd: 3, pesoMedio: 400, valorTotal: 0, data: hoje, tipoSaida: 'morte',
  }, {}, { persist: false });
  assert.equal(r.animais.find((a) => a.id === 1).qtd, 47);
});

test('transferência: sincroniza a linha "grupo" de animais na origem E no destino', () => {
  const db = makeDb({
    lotes: [makeLote({ id: 1, qtd: 50, p_at: 400 }), makeLote({ id: 2, nome: 'Lote B', qtd: 20, p_at: 350 })],
    animais: [makeAnimal({ id: 1, lote_id: 1, qtd: 50, p_at: 400 }), makeAnimal({ id: 2, lote_id: 2, qtd: 20, p_at: 350 })],
  });
  const r = registrarSaidaAnimal(db, {
    loteId: 1, destinoLoteId: 2, qtd: 10, pesoMedio: 400, valorTotal: 0, data: hoje, tipoSaida: 'transferencia_saida',
  }, {}, { persist: false });
  assert.equal(r.animais.find((a) => a.id === 1).qtd, 40);
  assert.equal(r.animais.find((a) => a.id === 2).qtd, 30);
});

test('registro individual (tipo_registro: individual) nunca é tocado pela sincronização de grupo', () => {
  const db = makeDb({
    lotes: [makeLote({ qtd: 51 })],
    animais: [
      makeAnimal({ id: 1, qtd: 50 }),
      { id: 2, lote_id: 1, qtd: 1, p_at: 410, tipo_registro: 'individual', identificacao: 'Brinco 42' },
    ],
  });
  const r = registrarSaidaAnimal(db, {
    loteId: 1, qtd: 10, pesoMedio: 400, valorTotal: 15000, data: hoje, tipoSaida: 'venda',
  }, {}, { persist: false });
  // Saldo canônico é lote.qtd (51: 50 do grupo + 1 individual) → 51-10=41;
  // só a linha "grupo" absorve a redução, a individual fica intocada.
  assert.equal(r.animais.find((a) => a.id === 1).qtd, 41, 'a linha grupo absorve a venda');
  const individual = r.animais.find((a) => a.id === 2);
  assert.equal(individual.qtd, 1, 'o registro individual não é decrementado pela venda do grupo');
});

test('compra (entrada): também sincroniza a linha "grupo" de animais', () => {
  const db = makeDb({ lotes: [makeLote()], animais: [makeAnimal()] });
  const r = registrarEntradaAnimal(db, {
    loteId: 1, qtd: 5, pesoMedio: 300, valorTotal: 5000, data: hoje, tipoEntrada: 'compra',
  }, {}, { persist: false });
  assert.equal(r.animais.find((a) => a.id === 1).qtd, 55);
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
    /Quantidade indispon[íi]vel/
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
    /Quantidade indispon[íi]vel/
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
    /Quantidade indispon[íi]vel/
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

// ── Carência sanitária (Onda A — UX-SAN1): venda bloqueada com carência ativa,
// mesma checagem usada pela venda de lote e pela venda individual. Toda venda
// é tratada como destino abate (decisão de produto da sprint). ──

test('registrarSaidaAnimal: venda bloqueada quando o lote está em carência ativa', () => {
  const db = { ...makeDb({ lotes: [makeLote()], animais: [makeAnimal()] }), sanitario: [
    { id: 1, lote_id: 1, desc: 'Ivermectina', data_fim_carencia: '2026-08-01' },
  ] };
  assert.throws(
    () => registrarSaidaAnimal(db, { loteId: 1, qtd: 1, pesoMedio: 400, valorTotal: 1000, data: hoje, tipoSaida: 'venda' }, {}, { persist: false }),
    /carência.*abate.*01\/08\/2026/is
  );
});

test('registrarSaidaAnimal: morte não é bloqueada por carência (carência só impede venda)', () => {
  const db = { ...makeDb({ lotes: [makeLote()], animais: [makeAnimal()] }), sanitario: [
    { id: 1, lote_id: 1, desc: 'Ivermectina', data_fim_carencia: '2026-08-01' },
  ] };
  const r = registrarSaidaAnimal(db, { loteId: 1, qtd: 1, pesoMedio: 400, valorTotal: 0, data: hoje, tipoSaida: 'morte' }, {}, { persist: false });
  assert.equal(r.lotes.find((l) => l.id === 1).qtd, 49);
});

test('registrarSaidaAnimal: venda liberada quando a carência já terminou', () => {
  const db = { ...makeDb({ lotes: [makeLote()], animais: [makeAnimal()] }), sanitario: [
    { id: 1, lote_id: 1, desc: 'Ivermectina', data_fim_carencia: '2026-07-01' },
  ] };
  const r = registrarSaidaAnimal(db, { loteId: 1, qtd: 1, pesoMedio: 400, valorTotal: 1000, data: hoje, tipoSaida: 'venda' }, {}, { persist: false });
  assert.equal(r.lotes.find((l) => l.id === 1).qtd, 49);
});

// ── registrarSaidaAnimalIndividual (Onda A — UX-P1-1): venda/morte de UM
// animal rastreado individualmente agora sincroniza lote.qtd e a linha
// "grupo" do lote, do mesmo jeito que a venda/morte de lote já fazia. ──

function makeAnimalIndividual(overrides = {}) {
  return { id: 501, lote_id: 1, tipo_registro: 'individual', qtd: 1, p_at: 420, identificacao: 'Brinco 501', status: 'ativo', ...overrides };
}

function makeDbIndividual({ lotes = [makeLote()], animais = [makeAnimalIndividual()], sanitario = [] } = {}) {
  return { lotes, animais, movimentacoes_animais: [], movimentacoes_financeiras: [], sanitario };
}

test('venda individual: reduz lote.qtd em 1, cria movimentação e receita, marca animal como vendido', () => {
  const db = makeDbIndividual();
  const r = registrarSaidaAnimalIndividual(db, { animalId: 501, tipo: 'venda', data: hoje, valor: 3200, peso: 430 }, {}, { persist: false });

  assert.equal(r.lotes.find((l) => l.id === 1).qtd, 49);
  const animal = r.animais.find((a) => a.id === 501);
  assert.equal(animal.status, 'vendido');
  assert.equal(animal.p_at, 430);
  assert.equal(r.movimentacoes_animais.length, 1);
  assert.equal(r.movimentacoes_animais[0].tipo, 'venda');
  assert.equal(r.movimentacoes_animais[0].metadata.movement_scope, 'individual');
  assert.equal(r.movimentacoes_financeiras.length, 1);
  assert.equal(r.movimentacoes_financeiras[0].tipo, 'receita');
  assert.equal(r.movimentacoes_financeiras[0].valor, 3200);
});

test('morte individual: reduz lote.qtd em 1, sem gerar receita', () => {
  const db = makeDbIndividual();
  const r = registrarSaidaAnimalIndividual(db, { animalId: 501, tipo: 'morte', data: hoje }, {}, { persist: false });

  assert.equal(r.lotes.find((l) => l.id === 1).qtd, 49);
  assert.equal(r.animais.find((a) => a.id === 501).status, 'morte');
  assert.equal(r.movimentacoes_financeiras.length, 0);
});

test('venda/morte individual: também sincroniza a linha "grupo" do mesmo lote quando existir', () => {
  const db = makeDbIndividual({
    animais: [
      makeAnimalIndividual(),
      { id: 2, lote_id: 1, tipo_registro: 'grupo', qtd: 49, p_at: 400 },
    ],
  });
  const r = registrarSaidaAnimalIndividual(db, { animalId: 501, tipo: 'venda', data: hoje, valor: 3200 }, {}, { persist: false });
  assert.equal(r.lotes.find((l) => l.id === 1).qtd, 49);
  // A linha "grupo" continua com sua própria contagem — quem saiu foi o individual, não o grupo.
  assert.equal(r.animais.find((a) => a.id === 2).qtd, 49);
});

test('operação individual repetida é bloqueada (animal já inativo)', () => {
  const db = makeDbIndividual({ animais: [makeAnimalIndividual({ status: 'vendido' })] });
  assert.throws(
    () => registrarSaidaAnimalIndividual(db, { animalId: 501, tipo: 'venda', data: hoje, valor: 100 }, {}, { persist: false }),
    /já está inativo/
  );
});

test('animal individual inexistente lança erro', () => {
  const db = makeDbIndividual();
  assert.throws(
    () => registrarSaidaAnimalIndividual(db, { animalId: 9999, tipo: 'venda', data: hoje, valor: 100 }, {}, { persist: false }),
    /não encontrado/
  );
});

test('venda individual bloqueada quando o lote do animal está em carência ativa', () => {
  const db = makeDbIndividual({ sanitario: [{ id: 1, lote_id: 1, desc: 'Ivermectina', data_fim_carencia: '2026-08-01' }] });
  assert.throws(
    () => registrarSaidaAnimalIndividual(db, { animalId: 501, tipo: 'venda', data: hoje, valor: 100 }, {}, { persist: false }),
    /carência/i
  );
});

test('morte individual não é bloqueada por carência', () => {
  const db = makeDbIndividual({ sanitario: [{ id: 1, lote_id: 1, desc: 'Ivermectina', data_fim_carencia: '2026-08-01' }] });
  const r = registrarSaidaAnimalIndividual(db, { animalId: 501, tipo: 'morte', data: hoje }, {}, { persist: false });
  assert.equal(r.lotes.find((l) => l.id === 1).qtd, 49);
});

test('tipo de saída individual inválido lança erro', () => {
  const db = makeDbIndividual();
  assert.throws(
    () => registrarSaidaAnimalIndividual(db, { animalId: 501, tipo: 'saída-esquisita', data: hoje }, {}, { persist: false }),
    /Tipo de saída individual inválido/
  );
});

test('animal individual sem lote vinculado ainda registra a saída (sem tocar lotes)', () => {
  const db = makeDbIndividual({ animais: [makeAnimalIndividual({ lote_id: null })], lotes: [] });
  const r = registrarSaidaAnimalIndividual(db, { animalId: 501, tipo: 'morte', data: hoje }, {}, { persist: false });
  assert.equal(r.animais.find((a) => a.id === 501).status, 'morte');
});

test('isAnimalIndividualAtivo reconhece os status inativos canônicos', () => {
  assert.equal(isAnimalIndividualAtivo({ status: 'ativo' }), true);
  assert.equal(isAnimalIndividualAtivo({ status: 'vendido' }), false);
  assert.equal(isAnimalIndividualAtivo({ status: 'transferencia_saida' }), false);
  assert.equal(isAnimalIndividualAtivo({}), true);
});

// ── Estoque (auditoria funcional: saída/entrada não persistiam no Supabase,
// só atualizavam o estado React local — handleRegistrarSaidaEstoque/
// handleRegistrarEntradaEstoque em App.jsx nunca passavam persistContext) ──

function makeEstoqueDb({ estoque = [] } = {}) {
  return { estoque, movimentacoes_estoque: [], movimentacoes_financeiras: [] };
}

function makeItemEstoque(overrides = {}) {
  return { id: 1, produto: 'Ração', categoria: 'ração', quantidade_atual: 100, valor_unitario: 2, ...overrides };
}

// ── Regressão P0 (auditoria 360º, EST-01): "tratamento" e tipos inválidos não
// podem mais falhar silenciosamente — antes devolviam `db` inalterado com um
// `console.warn`, e o modal (EstoquePage.jsx) fechava como se tivesse dado
// certo, sem nada persistido. ──

test('registrarSaidaEstoque: "tratamento" é um tipo válido e gera despesa própria (tratamento_sanitario) quando vinculado a um lote', () => {
  const db = makeEstoqueDb({ estoque: [makeItemEstoque()] });
  const r = registrarSaidaEstoque(db, {
    itemId: 1, loteId: 7, quantidade: 5, tipo: 'tratamento', data: hoje,
  }, {}, { persist: false });

  assert.equal(r.estoque.find((i) => i.id === 1).quantidade_atual, 95);
  assert.equal(r.movimentacoes_estoque[0].tipo, 'tratamento');
  assert.equal(r.movimentacoes_financeiras.length, 1);
  assert.equal(r.movimentacoes_financeiras[0].categoria, 'tratamento_sanitario');
  assert.equal(r.movimentacoes_financeiras[0].lote_id, 7);
});

test('registrarSaidaEstoque: tipo inválido lança erro (nunca falha silenciosamente)', () => {
  const db = makeEstoqueDb({ estoque: [makeItemEstoque()] });
  assert.throws(
    () => registrarSaidaEstoque(db, { itemId: 1, quantidade: 5, tipo: 'saida', data: hoje }, {}, { persist: false }),
    /Tipo de saída inválido/
  );
  // db original não deve ter sido mutado nem parcialmente alterado.
  assert.equal(db.estoque[0].quantidade_atual, 100);
});

test('registrarSaidaEstoque: item inexistente lança erro', () => {
  const db = makeEstoqueDb({ estoque: [makeItemEstoque()] });
  assert.throws(
    () => registrarSaidaEstoque(db, { itemId: 999, quantidade: 5, tipo: 'consumo', data: hoje }, {}, { persist: false }),
    /Item de estoque não encontrado/
  );
});

test('registrarSaidaEstoque: quantidade inválida lança erro', () => {
  const db = makeEstoqueDb({ estoque: [makeItemEstoque()] });
  assert.throws(
    () => registrarSaidaEstoque(db, { itemId: 1, quantidade: 0, tipo: 'consumo', data: hoje }, {}, { persist: false }),
    /quantidade válida/
  );
});

test('registrarEntradaEstoque: item inexistente lança erro', () => {
  const db = makeEstoqueDb({ estoque: [makeItemEstoque()] });
  assert.throws(
    () => registrarEntradaEstoque(db, { itemId: 999, qtd: 10, custo: 2, data: hoje }, {}, { persist: false }),
    /Item de estoque não encontrado/
  );
});

test('registrarEntradaEstoque: quantidade e custo inválidos lançam erro', () => {
  const db = makeEstoqueDb({ estoque: [makeItemEstoque()] });
  assert.throws(
    () => registrarEntradaEstoque(db, { itemId: 1, qtd: 0, custo: 2, data: hoje }, {}, { persist: false }),
    /quantidade válida/
  );
  assert.throws(
    () => registrarEntradaEstoque(db, { itemId: 1, qtd: 10, custo: -1, data: hoje }, {}, { persist: false }),
    /custo unitário válido/
  );
});

test('registrarSaidaEstoque: aceita persistContext (4º argumento) sem alterar o resultado do saldo', () => {
  const db = makeEstoqueDb({ estoque: [makeItemEstoque()] });
  const r = registrarSaidaEstoque(db, {
    itemId: 1, quantidade: 10, tipo: 'consumo', data: hoje,
  }, {}, { persist: false });

  assert.equal(r.estoque.find((i) => i.id === 1).quantidade_atual, 90);
  assert.equal(r.movimentacoes_estoque.length, 1);
});

// A coluna real em `movimentacoes_estoque` é `custo_unitario` (não
// `custo_unit`) — um nome de campo divergente aqui fazia o insert falhar
// silenciosamente (persistCollectionMutation reporta `persisted: false`,
// mas o item de estoque em si já tinha sido salvo à parte, então o saldo
// parecia correto e só o histórico de movimentações sumia no reload).
test('registrarSaidaEstoque: movimentação usa a coluna real custo_unitario (não custo_unit)', () => {
  const db = makeEstoqueDb({ estoque: [makeItemEstoque({ valor_unitario: 5 })] });
  const r = registrarSaidaEstoque(db, {
    itemId: 1, quantidade: 10, tipo: 'consumo', data: hoje,
  }, {}, { persist: false });

  const mov = r.movimentacoes_estoque[0];
  assert.equal(mov.custo_unitario, 5);
  assert.equal('custo_unit' in mov, false);
});

test('registrarSaidaEstoque: consumo com lote gera despesa financeira vinculada', () => {
  const db = makeEstoqueDb({ estoque: [makeItemEstoque()] });
  const r = registrarSaidaEstoque(db, {
    itemId: 1, loteId: 7, quantidade: 10, tipo: 'consumo', data: hoje,
  }, {}, { persist: false });

  assert.equal(r.movimentacoes_financeiras.length, 1);
  assert.equal(r.movimentacoes_financeiras[0].tipo, 'despesa');
  assert.equal(r.movimentacoes_financeiras[0].lote_id, 7);
});

test('registrarSaidaEstoque: impede saldo negativo', () => {
  const db = makeEstoqueDb({ estoque: [makeItemEstoque({ quantidade_atual: 5 })] });
  assert.throws(
    () => registrarSaidaEstoque(db, { itemId: 1, quantidade: 10, tipo: 'consumo', data: hoje }, {}, { persist: false }),
    /Saldo insuficiente/
  );
});

test('registrarEntradaEstoque: aceita persistContext (4º argumento) sem alterar o resultado do saldo', () => {
  const db = makeEstoqueDb({ estoque: [makeItemEstoque()] });
  const r = registrarEntradaEstoque(db, {
    itemId: 1, qtd: 20, custo: 3, data: hoje, fornecedor: 'Fornecedor X',
  }, {}, { persist: false });

  assert.equal(r.estoque.find((i) => i.id === 1).quantidade_atual, 120);
  assert.equal(r.movimentacoes_financeiras.length, 1, 'entrada sempre gera despesa de compra');
});

test('registrarEntradaEstoque: movimentação usa a coluna real custo_unitario (não custo_unit)', () => {
  const db = makeEstoqueDb({ estoque: [makeItemEstoque()] });
  const r = registrarEntradaEstoque(db, {
    itemId: 1, qtd: 20, custo: 3, data: hoje,
  }, {}, { persist: false });

  const mov = r.movimentacoes_estoque[0];
  assert.equal(mov.custo_unitario, 3);
  assert.equal('custo_unit' in mov, false);
});
