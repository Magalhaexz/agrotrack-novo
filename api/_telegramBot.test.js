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
    delete() { this._op = 'delete'; return this; }
    _match(r) { return this.filters.every(([c, v]) => String(r[c]) === String(v)); }
    _run(single) {
      const arr = tables[this.table] || [];
      if (this._op === 'update') {
        const matched = arr.filter((r) => this._match(r));
        matched.forEach((r) => Object.assign(r, this._patch));
        return { data: single ? (matched[0] || null) : matched, error: null };
      }
      if (this._op === 'delete') {
        const matched = arr.filter((r) => this._match(r));
        tables[this.table] = arr.filter((r) => !this._match(r));
        return { data: single ? (matched[0] || null) : matched, error: null };
      }
      const matched = arr.filter((r) => this._match(r));
      return { data: single ? (matched[0] || null) : matched, error: null };
    }
    maybeSingle() { return Promise.resolve(this._run(true)); }
    then(res, rej) { return Promise.resolve(this._run(false)).then(res, rej); }
  }

  // Fake das RPCs transacionais (Sprint Paridade 1, bloco 4). Espelha a
  // lógica do SQL real (supabase/migrations/20260716120000_...sql) sobre as
  // mesmas tabelas em memória — não é um Postgres real, mas cobre a mesma
  // orquestração (uma única chamada, tudo aplicado de uma vez) que os testes
  // de bot precisam verificar sem depender de um banco.
  function nextId(tabela) {
    const arr = tables[tabela] || (tables[tabela] = []);
    return `${tabela}_${arr.length + 1}`;
  }
  const rpcImpl = {
    registrar_saida_lote(p) {
      const lote = tables.lotes.find((l) => String(l.id) === String(p.p_lote_id));
      if (!lote) return { error: 'LOTE_NAO_ENCONTRADO' };
      if (p.p_qtd > lote.qtd) return { error: 'ANIMAIS_INSUFICIENTES' };
      const movId = nextId('movimentacoes_animais');
      tables.movimentacoes_animais.push({
        id: movId, owner_user_id: p.p_owner_user_id, lote_id: p.p_lote_id,
        destino_lote_id: p.p_tipo === 'transferencia_saida' ? p.p_destino_lote_id : null,
        tipo: p.p_tipo, qtd: p.p_qtd, peso_medio: p.p_peso_medio, valor_total: p.p_valor_total,
        custo_por_cabeca: p.p_custo_por_cabeca, data: p.p_data,
        comprador_fornecedor: p.p_comprador_fornecedor, obs: p.p_obs,
      });
      lote.qtd -= p.p_qtd;
      let finId = null;
      if ((p.p_tipo === 'venda' || p.p_tipo === 'abate') && (p.p_valor_total || 0) > 0) {
        finId = nextId('movimentacoes_financeiras');
        tables.movimentacoes_financeiras.push({
          id: finId, owner_user_id: p.p_owner_user_id, lote_id: p.p_lote_id, tipo: 'receita',
          categoria: p.p_tipo === 'abate' ? 'abate_animal' : 'venda_animal', valor: p.p_valor_total,
          data: p.p_data, status: 'realizado', descricao: p.p_obs, origem_id: movId,
        });
      }
      if (p.p_tipo === 'transferencia_saida') {
        const destino = tables.lotes.find((l) => String(l.id) === String(p.p_destino_lote_id));
        destino.qtd += p.p_qtd;
        if (p.p_peso_destino_final != null) destino.p_at = p.p_peso_destino_final;
      }
      return { data: [{ movimentacao_id: movId, financeiro_id: finId }] };
    },
    ajustar_lotacao_lote(p) {
      const lote = tables.lotes.find((l) => String(l.id) === String(p.p_lote_id));
      if (!lote) return { error: 'LOTE_NAO_ENCONTRADO' };
      const delta = p.p_nova_qtd - lote.qtd;
      const movId = nextId('movimentacoes_animais');
      tables.movimentacoes_animais.push({ id: movId, owner_user_id: p.p_owner_user_id, lote_id: p.p_lote_id, tipo: 'ajuste', qtd: delta, data: p.p_data, obs: p.p_motivo });
      lote.qtd = p.p_nova_qtd;
      return { data: [{ movimentacao_id: movId }] };
    },
    finalizar_lote(p) {
      const lote = tables.lotes.find((l) => String(l.id) === String(p.p_lote_id));
      if (!lote) return { error: 'LOTE_NAO_ENCONTRADO' };
      lote.status = p.p_status;
      lote.data_encerramento = p.p_data_encerramento;
      lote.data_venda = p.p_status === 'vendido' ? (p.p_data_venda || p.p_data_encerramento) : null;
      if (p.p_motivo) lote.obs = p.p_motivo;
      return { data: null };
    },
    mover_lote_para_pasto_bot(p) {
      const lote = tables.lotes.find((l) => String(l.id) === String(p.p_lote_id));
      if (!lote) return { error: 'LOTE_NAO_ENCONTRADO' };
      const historico = tables.lote_pastagens_historico || (tables.lote_pastagens_historico = []);
      historico.push({
        id: nextId('lote_pastagens_historico'), owner_user_id: p.p_owner_user_id, lote_id: p.p_lote_id,
        faz_id: lote.faz_id, pastagem_origem_id: lote.pastagem_id ?? null,
        pastagem_destino_id: p.p_pastagem_destino_id, data_movimentacao: p.p_data,
        quantidade_cabecas: p.p_quantidade_cabecas, motivo: p.p_motivo, observacoes: p.p_observacoes,
      });
      lote.pastagem_id = p.p_pastagem_destino_id;
      return { data: null };
    },
    editar_ultima_pesagem_lote(p) {
      const pesagem = tables.pesagens.find((x) => String(x.id) === String(p.p_pesagem_id));
      if (!pesagem) return { error: 'PESAGEM_NAO_ENCONTRADA' };
      pesagem.peso_medio = p.p_novo_peso;
      if (p.p_nova_data) pesagem.data = p.p_nova_data;
      const doLote = tables.pesagens.filter((x) => x.lote_id === pesagem.lote_id).sort((a, b) => String(b.data).localeCompare(String(a.data)));
      const lote = tables.lotes.find((l) => l.id === pesagem.lote_id);
      if (lote && doLote[0]) { lote.p_at = doLote[0].peso_medio; lote.ultima_pesagem = doLote[0].data; }
      return { data: null };
    },
    excluir_ultima_pesagem_lote(p) {
      const idx = tables.pesagens.findIndex((x) => String(x.id) === String(p.p_pesagem_id));
      if (idx === -1) return { error: 'PESAGEM_NAO_ENCONTRADA' };
      const [removida] = tables.pesagens.splice(idx, 1);
      const lote = tables.lotes.find((l) => l.id === removida.lote_id);
      const restantes = tables.pesagens.filter((x) => x.lote_id === removida.lote_id).sort((a, b) => String(b.data).localeCompare(String(a.data)));
      if (lote) {
        if (restantes[0]) { lote.p_at = restantes[0].peso_medio; lote.ultima_pesagem = restantes[0].data; } else { lote.ultima_pesagem = null; }
      }
      return { data: null };
    },
    criar_lote_completo(p) {
      const loteId = nextId('lotes');
      tables.lotes.push({
        id: loteId, owner_user_id: p.p_owner_user_id, nome: p.p_nome, faz_id: p.p_faz_id,
        pastagem_id: p.p_pastagem_id ?? null, entrada: p.p_data_entrada, status: 'ativo',
        raca: p.p_raca || '', sexo: p.p_sexo, qtd: p.p_qtd, p_ini: p.p_peso_inicial || 0, p_at: p.p_peso_inicial || 0,
        rendimento_carcaca: p.p_rendimento_carcaca ?? 52, obs: p.p_observacao || null,
      });
      if (p.p_qtd > 0) {
        tables.animais.push({ id: nextId('animais'), owner_user_id: p.p_owner_user_id, fazenda_id: p.p_faz_id, lote_id: loteId, identificacao: p.p_nome, tipo_registro: 'grupo', qtd: p.p_qtd, p_at: p.p_peso_inicial || 0 });
      }
      if ((p.p_peso_inicial || 0) > 0) {
        tables.pesagens.push({ id: nextId('pesagens'), owner_user_id: p.p_owner_user_id, lote_id: loteId, data: p.p_data_entrada, peso_medio: p.p_peso_inicial, tipo: 'lote', origem: 'telegram' });
      }
      if (p.p_pastagem_id) {
        const historico = tables.lote_pastagens_historico || (tables.lote_pastagens_historico = []);
        historico.push({ id: nextId('lote_pastagens_historico'), owner_user_id: p.p_owner_user_id, lote_id: loteId, faz_id: p.p_faz_id, pastagem_destino_id: p.p_pastagem_id });
      }
      return { data: loteId };
    },
    // P1-03: entrada/saída de estoque via bot passaram a usar RPC transacional
    // (migration 20260721210000) em vez de writes sequenciais sem checagem de
    // erro — espelha a mesma lógica em `_fakeTelegramClient.js`.
    registrar_entrada_estoque_telegram(p) {
      const item = (tables.estoque || []).find((e) => String(e.id) === String(p.p_item_estoque_id) && e.owner_user_id === p.p_owner_user_id);
      if (!item) return { error: 'ITEM_NAO_ENCONTRADO' };
      const movId = nextId('movimentacoes_estoque');
      tables.movimentacoes_estoque.push({
        id: movId, owner_user_id: p.p_owner_user_id, item_estoque_id: p.p_item_estoque_id, tipo: 'entrada',
        quantidade: p.p_quantidade, data: p.p_data, obs: p.p_obs, origem: 'telegram',
      });
      const novoSaldo = (item.quantidade_atual || 0) + p.p_quantidade;
      item.quantidade_atual = novoSaldo;
      item.quantidade = (item.quantidade || 0) + p.p_quantidade;
      return { data: [{ movimentacao_id: movId, novo_saldo: novoSaldo }] };
    },
    registrar_saida_estoque_telegram(p) {
      const item = (tables.estoque || []).find((e) => String(e.id) === String(p.p_item_estoque_id) && e.owner_user_id === p.p_owner_user_id);
      if (!item) return { error: 'ITEM_NAO_ENCONTRADO' };
      if (p.p_quantidade > (item.quantidade_atual || 0)) return { error: 'SALDO_INSUFICIENTE' };
      const movId = nextId('movimentacoes_estoque');
      tables.movimentacoes_estoque.push({
        id: movId, owner_user_id: p.p_owner_user_id, item_estoque_id: p.p_item_estoque_id, lote_id: p.p_lote_id ?? null,
        tipo: p.p_tipo, quantidade: p.p_quantidade, custo_unitario: p.p_custo_unitario ?? null, valor_total: p.p_valor_total ?? null,
        data: p.p_data, obs: p.p_obs, origem: 'telegram',
      });
      const novoSaldo = (item.quantidade_atual || 0) - p.p_quantidade;
      item.quantidade_atual = novoSaldo;
      item.quantidade = (item.quantidade || 0) - p.p_quantidade;
      let finId = null;
      if (p.p_tipo === 'consumo' && p.p_lote_id != null) {
        finId = nextId('movimentacoes_financeiras');
        tables.movimentacoes_financeiras.push({
          id: finId, owner_user_id: p.p_owner_user_id, tipo: 'despesa', categoria: 'consumo_estoque', lote_id: p.p_lote_id,
          valor: p.p_valor_total || 0, data: p.p_data, data_competencia: p.p_data, status: 'realizado',
          descricao: p.p_descricao_financeiro, origem_tipo: 'movimentacao_estoque', origem_id: movId, origem: 'telegram',
        });
      } else if (p.p_tipo === 'venda') {
        finId = nextId('movimentacoes_financeiras');
        tables.movimentacoes_financeiras.push({
          id: finId, owner_user_id: p.p_owner_user_id, tipo: 'receita', categoria: 'venda_estoque', lote_id: p.p_lote_id ?? null,
          valor: p.p_valor_total || 0, data: p.p_data, data_competencia: p.p_data, status: 'realizado',
          descricao: p.p_descricao_financeiro, origem_tipo: 'movimentacao_estoque', origem_id: movId, origem: 'telegram',
        });
      }
      return { data: [{ movimentacao_id: movId, financeiro_id: finId, novo_saldo: novoSaldo }] };
    },
  };

  return {
    from: (t) => new Q(t),
    rpc: (nome, params) => {
      const impl = rpcImpl[nome];
      if (!impl) return Promise.resolve({ data: null, error: { message: `RPC desconhecida no fake: ${nome}` } });
      const resultado = impl(params);
      if (resultado.error) return Promise.resolve({ data: null, error: { message: resultado.error } });
      return Promise.resolve({ data: resultado.data ?? null, error: null });
    },
  };
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

