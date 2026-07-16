// Matrizes sistemáticas de IDEMPOTÊNCIA e MULTI-FAZENDA (Sprint Paridade 1,
// bloco 5). Programáticas, não célula-por-célula manual: iteram sobre um
// conjunto representativo que cobre TODOS os ramos do executor
// (`api/_telegramBot.js`): rpc (aplicarRpc), writes-insert e writes-delete
// (aplicarWrites), e os dois bespoke legados (transferir/renomear). A
// idempotência em si (transição atômica em `confirmar` via
// `.eq('status','pendente')`) é compartilhada por todos — provar num
// representante por ramo cobre o mecanismo real sem 21 testes redundantes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { processarComandoBot } from './_telegramBot.js';
import { makeClient, baseTables, conexao } from './_fakeTelegramClient.js';

// Cada cenário: mensagens até a confirmação + a tabela cujo comprimento é o
// "efeito" persistido (o que não pode duplicar).
function cenarios() {
  return [
    {
      nome: 'venda (rpc registrar_saida_lote)',
      msgs: ['vendi 10 animais do lote Recria 01', '5000'], // valor perguntado em seguida
      efeito: (t) => t.movimentacoes_animais.length,
    },
    {
      nome: 'ajuste de lotação (rpc ajustar_lotacao_lote)',
      msgs: ['ajustar o lote Recria 01 para 70 cabeças', 'Recontagem física'],
      efeito: (t) => t.movimentacoes_animais.length,
    },
    {
      nome: 'transferência (bespoke executarTransferencia)',
      msgs: ['transferir 15 animais do lote Recria 01 para Engorda 02'],
      efeito: (t) => t.movimentacoes_animais.length,
    },
    {
      nome: 'renomear lote (bespoke executarRenomear)',
      msgs: ['renomear lote Recria 01 para Recria Norte'],
      efeito: (t) => t.lotes.filter((l) => l.nome === 'Recria Norte').length,
    },
    {
      nome: 'cadastrar pasto (writes insert)',
      setup: (t) => { t.pastagens = []; },
      msgs: ['cadastre o pasto Norte', 'não', 'não'],
      efeito: (t) => t.pastagens.length,
    },
    {
      nome: 'excluir pasto (writes delete)',
      perfil: 'gerente',
      setup: (t) => { t.pastagens = [{ id: 'p1', nome: 'Capim Sul', faz_id: 1, owner_user_id: 'o1' }]; },
      msgs: ['excluir o pasto Capim Sul'],
      efeito: (t) => t.pastagens.length, // 1 → 0 na 1ª confirmação; a 2ª não pode reintroduzir
    },
    {
      nome: 'resolver alerta (writes insert em alertas_tratativas)',
      setup: (t) => { t.estoque = [{ id: 1, produto: 'Sal', data_validade: '2020-01-01', alerta_dias_antes: 5, quantidade_atual: 100, quantidade_minima: 10, owner_user_id: 'o1' }]; },
      msgs: ['resolver alerta 1'],
      efeito: (t) => t.alertas_tratativas.length,
    },
  ];
}

test('idempotência: confirmação repetida nunca duplica a gravação (todos os ramos do executor)', async () => {
  for (const c of cenarios()) {
    const tables = baseTables(c.perfil || 'operador');
    if (c.setup) c.setup(tables);
    const client = makeClient(tables);
    const cx = conexao();

    for (const msg of c.msgs) {
      await processarComandoBot({ client, conexao: cx, texto: msg, chatId: '123' });
    }
    const primeira = await processarComandoBot({ client, conexao: cx, texto: '/confirmar', chatId: '123' });
    assert.match(primeira.texto, /Registrado|concluída|Transferência|renomeado|atualizado|reaberto|excluíd[oa]/i, `${c.nome}: 1ª confirmação deveria executar (recebeu: ${primeira.texto})`);
    const efeitoApos1 = c.efeito(tables);

    // Segunda confirmação (retry / callback repetido / resposta atrasada):
    const segunda = await processarComandoBot({ client, conexao: cx, texto: '/confirmar', chatId: '123' });
    assert.match(segunda.texto, /nenhuma operação/i, `${c.nome}: 2ª confirmação deveria dizer que não há operação pendente (recebeu: ${segunda.texto})`);
    const efeitoApos2 = c.efeito(tables);

    assert.equal(efeitoApos2, efeitoApos1, `${c.nome}: efeito não pode mudar na 2ª confirmação (${efeitoApos1} → ${efeitoApos2})`);
    // Exatamente uma operação marcada como executada, nunca duas:
    const executadas = tables.telegram_operacoes_pendentes.filter((o) => o.status === 'executada');
    assert.equal(executadas.length, 1, `${c.nome}: deveria haver exatamente 1 operação executada`);
  }
});

