import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGrupoAnimaisAutoPatch, buildPesagemInicialPatch, buildAjusteLotacaoPatch, deveAvisarSaldoPositivoAoFinalizar, loteEstaBloqueado } from './lotesLogic.js';

// Sprint 37.1: editar um lote (ex.: cabeças) não atualizava o grupo
// correspondente em `animais` criado automaticamente no cadastro (Sprint 35),
// deixando UA/Resultado/Decisão de Venda desatualizados (eles leem `animais`,
// nunca `lotes.qtd`). buildGrupoAnimaisAutoPatch é reusado tanto na criação
// quanto na sincronização pós-edição em LotesPage.jsx.

test('buildGrupoAnimaisAutoPatch reflete qtd atualizada do lote editado', () => {
  const loteEditado = {
    id: 21,
    nome: 'QA371 Lote Teste',
    faz_id: 641,
    qtd: 12,
    p_ini: 300,
    p_at: 320,
    entrada: '2026-06-25',
  };

  const patch = buildGrupoAnimaisAutoPatch(loteEditado);

  assert.equal(patch.qtd, 12);
  assert.equal(patch.p_ini, 300);
  assert.equal(patch.p_at, 320);
  assert.equal(patch.lote_id, 21);
  assert.equal(patch.nome, 'QA371 Lote Teste');
});

test('buildGrupoAnimaisAutoPatch retorna null quando qtd cai a zero', () => {
  const loteSemCabecas = { id: 21, nome: 'QA371 Lote Teste', faz_id: 641, qtd: 0, p_ini: 300 };
  assert.equal(buildGrupoAnimaisAutoPatch(loteSemCabecas), null);
});

test('buildGrupoAnimaisAutoPatch usa p_ini como p_at quando peso atual não informado', () => {
  const lote = { id: 21, nome: 'Lote X', faz_id: 1, qtd: 5, p_ini: 280 };
  const patch = buildGrupoAnimaisAutoPatch(lote);
  assert.equal(patch.p_at, 280);
});

// Bug 3.2 — a primeira pesagem do histórico deve corresponder ao peso médio
// de entrada informado no cadastro do lote.
test('buildPesagemInicialPatch usa peso de entrada e data de entrada do lote', () => {
  const lote = { id: 21, entrada: '2026-06-25', p_ini: 405 };
  const patch = buildPesagemInicialPatch(lote);
  assert.equal(patch.lote_id, 21);
  assert.equal(patch.peso_medio, 405);
  assert.equal(patch.data, '2026-06-25');
  assert.equal(patch.tipo, 'lote');
});

test('buildPesagemInicialPatch retorna null sem peso de entrada informado', () => {
  assert.equal(buildPesagemInicialPatch({ id: 21, entrada: '2026-06-25', p_ini: 0 }), null);
  assert.equal(buildPesagemInicialPatch({ id: 21, entrada: '2026-06-25' }), null);
});

test('buildPesagemInicialPatch cai para a data de hoje quando o lote não tem entrada', () => {
  const patch = buildPesagemInicialPatch({ id: 21, p_ini: 300 });
  assert.equal(patch.data, new Date().toISOString().slice(0, 10));
});

// Ajuste de lotação: correção administrativa da contagem, distinta de venda/
// morte/transferência. Não gera financeiro, não altera peso.
test('buildAjusteLotacaoPatch reduz qtd e registra o motivo com a mudança', () => {
  const lote = { id: 21, qtd: 82 };
  const r = buildAjusteLotacaoPatch({ lote, novaQtd: 78, motivo: 'Recontagem física', data: '2026-07-11' });
  assert.equal(r.ok, true);
  assert.equal(r.resumo.qtdAnterior, 82);
  assert.equal(r.resumo.qtdNova, 78);
  assert.equal(r.resumo.delta, -4);
  assert.equal(r.writes.loteUpdate.qtd, 78);
  assert.equal(r.writes.movimentacao.tipo, 'ajuste');
  assert.equal(r.writes.movimentacao.qtd, -4);
  assert.equal(r.writes.movimentacao.valor_total, 0);
  assert.match(r.writes.movimentacao.obs, /Recontagem física/);
  assert.match(r.writes.movimentacao.obs, /82.*78/);
});