// ── Regressão: seleção numérica de fazenda retoma o comando original ────────
function tablesDuasFazendas(perfil = 'operador') {
  const tables = baseTables(perfil);
  tables.fazendas[0].nome = 'yellowstone';
  tables.fazendas.push({ id: 2, nome: 'Olhos D’água', owner_user_id: 'o1' });
  tables.lotes.forEach((l) => { l.faz_id = 1; });
  return tables;
}

test('regressão: /estoque com duas fazendas + "1" seleciona a primeira e retoma /estoque (nunca cai na ajuda)', async () => {
  const tables = tablesDuasFazendas();
  const client = makeClient(tables);
  const c = { ...conexao(), fazenda_id: null };
  const lista = await processarComandoBot({ client, conexao: c, texto: '/estoque', chatId: '123' });
  assert.match(lista.texto, /mais de uma fazenda/i);
  assert.match(lista.texto, /1\. yellowstone/);
  assert.match(lista.texto, /2\. Olhos D’água/);

  const r = await processarComandoBot({ client, conexao: c, texto: '1', chatId: '123' });
  assert.match(r.texto, /Fazenda yellowstone selecionada/i);
  assert.doesNotMatch(r.texto, /HERDON pelo Telegram/); // nunca é o fallback de ajuda
  assert.equal(c.fazenda_id, 1);
  assert.equal(tables.telegram_conversas[0].status, 'concluida');
});

