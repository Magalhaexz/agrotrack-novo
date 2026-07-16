// Testes da integração do catálogo de ferramentas (telegramToolsRegistry)
// com o orquestrador existente (`_telegramBot.js`): a operação pendente
// tipo_operacao='ferramenta_bot' criada pelo interpretador determinístico
// (`interpretadorTelegram.js`) é confirmada/executada pelo MESMO
// `/confirmar` já testado em `_telegramBot.test.js` — é esse acoplamento
// que este arquivo garante que não quebrou.
import test from 'node:test';
import assert from 'node:assert/strict';
import { processarComandoBot, salvarOperacaoPendente, executarFerramentaCatalogo } from './_telegramBot.js';

function makeClient(tables) {
  class Q {
    constructor(table) { this.table = table; this.filters = []; this._op = 'select'; this._patch = null; }
    select() { return this; }
    order() { return this; }
    limit() { return this; }
    eq(c, v) { this.filters.push([c, v]); return this; }
    insert(row) {
      const arr = tables[this.table] || (tables[this.table] = []);
      (Array.isArray(row) ? row : [row]).forEach((r) => arr.push({ id: r.id ?? `gen_${arr.length + 1}`, ...r }));
      return Promise.resolve({ data: null, error: null });
    }
    update(patch) { this._op = 'update'; this._patch = patch; return this; }
    _match(r) { return this.filters.every(([c, v]) => String(r[c]) === String(v)); }
    _run(single) {
      const arr = tables[this.table] || [];
      if (this._op === 'update') {
        const matched = arr.filter((r) => this._match(r));
        matched.forEach((r) => Object.assign(r, this._patch));
        return { data: single ? (matched[0] || null) : matched, error: null };
      }
      const matched = arr.filter((r) => this._match(r));
      return { data: single ? (matched[0] || null) : matched, error: null };
    }
    maybeSingle() { return Promise.resolve(this._run(true)); }
    then(res, rej) { return Promise.resolve(this._run(false)).then(res, rej); }
  }
  return { from: (t) => new Q(t) };
}

function baseTables(perfil = 'operador') {
  return {
    fazendas: [{ id: 1, nome: 'Santa Clara', owner_user_id: 'o1' }],
    lotes: [{ id: 10, nome: 'Recria 01', status: 'ativo', qtd: 82, p_at: 312, faz_id: 1, owner_user_id: 'o1' }],
    animais: [], profiles: [{ id: 'u1', perfil }],
    pesagens: [], movimentacoes_financeiras: [],
    estoque: [{ id: 5, produto: 'Sal Mineral 90', quantidade_atual: 100, valor_unitario: 5, unidade: 'kg', owner_user_id: 'o1' }],
    movimentacoes_estoque: [],
    tarefas: [], sanitario: [], pastagens: [], alertas_tratativas: [], funcionarios: [],
    telegram_operacoes_pendentes: [], telegram_bot_auditoria: [], movimentacoes_animais: [],
    telegram_conversas: [],
  };
}

const conexao = () => ({ id: 'c1', owner_user_id: 'o1', user_id: 'u1', telegram_chat_id: '123', fazenda_id: 1 });

test('salvarOperacaoPendente(ferramenta_bot) + /confirmar executa cadastrar_tarefa via executarFerramentaCatalogo', async () => {
  const tables = baseTables('operador');
  const client = makeClient(tables);
  const ok = await salvarOperacaoPendente(client, conexao(), 'ferramenta_bot', {
    tool: 'cadastrar_tarefa', params: { titulo: 'Pesar o lote 12', data_vencimento: '2026-07-20' },
  }, new Date());
  assert.equal(ok, true);

  const r = await processarComandoBot({ client, conexao: conexao(), texto: '/confirmar', chatId: '123' });
  assert.match(r.texto, /Registrado/);
  assert.equal(tables.tarefas.length, 1);
  assert.equal(tables.tarefas[0].titulo, 'Pesar o lote 12');
  assert.equal(tables.tarefas[0].owner_user_id, 'o1');
});

test('ferramenta desconhecida no payload nunca executa nada e vira falha genérica', async () => {
  const tables = baseTables('operador');
  const client = makeClient(tables);
  await salvarOperacaoPendente(client, conexao(), 'ferramenta_bot', { tool: 'ferramenta_inventada', params: {} }, new Date());
  const r = await processarComandoBot({ client, conexao: conexao(), texto: '/confirmar', chatId: '123' });
  assert.match(r.texto, /Não consegui concluir/);
  assert.equal(tables.tarefas.length, 0);
});

test('visualizador não consegue confirmar uma ferramenta de escrita (revalidação de permissão na execução)', async () => {
  const tables = baseTables('operador'); // cria como operador (podia)...
  const client = makeClient(tables);
  await salvarOperacaoPendente(client, conexao(), 'ferramenta_bot', {
    tool: 'dar_baixa_estoque', params: { item: 'Sal Mineral', quantidade: 10 },
  }, new Date());
  // ...perfil muda para visualizador ANTES da confirmação (ex.: rebaixado no meio do fluxo)
  tables.profiles[0].perfil = 'visualizador';
  const r = await processarComandoBot({ client, conexao: conexao(), texto: '/confirmar', chatId: '123' });
  assert.match(r.texto, /Não consegui concluir/);
  assert.equal(tables.estoque[0].quantidade_atual, 100); // saldo intocado
});

test('executarFerramentaCatalogo aplica os writes de dar_baixa_estoque e decrementa o saldo real', async () => {
  const tables = baseTables('operador');
  const client = makeClient(tables);
  const op = { fazenda_id: 1, payload: { tool: 'dar_baixa_estoque', params: { item: 'Sal Mineral', quantidade: 30 } } };
  const texto = await executarFerramentaCatalogo(client, conexao(), op);
  assert.match(texto, /Registrado/);
  assert.equal(tables.estoque[0].quantidade_atual, 70);
  assert.equal(tables.movimentacoes_estoque.length, 1);
});

test('idempotência: confirmar duas vezes a mesma operação só executa uma vez', async () => {
  const tables = baseTables('operador');
  const client = makeClient(tables);
  await salvarOperacaoPendente(client, conexao(), 'ferramenta_bot', {
    tool: 'cadastrar_tarefa', params: { titulo: 'X', data_vencimento: '2026-07-20' },
  }, new Date());
  await processarComandoBot({ client, conexao: conexao(), texto: '/confirmar', chatId: '123' });
  // A operação já saiu de status='pendente' (virou 'executada') — o segundo
  // /confirmar não encontra mais nenhuma operação PENDENTE para este chat
  // (mesmo comportamento de `buscarPendente` para qualquer tipo_operacao,
  // não é específico deste tipo). O ponto do teste é: não duplica a tarefa.
  const r2 = await processarComandoBot({ client, conexao: conexao(), texto: '/confirmar', chatId: '123' });
  assert.match(r2.texto, /Não há nenhuma operação/);
  assert.equal(tables.tarefas.length, 1);
});
