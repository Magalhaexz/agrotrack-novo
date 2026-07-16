// Harness de webhook REALISTA (Sprint Paridade 1, bloco 5). Passa pelo
// handler HTTP real (`api/telegram-webhook.js`): payload de update do Telegram
// → autenticação por secret_token → rate limit → busca de conexão por
// chat_id → `processarComandoBot` → resposta capturada. NÃO usa o cliente
// Telegram real nem rede: injeta um client Supabase fake (mesmo das matrizes)
// e um capturador de envio via o seam `deps` do handler. É "validação por
// harness de webhook realista", NÃO validação no aplicativo Telegram real.
import test from 'node:test';
import assert from 'node:assert/strict';
import handler from './telegram-webhook.js';
import { makeClient, baseTables } from './_fakeTelegramClient.js';

// chat_id único por teste: o rate limit do handler é um Map em memória por
// chat_id que persiste entre invocações (como na function Vercel "quente").
// Um chat distinto por teste dá a cada um seu próprio balde — e é realista
// (cada produtor tem seu chat). Sem isso, os multi-turn estouram o limite.
let contadorChat = 900000;
function novoChat() { contadorChat += 1; return contadorChat; }

function tabelasComConexao(perfil, fazendaId, chatId) {
  const t = baseTables(perfil);
  t.telegram_connections = [{
    id: `conn-${chatId}`, owner_user_id: 'o1', user_id: 'u1',
    telegram_chat_id: String(chatId), fazenda_id: fazendaId, is_active: true,
  }];
  return t;
}

/** Roda UM update pelo handler real e devolve o texto que o bot enviaria. */
async function enviarWebhook(client, texto, chatId) {
  const enviados = [];
  const deps = {
    getSupabaseAdminClient: () => client,
    enviarMensagemTelegramParaChat: async (cid, msg) => { enviados.push({ chatId: cid, texto: msg }); return { messageId: 1 }; },
  };
  const req = {
    method: 'POST',
    headers: {},
    body: {
      update_id: Math.floor(Math.random() * 1e9),
      message: {
        message_id: 1,
        from: { id: 111, is_bot: false, first_name: 'QA', username: 'qa_user' },
        chat: { id: chatId, type: 'private' },
        date: 1700000000,
        text: texto,
      },
    },
  };
  const captured = {};
  const res = {
    status(code) { captured.status = code; return this; },
    json(payload) { captured.json = payload; return captured; },
  };
  await handler(req, res, deps);
  return { status: captured.status, json: captured.json, resposta: enviados.at(-1)?.texto ?? null };
}

test('harness: método não-POST é rejeitado (405)', async () => {
  const chat = novoChat();
  const client = makeClient(tabelasComConexao('operador', 1, chat));
  const res = { _s: null, status(c) { this._s = c; return this; }, json() { return this; } };
  await handler({ method: 'GET', headers: {}, body: {} }, res, { getSupabaseAdminClient: () => client, enviarMensagemTelegramParaChat: async () => {} });
  assert.equal(res._s, 405);
});

test('harness: resumo consolidado de todas as fazendas', async () => {
  const chat = novoChat();
  const t = tabelasComConexao('operador', null, chat); // sem fazenda ativa
  t.fazendas.push({ id: 2, nome: 'Boa Vista', owner_user_id: 'o1' });
  const client = makeClient(t);
  const r = await enviarWebhook(client, 'resumo de todas as fazendas', chat);
  assert.equal(r.status, 200);
  assert.match(r.resposta, /Resumo consolidado/);
  assert.match(r.resposta, /Santa Clara/);
  assert.match(r.resposta, /Boa Vista/);
});

test('harness: editar lote (peso inicial) → confirma → grava', async () => {
  const chat = novoChat();
  const t = tabelasComConexao('operador', 1, chat);
  const client = makeClient(t);
  let atual = await enviarWebhook(client, 'altere o peso inicial do lote Recria 01 para 380 kg', chat);
  for (let i = 0; i < 5 && !/Confirme a edição do lote/.test(atual.resposta || ''); i += 1) {
    atual = await enviarWebhook(client, 'não', chat);
  }
  assert.match(atual.resposta, /Confirme a edição do lote/);
  const conf = await enviarWebhook(client, '/confirmar', chat);
  assert.match(conf.resposta, /Registrado/i);
  assert.equal(t.lotes.find((l) => l.id === 10).p_ini, 380);
});