test('resposta "2" seleciona a segunda opção da lista', async () => {
  const tables = tablesDuasFazendas();
  const client = makeClient(tables);
  const c = { ...conexao(), fazenda_id: null };
  await processarComandoBot({ client, conexao: c, texto: '/estoque', chatId: '123' });
  const r = await processarComandoBot({ client, conexao: c, texto: '2', chatId: '123' });
  assert.match(r.texto, /Fazenda Olhos D’água selecionada/i);
  assert.equal(c.fazenda_id, 2);
});

test('seleção por nome, "usar fazenda NOME" e "opção 1" também retomam o comando', async () => {
  for (const resposta of ['yellowstone', 'usar fazenda yellowstone', 'opção 1', 'fazenda 1']) {
    const tables = tablesDuasFazendas();
    const client = makeClient(tables);
    const c = { ...conexao(), fazenda_id: null };
    await processarComandoBot({ client, conexao: c, texto: '/estoque', chatId: '123' });
    const r = await processarComandoBot({ client, conexao: c, texto: resposta, chatId: '123' });
    assert.match(r.texto, /Fazenda yellowstone selecionada/i, `falhou para "${resposta}"`);
    assert.equal(c.fazenda_id, 1, `falhou para "${resposta}"`);
  }
});

test('número fora da faixa reapresenta a lista, sem escolher nada', async () => {
  const tables = tablesDuasFazendas();
  const client = makeClient(tables);
  const c = { ...conexao(), fazenda_id: null };
  await processarComandoBot({ client, conexao: c, texto: '/estoque', chatId: '123' });
  const r = await processarComandoBot({ client, conexao: c, texto: '3', chatId: '123' });
  assert.match(r.texto, /Não encontrei essa opção/i);
  assert.match(r.texto, /1\. yellowstone/);
  assert.equal(c.fazenda_id, null);
});

test('contexto expirado avisa e não seleciona', async () => {
  const tables = tablesDuasFazendas();
  const client = makeClient(tables);
  const c = { ...conexao(), fazenda_id: null };
  await processarComandoBot({ client, conexao: c, texto: '/estoque', chatId: '123' });
  tables.telegram_conversas[0].expira_em = new Date(Date.now() - 60_000).toISOString();
  const r = await processarComandoBot({ client, conexao: c, texto: '1', chatId: '123' });
  assert.match(r.texto, /expirou/i);
  assert.equal(c.fazenda_id, null);
  assert.equal(tables.telegram_conversas[0].status, 'expirada');
});

test('fallback de ajuda não intercepta "1": /ajuda explícito interrompe a pendência e responde a ajuda normalmente', async () => {
  const tables = tablesDuasFazendas();
  const client = makeClient(tables);
  const c = { ...conexao(), fazenda_id: null };
  await processarComandoBot({ client, conexao: c, texto: '/estoque', chatId: '123' });
  const r = await processarComandoBot({ client, conexao: c, texto: '/ajuda', chatId: '123' });
  assert.match(r.texto, /HERDON pelo Telegram/);
  assert.equal(tables.telegram_conversas[0].status, 'cancelada');
});

