// P1-03 — o executor legado do bot (`aplicarWrites`) rodava cada gravação do
// plano num `for` sequencial sem NUNCA checar `{ error }`: se um passo
// falhasse (rede, RLS, constraint), o loop seguia e o bot ainda respondia
// como se tivesse dado certo. Este arquivo cobre:
//
//   1. `aplicarWrites` em isolamento (unitário, sem RPC nenhuma): confirma
//      que qualquer erro interrompe IMEDIATAMENTE e lança, sem tentar o
//      próximo write — com as MESMAS formas de `writes` que
//      `cadastros.js`/`acoesEstoque.js` produzem para entrada/saída de
//      estoque (planos continuam puros; só o executor mudou).
//   2. O fluxo completo de entrada/saída de estoque via `/confirmar`, agora
//      atrás das RPCs transacionais `registrar_entrada_estoque_telegram`/
//      `registrar_saida_estoque_telegram` (migration 20260721210000): sucesso
//      real, falha sem confirmação falsa, sem pendência marcada como
//      executada, sem saldo parcial, retry após falha e não-duplicação.
import test from 'node:test';
import assert from 'node:assert/strict';
import { processarComandoBot, salvarOperacaoPendente, aplicarWrites } from './_telegramBot.js';
import { makeClient, baseTables, conexao as conexaoBase } from './_fakeTelegramClient.js';
import { INTENCOES } from '../src/domain/telegram/interpretarComandoTelegram.js';

const OWNER = 'o1';

// ── 1. `aplicarWrites` em isolamento ────────────────────────────────────────
// Fake mínimo cujo `.from(tabela)` deixa configurar, por chamada, se aquela
// operação falha — o que `_fakeTelegramClient.js` (espelha só RPCs) não
// oferece e não devia: aqui o alvo é o `for` de `aplicarWrites` em si.
function makeClientComFalhas(tabelasComFalha = {}) {
  const aplicados = [];
  const conexaoParam = { owner_user_id: OWNER };
  return {
    aplicados,
    from(tabela) {
      const falha = tabelasComFalha[tabela];
      return {
        insert(registro) {
          if (falha === 'insert') return Promise.resolve({ data: null, error: { code: '23505', message: 'falha simulada no insert' } });
          aplicados.push({ tabela, tipo: 'insert', registro });
          return Promise.resolve({ data: null, error: null });
        },
        update(patch) {
          return {
            eq() { return this; },
            then: (res) => {
              if (falha === 'update') return res({ data: null, error: { code: '22023', message: 'falha simulada no update' } });
              aplicados.push({ tabela, tipo: 'update', patch });
              return res({ data: null, error: null });
            },
          };
        },
      };
    },
    _conexao: conexaoParam,
  };
}

test('aplicarWrites: primeiro write bem-sucedido e o segundo com erro interrompe sem tentar o terceiro', async () => {
  const client = makeClientComFalhas({ estoque: 'update' });
  const writes = [
    { tabela: 'movimentacoes_estoque', tipo: 'insert', registro: { item_estoque_id: 5, tipo: 'entrada', quantidade: 10 } },
    { tabela: 'estoque', tipo: 'update', match: { id: 5 }, patch: { quantidade_atual: 110 } },
    { tabela: 'movimentacoes_financeiras', tipo: 'insert', registro: { tipo: 'despesa', valor: 50 } },
  ];
  await assert.rejects(() => aplicarWrites(client, client._conexao, writes), /falha simulada no update/);
  assert.equal(client.aplicados.length, 1, 'só o primeiro write foi aplicado — o terceiro nunca foi tentado');
  assert.equal(client.aplicados[0].tabela, 'movimentacoes_estoque');
});

test('aplicarWrites: primeiro write com erro interrompe imediatamente, nada é aplicado', async () => {
  const client = makeClientComFalhas({ movimentacoes_estoque: 'insert' });
  const writes = [
    { tabela: 'movimentacoes_estoque', tipo: 'insert', registro: { item_estoque_id: 5, tipo: 'entrada', quantidade: 10 } },
    { tabela: 'estoque', tipo: 'update', match: { id: 5 }, patch: { quantidade_atual: 110 } },
  ];
  await assert.rejects(() => aplicarWrites(client, client._conexao, writes), /falha simulada no insert/);
  assert.equal(client.aplicados.length, 0);
});

