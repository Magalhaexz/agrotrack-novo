import test from 'node:test';
import assert from 'node:assert/strict';
import { processarComandoBot } from './_telegramBot.js';

// Fake mínimo do client Supabase: chain from().select().eq().maybeSingle(),
// insert(), update().eq(). Guarda tudo em memória para testar a orquestração
// (roteamento, permissão, operação pendente, confirmação) sem tocar no banco.
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
    lotes: [
      { id: 10, nome: 'Recria 01', status: 'ativo', qtd: 82, p_at: 312, faz_id: 1, owner_user_id: 'o1' },
      { id: 11, nome: 'Engorda 02', status: 'ativo', qtd: 64, p_at: 478, faz_id: 1, owner_user_id: 'o1' },
    ],
    animais: [
      { id: 1, lote_id: 10, qtd: 82, p_at: 312, owner_user_id: 'o1' },
      { id: 2, lote_id: 11, qtd: 64, p_at: 478, owner_user_id: 'o1' },
    ],
    profiles: [{ id: 'u1', perfil }],
    pesagens: [], movimentacoes_financeiras: [], estoque: [], movimentacoes_estoque: [],
    tarefas: [], sanitario: [], pastagens: [], alertas_tratativas: [],
    telegram_operacoes_pendentes: [], telegram_bot_auditoria: [], movimentacoes_animais: [],
    telegram_conversas: [],
  };
}

const conexao = () => ({ id: 'c1', owner_user_id: 'o1', user_id: 'u1', telegram_chat_id: '123', fazenda_id: 1 });

test('intenção não atendida devolve null (cai no fluxo legado)', async () => {
  const client = makeClient(baseTables());
  const r = await processarComandoBot({ client, conexao: conexao(), texto: '/status', chatId: '123' });
  assert.equal(r, null);
});

test('/resumo responde com contadores da fazenda', async () => {
  const client = makeClient(baseTables());
  const r = await processarComandoBot({ client, conexao: conexao(), texto: '/resumo', chatId: '123' });
  assert.match(r.texto, /Santa Clara/);
  assert.match(r.texto, /146 animais/);
});

test('visualizador não pode transferir (nenhuma operação pendente criada)', async () => {
  const tables = baseTables('visualizador');
  const client = makeClient(tables);
  const r = await processarComandoBot({ client, conexao: conexao(), texto: 'transferir 10 animais do lote Recria 01 para Engorda 02', chatId: '123' });
  assert.match(r.texto, /permissão/);
  assert.equal(tables.telegram_operacoes_pendentes.length, 0);
});

test('transferência cria operação pendente e pede confirmação', async () => {
  const tables = baseTables('operador');
  const client = makeClient(tables);
  const r = await processarComandoBot({ client, conexao: conexao(), texto: 'transferir 15 animais do lote Recria 01 para Engorda 02', chatId: '123' });
  assert.match(r.texto, /Confirme a transferência/);
  const pend = tables.telegram_operacoes_pendentes.filter((o) => o.status === 'pendente');
  assert.equal(pend.length, 1);
  assert.equal(pend[0].tipo_operacao, 'transferir_animais');
  // Nada foi alterado ainda:
  assert.equal(tables.lotes.find((l) => l.id === 10).qtd, 82);
});

test('/confirmar executa a transferência e atualiza os lotes', async () => {
  const tables = baseTables('operador');
  const client = makeClient(tables);
  await processarComandoBot({ client, conexao: conexao(), texto: 'transferir 15 animais do lote Recria 01 para Engorda 02', chatId: '123' });
  const r = await processarComandoBot({ client, conexao: conexao(), texto: '/confirmar', chatId: '123' });
  assert.match(r.texto, /Transferência concluída/);
  assert.equal(tables.lotes.find((l) => l.id === 10).qtd, 67);
  assert.equal(tables.lotes.find((l) => l.id === 11).qtd, 79);
  assert.equal(tables.movimentacoes_animais.length, 1);
  assert.equal(tables.movimentacoes_animais[0].tipo, 'transferencia_saida');
  assert.equal(tables.telegram_operacoes_pendentes[0].status, 'executada');
  // Auditoria registrada:
  assert.ok(tables.telegram_bot_auditoria.some((a) => a.acao === 'transferir_animais'));
});

test('confirmação por outro usuário é negada e não executa', async () => {
  const tables = baseTables('operador');
  const client = makeClient(tables);
  await processarComandoBot({ client, conexao: conexao(), texto: 'transferir 15 animais do lote Recria 01 para Engorda 02', chatId: '123' });
  const outro = { ...conexao(), user_id: 'u2' };
  const r = await processarComandoBot({ client, conexao: outro, texto: '/confirmar', chatId: '123' });
  assert.match(r.texto, /Só quem iniciou/);
  assert.equal(tables.lotes.find((l) => l.id === 10).qtd, 82);
});