test('mesma lógica funciona para uma intenção de escrita (/tarefas): retoma o cadastro em etapas', async () => {
  const tables = tablesDuasFazendas('gerente');
  const client = makeClient(tables);
  const c = { ...conexao(), fazenda_id: null };
  await processarComandoBot({ client, conexao: c, texto: 'crie uma tarefa para pesar o lote amanha', chatId: '123' });
  const r = await processarComandoBot({ client, conexao: c, texto: '2', chatId: '123' });
  assert.match(r.texto, /Fazenda Olhos D’água selecionada/i);
  assert.match(r.texto, /vinculada a algum lote/i); // retomou a conversa de cadastro da tarefa
  assert.equal(c.fazenda_id, 2);
});

test('visualizador: consulta (permitida) fica pendente de fazenda e é retomada normalmente após a seleção', async () => {
  // Escrita é negada ANTES do portão de fazenda (permissão é checada primeiro
  // — ver "visualizador não cadastra despesa" acima), então só consultas
  // chegam a criar a pendência de seleção para este perfil.
  const tables = tablesDuasFazendas('visualizador');
  const client = makeClient(tables);
  const c = { ...conexao(), fazenda_id: null };
  await processarComandoBot({ client, conexao: c, texto: '/estoque', chatId: '123' });
  const r = await processarComandoBot({ client, conexao: c, texto: '1', chatId: '123' });
  assert.match(r.texto, /Fazenda yellowstone selecionada/i);
  assert.equal(c.fazenda_id, 1);
  assert.equal(tables.telegram_conversas.filter((x) => x.status === 'ativa').length, 0);
});

// ── Sprint bot operacional determinístico: 4 novos cadastros/ações (fim a fim) ──
test('cadastrar tarefa: título e data extraídos de uma mensagem, lote perguntado em seguida, depois confirma', async () => {
  const tables = baseTables('operador');
  const client = makeClient(tables);
  const c = conexao();
  const p1 = await processarComandoBot({ client, conexao: c, texto: 'crie uma tarefa para pesar o lote amanha', chatId: '123' });
  assert.match(p1.texto, /vinculada a algum lote/i);
  const p2 = await processarComandoBot({ client, conexao: c, texto: 'não', chatId: '123' });
  assert.match(p2.texto, /Confirme a tarefa/);
  const r = await processarComandoBot({ client, conexao: c, texto: '/confirmar', chatId: '123' });
  assert.match(r.texto, /Registrado/i);
  assert.equal(tables.tarefas.length, 1);
  assert.equal(tables.tarefas[0].status, 'pendente');
  assert.equal(tables.tarefas[0].owner_user_id, 'o1');
});

test('cadastrar item de estoque novo em várias etapas (slot-filling)', async () => {
  const tables = baseTables('gerente');
  const client = makeClient(tables);
  const c = conexao();
  let r = await processarComandoBot({ client, conexao: c, texto: 'cadastre um item novo', chatId: '123' });
  assert.match(r.texto, /nome do produto/i);
  r = await processarComandoBot({ client, conexao: c, texto: 'Sal Proteinado', chatId: '123' });
  assert.match(r.texto, /quantidade inicial/i);
  r = await processarComandoBot({ client, conexao: c, texto: 'não', chatId: '123' });
  assert.match(r.texto, /Confirme o novo item/);
  r = await processarComandoBot({ client, conexao: c, texto: '/confirmar', chatId: '123' });
  assert.match(r.texto, /Registrado/i);
  assert.equal(tables.estoque.some((e) => e.produto === 'Sal Proteinado'), true);
});

test('dar baixa em estoque valida saldo e decrementa após confirmar', async () => {
  const tables = baseTables('operador');
  tables.estoque = [{ id: 1, produto: 'Sal Mineral 90', quantidade_atual: 100, unidade: 'kg', owner_user_id: 'o1' }];
  const client = makeClient(tables);
  const c = conexao();
  const p1 = await processarComandoBot({ client, conexao: c, texto: 'dar baixa em 30 kg de sal', chatId: '123' });
  assert.match(p1.texto, /Confirme a saída de estoque/);
  const r = await processarComandoBot({ client, conexao: c, texto: '/confirmar', chatId: '123' });
  assert.match(r.texto, /Registrado/i);
  assert.equal(tables.estoque[0].quantidade_atual, 70);
});

test('mover lote para outro pasto por mensagem única → confirma → aplica', async () => {
  const tables = baseTables('operador');
  tables.pastagens = [
    { id: 'pasto-a', nome: 'Capim Sul', faz_id: 1, owner_user_id: 'o1' },
    { id: 'pasto-b', nome: 'Capim Norte', faz_id: 1, owner_user_id: 'o1' },
  ];
  tables.lotes[0].faz_id = 1;
  tables.lotes[0].pastagem_id = 'pasto-a';
  const client = makeClient(tables);
  const c = conexao();
  const p1 = await processarComandoBot({ client, conexao: c, texto: 'mova o lote Recria 01 para o pasto Capim Norte', chatId: '123' });
  assert.match(p1.texto, /Confirme a movimentação de pasto/);
  const r = await processarComandoBot({ client, conexao: c, texto: '/confirmar', chatId: '123' });
  assert.match(r.texto, /Registrado/i);
  assert.equal(tables.lotes.find((l) => l.id === 10).pastagem_id, 'pasto-b');
});

test('mover lote para pasto registra o histórico de movimentação', async () => {
  const tables = baseTables('operador');
  tables.pastagens = [
    { id: 'pasto-a', nome: 'Capim Sul', faz_id: 1, owner_user_id: 'o1' },
    { id: 'pasto-b', nome: 'Capim Norte', faz_id: 1, owner_user_id: 'o1' },
  ];
  tables.lote_pastagens_historico = [];
  tables.lotes[0].faz_id = 1;
  tables.lotes[0].pastagem_id = 'pasto-a';
  const client = makeClient(tables);
  const c = conexao();
  await processarComandoBot({ client, conexao: c, texto: 'mova o lote Recria 01 para o pasto Capim Norte', chatId: '123' });
  await processarComandoBot({ client, conexao: c, texto: '/confirmar', chatId: '123' });
  assert.equal(tables.lote_pastagens_historico.length, 1);
  assert.equal(tables.lote_pastagens_historico[0].pastagem_destino_id, 'pasto-b');
});

