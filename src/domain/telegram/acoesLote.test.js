import test from 'node:test';
import assert from 'node:assert/strict';
import {
  prepararTransferenciaAnimais, prepararRenomearLote,
  prepararVendaAnimais, prepararMorteAnimais, prepararFinalizarLote,
  prepararAjusteLotacao, prepararEdicaoLote,
} from './acoesLote.js';

function db() {
  return {
    lotes: [
      { id: 10, nome: 'Recria 01', status: 'ativo', qtd: 82, p_at: 312 },
      { id: 11, nome: 'Engorda 02', status: 'ativo', qtd: 64, p_at: 478 },
      { id: 12, nome: 'Encerrado', status: 'encerrado', qtd: 0, p_at: 0 },
    ],
    animais: [
      { id: 1, lote_id: 10, qtd: 82, p_at: 312 },
      { id: 2, lote_id: 11, qtd: 64, p_at: 478 },
    ],
  };
}

test('transferência válida atualiza os dois lotes e cria movimentação (via RPC transacional)', () => {
  const r = prepararTransferenciaAnimais(db(), { loteOrigemId: 10, loteDestinoId: 11, quantidade: 15 });
  assert.equal(r.ok, true);
  assert.equal(r.resumo.origemQtdFinal, 67);
  assert.equal(r.resumo.destinoQtdFinal, 79);
  assert.equal(r.rpc.nome, 'registrar_saida_lote');
  assert.equal(r.rpc.params.p_tipo, 'transferencia_saida');
  assert.equal(r.rpc.params.p_lote_id, 10);
  assert.equal(r.rpc.params.p_destino_lote_id, 11);
  assert.equal(r.rpc.params.p_qtd, 15);
});

test('peso médio do destino é ponderado', () => {
  const r = prepararTransferenciaAnimais(db(), { loteOrigemId: 10, loteDestinoId: 11, quantidade: 10 });
  // (64*478 + 10*312) / 74
  const esperado = (64 * 478 + 10 * 312) / 74;
  assert.ok(Math.abs(r.rpc.params.p_peso_destino_final - esperado) < 1e-6);
});

test('rejeita quantidade maior que o disponível', () => {
  assert.equal(prepararTransferenciaAnimais(db(), { loteOrigemId: 10, loteDestinoId: 11, quantidade: 999 }).erro, 'ANIMAIS_INSUFICIENTES');
});

test('rejeita quantidade inválida', () => {
  assert.equal(prepararTransferenciaAnimais(db(), { loteOrigemId: 10, loteDestinoId: 11, quantidade: 0 }).erro, 'QUANTIDADE_INVALIDA');
  assert.equal(prepararTransferenciaAnimais(db(), { loteOrigemId: 10, loteDestinoId: 11, quantidade: 1.5 }).erro, 'QUANTIDADE_INVALIDA');
  assert.equal(prepararTransferenciaAnimais(db(), { loteOrigemId: 10, loteDestinoId: 11, quantidade: null }).erro, 'QUANTIDADE_INVALIDA');
});

test('rejeita mesmo lote, lote inexistente e lote inativo', () => {
  assert.equal(prepararTransferenciaAnimais(db(), { loteOrigemId: 10, loteDestinoId: 10, quantidade: 5 }).erro, 'MESMO_LOTE');
  assert.equal(prepararTransferenciaAnimais(db(), { loteOrigemId: 99, loteDestinoId: 11, quantidade: 5 }).erro, 'LOTE_ORIGEM_NAO_ENCONTRADO');
  assert.equal(prepararTransferenciaAnimais(db(), { loteOrigemId: 10, loteDestinoId: 99, quantidade: 5 }).erro, 'LOTE_DESTINO_NAO_ENCONTRADO');
  assert.equal(prepararTransferenciaAnimais(db(), { loteOrigemId: 10, loteDestinoId: 12, quantidade: 5 }).erro, 'LOTE_INATIVO');
});

test('cai para lote.qtd quando não há linhas de animais', () => {
  const d = { lotes: [{ id: 1, nome: 'A', status: 'ativo', qtd: 20, p_at: 300 }, { id: 2, nome: 'B', status: 'ativo', qtd: 5, p_at: 280 }], animais: [] };
  const r = prepararTransferenciaAnimais(d, { loteOrigemId: 1, loteDestinoId: 2, quantidade: 8 });
  assert.equal(r.ok, true);
  assert.equal(r.resumo.origemQtdFinal, 12);
  assert.equal(r.resumo.destinoQtdFinal, 13);
});