test('aplicarWrites: entrada de estoque com erro na movimentação nunca chega a tocar o saldo', async () => {
  const client = makeClientComFalhas({ movimentacoes_estoque: 'insert' });
  const writes = [
    { tabela: 'movimentacoes_estoque', tipo: 'insert', registro: { item_estoque_id: 5, tipo: 'entrada', quantidade: 20, data: '2026-07-21', obs: 'Entrada via Telegram' } },
    { tabela: 'estoque', tipo: 'update', match: { id: 5 }, patch: { quantidade_atual: 120 } },
  ];
  await assert.rejects(() => aplicarWrites(client, client._conexao, writes));
  assert.equal(client.aplicados.length, 0, 'o update de saldo nunca foi tentado');
});

test('aplicarWrites: saída/consumo com erro no update do saldo lança e não aplica o write seguinte', async () => {
  const client = makeClientComFalhas({ estoque: 'update' });
  const writes = [
    { tabela: 'movimentacoes_estoque', tipo: 'insert', registro: { item_estoque_id: 5, lote_id: 10, tipo: 'consumo', quantidade: 5 } },
    { tabela: 'estoque', tipo: 'update', match: { id: 5 }, patch: { quantidade_atual: 95 } },
    { tabela: 'movimentacoes_financeiras', tipo: 'insert', registro: { tipo: 'despesa', categoria: 'consumo_estoque', valor: 25 } },
  ];
  await assert.rejects(() => aplicarWrites(client, client._conexao, writes), /falha simulada no update/);
  // O insert da movimentação já tinha sido aplicado antes do erro (aplicarWrites
  // não faz rollback do que já rodou — por isso operações com mais de uma
  // tabela migram para RPC transacional, como entrada/saída de estoque abaixo).
  assert.equal(client.aplicados.length, 1);
  assert.equal(client.aplicados[0].tabela, 'movimentacoes_estoque');
});

// ── 2. Fluxo completo via /confirmar, atrás da RPC transacional ─────────────
function tabelasComItem(overrides = {}) {
  const t = baseTables('operador');
  t.telegram_connections = [{ id: 'conn-1', owner_user_id: OWNER, user_id: 'u1', telegram_chat_id: '123', fazenda_id: 1, is_active: true }];
  t.estoque = [{ id: 5, produto: 'Sal Mineral', nome: 'Sal Mineral', quantidade_atual: 100, quantidade: 100, unidade: 'kg', valor_unitario: 5, owner_user_id: OWNER, ...overrides }];
  return t;
}

/** Envolve o client fake para forçar UMA RPC específica a falhar (simula rede/servidor), preservando todo o resto do comportamento real do fake. */
function comRpcFalhando(client, nomeAlvo) {
  return { ...client, rpc: (nome, params) => (nome === nomeAlvo ? Promise.resolve({ data: null, error: { message: 'falha simulada de servidor' } }) : client.rpc(nome, params)) };
}

test('entrada de estoque via bot: RPC bem-sucedida incrementa o saldo e cria uma única movimentação', async () => {
  const t = tabelasComItem();
  const client = makeClient(t);
  const conexao = conexaoBase();
  const agora = new Date();

  await salvarOperacaoPendente(client, conexao, 'cadastro', {
    intencao: INTENCOES.REGISTRAR_ENTRADA_ESTOQUE, dados: { item: 'Sal Mineral', quantidade: 30, data: '2026-07-21' },
  }, agora);
  const r = await processarComandoBot({ client, conexao, texto: '/confirmar', chatId: '123', agora });

  assert.match(r.texto, /Registrado/);
  assert.equal(t.estoque[0].quantidade_atual, 130);
  assert.equal(t.movimentacoes_estoque.length, 1);
  assert.equal(t.movimentacoes_estoque[0].tipo, 'entrada');
  assert.equal(t.telegram_operacoes_pendentes.at(-1).status, 'executada');
});

test('saída/consumo de estoque vinculado a lote via bot: decrementa o saldo e lança a despesa', async () => {
  const t = tabelasComItem();
  const client = makeClient(t);
  const conexao = conexaoBase();
  const agora = new Date();

  await salvarOperacaoPendente(client, conexao, 'cadastro', {
    intencao: INTENCOES.DAR_BAIXA_ESTOQUE, dados: { item: 'Sal Mineral', quantidade: 20, tipo: 'consumo', lote: 'Recria 01', data: '2026-07-21' },
  }, agora);
  const r = await processarComandoBot({ client, conexao, texto: '/confirmar', chatId: '123', agora });

  assert.match(r.texto, /Registrado/);
  assert.equal(t.estoque[0].quantidade_atual, 80);
  assert.equal(t.movimentacoes_estoque.length, 1);
  assert.equal(t.movimentacoes_financeiras.length, 1);
  assert.equal(t.movimentacoes_financeiras[0].tipo, 'despesa');
  assert.equal(t.movimentacoes_financeiras[0].categoria, 'consumo_estoque');
});