test('visualizador não consegue trocar lote de pasto nem dar baixa em estoque', async () => {
  const tables = baseTables('visualizador');
  const client = makeClient(tables);
  const c = conexao();
  const r1 = await processarComandoBot({ client, conexao: c, texto: 'mova o lote Recria 01 para o pasto Norte', chatId: '123' });
  assert.match(r1.texto, /permissão/);
  const r2 = await processarComandoBot({ client, conexao: c, texto: 'dar baixa em 10 kg de sal', chatId: '123' });
  assert.match(r2.texto, /permissão/);
});

// ── Interpretador determinístico central: tolerância a erro de digitação ────
test('mensagem sem erro (confiança alta) não recebe nenhuma nota de correção', async () => {
  const client = makeClient(baseTables());
  const r = await processarComandoBot({ client, conexao: conexao(), texto: '/resumo', chatId: '123' });
  assert.equal(/Entendi ".*" como/.test(r.texto), false);
});

test('erro de digitação simples é corrigido e o produtor é avisado da correção, sem perder a intenção', async () => {
  const client = makeClient(baseTables());
  const r = await processarComandoBot({ client, conexao: conexao(), texto: 'resumu da fazenda', chatId: '123' });
  assert.match(r.texto, /Entendi "resumu" como "resumo"/);
  assert.match(r.texto, /Santa Clara/); // resposta real do /resumo continua presente, só com a nota na frente
});

test('correção de digitação preserva o nome próprio do lote (não corrompe "Recria")', async () => {
  const tables = baseTables('operador');
  const client = makeClient(tables);
  const r = await processarComandoBot({ client, conexao: conexao(), texto: 'registrar pesajen de 425 kg no lote Recria 01', chatId: '123' });
  assert.match(r.texto, /Entendi "pesajen" como "pesagem"/);
  assert.match(r.texto, /Confirme a pesagem/);
  assert.match(r.texto, /Recria 01/);
});

// ── Confirmação editável (Sprint Paridade 1, bloco 4) ────────────────────────
test('confirmação editável: corrige o pasto de um lote pendente sem perder os outros campos', async () => {
  const tables = baseTables('operador');
  tables.pastagens = [
    { id: 'pasto-a', nome: 'Capim Sul', faz_id: 1, owner_user_id: 'o1' },
    { id: 'pasto-b', nome: 'Capim Norte', faz_id: 1, owner_user_id: 'o1' },
  ];
  const client = makeClient(tables);
  const c = conexao();
  const chatId = '123';

  let r = await processarComandoBot({ client, conexao: c, texto: 'cadastre um lote', chatId });
  assert.match(r.texto, /nome do lote/i);
  r = await processarComandoBot({ client, conexao: c, texto: 'Recria 03', chatId });
  assert.match(r.texto, /quantas cabe/i);
  r = await processarComandoBot({ client, conexao: c, texto: '20', chatId });
  assert.match(r.texto, /sexo/i);
  r = await processarComandoBot({ client, conexao: c, texto: 'machos', chatId });
  assert.match(r.texto, /peso/i);
  r = await processarComandoBot({ client, conexao: c, texto: 'não', chatId });
  assert.match(r.texto, /pasto/i);
  r = await processarComandoBot({ client, conexao: c, texto: 'Capim Sul', chatId });
  assert.match(r.texto, /Confirme o novo lote/);
  assert.match(r.texto, /Capim Sul/);

  const edit = await processarComandoBot({ client, conexao: c, texto: 'troque o pasto para Capim Norte', chatId });
  assert.match(edit.texto, /Pasto alterado/i);
  assert.match(edit.texto, /Capim Norte/);
  assert.doesNotMatch(edit.texto, /Capim Sul/);
  assert.match(edit.texto, /Recria 03/); // outros campos preservados
  assert.match(edit.texto, /20 cabeças/);

  const conf = await processarComandoBot({ client, conexao: c, texto: '/confirmar', chatId });
  assert.match(conf.texto, /Registrado/i);
  const loteCriado = tables.lotes.find((l) => l.nome === 'Recria 03');
  assert.equal(loteCriado.pastagem_id, 'pasto-b');
  // action_id estável: UPDATE na mesma linha, nunca criou uma segunda pendência.
  assert.equal(tables.telegram_operacoes_pendentes.length, 1);
});

test('confirmação editável: revalidação falhando não altera a pendência (pasto novo não existe)', async () => {
  const tables = baseTables('operador');
  tables.pastagens = [{ id: 'pasto-a', nome: 'Capim Sul', faz_id: 1, owner_user_id: 'o1' }];
  const client = makeClient(tables);
  const c = conexao();
  const chatId = '123';
  await processarComandoBot({ client, conexao: c, texto: 'cadastre um lote', chatId });
  await processarComandoBot({ client, conexao: c, texto: 'Recria 04', chatId });
  await processarComandoBot({ client, conexao: c, texto: '15', chatId });
  await processarComandoBot({ client, conexao: c, texto: 'femeas', chatId });
  await processarComandoBot({ client, conexao: c, texto: 'não', chatId });
  const antes = await processarComandoBot({ client, conexao: c, texto: 'não', chatId }); // pasto: não informado
  assert.match(antes.texto, /Confirme o novo lote/);

  const edit = await processarComandoBot({ client, conexao: c, texto: 'troque o pasto para Pasto Inexistente', chatId });
  assert.match(edit.texto, /não encontrei/i);

  const conf = await processarComandoBot({ client, conexao: c, texto: '/confirmar', chatId });
  assert.match(conf.texto, /Registrado/i);
  const lote = tables.lotes.find((l) => l.nome === 'Recria 04');
  assert.equal(lote.pastagem_id, null);
});