test('buildAjusteLotacaoPatch aceita aumento de qtd (animal não registrado)', () => {
  const r = buildAjusteLotacaoPatch({ lote: { id: 1, qtd: 50 }, novaQtd: 53, motivo: 'Animal esquecido no cadastro', data: '2026-07-11' });
  assert.equal(r.ok, true);
  assert.equal(r.resumo.delta, 3);
});

test('buildAjusteLotacaoPatch rejeita quantidade negativa, não-inteira ou sem mudança', () => {
  assert.equal(buildAjusteLotacaoPatch({ lote: { id: 1, qtd: 10 }, novaQtd: -1, motivo: 'x' }).erro, 'QUANTIDADE_INVALIDA');
  assert.equal(buildAjusteLotacaoPatch({ lote: { id: 1, qtd: 10 }, novaQtd: 5.5, motivo: 'x' }).erro, 'QUANTIDADE_INVALIDA');
  assert.equal(buildAjusteLotacaoPatch({ lote: { id: 1, qtd: 10 }, novaQtd: 10, motivo: 'x' }).erro, 'SEM_ALTERACAO');
});

test('buildAjusteLotacaoPatch exige motivo', () => {
  assert.equal(buildAjusteLotacaoPatch({ lote: { id: 1, qtd: 10 }, novaQtd: 8, motivo: '' }).erro, 'MOTIVO_VAZIO');
  assert.equal(buildAjusteLotacaoPatch({ lote: { id: 1, qtd: 10 }, novaQtd: 8, motivo: '   ' }).erro, 'MOTIVO_VAZIO');
});

test('buildAjusteLotacaoPatch exige lote válido', () => {
  assert.equal(buildAjusteLotacaoPatch({ lote: null, novaQtd: 8, motivo: 'x' }).erro, 'LOTE_INVALIDO');
});

test('buildAjusteLotacaoPatch não altera peso médio (efeito só na quantidade)', () => {
  const r = buildAjusteLotacaoPatch({ lote: { id: 1, qtd: 10, p_at: 400 }, novaQtd: 8, motivo: 'x' });
  assert.equal(r.writes.loteUpdate.p_at, undefined);
  assert.equal(r.writes.movimentacao.peso_medio, 0);
});

// Seção 6 — finalização do lote: saldo positivo é permitido, mas avisado.
test('deveAvisarSaldoPositivoAoFinalizar avisa quando lote.qtd > 0', () => {
  assert.equal(deveAvisarSaldoPositivoAoFinalizar({ qtd: 12 }), true);
});

test('deveAvisarSaldoPositivoAoFinalizar não avisa com saldo zero ou ausente', () => {
  assert.equal(deveAvisarSaldoPositivoAoFinalizar({ qtd: 0 }), false);
  assert.equal(deveAvisarSaldoPositivoAoFinalizar({}), false);
  assert.equal(deveAvisarSaldoPositivoAoFinalizar(null), false);
});

// Seção 6 — bloquear lançamentos incompatíveis após finalização.
test('loteEstaBloqueado: true para encerrado/vendido, false para ativo', () => {
  assert.equal(loteEstaBloqueado({ status: 'encerrado' }), true);
  assert.equal(loteEstaBloqueado({ status: 'vendido' }), true);
  assert.equal(loteEstaBloqueado({ status: 'ativo' }), false);
  assert.equal(loteEstaBloqueado({}), false, 'sem status definido, assume ativo');
  assert.equal(loteEstaBloqueado({ status: 'ENCERRADO' }), true, 'case-insensitive');
});
