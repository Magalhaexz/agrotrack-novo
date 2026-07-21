import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SEM_FAZENDA,
  aplicarBaixaRebanho,
  loteEstaAtivo,
  lotacaoDosPastos,
  lotesAtivos,
  qtdCabecasDoLote,
  rebanhoAtivo,
  rebanhoPorFazenda,
  uaDoLote,
  uaTotalAtiva,
  validarBaixaRebanho,
} from './rebanho.js';

const lote = (over = {}) => ({ id: 1, faz_id: 1, status: 'ativo', qtd: 10, p_at: 300, ...over });
const animal = (over = {}) => ({ id: 1, lote_id: 1, qtd: 10, p_at: 300, ...over });

// ── Regra 1/2/3: fonte canônica, fallback e o zero ──────────────────────────
test('usa lote.qtd como fonte canônica, ignorando animais[] defasado', () => {
  // Cenário real: vendeu 2 de 10 → lote.qtd=8, animais[] ainda em 10.
  assert.equal(qtdCabecasDoLote(lote({ qtd: 8 }), [animal({ qtd: 10 })]), 8);
});

test('lote.qtd = 0 continua ZERO e nunca vira 1', () => {
  // Regressão do padrão `qtd || 1`, que transformava lote esvaziado em 1 cabeça.
  assert.equal(qtdCabecasDoLote(lote({ qtd: 0 }), [animal({ qtd: 10 })]), 0);
  assert.equal(rebanhoAtivo({ lotes: [lote({ qtd: 0 })], animais: [animal({ qtd: 10 })] }), 0);
});

test('cai para soma de animais[] só quando lote.qtd é null/undefined', () => {
  assert.equal(qtdCabecasDoLote(lote({ qtd: null }), [animal({ qtd: 7 })]), 7);
  assert.equal(qtdCabecasDoLote(lote({ qtd: undefined }), [animal({ qtd: 7 })]), 7);
});

test('quantidade negativa é normalizada para 0 na leitura', () => {
  assert.equal(qtdCabecasDoLote(lote({ qtd: -5 }), []), 0);
  assert.equal(rebanhoAtivo({ lotes: [lote({ qtd: -5 })], animais: [] }), 0);
});

test('lote sem animais e sem qtd devolve 0', () => {
  assert.equal(qtdCabecasDoLote(lote({ qtd: null }), []), 0);
  assert.equal(qtdCabecasDoLote(null, []), 0);
});

// ── Regra 4/5: status do lote ───────────────────────────────────────────────
test('lote vendido/encerrado/finalizado/inativo sai do rebanho ativo', () => {
  for (const status of ['vendido', 'encerrado', 'finalizado', 'inativo', 'cancelado']) {
    assert.equal(loteEstaAtivo(lote({ status })), false, status);
    assert.equal(rebanhoAtivo({ lotes: [lote({ status, qtd: 50 })], animais: [] }), 0, status);
  }
});

test('status ausente é tratado como ativo (lote legado)', () => {
  assert.equal(loteEstaAtivo({ id: 1 }), true);
  assert.equal(rebanhoAtivo({ lotes: [{ id: 1, faz_id: 1, qtd: 4 }], animais: [] }), 4);
});

test('status é comparado sem depender de caixa ou espaços', () => {
  assert.equal(loteEstaAtivo(lote({ status: '  VENDIDO ' })), false);
});

test('lote finalizado NÃO participa da UA', () => {
  const db = {
    lotes: [lote({ id: 1, qtd: 8, p_at: 300 }), lote({ id: 2, status: 'vendido', qtd: 20, p_at: 450 })],
    animais: [animal({ id: 1, lote_id: 1, qtd: 8 }), animal({ id: 2, lote_id: 2, qtd: 20, p_at: 450 })],
  };
  // Só o lote ativo: 300/450 * 8 = 5,333 (antes o cálculo inline devolvia 25,333).
  assert.ok(Math.abs(uaTotalAtiva(db) - (300 / 450) * 8) < 1e-9);
});