test('confirmação editável: idempotência — editar depois de já confirmado não encontra pendência', async () => {
  const tables = baseTables('operador');
  tables.pastagens = [
    { id: 'pasto-a', nome: 'Capim Sul', faz_id: 1, owner_user_id: 'o1' },
    { id: 'pasto-b', nome: 'Capim Norte', faz_id: 1, owner_user_id: 'o1' },
  ];
  const client = makeClient(tables);
  const c = conexao();
  const chatId = '123';
  await processarComandoBot({ client, conexao: c, texto: 'cadastre um lote', chatId });
  await processarComandoBot({ client, conexao: c, texto: 'Recria 05', chatId });
  await processarComandoBot({ client, conexao: c, texto: '10', chatId });
  await processarComandoBot({ client, conexao: c, texto: 'misto', chatId });
  await processarComandoBot({ client, conexao: c, texto: 'não', chatId });
  await processarComandoBot({ client, conexao: c, texto: 'Capim Sul', chatId });
  await processarComandoBot({ client, conexao: c, texto: '/confirmar', chatId });

  const executada = tables.telegram_operacoes_pendentes.find((o) => o.status === 'executada');
  const payloadAntes = JSON.stringify(executada.payload);

  // Sem pendência 'cadastro' ativa (já executada) — a frase de edição não tem
  // mais nada a interceptar; pode até disparar OUTRA intenção normal (não é o
  // que estamos testando aqui), mas nunca deve reabrir/alterar a pendência
  // antiga já executada nem o lote que ela já criou.
  await processarComandoBot({ client, conexao: c, texto: 'troque o pasto para Capim Norte', chatId });

  const aindaExecutada = tables.telegram_operacoes_pendentes.find((o) => o.id === executada.id);
  assert.equal(aindaExecutada.status, 'executada');
  assert.equal(JSON.stringify(aindaExecutada.payload), payloadAntes);
  const lote = tables.lotes.find((l) => l.nome === 'Recria 05');
  assert.equal(lote.pastagem_id, 'pasto-a');
});

// ── RPCs transacionais (Sprint Paridade 1, bloco 4) — fim a fim via o bot ───
test('venda: confirma e lança financeiro (via registrar_saida_lote)', async () => {
  const tables = baseTables('operador');
  const client = makeClient(tables);
  const c = conexao();
  const p1 = await processarComandoBot({ client, conexao: c, texto: 'vendi 10 animais do lote Recria 01 por 25000', chatId: '123' });
  assert.match(p1.texto, /valor da venda/i);
  const p2 = await processarComandoBot({ client, conexao: c, texto: '25000', chatId: '123' });
  assert.match(p2.texto, /Confirme a venda/);
  const r = await processarComandoBot({ client, conexao: c, texto: '/confirmar', chatId: '123' });
  assert.match(r.texto, /Registrado/i);
  assert.equal(tables.lotes.find((l) => l.id === 10).qtd, 72);
  assert.equal(tables.movimentacoes_animais[0].tipo, 'venda');
  assert.equal(tables.movimentacoes_financeiras.length, 1);
  assert.equal(tables.movimentacoes_financeiras[0].valor, 25000);
});

test('morte: confirma, decrementa qtd e nunca lança financeiro (via registrar_saida_lote)', async () => {
  const tables = baseTables('operador');
  const client = makeClient(tables);
  const c = conexao();
  const p1 = await processarComandoBot({ client, conexao: c, texto: 'registrar morte de 2 animais do lote Recria 01', chatId: '123' });
  assert.match(p1.texto, /motivo/i);
  const p2 = await processarComandoBot({ client, conexao: c, texto: 'Doença respiratória', chatId: '123' });
  assert.match(p2.texto, /Confirme a baixa por morte/);
  const r = await processarComandoBot({ client, conexao: c, texto: '/confirmar', chatId: '123' });
  assert.match(r.texto, /Registrado/i);
  assert.equal(tables.lotes.find((l) => l.id === 10).qtd, 80);
  assert.equal(tables.movimentacoes_animais[0].tipo, 'morte');
  assert.equal(tables.movimentacoes_financeiras.length, 0);
});

test('ajuste de lotação: confirma e atualiza qtd (via ajustar_lotacao_lote)', async () => {
  const tables = baseTables('operador');
  const client = makeClient(tables);
  const c = conexao();
  const p1 = await processarComandoBot({ client, conexao: c, texto: 'ajustar o lote Recria 01 para 70 cabeças', chatId: '123' });
  assert.match(p1.texto, /motivo/i);
  const p2 = await processarComandoBot({ client, conexao: c, texto: 'Recontagem física', chatId: '123' });
  assert.match(p2.texto, /Confirme o ajuste de lota/);
  const r = await processarComandoBot({ client, conexao: c, texto: '/confirmar', chatId: '123' });
  assert.match(r.texto, /Registrado/i);
  assert.equal(tables.lotes.find((l) => l.id === 10).qtd, 70);
  assert.equal(tables.movimentacoes_animais[0].tipo, 'ajuste');
});

test('finalizar lote: confirma e encerra o status (via finalizar_lote)', async () => {
  const tables = baseTables('operador');
  const client = makeClient(tables);
  const c = conexao();
  const p1 = await processarComandoBot({ client, conexao: c, texto: 'finalizar o lote Recria 01', chatId: '123' });
  assert.match(p1.texto, /motivo/i);
  const p2 = await processarComandoBot({ client, conexao: c, texto: 'Ciclo encerrado', chatId: '123' });
  assert.match(p2.texto, /Confirme a finaliza/);
  const r = await processarComandoBot({ client, conexao: c, texto: '/confirmar', chatId: '123' });
  assert.match(r.texto, /Registrado/i);
  assert.equal(tables.lotes.find((l) => l.id === 10).status, 'encerrado');
});

