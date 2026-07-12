import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararTransferenciaAnimais, prepararRenomearLote } from './acoesLote.js';

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

test('transferência válida atualiza os dois lotes e cria movimentação', () => {
  const r = prepararTransferenciaAnimais(db(), { loteOrigemId: 10, loteDestinoId: 11, quantidade: 15 });
  assert.equal(r.ok, true);
  assert.equal(r.resumo.origemQtdFinal, 67);
  assert.equal(r.resumo.destinoQtdFinal, 79);
  assert.equal(r.writes.movimentacaoAnimal.tipo, 'transferencia_saida');
  assert.equal(r.writes.movimentacaoAnimal.lote_id, 10);
  assert.equal(r.writes.movimentacaoAnimal.destino_lote_id, 11);
  assert.equal(r.writes.loteOrigem.qtd, 67);
  assert.equal(r.writes.loteDestino.qtd, 79);
});

test('peso médio do destino é ponderado', () => {
  const r = prepararTransferenciaAnimais(db(), { loteOrigemId: 10, loteDestinoId: 11, quantidade: 10 });
  // (64*478 + 10*312) / 74
  const esperado = (64 * 478 + 10 * 312) / 74;
  assert.ok(Math.abs(r.writes.loteDestino.p_at - esperado) < 1e-6);
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