test('falha da RPC de estoque: nenhuma confirmação de sucesso, pendência não fica executada, nada gravado', async () => {
  const t = tabelasComItem();
  const client = comRpcFalhando(makeClient(t), 'registrar_entrada_estoque_telegram');
  const conexao = conexaoBase();
  const agora = new Date();

  await salvarOperacaoPendente(client, conexao, 'cadastro', {
    intencao: INTENCOES.REGISTRAR_ENTRADA_ESTOQUE, dados: { item: 'Sal Mineral', quantidade: 30, data: '2026-07-21' },
  }, agora);
  const r = await processarComandoBot({ client, conexao, texto: '/confirmar', chatId: '123', agora });

  assert.doesNotMatch(r.texto, /Registrado/);
  assert.match(r.texto, /Não consegui concluir/);
  assert.equal(t.estoque[0].quantidade_atual, 100, 'saldo intocado — sem estado parcial');
  assert.equal(t.movimentacoes_estoque.length, 0);
  assert.equal(t.telegram_operacoes_pendentes.at(-1).status, 'erro', 'nunca marcada como executada');
});

test('retry após falha: reenviar o cadastro cria uma pendência nova que executa quando o problema já passou', async () => {
  const t = tabelasComItem();
  const clientComFalha = comRpcFalhando(makeClient(t), 'registrar_entrada_estoque_telegram');
  const conexao = conexaoBase();
  const agora = new Date();

  await salvarOperacaoPendente(clientComFalha, conexao, 'cadastro', {
    intencao: INTENCOES.REGISTRAR_ENTRADA_ESTOQUE, dados: { item: 'Sal Mineral', quantidade: 30, data: '2026-07-21' },
  }, agora);
  const falhou = await processarComandoBot({ client: clientComFalha, conexao, texto: '/confirmar', chatId: '123', agora });
  assert.match(falhou.texto, /Não consegui concluir/);
  assert.equal(t.estoque[0].quantidade_atual, 100);

  // Reenvia o MESMO cadastro (usuário tenta de novo) — sem a falha simulada desta vez.
  const clientOk = makeClient(t);
  await salvarOperacaoPendente(clientOk, conexao, 'cadastro', {
    intencao: INTENCOES.REGISTRAR_ENTRADA_ESTOQUE, dados: { item: 'Sal Mineral', quantidade: 30, data: '2026-07-21' },
  }, agora);
  const sucesso = await processarComandoBot({ client: clientOk, conexao, texto: '/confirmar', chatId: '123', agora });

  assert.match(sucesso.texto, /Registrado/);
  assert.equal(t.estoque[0].quantidade_atual, 130, 'só a tentativa bem-sucedida aplicou o saldo');
  assert.equal(t.movimentacoes_estoque.length, 1, 'a tentativa falha não deixou movimentação nenhuma');
});

test('confirmar duas vezes a mesma operação de estoque não duplica nem a movimentação nem o saldo', async () => {
  const t = tabelasComItem();
  const client = makeClient(t);
  const conexao = conexaoBase();
  const agora = new Date();

  await salvarOperacaoPendente(client, conexao, 'cadastro', {
    intencao: INTENCOES.REGISTRAR_ENTRADA_ESTOQUE, dados: { item: 'Sal Mineral', quantidade: 30, data: '2026-07-21' },
  }, agora);
  const r1 = await processarComandoBot({ client, conexao, texto: '/confirmar', chatId: '123', agora });
  assert.match(r1.texto, /Registrado/);

  const r2 = await processarComandoBot({ client, conexao, texto: '/confirmar', chatId: '123', agora });
  assert.match(r2.texto, /não há nenhuma opera[çc][ãa]o/i);
  assert.equal(t.estoque[0].quantidade_atual, 130, 'saldo não dobrou');
  assert.equal(t.movimentacoes_estoque.length, 1, 'uma única movimentação');
});