test('editar pesagem: confirma e chama editar_ultima_pesagem_lote', async () => {
  const tables = baseTables('operador');
  tables.pesagens = [{ id: 1, lote_id: 10, data: '2026-07-01', peso_medio: 300, tipo: 'lote', owner_user_id: 'o1' }];
  const client = makeClient(tables);
  const c = conexao();
  const p1 = await processarComandoBot({ client, conexao: c, texto: 'corrija a pesagem do lote Recria 01', chatId: '123' });
  assert.match(p1.texto, /peso/i);
  const p2 = await processarComandoBot({ client, conexao: c, texto: '405', chatId: '123' });
  assert.match(p2.texto, /Confirme a corre/);
  const r = await processarComandoBot({ client, conexao: c, texto: '/confirmar', chatId: '123' });
  assert.match(r.texto, /Registrado/i);
  assert.equal(tables.pesagens[0].peso_medio, 405);
  assert.equal(tables.lotes.find((l) => l.id === 10).p_at, 405);
});

test('excluir pesagem: confirma e chama excluir_ultima_pesagem_lote', async () => {
  const tables = baseTables('operador');
  tables.pesagens = [
    { id: 1, lote_id: 10, data: '2026-07-01', peso_medio: 300, tipo: 'lote', owner_user_id: 'o1' },
    { id: 2, lote_id: 10, data: '2026-07-10', peso_medio: 320, tipo: 'lote', owner_user_id: 'o1' },
  ];
  const client = makeClient(tables);
  const c = conexao();
  const p1 = await processarComandoBot({ client, conexao: c, texto: 'excluir a pesagem do lote Recria 01', chatId: '123' });
  assert.match(p1.texto, /Confirme a exclus/);
  const r = await processarComandoBot({ client, conexao: c, texto: '/confirmar', chatId: '123' });
  assert.match(r.texto, /Registrado/i);
  assert.equal(tables.pesagens.length, 1);
  assert.equal(tables.pesagens[0].id, 1);
  assert.equal(tables.lotes.find((l) => l.id === 10).p_at, 300);
  assert.equal(tables.lotes.find((l) => l.id === 10).ultima_pesagem, '2026-07-01');
});

test('cadastro completo de lote: confirma e cria o grupo em animais + pesagem inicial (via criar_lote_completo)', async () => {
  const tables = baseTables('operador');
  const client = makeClient(tables);
  const c = conexao();
  const animaisAntes = tables.animais.length;
  const p1 = await processarComandoBot({ client, conexao: c, texto: 'cadastre um lote', chatId: '123' });
  assert.match(p1.texto, /nome do lote/i);
  await processarComandoBot({ client, conexao: c, texto: 'Recria 06', chatId: '123' });
  await processarComandoBot({ client, conexao: c, texto: '25', chatId: '123' });
  await processarComandoBot({ client, conexao: c, texto: 'machos', chatId: '123' });
  await processarComandoBot({ client, conexao: c, texto: '350', chatId: '123' });
  const confirmacao = await processarComandoBot({ client, conexao: c, texto: 'não', chatId: '123' });
  assert.match(confirmacao.texto, /Confirme o novo lote/);
  const r = await processarComandoBot({ client, conexao: c, texto: '/confirmar', chatId: '123' });
  assert.match(r.texto, /Registrado/i);

  const loteCriado = tables.lotes.find((l) => l.nome === 'Recria 06');
  assert.ok(loteCriado);
  assert.equal(loteCriado.qtd, 25);
  // Side-effects que o insert avulso antigo nunca replicava:
  assert.equal(tables.animais.length, animaisAntes + 1);
  const grupo = tables.animais.find((a) => a.lote_id === loteCriado.id);
  assert.equal(grupo.tipo_registro, 'grupo');
  assert.equal(grupo.qtd, 25);
  const pesagemInicial = tables.pesagens.find((p) => p.lote_id === loteCriado.id);
  assert.equal(pesagemInicial.peso_medio, 350);
});

// ── Sprint Paridade 1, bloco 5: alertas, edição completa de lote,
//    resumo consolidado, exclusão de fazenda/pasto ─────────────────────────
test('resolver alerta: lista numerada, resolve por posição, grava em alertas_tratativas', async () => {
  const tables = baseTables('operador');
  tables.estoque = [{ id: 1, produto: 'Sal mineral', data_validade: '2020-01-01', alerta_dias_antes: 5, quantidade_atual: 100, quantidade_minima: 10, owner_user_id: 'o1' }];
  const client = makeClient(tables);
  const c = conexao();
  const lista = await processarComandoBot({ client, conexao: c, texto: '/alertas', chatId: '123' });
  assert.match(lista.texto, /1\. .*vencid/i);
  const p1 = await processarComandoBot({ client, conexao: c, texto: 'resolver alerta 1', chatId: '123' });
  assert.match(p1.texto, /Vou marcar como resolvido/);
  const r = await processarComandoBot({ client, conexao: c, texto: '/confirmar', chatId: '123' });
  assert.match(r.texto, /Alerta atualizado/i);
  assert.equal(tables.alertas_tratativas.length, 1);
  assert.equal(tables.alertas_tratativas[0].status, 'resolvido');
  assert.equal(tables.alertas_tratativas[0].owner_user_id, 'o1');
});

test('reabrir alerta: remove a tratativa (delete), alerta volta a aparecer', async () => {
  const tables = baseTables('operador');
  tables.estoque = [{ id: 1, produto: 'Sal mineral', data_validade: '2020-01-01', alerta_dias_antes: 5, quantidade_atual: 100, quantidade_minima: 10, owner_user_id: 'o1' }];
  const client = makeClient(tables);
  const c = conexao();
  await processarComandoBot({ client, conexao: c, texto: 'resolver alerta 1', chatId: '123' });
  await processarComandoBot({ client, conexao: c, texto: '/confirmar', chatId: '123' });
  assert.equal(tables.alertas_tratativas.length, 1);

  const antesReabrir = await processarComandoBot({ client, conexao: c, texto: 'reabrir o alerta vencido', chatId: '123' });
  assert.match(antesReabrir.texto, /Vou reabrir/);
  const r = await processarComandoBot({ client, conexao: c, texto: '/confirmar', chatId: '123' });
  assert.match(r.texto, /Alerta reaberto/i);
  assert.equal(tables.alertas_tratativas.length, 0);

  const listaDepois = await processarComandoBot({ client, conexao: c, texto: '/alertas', chatId: '123' });
  assert.match(listaDepois.texto, /vencid/i);
});

