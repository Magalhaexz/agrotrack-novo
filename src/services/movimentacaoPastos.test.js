import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatHistoricoMensagem, getFriendlyErrorMessage } from './movimentacaoPastos.js';

// ─── formatHistoricoMensagem ────────────────────────────────────────────────

test('formatHistoricoMensagem descreve movimentação entre dois pastos', () => {
  const mensagem = formatHistoricoMensagem({
    data_movimentacao: '2026-06-20',
    pastagem_origem: { nome: 'Pasto 1' },
    pastagem_destino: { nome: 'Pasto 3' },
  }, { loteNome: 'Recria Machos 2026' });

  assert.equal(
    mensagem,
    'Em 20/06/2026, o lote Recria Machos 2026 foi movido do pasto Pasto 1 para o pasto Pasto 3.'
  );
});

test('formatHistoricoMensagem descreve primeira vinculação quando não há pasto de origem', () => {
  const mensagem = formatHistoricoMensagem({
    data_movimentacao: '2026-06-20',
    pastagem_origem: null,
    pastagem_destino: { nome: 'Pasto 3' },
  }, { loteNome: 'Recria Machos 2026' });

  assert.equal(mensagem, 'Em 20/06/2026, o lote Recria Machos 2026 foi vinculado ao pasto Pasto 3.');
});

test('formatHistoricoMensagem usa lote_nome do registro quando loteNome não é informado', () => {
  const mensagem = formatHistoricoMensagem({
    data_movimentacao: '2026-06-20',
    lote_nome: 'Lote B',
    pastagem_origem: { nome: 'Pasto 1' },
    pastagem_destino: { nome: 'Pasto 2' },
  });

  assert.match(mensagem, /^Em 20\/06\/2026, o lote Lote B/);
});

// ─── getFriendlyErrorMessage ────────────────────────────────────────────────

test('getFriendlyErrorMessage repassa mensagens lançadas pela função mover_lote_para_pasto', () => {
  const mensagem = getFriendlyErrorMessage({ code: '22023', message: 'O pasto de destino pertence a outra fazenda.' });
  assert.equal(mensagem, 'O pasto de destino pertence a outra fazenda.');
});

test('getFriendlyErrorMessage traduz erro de sessão expirada', () => {
  const mensagem = getFriendlyErrorMessage({ status: 401, message: 'JWT expired' });
  assert.match(mensagem, /sessão expirou/i);
});

test('getFriendlyErrorMessage traduz erro de row-level security', () => {
  const mensagem = getFriendlyErrorMessage({ code: '42501', message: 'permission denied for table lotes (row-level security)' });
  assert.match(mensagem, /não tem permissão/i);
});

test('getFriendlyErrorMessage traduz falha de rede', () => {
  const mensagem = getFriendlyErrorMessage({ message: 'Failed to fetch' });
  assert.match(mensagem, /conectar/i);
});

test('getFriendlyErrorMessage usa mensagem genérica quando não há erro', () => {
  const mensagem = getFriendlyErrorMessage(null);
  assert.match(mensagem, /não foi possível confirmar/i);
});

// ─── moverLoteParaPasto (Seção 5) ───────────────────────────────────────────
// A regra de negócio (lote permanece ativo, quantidade não muda, pasto
// anterior/novo registrados, fazenda não muda, operação atômica) está
// implementada na função SQL mover_lote_para_pasto (RPC) — verificada por
// leitura de supabase/migrations/20260619113446_lote_pastagens_historico.sql:
// só altera lotes.pastagem_id, nunca lotes.status/lotes.faz_id/lotes.qtd, e
// exige v_destino.faz_id = v_lote.faz_id. Os testes aqui cobrem a camada
// cliente: que os parâmetros corretos (e só eles) chegam ao RPC.
import { supabase } from '../lib/supabase.js';
import { moverLoteParaPasto } from './movimentacaoPastos.js';

test('moverLoteParaPasto envia ao RPC só os parâmetros de movimentação (nunca status/faz_id/qtd)', async () => {
  let capturado = null;
  supabase.rpc = async (name, params) => {
    capturado = { name, params };
    return { data: { id: 'hist-1' }, error: null };
  };

  const r = await moverLoteParaPasto({
    loteId: 21,
    pastagemDestinoId: 'pasto-2',
    dataMovimentacao: '2026-07-11',
    quantidadeCabecas: 15,
    motivo: 'Rotação de pasto',
  });

  assert.equal(r.success, true);
  assert.equal(capturado.name, 'mover_lote_para_pasto');
  assert.deepEqual(Object.keys(capturado.params).sort(), [
    'p_data_movimentacao', 'p_lote_id', 'p_motivo', 'p_observacoes', 'p_pastagem_destino_id', 'p_quantidade_cabecas',
  ]);
  assert.equal(capturado.params.p_lote_id, 21);
  assert.equal(capturado.params.p_pastagem_destino_id, 'pasto-2');
  assert.ok(!('status' in capturado.params), 'não deve enviar status — lote não é finalizado/vendido por esta ação');
  assert.ok(!('faz_id' in capturado.params), 'não deve enviar faz_id — fazenda não muda por esta ação');
  assert.ok(!('qtd' in capturado.params), 'quantidadeCabecas só registra histórico, não sobrescreve lotes.qtd');
});

test('moverLoteParaPasto: sucesso devolve os dados do histórico criado', async () => {
  supabase.rpc = async () => ({ data: { id: 'hist-2', pastagem_destino_id: 'pasto-2' }, error: null });
  const r = await moverLoteParaPasto({ loteId: 1, pastagemDestinoId: 'pasto-2', dataMovimentacao: '2026-07-11' });
  assert.equal(r.success, true);
  assert.equal(r.data.id, 'hist-2');
  assert.equal(r.error, null);
});

test('moverLoteParaPasto: erro do RPC (ex.: pasto de outra fazenda) vira mensagem amigável, sem quebrar', async () => {
  supabase.rpc = async () => ({ data: null, error: { message: 'O pasto de destino pertence a outra fazenda.' } });
  const r = await moverLoteParaPasto({ loteId: 1, pastagemDestinoId: 'pasto-9', dataMovimentacao: '2026-07-11' });
  assert.equal(r.success, false);
  assert.equal(r.data, null);
  assert.match(r.error, /outra fazenda/);
});
