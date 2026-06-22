import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIPOS_OPERACAO_OFFLINE,
  adicionarOperacaoOffline,
  aplicarItemSincronizadoNoDb,
  construirChaveIdempotencia,
  isOnline,
  listarFilaOffline,
  obterResumoFilaOffline,
  removerOperacaoOffline,
  sincronizarFilaOffline,
  sincronizarItemDaFilaOffline,
} from './offlineQueue.js';
import { supabase } from '../lib/supabase.js';

function installLocalStorageMock() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(String(key), String(value)); },
    removeItem: (key) => { store.delete(String(key)); },
    clear: () => { store.clear(); },
  };
}

function setOnline(value) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: value },
    configurable: true,
    writable: true,
  });
}

function makeSession(userId = 'user-1') {
  return { user: { id: userId, email: `${userId}@test.local` } };
}

installLocalStorageMock();
setOnline(true);

function mockInsertSuccess(captureRef) {
  supabase.from = () => ({
    insert: (payload) => {
      if (captureRef) captureRef.payload = payload;
      return {
        select: () => ({
          single: async () => ({ data: { id: 1, ...payload }, error: null }),
        }),
      };
    },
  });
}

function mockInsertFailure(message = 'network fail') {
  supabase.from = () => ({
    insert: () => ({
      select: () => ({
        single: async () => ({ data: null, error: { message } }),
      }),
    }),
  });
}

function mockLotePastagemAtual(pastagemId) {
  supabase.from = (table) => {
    if (table === 'lotes') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { pastagem_id: pastagemId }, error: null }),
          }),
        }),
      };
    }
    return { insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: 'unexpected table' } }) }) }) };
  };
}

function mockRpcSuccess(captureRef) {
  supabase.rpc = async (name, params) => {
    if (captureRef) captureRef.call = { name, params };
    return {
      data: {
        id: 'hist-1',
        lote_id: params.p_lote_id,
        pastagem_origem_id: null,
        pastagem_destino_id: params.p_pastagem_destino_id,
      },
      error: null,
    };
  };
}

function mockRpcFailure(message = 'O pasto de destino pertence a outra fazenda.') {
  supabase.rpc = async () => ({ data: null, error: { message } });
}

