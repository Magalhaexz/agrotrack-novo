import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularCapacidadeTotalUa,
  calcularDiagnosticoCapacidade,
  calcularUaPorAnimal,
  calcularUaPorLote,
  calcularUaTotalFazenda,
} from '../src/domain/unidadeAnimal.js';

test('calcularUaPorAnimal aplica formula UA = peso_vivo_kg / 450', () => {
  assert.equal(calcularUaPorAnimal(450), 1);
  assert.equal(calcularUaPorAnimal(225), 0.5);
});

test('calcularUaPorLote e calcularUaTotalFazenda agregam corretamente', () => {
  const animais = [
    { lote_id: 1, qtd: 10, p_at: 450 },
    { lote_id: 1, qtd: 5, p_at: 225 },
    { lote_id: 2, qtd: 4, p_at: 450 },
  ];

  assert.equal(calcularUaPorLote(animais, 1), 12.5);
  assert.equal(calcularUaPorLote(animais, 2), 4);
  assert.equal(calcularUaTotalFazenda(animais), 16.5);
});

// ── Regressão PST-1/PST-2 (teste de campo): UA/status de lotação divergia de
// lote.qtd (fonte canônica) — venda/morte/ajuste sincronizam animais[], mas
// um lote com contagem antiga em animais[] (dado legado, ou raça edge case)
// ainda derrubava o cálculo de capacidade. E um lote encerrado/vendido
// continuava contando na capacidade da fazenda para sempre. ──

test('calcularUaPorLote com loteCanonico usa lote.qtd, não a contagem desatualizada de animais[]', () => {
  // animais[] ainda diz 15 cabeças (não sincronizado), mas o lote (canônico) já está em 10.
  const animais = [{ lote_id: 1, qtd: 15, p_at: 450 }];
  const loteCanonico = { id: 1, qtd: 10, p_at: 450 };

  assert.equal(calcularUaPorLote(animais, 1, loteCanonico), 10); // 10 * (450/450)
  assert.equal(calcularUaPorLote(animais, 1), 15); // sem loteCanonico: comportamento antigo preservado
});

test('calcularUaTotalFazenda com lotes ignora lote finalizado/vendido na capacidade da fazenda', () => {
  const animais = [
    { lote_id: 1, qtd: 20, p_at: 450 }, // lote ativo
    { lote_id: 2, qtd: 30, p_at: 450 }, // lote já vendido — não deve contar
  ];
  const lotes = [
    { id: 1, qtd: 20, p_at: 450, status: 'ativo' },
    { id: 2, qtd: 0, p_at: 450, status: 'vendido' },
  ];

  assert.equal(calcularUaTotalFazenda(animais, lotes), 20); // só o lote ativo
  assert.equal(calcularUaTotalFazenda(animais), 50); // sem lotes: comportamento antigo (soma tudo) preservado
});

test('calcularDiagnosticoCapacidade aceita lotes e propaga o filtro de status', () => {
  // Sem o filtro por lotes, os 100 do lote 2 (encerrado) empurrariam a
  // fazenda para "superlotado" mesmo tendo capacidade de sobra para o
  // rebanho realmente ativo.
  const animais = [{ lote_id: 1, qtd: 10, p_at: 450 }, { lote_id: 2, qtd: 100, p_at: 450 }];
  const lotes = [{ id: 1, qtd: 10, p_at: 450, status: 'ativo' }, { id: 2, qtd: 0, p_at: 450, status: 'encerrado' }];
  const pastagens = [{ area_ha: 10, capacidade_suporte_ua_ha: 1.5 }]; // capacidade = 15 UA

  const diagnostico = calcularDiagnosticoCapacidade({ animais, pastagens, lotes });
  assert.equal(diagnostico.uaTotalFazenda, 10); // só o lote 1 (ativo)
  assert.equal(diagnostico.statusCapacidade, 'dentro_da_capacidade'); // 10 UA < 15 de capacidade
});

test('calcularDiagnosticoCapacidade retorna saldo e status da capacidade', () => {
  const animais = [{ lote_id: 1, qtd: 20, p_at: 450 }];
  const pastagens = [{ area_ha: 10, capacidade_suporte_ua_ha: 1.5 }];

  const diagnostico = calcularDiagnosticoCapacidade({ animais, pastagens });

  assert.equal(calcularCapacidadeTotalUa(pastagens), 15);
  assert.equal(diagnostico.uaTotalFazenda, 20);
  assert.equal(diagnostico.saldoCapacidadeUa, -5);
  assert.equal(diagnostico.statusCapacidade, 'superlotado');
  assert.equal(diagnostico.superlotado, true);
});