test('o cenário que devolvia 25,3 UA agora devolve 5,3 e não é superlotação a 20 UA', () => {
  const db = {
    lotes: [lote({ id: 1, qtd: 8, p_at: 300, pastagem_id: 'p1' }), lote({ id: 2, status: 'vendido', qtd: 20, p_at: 450, pastagem_id: 'p1' })],
    animais: [animal({ id: 1, lote_id: 1, qtd: 8 }), animal({ id: 2, lote_id: 2, qtd: 20, p_at: 450 })],
    pastagens: [{ id: 'p1', fazenda_id: 1, nome: 'P1', area_ha: 10, capacidade_suporte_ua_ha: 2 }], // 20 UA
  };
  const ua = uaTotalAtiva(db);
  assert.ok(ua > 5.3 && ua < 5.4, `esperado ~5,33 UA, recebido ${ua}`);
  const p = lotacaoDosPastos(db)[0];
  assert.equal(p.capacidadeUa, 20);
  assert.equal(p.superlotado, false, 'não pode marcar superlotação com 5,3 de 20 UA');
  assert.ok(p.taxaOcupacao < 0.27);
});

// ── Eventos que alteram o rebanho ───────────────────────────────────────────
test('venda parcial usa a quantidade já atualizada', () => {
  assert.equal(rebanhoAtivo({ lotes: [lote({ qtd: 8 })], animais: [animal({ qtd: 10 })] }), 8);
});

test('venda total zera o lote sem removê-lo do cadastro', () => {
  const db = { lotes: [lote({ qtd: 0 })], animais: [animal({ qtd: 10 })] };
  assert.equal(rebanhoAtivo(db), 0);
  assert.equal(lotesAtivos(db).length, 1);
});

test('morte/perda reduz o rebanho', () => {
  assert.equal(rebanhoAtivo({ lotes: [lote({ qtd: 9 })], animais: [animal({ qtd: 10 })] }), 9);
});

test('transferência entre LOTES não altera o total da fazenda', () => {
  const antes = { lotes: [lote({ id: 1, qtd: 10 }), lote({ id: 2, qtd: 0 })], animais: [] };
  const depois = { lotes: [lote({ id: 1, qtd: 4 }), lote({ id: 2, qtd: 6 })], animais: [] };
  assert.equal(rebanhoAtivo(antes), 10);
  assert.equal(rebanhoAtivo(depois), 10, 'transferir entre lotes não pode mudar o total');
});

test('troca de PASTO não altera total do lote nem da fazenda', () => {
  const base = {
    lotes: [lote({ id: 1, qtd: 10, pastagem_id: 'p1' })],
    animais: [],
    pastagens: [{ id: 'p1', fazenda_id: 1, area_ha: 10, capacidade_suporte_ua_ha: 2 }, { id: 'p2', fazenda_id: 1, area_ha: 10, capacidade_suporte_ua_ha: 2 }],
  };
  const movido = { ...base, lotes: [lote({ id: 1, qtd: 10, pastagem_id: 'p2' })] };
  assert.equal(rebanhoAtivo(base), rebanhoAtivo(movido));
  assert.equal(qtdCabecasDoLote(base.lotes[0], []), qtdCabecasDoLote(movido.lotes[0], []));
  // O rebanho migra de pasto, sem sumir nem duplicar.
  assert.equal(lotacaoDosPastos(base).find((p) => p.pastagem_id === 'p1').cabecas, 10);
  assert.equal(lotacaoDosPastos(movido).find((p) => p.pastagem_id === 'p1').cabecas, 0);
  assert.equal(lotacaoDosPastos(movido).find((p) => p.pastagem_id === 'p2').cabecas, 10);
});

test('transferência entre FAZENDAS reduz na origem e aumenta no destino, mantendo o consolidado', () => {
  const antes = { lotes: [lote({ id: 1, faz_id: 1, qtd: 10 }), lote({ id: 2, faz_id: 2, qtd: 5 })], animais: [] };
  const depois = { lotes: [lote({ id: 1, faz_id: 1, qtd: 6 }), lote({ id: 2, faz_id: 2, qtd: 9 })], animais: [] };
  assert.equal(rebanhoAtivo(antes, 1), 10);
  assert.equal(rebanhoAtivo(depois, 1), 6, 'origem reduz exatamente 4');
  assert.equal(rebanhoAtivo(depois, 2), 9, 'destino aumenta exatamente 4');
  assert.equal(rebanhoAtivo(antes), rebanhoAtivo(depois), 'consolidado não muda');
});

