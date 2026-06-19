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