// Auditoria funcional: saldo de validação segue lote.qtd (canônico), mesmo
// quando `animais.qtd` está desatualizado — paridade com
// services/movimentacoes.js::obterResumoLote (Seção 8). Sem isso, um Ajuste
// de lotação (só grava em lote.qtd) ficava invisível para o bot: era possível
// transferir mais animais do que o saldo real usando a soma desatualizada de
// `animais`.
test('transferência via Telegram segue lote.qtd (canônico), não animais.qtd desatualizado', () => {
  const d = {
    lotes: [
      { id: 1, nome: 'A', status: 'ativo', qtd: 40, p_at: 300 },
      { id: 2, nome: 'B', status: 'ativo', qtd: 5, p_at: 280 },
    ],
    // animais ainda mostra 82 (não sincronizado após um Ajuste de lotação que reduziu para 40).
    animais: [{ id: 1, lote_id: 1, qtd: 82, p_at: 300 }],
  };

  // Transferir 45 deveria falhar (só há 40 cabeças reais no lote), mesmo animais.qtd dizendo 82:
  assert.equal(
    prepararTransferenciaAnimais(d, { loteOrigemId: 1, loteDestinoId: 2, quantidade: 45 }).erro,
    'ANIMAIS_INSUFICIENTES'
  );

  // Transferir 40 (o saldo real canônico) deve funcionar:
  const r = prepararTransferenciaAnimais(d, { loteOrigemId: 1, loteDestinoId: 2, quantidade: 40 });
  assert.equal(r.ok, true);
  assert.equal(r.resumo.origemQtdFinal, 0);
});

test('renomear válido preserva o ID', () => {
  const r = prepararRenomearLote(db(), { loteId: 10, novoNome: 'Recria Norte' });
  assert.equal(r.ok, true);
  assert.equal(r.writes.loteUpdate.id, 10);
  assert.equal(r.writes.loteUpdate.nome, 'Recria Norte');
  assert.equal(r.resumo.nomeAnterior, 'Recria 01');
});

test('renomear rejeita vazio, igual e duplicado', () => {
  assert.equal(prepararRenomearLote(db(), { loteId: 10, novoNome: '  ' }).erro, 'NOME_VAZIO');
  assert.equal(prepararRenomearLote(db(), { loteId: 10, novoNome: 'Recria 01' }).erro, 'NOME_IGUAL');
  assert.equal(prepararRenomearLote(db(), { loteId: 10, novoNome: 'Engorda 02' }).erro, 'NOME_DUPLICADO');
});

test('renomear lote inexistente', () => {
  assert.equal(prepararRenomearLote(db(), { loteId: 99, novoNome: 'X' }).erro, 'LOTE_NAO_ENCONTRADO');
});

// ── Venda ────────────────────────────────────────────────────────────────────
test('venda válida atualiza qtd e gera receita quando valor > 0 (via RPC transacional)', () => {
  const r = prepararVendaAnimais(db(), { loteId: 10, quantidade: 10, valor: 25000, data: '2026-07-15' });
  assert.equal(r.ok, true);
  assert.ok(r.resumo.some((l) => l === 'Quantidade atual: 82 cabeças'));
  assert.ok(r.resumo.some((l) => /Quantidade vendida: 10/.test(l)));
  assert.ok(r.resumo.some((l) => /Quantidade restante: 72/.test(l)));
  assert.equal(r.rpc.nome, 'registrar_saida_lote');
  assert.equal(r.rpc.params.p_tipo, 'venda');
  assert.equal(r.rpc.params.p_lote_id, 10);
  assert.equal(r.rpc.params.p_qtd, 10);
  assert.equal(r.rpc.params.p_valor_total, 25000);
  assert.equal(r.rpc.params.p_data, '2026-07-15');
});

test('venda sem valor manda p_valor_total=0 (a RPC decide não lançar financeiro)', () => {
  const r = prepararVendaAnimais(db(), { loteId: 10, quantidade: 5 });
  assert.equal(r.ok, true);
  assert.equal(r.rpc.params.p_valor_total, 0);
});

test('venda rejeita quantidade acima do disponível, inválida e lote bloqueado/inexistente', () => {
  assert.equal(prepararVendaAnimais(db(), { loteId: 10, quantidade: 999 }).erro, 'ANIMAIS_INSUFICIENTES');
  assert.equal(prepararVendaAnimais(db(), { loteId: 10, quantidade: 0 }).erro, 'QUANTIDADE_INVALIDA');
  assert.equal(prepararVendaAnimais(db(), { loteId: 12, quantidade: 1 }).erro, 'LOTE_BLOQUEADO');
  assert.equal(prepararVendaAnimais(db(), { loteId: 99, quantidade: 1 }).erro, 'LOTE_NAO_ENCONTRADO');
});

// ── Morte / perda ────────────────────────────────────────────────────────────
test('morte válida atualiza qtd e nunca gera receita (via RPC transacional)', () => {
  const r = prepararMorteAnimais(db(), { loteId: 10, quantidade: 2, motivo: 'Doença respiratória' });
  assert.equal(r.ok, true);
  assert.equal(r.rpc.nome, 'registrar_saida_lote');
  assert.equal(r.rpc.params.p_tipo, 'morte');
  assert.equal(r.rpc.params.p_valor_total, 0);
  assert.equal(r.rpc.params.p_obs, 'Doença respiratória');
  assert.equal(r.rpc.params.p_qtd, 2);
});

test('morte rejeita quantidade acima do disponível', () => {
  assert.equal(prepararMorteAnimais(db(), { loteId: 10, quantidade: 999 }).erro, 'ANIMAIS_INSUFICIENTES');
});