test('offlineQueue', { concurrency: 1 }, async (t) => {

  await t.test('isOnline reflete navigator.onLine', () => {
    setOnline(true);
    assert.equal(isOnline(), true);
    setOnline(false);
    assert.equal(isOnline(), false);
    setOnline(true);
  });

  await t.test('tipos de operação offline cobrem os 5 tipos esperados', () => {
    assert.deepEqual(TIPOS_OPERACAO_OFFLINE, [
      'pesagem_lote',
      'pesagem_animal',
      'movimentacao_pasto',
      'despesa_simples',
      'ocorrencia_manejo',
    ]);
  });

  await t.test('adicionarOperacaoOffline cria item com todos os campos pedidos', () => {
    localStorage.clear();
    const resultado = adicionarOperacaoOffline('pesagem_lote', { loteId: 10, data: '2026-06-20', pesoMedio: 320 }, makeSession());

    assert.equal(resultado.ok, true);
    assert.equal(resultado.duplicado, false);
    const item = resultado.item;
    assert.ok(item.id_local);
    assert.equal(item.tipo_operacao, 'pesagem_lote');
    assert.deepEqual(item.payload, { loteId: 10, data: '2026-06-20', pesoMedio: 320 });
    assert.equal(item.status, 'pendente');
    assert.equal(item.tentativas, 0);
    assert.equal(item.erro, null);
    assert.ok(item.criado_em);
    assert.equal(item.sincronizado_em, null);
  });

  await t.test('adicionarOperacaoOffline sem sessão retorna erro amigável e não grava', () => {
    localStorage.clear();
    const resultado = adicionarOperacaoOffline('pesagem_lote', { loteId: 10, data: '2026-06-20', pesoMedio: 320 }, null);
    assert.equal(resultado.ok, false);
    assert.match(resultado.error, /entre na sua conta/i);
    assert.equal(listarFilaOffline(makeSession()).length, 0);
  });

  await t.test('adicionarOperacaoOffline rejeita tipo de operação desconhecido', () => {
    localStorage.clear();
    const resultado = adicionarOperacaoOffline('tipo_invalido', {}, makeSession());
    assert.equal(resultado.ok, false);
    assert.match(resultado.error, /desconhecido/i);
  });

  await t.test('listarFilaOffline e obterResumoFilaOffline são isolados por usuário', () => {
    localStorage.clear();
    adicionarOperacaoOffline('pesagem_lote', { loteId: 1, data: '2026-06-20', pesoMedio: 100 }, makeSession('user-1'));
    adicionarOperacaoOffline('despesa_simples', { fazendaId: 1, data: '2026-06-20', descricao: 'x', valor: 10 }, makeSession('user-2'));

    const resumoUm = obterResumoFilaOffline(makeSession('user-1'));
    const resumoDois = obterResumoFilaOffline(makeSession('user-2'));
    assert.equal(resumoUm.itens.length, 1);
    assert.equal(resumoDois.itens.length, 1);
    assert.equal(resumoUm.pendentes, 1);
    assert.equal(resumoUm.sincronizados, 0);
    assert.equal(resumoUm.comErro, 0);
  });

  await t.test('proteção contra duplicidade local: mesma chave de idempotência não duplica enquanto pendente', () => {
    localStorage.clear();
    const session = makeSession();
    const payload = { loteId: 10, data: '2026-06-20', pesoMedio: 320 };
    const primeiro = adicionarOperacaoOffline('pesagem_lote', payload, session);
    const segundo = adicionarOperacaoOffline('pesagem_lote', payload, session);

    assert.equal(primeiro.duplicado, false);
    assert.equal(segundo.duplicado, true);
    assert.equal(segundo.item.id_local, primeiro.item.id_local);
    assert.equal(listarFilaOffline(session).length, 1);
  });

  await t.test('construirChaveIdempotencia é determinística para o mesmo payload', () => {
    const chaveA = construirChaveIdempotencia('despesa_simples', { fazendaId: 1, data: '2026-06-20', valor: 50, descricao: 'Frete' });
    const chaveB = construirChaveIdempotencia('despesa_simples', { fazendaId: 1, data: '2026-06-20', valor: 50, descricao: 'Frete' });
    const chaveDiferente = construirChaveIdempotencia('despesa_simples', { fazendaId: 1, data: '2026-06-20', valor: 99, descricao: 'Frete' });
    assert.equal(chaveA, chaveB);
    assert.notEqual(chaveA, chaveDiferente);
  });

  await t.test('removerOperacaoOffline remove apenas o item do dono correto', () => {
    localStorage.clear();
    const session = makeSession();
    const { item } = adicionarOperacaoOffline('pesagem_lote', { loteId: 1, data: '2026-06-20', pesoMedio: 100 }, session);
    assert.equal(removerOperacaoOffline(item.id_local, makeSession('outro-user')), false);
    assert.equal(removerOperacaoOffline(item.id_local, session), true);
    assert.equal(listarFilaOffline(session).length, 0);
  });

  await t.test('sincronizarFilaOffline sem sessão não tenta sincronizar', async () => {
    const resultado = await sincronizarFilaOffline(null);
    assert.equal(resultado.semSessao, true);
    assert.equal(resultado.sincronizados, 0);
  });

  await t.test('sincronizarFilaOffline offline não tenta enviar e mantém pendência', async () => {
    localStorage.clear();
    const session = makeSession();
    adicionarOperacaoOffline('pesagem_lote', { loteId: 1, data: '2026-06-20', pesoMedio: 100 }, session);
    setOnline(false);
    const resultado = await sincronizarFilaOffline(session);
    setOnline(true);
    assert.equal(resultado.offline, true);
    assert.equal(resultado.pendentes, 1);
  });

  await t.test('pesagem_lote sincroniza via createOperationalRecord e marca como sincronizado', async () => {
    localStorage.clear();
    const session = makeSession();
    const capture = {};
    mockInsertSuccess(capture);
    adicionarOperacaoOffline('pesagem_lote', { loteId: 10, data: '2026-06-20', pesoMedio: 320, quantidadeCabecas: 5, observacao: 'teste' }, session);

    const sincronizados = [];
    const resultado = await sincronizarFilaOffline(session, { onItemSynced: (item, data) => sincronizados.push({ item, data }) });

    assert.equal(resultado.sincronizados, 1);
    assert.equal(resultado.pendentes, 0);
    assert.equal(capture.payload.lote_id, 10);
    assert.equal(capture.payload.peso_medio, 320);
    assert.equal(capture.payload.tipo, 'lote');
    assert.equal(sincronizados.length, 1);

    const resumo = obterResumoFilaOffline(session);
    assert.equal(resumo.itens[0].status, 'sincronizado');
    assert.ok(resumo.itens[0].sincronizado_em);
  });

  await t.test('pesagem_animal envia tipo=animal e animal_id', async () => {
    localStorage.clear();
    const session = makeSession();
    const capture = {};
    mockInsertSuccess(capture);
    adicionarOperacaoOffline('pesagem_animal', { animalId: 77, loteId: 10, data: '2026-06-20', pesoMedio: 280 }, session);

    await sincronizarFilaOffline(session);
    assert.equal(capture.payload.tipo, 'animal');
    assert.equal(capture.payload.animal_id, 77);
  });

  await t.test('despesa_simples sincroniza como movimentacoes_financeiras tipo despesa', async () => {
    localStorage.clear();
    const session = makeSession();
    const capture = {};
    mockInsertSuccess(capture);
    adicionarOperacaoOffline('despesa_simples', { fazendaId: 3, data: '2026-06-20', descricao: 'Frete de ração', valor: 450, categoria: 'Frete', observacoes: 'urgente' }, session);

    const resultado = await sincronizarFilaOffline(session);
    assert.equal(resultado.sincronizados, 1);
    assert.equal(capture.payload.tipo, 'despesa');
    assert.equal(capture.payload.fazenda_id, 3);
    assert.equal(capture.payload.valor, 450);
    assert.equal(capture.payload.categoria, 'Frete');
  });

  await t.test('ocorrencia_manejo sincroniza como registro em sanitario', async () => {
    localStorage.clear();
    const session = makeSession();
    const capture = {};
    mockInsertSuccess(capture);
    adicionarOperacaoOffline('ocorrencia_manejo', { fazendaId: 2, loteId: 5, data: '2026-06-20', tipo: 'mortalidade', descricao: 'Animal encontrado morto', observacoes: '' }, session);

    const resultado = await sincronizarFilaOffline(session);
    assert.equal(resultado.sincronizados, 1);
    assert.equal(capture.payload.tipo, 'mortalidade');
    assert.equal(capture.payload.desc, 'Animal encontrado morto');
    assert.equal(capture.payload.lote_id, 5);
  });

  await t.test('movimentacao_pasto sincroniza via RPC mover_lote_para_pasto quando o pasto atual confere', async () => {
    localStorage.clear();
    const session = makeSession();
    mockLotePastagemAtual('pasto-1');
    const captureRpc = {};
    mockRpcSuccess(captureRpc);

    adicionarOperacaoOffline('movimentacao_pasto', {
      loteId: 20,
      pastagemDestinoId: 'pasto-2',
      dataMovimentacao: '2026-06-20',
      quantidadeCabecas: 62,
      motivo: 'Rotação de pasto',
      observacoes: null,
      pastagemOrigemEsperada: 'pasto-1',
    }, session);

    const resultado = await sincronizarFilaOffline(session);
    assert.equal(resultado.sincronizados, 1);
    assert.equal(captureRpc.call.params.p_lote_id, 20);
    assert.equal(captureRpc.call.params.p_pastagem_destino_id, 'pasto-2');
  });

  await t.test('movimentacao_pasto bloqueia com erro amigável se o lote já mudou de pasto antes de sincronizar', async () => {
    localStorage.clear();
    const session = makeSession();
    // pasto atual real (pasto-9) é diferente do esperado quando a operação foi enfileirada (pasto-1)
    mockLotePastagemAtual('pasto-9');
    let rpcChamada = false;
    supabase.rpc = async () => { rpcChamada = true; return { data: null, error: null }; };

    adicionarOperacaoOffline('movimentacao_pasto', {
      loteId: 20,
      pastagemDestinoId: 'pasto-2',
      dataMovimentacao: '2026-06-20',
      pastagemOrigemEsperada: 'pasto-1',
    }, session);

    const resultado = await sincronizarFilaOffline(session);
    assert.equal(resultado.sincronizados, 0);
    assert.equal(resultado.comErro, 1);
    assert.equal(rpcChamada, false);

    const resumo = obterResumoFilaOffline(session);
    assert.match(resumo.itens[0].erro, /já foi movido/i);
    assert.equal(resumo.itens[0].status, 'erro');
  });

  await t.test('marca como erro e mantém a pendência quando a gravação real falha', async () => {
    localStorage.clear();
    const session = makeSession();
    mockInsertFailure('network fail');
    adicionarOperacaoOffline('pesagem_lote', { loteId: 1, data: '2026-06-20', pesoMedio: 100 }, session);

    const resultado = await sincronizarFilaOffline(session);
    assert.equal(resultado.sincronizados, 0);
    assert.equal(resultado.comErro, 1);
    // O item não fica mais como "pendente" — passa para o status "erro",
    // mas continua na fila (não é apagado) e visível para o usuário.
    assert.equal(resultado.pendentes, 0);

    const resumo = obterResumoFilaOffline(session);
    assert.equal(resumo.itens.length, 1);
    assert.equal(resumo.itens[0].status, 'erro');
    assert.equal(resumo.itens[0].tentativas, 1);
    assert.ok(resumo.itens[0].erro);
  });

  await t.test('retry manual de um único item: sincronizarItemDaFilaOffline', async () => {
    localStorage.clear();
    const session = makeSession();
    mockInsertFailure('network fail');
    const { item } = adicionarOperacaoOffline('pesagem_lote', { loteId: 1, data: '2026-06-20', pesoMedio: 100 }, session);
    await sincronizarFilaOffline(session);
    assert.equal(obterResumoFilaOffline(session).itens[0].status, 'erro');

    mockInsertSuccess({});
    const retry = await sincronizarItemDaFilaOffline(item.id_local, session);
    assert.equal(retry.ok, true);
    assert.equal(obterResumoFilaOffline(session).itens[0].status, 'sincronizado');
  });

  await t.test('sincronizarItemDaFilaOffline sem sessão retorna erro amigável', async () => {
    const resultado = await sincronizarItemDaFilaOffline('qualquer-id', null);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.semSessao, true);
  });

  await t.test('rpc com mensagem de negócio (ex.: outra fazenda) mantém o item com erro e não duplica registro', async () => {
    localStorage.clear();
    const session = makeSession();
    mockLotePastagemAtual(null);
    mockRpcFailure('O pasto de destino pertence a outra fazenda.');

    adicionarOperacaoOffline('movimentacao_pasto', {
      loteId: 30,
      pastagemDestinoId: 'pasto-de-outra-fazenda',
      dataMovimentacao: '2026-06-20',
      pastagemOrigemEsperada: null,
    }, session);

    const resultado = await sincronizarFilaOffline(session);
    assert.equal(resultado.sincronizados, 0);
    assert.match(obterResumoFilaOffline(session).itens[0].erro, /outra fazenda/i);
  });

  await t.test('aplicarItemSincronizadoNoDb mescla pesagem na lista correspondente', () => {
    const db = { pesagens: [] };
    const novo = aplicarItemSincronizadoNoDb(db, { tipo_operacao: 'pesagem_lote' }, { id: 99, peso_medio: 300 });
    assert.equal(novo.pesagens.length, 1);
    assert.equal(novo.pesagens[0].id, 99);
  });

  await t.test('aplicarItemSincronizadoNoDb atualiza pastagem_id do lote em movimentacao_pasto', () => {
    const db = { lotes: [{ id: 5, pastagem_id: 'pasto-1' }] };
    const novo = aplicarItemSincronizadoNoDb(db, { tipo_operacao: 'movimentacao_pasto', payload: { loteId: 5, pastagemDestinoId: 'pasto-2' } }, null);
    assert.equal(novo.lotes[0].pastagem_id, 'pasto-2');
  });

});