test('idempotência: uma nova operação cancela a pendência anterior do mesmo chat (não acumula)', async () => {
  const tables = baseTables('operador');
  const client = makeClient(tables);
  const cx = conexao();
  // Propõe uma transferência, depois propõe um renomear SEM confirmar a
  // primeira (ambas propõem numa única mensagem, sem entrar em conversa):
  await processarComandoBot({ client, conexao: cx, texto: 'transferir 15 animais do lote Recria 01 para Engorda 02', chatId: '123' });
  await processarComandoBot({ client, conexao: cx, texto: 'renomear lote Recria 01 para Recria Norte', chatId: '123' });
  // Só deve haver UMA pendência ativa (a segunda); a primeira foi cancelada.
  const pendentes = tables.telegram_operacoes_pendentes.filter((o) => o.status === 'pendente');
  assert.equal(pendentes.length, 1);
  // E o /confirmar aplica a segunda (renomear), não a transferência:
  await processarComandoBot({ client, conexao: cx, texto: '/confirmar', chatId: '123' });
  assert.equal(tables.lotes.find((l) => l.id === 10).nome, 'Recria Norte');
  assert.equal(tables.movimentacoes_animais.length, 0); // a transferência cancelada nunca aconteceu
});

// ── MULTI-FAZENDA ────────────────────────────────────────────────────────────
function tabelasDuasFazendas(perfil = 'operador') {
  const t = baseTables(perfil);
  t.fazendas.push({ id: 2, nome: 'Boa Vista', owner_user_id: 'o1' });
  // Lote com o MESMO nome nas duas fazendas:
  t.lotes.push({ id: 30, nome: 'Recria 01', status: 'ativo', qtd: 20, p_at: 300, faz_id: 2, owner_user_id: 'o1' });
  return t;
}

test('multi-fazenda: escrita escopada exige fazenda ativa quando há mais de uma', async () => {
  const tables = tabelasDuasFazendas();
  const client = makeClient(tables);
  const semFazenda = { ...conexao(), fazenda_id: null };
  const r = await processarComandoBot({ client, conexao: semFazenda, texto: 'ajustar o lote Recria 01 para 70 cabeças', chatId: '123' });
  assert.match(r.texto, /mais de uma fazenda/i);
  assert.equal(tables.telegram_operacoes_pendentes.filter((o) => o.status === 'pendente').length, 0);
});

test('multi-fazenda: com fazenda ativa, o lote é resolvido dentro do escopo (sem ambiguidade cross-fazenda)', async () => {
  const tables = tabelasDuasFazendas();
  const client = makeClient(tables);
  const c = conexao(); // fazenda_id = 1
  await processarComandoBot({ client, conexao: c, texto: 'ajustar o lote Recria 01 para 70 cabeças', chatId: '123' });
  await processarComandoBot({ client, conexao: c, texto: 'Recontagem', chatId: '123' });
  const r = await processarComandoBot({ client, conexao: c, texto: '/confirmar', chatId: '123' });
  assert.match(r.texto, /Registrado/i);
  // Só o lote 10 (fazenda 1) mudou; o lote 30 (fazenda 2, mesmo nome) ficou intacto:
  assert.equal(tables.lotes.find((l) => l.id === 10).qtd, 70);
  assert.equal(tables.lotes.find((l) => l.id === 30).qtd, 20);
});

test('multi-fazenda: consulta consolidada (resumo de todas) é permitida sem fazenda ativa', async () => {
  const tables = tabelasDuasFazendas();
  const client = makeClient(tables);
  const semFazenda = { ...conexao(), fazenda_id: null };
  const r = await processarComandoBot({ client, conexao: semFazenda, texto: 'resumo de todas as fazendas', chatId: '123' });
  assert.match(r.texto, /Resumo consolidado/);
  assert.match(r.texto, /Santa Clara/);
  assert.match(r.texto, /Boa Vista/);
});

test('multi-fazenda: pasto de outra fazenda é rejeitado ao mover lote', async () => {
  const tables = tabelasDuasFazendas();
  tables.pastagens = [
    { id: 'pa', nome: 'Capim Norte', faz_id: 1, owner_user_id: 'o1' },
    { id: 'pb', nome: 'Capim Sul', faz_id: 2, owner_user_id: 'o1' }, // outra fazenda
  ];
  const client = makeClient(tables);
  const c = conexao(); // fazenda 1
  // tenta mover o lote (fazenda 1) para um pasto da fazenda 2 → recusa
  const r = await processarComandoBot({ client, conexao: c, texto: 'mova o lote Recria 01 para o pasto Capim Sul', chatId: '123' });
  assert.match(r.texto, /não encontrei|outra fazenda/i);
  assert.equal(tables.telegram_operacoes_pendentes.filter((o) => o.status === 'pendente').length, 0);
});