test('ajuste de lotação positivo e negativo', () => {
  assert.equal(rebanhoAtivo({ lotes: [lote({ qtd: 12 })], animais: [] }), 12);
  assert.equal(rebanhoAtivo({ lotes: [lote({ qtd: 7 })], animais: [] }), 7);
});

// ── "Todas as fazendas" e dados órfãos ──────────────────────────────────────
test('consolidado conta cada lote UMA vez e bate com a soma das fazendas', () => {
  const db = {
    lotes: [
      lote({ id: 1, faz_id: 1, qtd: 10 }),
      lote({ id: 2, faz_id: 1, qtd: 5 }),
      lote({ id: 3, faz_id: 2, qtd: 7 }),
    ],
    animais: [],
  };
  assert.equal(rebanhoAtivo(db, 1), 15);
  assert.equal(rebanhoAtivo(db, 2), 7);
  assert.equal(rebanhoAtivo(db), 22, 'consolidado = 15 + 7, sem duplicar');
});

test('lote SEM fazenda aparece separado, sem ser duplicado nem descartado', () => {
  const db = {
    lotes: [lote({ id: 1, faz_id: 1, qtd: 10 }), lote({ id: 2, faz_id: null, qtd: 3 })],
    animais: [],
  };
  const r = rebanhoPorFazenda(db);
  assert.equal(r.porFazenda.get(1), 10);
  assert.equal(r.semFazenda, 3);
  assert.equal(r.total, 13, 'total = fazendas + órfãos');
  assert.equal(r.total, rebanhoAtivo(db), 'bate com o consolidado');
  assert.equal(SEM_FAZENDA, 'sem_fazenda');
});

test('invariante: total consolidado == soma por fazenda + sem fazenda', () => {
  const db = {
    lotes: [
      lote({ id: 1, faz_id: 1, qtd: 4 }),
      lote({ id: 2, faz_id: 2, qtd: 6 }),
      lote({ id: 3, faz_id: undefined, qtd: 2 }),
      lote({ id: 4, faz_id: 1, status: 'vendido', qtd: 99 }), // não entra
    ],
    animais: [],
  };
  const r = rebanhoPorFazenda(db);
  const somaFazendas = [...r.porFazenda.values()].reduce((s, v) => s + v, 0);
  assert.equal(r.total, somaFazendas + r.semFazenda);
  assert.equal(r.total, 12);
});

test('animal órfão (sem lote) não entra no rebanho por lote', () => {
  const db = { lotes: [lote({ qtd: null })], animais: [animal({ lote_id: null, qtd: 5 })] };
  assert.equal(rebanhoAtivo(db), 0, 'animal sem lote não é somado a lote nenhum');
});

// ── Pastos ──────────────────────────────────────────────────────────────────
test('lote sem pasto não é atribuído a nenhum pasto', () => {
  const db = {
    lotes: [lote({ id: 1, qtd: 10, pastagem_id: null })],
    animais: [],
    pastagens: [{ id: 'p1', fazenda_id: 1, area_ha: 10, capacidade_suporte_ua_ha: 2 }],
  };
  assert.equal(lotacaoDosPastos(db)[0].cabecas, 0);
  assert.equal(rebanhoAtivo(db), 10, 'mas segue no rebanho da fazenda');
});

test('pasto inativo é sinalizado, não omitido', () => {
  const db = {
    lotes: [], animais: [],
    pastagens: [{ id: 'p1', fazenda_id: 1, status: 'inativo', area_ha: 10, capacidade_suporte_ua_ha: 2 }],
  };
  const p = lotacaoDosPastos(db)[0];
  assert.equal(p.ativo, false);
  assert.equal(p.cabecas, 0);
});