test('/confirmar sem operação pendente avisa', async () => {
  const client = makeClient(baseTables());
  const r = await processarComandoBot({ client, conexao: conexao(), texto: '/confirmar', chatId: '123' });
  assert.match(r.texto, /nenhuma operação/i);
});

test('renomear lote cria pendência e /confirmar aplica o novo nome', async () => {
  const tables = baseTables('operador');
  const client = makeClient(tables);
  const c = await processarComandoBot({ client, conexao: conexao(), texto: 'renomear lote Recria 01 para Recria Norte', chatId: '123' });
  assert.match(c.texto, /Confirme a renomeação/);
  const r = await processarComandoBot({ client, conexao: conexao(), texto: '/confirmar', chatId: '123' });
  assert.match(r.texto, /renomeado/);
  assert.equal(tables.lotes.find((l) => l.id === 10).nome, 'Recria Norte');
});

test('cadastro de pesagem por mensagem única → confirma → insere pesagem', async () => {
  const tables = baseTables('operador');
  const client = makeClient(tables);
  const c = await processarComandoBot({ client, conexao: conexao(), texto: 'registre pesagem de 425 kg no lote Engorda 02', chatId: '123' });
  assert.match(c.texto, /Confirme a pesagem/);
  assert.match(c.texto, /425 kg/);
  const r = await processarComandoBot({ client, conexao: conexao(), texto: '/confirmar', chatId: '123' });
  assert.match(r.texto, /Registrado/i);
  assert.equal(tables.pesagens.length, 1);
  assert.equal(tables.pesagens[0].lote_id, 11);
  assert.equal(tables.pesagens[0].peso_medio, 425);
  assert.equal(tables.pesagens[0].owner_user_id, 'o1');
});

test('cadastro de despesa em várias etapas (slot-filling)', async () => {
  const tables = baseTables('gerente');
  const client = makeClient(tables);
  const chatId = '123';
  const c = conexao();
  let r = await processarComandoBot({ client, conexao: c, texto: 'cadastrar despesa', chatId });
  assert.match(r.texto, /valor/i);
  r = await processarComandoBot({ client, conexao: c, texto: '500 reais', chatId });
  assert.match(r.texto, /descri/i);
  r = await processarComandoBot({ client, conexao: c, texto: 'Compra de sal mineral', chatId });
  assert.match(r.texto, /lote/i); // pergunta opcional
  r = await processarComandoBot({ client, conexao: c, texto: 'não', chatId });
  assert.match(r.texto, /Confirme o lançamento/);
  assert.match(r.texto, /R\$ 500,00/);
  r = await processarComandoBot({ client, conexao: c, texto: '/confirmar', chatId });
  assert.match(r.texto, /Registrado/i);
  assert.equal(tables.movimentacoes_financeiras.length, 1);
  assert.equal(tables.movimentacoes_financeiras[0].tipo, 'despesa');
  assert.equal(tables.movimentacoes_financeiras[0].valor, 500);
  assert.equal(tables.movimentacoes_financeiras[0].descricao, 'Compra de sal mineral');
});

test('visualizador não cadastra despesa', async () => {
  const tables = baseTables('visualizador');
  const client = makeClient(tables);
  const r = await processarComandoBot({ client, conexao: conexao(), texto: 'gastei 500 reais com sal', chatId: '123' });
  assert.match(r.texto, /permissão/);
  assert.equal(tables.telegram_conversas.length, 0);
});

test('/cancelar durante conversa encerra o cadastro', async () => {
  const tables = baseTables('gerente');
  const client = makeClient(tables);
  const c = conexao();
  await processarComandoBot({ client, conexao: c, texto: 'cadastrar despesa', chatId: '123' });
  const r = await processarComandoBot({ client, conexao: c, texto: '/cancelar', chatId: '123' });
  assert.match(r.texto, /cancelad/i);
  assert.equal(tables.telegram_conversas[0].status, 'cancelada');
});

test('trocar de fazenda com uma única fazenda funciona; multi-fazenda sem seleção pede escolha', async () => {
  // multi-fazenda, conexão sem fazenda fixa → consulta escopada pede seleção
  const tables = baseTables('operador');
  tables.fazendas.push({ id: 2, nome: 'Boa Vista', owner_user_id: 'o1' });
  const client = makeClient(tables);
  const semSelecao = { ...conexao(), fazenda_id: null };
  const r = await processarComandoBot({ client, conexao: semSelecao, texto: '/lotes', chatId: '123' });
  assert.match(r.texto, /mais de uma fazenda/i);
});