// ── Finalizar lote ───────────────────────────────────────────────────────────
test('finalizar lote válido preserva histórico e só atualiza status (via RPC transacional)', () => {
  const r = prepararFinalizarLote(db(), { loteId: 10, motivo: 'Ciclo encerrado', data: '2026-07-15' });
  assert.equal(r.ok, true);
  assert.equal(r.rpc.nome, 'finalizar_lote');
  assert.equal(r.rpc.params.p_status, 'encerrado');
  assert.equal(r.rpc.params.p_motivo, 'Ciclo encerrado');
  assert.equal(r.rpc.params.p_data_encerramento, '2026-07-15');
});

test('finalizar lote exige motivo e rejeita lote já finalizado/inexistente', () => {
  assert.equal(prepararFinalizarLote(db(), { loteId: 10, motivo: '  ' }).erro, 'MOTIVO_VAZIO');
  assert.equal(prepararFinalizarLote(db(), { loteId: 12, motivo: 'X' }).erro, 'LOTE_JA_FINALIZADO');
  assert.equal(prepararFinalizarLote(db(), { loteId: 99, motivo: 'X' }).erro, 'LOTE_NAO_ENCONTRADO');
});

// ── Ajuste de lotação (reaproveita buildAjusteLotacaoPatch de lotesLogic.js) ─
test('ajuste de lotação válido gera update de qtd e movimentação tipo ajuste (via RPC transacional)', () => {
  const r = prepararAjusteLotacao(db(), { loteId: 10, quantidade: 70, motivo: 'Contagem física' });
  assert.equal(r.ok, true);
  assert.equal(r.rpc.nome, 'ajustar_lotacao_lote');
  assert.equal(r.rpc.params.p_lote_id, 10);
  assert.equal(r.rpc.params.p_nova_qtd, 70);
  assert.equal(r.rpc.params.p_motivo, 'Contagem física');
});

test('ajuste de lotação rejeita quantidade igual, negativa e lote bloqueado/inexistente', () => {
  assert.equal(prepararAjusteLotacao(db(), { loteId: 10, quantidade: 82, motivo: 'X' }).erro, 'SEM_ALTERACAO');
  assert.equal(prepararAjusteLotacao(db(), { loteId: 10, quantidade: -1, motivo: 'X' }).erro, 'QUANTIDADE_INVALIDA');
  assert.equal(prepararAjusteLotacao(db(), { loteId: 12, quantidade: 5, motivo: 'X' }).erro, 'LOTE_BLOQUEADO');
  assert.equal(prepararAjusteLotacao(db(), { loteId: 99, quantidade: 5, motivo: 'X' }).erro, 'LOTE_NAO_ENCONTRADO');
});

test('ajuste de lotação exige motivo (validado por buildAjusteLotacaoPatch)', () => {
  assert.equal(prepararAjusteLotacao(db(), { loteId: 10, quantidade: 70, motivo: '' }).erro, 'MOTIVO_VAZIO');
});

// ── Edição básica do lote (sexo/raça/observação) ────────────────────────────
test('edição de lote altera só os campos informados', () => {
  const r = prepararEdicaoLote(db(), { loteId: 10, sexo: 'femeas' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.writes[0].patch, { sexo: 'femea' });
});

test('edição de lote aceita múltiplos campos de uma vez', () => {
  const r = prepararEdicaoLote(db(), { loteId: 10, raca: 'Nelore', observacao: 'Grupo homogêneo' });
  assert.equal(r.writes[0].patch.raca, 'Nelore');
  assert.equal(r.writes[0].patch.obs, 'Grupo homogêneo');
});

test('edição de lote rejeita sexo inválido, nenhum campo, lote bloqueado/inexistente', () => {
  assert.equal(prepararEdicaoLote(db(), { loteId: 10, sexo: 'invalido' }).erro, 'SEXO_INVALIDO');
  assert.equal(prepararEdicaoLote(db(), { loteId: 10 }).erro, 'NENHUM_CAMPO_INFORMADO');
  assert.equal(prepararEdicaoLote(db(), { loteId: 12, raca: 'X' }).erro, 'LOTE_BLOQUEADO');
  assert.equal(prepararEdicaoLote(db(), { loteId: 99, raca: 'X' }).erro, 'LOTE_NAO_ENCONTRADO');
});

// ── Edição de peso inicial / data de entrada (Sprint Paridade 1, bloco 5) ───
test('edição de lote altera peso inicial e data de entrada (colunas reais: p_ini/entrada)', () => {
  const r = prepararEdicaoLote(db(), { loteId: 10, pesoInicial: 380, dataEntrada: '2026-07-10' });
  assert.equal(r.ok, true);
  assert.equal(r.writes[0].patch.p_ini, 380);
  assert.equal(r.writes[0].patch.entrada, '2026-07-10');
});

test('edição de lote rejeita peso inicial inválido', () => {
  assert.equal(prepararEdicaoLote(db(), { loteId: 10, pesoInicial: 0 }).erro, 'PESO_INVALIDO');
  assert.equal(prepararEdicaoLote(db(), { loteId: 10, pesoInicial: -5 }).erro, 'PESO_INVALIDO');
});