test('pasto sem capacidade cadastrada devolve taxa null, não 0', () => {
  const db = {
    lotes: [lote({ qtd: 10, pastagem_id: 'p1' })], animais: [],
    pastagens: [{ id: 'p1', fazenda_id: 1, area_ha: 0, capacidade_suporte_ua_ha: 0 }],
  };
  const p = lotacaoDosPastos(db)[0];
  assert.equal(p.taxaOcupacao, null, '0 leria como "vazio", null diz "não dá para calcular"');
  assert.equal(p.saldoUa, null);
  assert.equal(p.superlotado, false);
});

test('superlotação real é detectada', () => {
  const db = {
    lotes: [lote({ qtd: 100, p_at: 450, pastagem_id: 'p1' })], animais: [],
    pastagens: [{ id: 'p1', fazenda_id: 1, area_ha: 10, capacidade_suporte_ua_ha: 2 }], // 20 UA
  };
  const p = lotacaoDosPastos(db)[0];
  assert.equal(p.uaOcupada, 100);
  assert.equal(p.superlotado, true);
});

// ── Segurança: quantidade nunca negativa ────────────────────────────────────
test('rejeita baixa maior que o saldo, com mensagem clara', () => {
  const r = validarBaixaRebanho(lote({ qtd: 8 }), 10, []);
  assert.equal(r.ok, false);
  assert.match(r.erro, /indispon[íi]vel/i);
  assert.match(r.erro, /8/);
  assert.match(r.erro, /10/);
});

test('aceita baixa até o saldo exato (venda total)', () => {
  const r = validarBaixaRebanho(lote({ qtd: 8 }), 8, []);
  assert.equal(r.ok, true);
  assert.equal(r.saldoFinal, 0);
});

test('rejeita quantidade zero, negativa ou não numérica', () => {
  for (const q of [0, -1, null, undefined, 'abc']) {
    assert.equal(validarBaixaRebanho(lote({ qtd: 8 }), q, []).ok, false, String(q));
  }
});

test('repetir a mesma baixa não deixa o saldo negativo', () => {
  // Simula duplo-envio/corrida: a 2ª chamada vê o saldo já reduzido e é rejeitada.
  const primeira = aplicarBaixaRebanho(lote({ qtd: 8 }), 8, []);
  assert.equal(primeira.ok, true);
  assert.equal(primeira.qtdFinal, 0);

  const segunda = aplicarBaixaRebanho(lote({ qtd: primeira.qtdFinal }), 8, []);
  assert.equal(segunda.ok, false, 'a repetição precisa ser rejeitada');
  assert.equal(segunda.qtdFinal, 0, 'e o saldo continua 0, nunca -8');
});

test('baixa em lote inexistente é rejeitada', () => {
  assert.equal(validarBaixaRebanho(null, 1, []).ok, false);
});

// ── Consistência entre telas ────────────────────────────────────────────────
test('todas as telas recebem a MESMA quantidade a partir da fonte única', () => {
  const db = {
    lotes: [lote({ id: 1, faz_id: 1, qtd: 8, p_at: 300, pastagem_id: 'p1' })],
    animais: [animal({ id: 1, lote_id: 1, qtd: 10, p_at: 300 })], // defasado de propósito
    pastagens: [{ id: 'p1', fazenda_id: 1, area_ha: 10, capacidade_suporte_ua_ha: 2 }],
  };
  const esperado = 8;
  assert.equal(qtdCabecasDoLote(db.lotes[0], db.animais), esperado, 'Lotes');
  assert.equal(rebanhoAtivo(db, 1), esperado, 'Painel Geral / fazenda');
  assert.equal(rebanhoAtivo(db), esperado, 'Todas as fazendas');
  assert.equal(rebanhoPorFazenda(db).porFazenda.get(1), esperado, 'consolidado por fazenda');
  assert.equal(lotacaoDosPastos(db)[0].cabecas, esperado, 'Pastos');
  assert.ok(Math.abs(uaDoLote(db.lotes[0], db.animais) - (300 / 450) * esperado) < 1e-9, 'UA/Indicadores');
});