test('reabrir sem tratativa existente recusa (nada para reabrir)', async () => {
  const tables = baseTables('operador');
  tables.estoque = [{ id: 1, produto: 'Sal mineral', data_validade: '2020-01-01', alerta_dias_antes: 5, quantidade_atual: 100, quantidade_minima: 10, owner_user_id: 'o1' }];
  const client = makeClient(tables);
  const c = conexao();
  const r = await processarComandoBot({ client, conexao: c, texto: 'reabrir o alerta vencido', chatId: '123' });
  assert.match(r.texto, /não está tratado/i);
});

test('visualizador não consegue tratar alerta', async () => {
  const tables = baseTables('visualizador');
  tables.estoque = [{ id: 1, produto: 'Sal mineral', data_validade: '2020-01-01', alerta_dias_antes: 5, quantidade_atual: 100, quantidade_minima: 10, owner_user_id: 'o1' }];
  const client = makeClient(tables);
  const r = await processarComandoBot({ client, conexao: conexao(), texto: 'resolver alerta 1', chatId: '123' });
  assert.match(r.texto, /permissão/);
  assert.equal(tables.alertas_tratativas.length, 0);
});

test('resumo consolidado de todas as fazendas', async () => {
  const tables = baseTables('operador');
  tables.fazendas.push({ id: 2, nome: 'Boa Vista', owner_user_id: 'o1' });
  tables.lotes[1].faz_id = 2; // Engorda 02 passa a ser da Boa Vista
  const client = makeClient(tables);
  const r = await processarComandoBot({ client, conexao: conexao(), texto: 'resumo de todas as fazendas', chatId: '123' });
  assert.match(r.texto, /Resumo consolidado/);
  assert.match(r.texto, /Santa Clara/);
  assert.match(r.texto, /Boa Vista/);
});

test('editar lote: peso inicial e data de entrada em mensagens separadas', async () => {
  const tables = baseTables('operador');
  const client = makeClient(tables);
  const c = conexao();
  await processarComandoBot({ client, conexao: c, texto: 'altere o peso inicial do lote Recria 01 para 380 kg', chatId: '123' });
  // demais campos opcionais perguntados em seguida — responde "não" até a confirmação:
  let r;
  for (let i = 0; i < 5; i += 1) {
    r = await processarComandoBot({ client, conexao: c, texto: 'não', chatId: '123' });
    if (/Confirme a edição do lote/.test(r.texto)) break;
  }
  assert.match(r.texto, /Confirme a edição do lote/);
  assert.match(r.texto, /Peso inicial: 380 kg/);
  const conf = await processarComandoBot({ client, conexao: c, texto: '/confirmar', chatId: '123' });
  assert.match(conf.texto, /Registrado/i);
  assert.equal(tables.lotes.find((l) => l.id === 10).p_ini, 380);
});

test('excluir fazenda: recusa com vínculos, aceita sem vínculos', async () => {
  // fazendas:editar não está em operador — só proprietario/gerente (mesma
  // matriz do app, ver src/auth/perfis.js).
  const tables = baseTables('gerente');
  const client = makeClient(tables);
  const c = conexao();
  // Santa Clara (id 1) tem lotes vinculados — a guarda já recusa na proposta,
  // antes até de pedir confirmação (falha rápido, sem gerar uma pendência).
  const p1 = await processarComandoBot({ client, conexao: c, texto: 'excluir a fazenda Santa Clara', chatId: '123' });
  assert.match(p1.texto, /vinculados/i);
  assert.equal(tables.fazendas.length, 1);

  // Fazenda nova, sem vínculo nenhum — deve funcionar:
  tables.fazendas.push({ id: 2, nome: 'Fazenda Vazia', owner_user_id: 'o1' });
  const p2 = await processarComandoBot({ client, conexao: c, texto: 'excluir a fazenda Vazia', chatId: '123' });
  assert.match(p2.texto, /Confirme a exclusão da fazenda/);
  const r2 = await processarComandoBot({ client, conexao: c, texto: '/confirmar', chatId: '123' });
  assert.match(r2.texto, /Fazenda excluída/i);
  assert.equal(tables.fazendas.some((f) => f.nome === 'Fazenda Vazia'), false);
});

test('excluir pasto: recusa com lote ativo ocupando, aceita depois de retirado', async () => {
  // pastagens:excluir não está em operador — só proprietario/gerente.
  const tables = baseTables('gerente');
  tables.pastagens = [{ id: 'pasto-a', nome: 'Capim Sul', faz_id: 1, owner_user_id: 'o1' }];
  tables.lotes[0].pastagem_id = 'pasto-a';
  const client = makeClient(tables);
  const c = conexao();
  // Guarda recusa já na proposta (falha rápido, sem gerar pendência):
  const p1 = await processarComandoBot({ client, conexao: c, texto: 'excluir o pasto Capim Sul', chatId: '123' });
  assert.match(p1.texto, /ocupado|vinculado/i);
  assert.equal(tables.pastagens.length, 1);

  tables.lotes[0].pastagem_id = null; // retirado do pasto
  const p2 = await processarComandoBot({ client, conexao: c, texto: 'excluir o pasto Capim Sul', chatId: '123' });
  const r2 = await processarComandoBot({ client, conexao: c, texto: '/confirmar', chatId: '123' });
  assert.match(p2.texto, /Confirme a exclusão do pasto/);
  assert.match(r2.texto, /Pasto excluído/i);
  assert.equal(tables.pastagens.length, 0);
});