test('harness: tratar alerta → confirma; reabrir → confirma', async () => {
  const chat = novoChat();
  const t = tabelasComConexao('operador', 1, chat);
  t.estoque = [{ id: 1, produto: 'Sal', data_validade: '2020-01-01', alerta_dias_antes: 5, quantidade_atual: 100, quantidade_minima: 10, owner_user_id: 'o1' }];
  const client = makeClient(t);
  await enviarWebhook(client, '/alertas', chat);
  const prop = await enviarWebhook(client, 'resolver alerta 1', chat);
  assert.match(prop.resposta, /Vou marcar como resolvido/);
  const conf = await enviarWebhook(client, '/confirmar', chat);
  assert.match(conf.resposta, /Alerta atualizado/i);
  assert.equal(t.alertas_tratativas.length, 1);

  await enviarWebhook(client, 'reabrir o alerta vencido', chat);
  const confReabrir = await enviarWebhook(client, '/confirmar', chat);
  assert.match(confReabrir.resposta, /Alerta reaberto/i);
  assert.equal(t.alertas_tratativas.length, 0);
});

test('harness: excluir pasto com lote ocupando é recusado', async () => {
  const chat = novoChat();
  const t = tabelasComConexao('gerente', 1, chat); // pastagens:excluir exige gerente+
  t.pastagens = [{ id: 'p1', nome: 'Capim Sul', faz_id: 1, owner_user_id: 'o1' }];
  t.lotes[0].pastagem_id = 'p1';
  const client = makeClient(t);
  const r = await enviarWebhook(client, 'excluir o pasto Capim Sul', chat);
  assert.match(r.resposta, /ocupado|vinculado/i);
  assert.equal(t.pastagens.length, 1);
});

test('harness: operação ambígua nunca vira ação', async () => {
  const chat = novoChat();
  const t = tabelasComConexao('operador', 1, chat);
  const client = makeClient(t);
  const r = await enviarWebhook(client, 'trocar lote Recria 01 para Engorda 02', chat);
  assert.match(r.resposta, /não ficou claro|Transferir|Renomear/i);
  assert.equal(t.telegram_operacoes_pendentes.filter((o) => o.status === 'pendente').length, 0);
});

test('harness: visualizador não escreve (bloqueado no handler real)', async () => {
  const chat = novoChat();
  const t = tabelasComConexao('visualizador', 1, chat);
  const client = makeClient(t);
  const r = await enviarWebhook(client, 'vendi 10 animais do lote Recria 01', chat);
  assert.match(r.resposta, /permissão/i);
});

test('harness: multi-fazenda sem fazenda ativa pede escolha antes de escrever', async () => {
  const chat = novoChat();
  const t = tabelasComConexao('operador', null, chat);
  t.fazendas.push({ id: 2, nome: 'Boa Vista', owner_user_id: 'o1' });
  const client = makeClient(t);
  const r = await enviarWebhook(client, 'ajustar o lote Recria 01 para 70 cabeças', chat);
  assert.match(r.resposta, /mais de uma fazenda/i);
});

test('harness: confirmação repetida (callback/retry) não duplica', async () => {
  const chat = novoChat();
  const t = tabelasComConexao('operador', 1, chat);
  const client = makeClient(t);
  await enviarWebhook(client, 'transferir 15 animais do lote Recria 01 para Engorda 02', chat);
  const c1 = await enviarWebhook(client, '/confirmar', chat);
  assert.match(c1.resposta, /Transferência concluída/i);
  const c2 = await enviarWebhook(client, '/confirmar', chat);
  assert.match(c2.resposta, /nenhuma operação/i);
  assert.equal(t.movimentacoes_animais.length, 1); // não duplicou
});

test('harness: sem conexão (chat desconhecido) orienta a enviar o código', async () => {
  const chat = novoChat();
  const t = baseTables('operador');
  t.telegram_connections = []; // nenhuma conexão para este chat
  const client = makeClient(t);
  const r = await enviarWebhook(client, 'resumo', chat);
  assert.match(r.resposta, /código/i);
});
