import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOperationalRecord,
  getPendingSyncQueueSnapshot,
  mergePendingCreatesIntoSnapshot,
  processPendingSyncQueue,
  reconcileSyncedRecords,
} from '../src/services/operationalPersistence.js';
import { supabase } from '../src/lib/supabase.js';
import { gerarNovoId } from '../src/utils/id.js';
import {
  makeSession,
  mockInvalidSupabaseAuthSession,
  mockValidSupabaseAuthSession,
} from './fixtures.js';

// Node não expõe localStorage por padrão; a fila de sincronização pendente
// depende dele. Este shim em memória é usado apenas nos testes.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

function clearPendingQueue() {
  globalThis.localStorage.clear();
}

function mockInsertSuccess(capture) {
  supabase.from = () => ({
    insert: (payload) => {
      capture.payload = payload;
      return {
        select: () => ({
          single: async () => ({ data: { id: 501, ...payload }, error: null }),
        }),
      };
    },
  });
}

function mockInsertRlsDenied() {
  supabase.from = () => ({
    insert: () => ({
      select: () => ({
        single: async () => ({ data: null, error: { code: '42501', message: 'permission denied for table animais' } }),
      }),
    }),
  });
}

// Reproduz exatamente a construção usada em AnimaisPage.jsx/salvarAnimal ao
// criar um novo animal: gera um id local estável antes de chamar
// createOperationalRecord, para que o registro nunca fique sem id.
function buildNovoAnimalPayload(animaisAtuais, dadosFormulario) {
  const localId = gerarNovoId(animaisAtuais);
  return {
    ...dadosFormulario,
    id: localId,
    metadata: { ...(dadosFormulario.metadata || {}), local_id: localId },
  };
}

const DADOS_GRUPO = {
  tipo_registro: 'grupo',
  lote_id: 14,
  identificacao: 'Grupo Teste',
  gen: 'Nelore',
  qtd: 30,
  p_ini: 280,
  p_at: 380,
  dias: 70,
  consumo: 9,
  status: 'ativo',
  rendimento_carcaca: 52,
};

test('cadastro online: animal criado com sessão válida persiste na nuvem e retorna o registro real', async () => {
  clearPendingQueue();
  mockValidSupabaseAuthSession(supabase);
  const capture = {};
  mockInsertSuccess(capture);

  const dadosComId = buildNovoAnimalPayload([], DADOS_GRUPO);
  const result = await createOperationalRecord('animais', dadosComId, makeSession());

  assert.equal(result.persisted, true);
  assert.equal(result.syncStatus, 'cloud_success');
  assert.equal(result.data.id, 501);
  assert.equal(capture.payload.identificacao, 'Grupo Teste');
  assert.equal(getPendingSyncQueueSnapshot().pendingCount, 0);
});

test('cadastro offline: sem sessão válida, o animal é salvo localmente com id estável (sem sucesso falso)', async () => {
  clearPendingQueue();
  mockInvalidSupabaseAuthSession(supabase);

  const dadosComId = buildNovoAnimalPayload([], DADOS_GRUPO);
  const result = await createOperationalRecord('animais', dadosComId, makeSession());

  assert.equal(result.persisted, false, 'não deve informar sucesso quando não persistiu na nuvem');
  assert.equal(result.syncStatus, 'pending_sync');
  assert.equal(result.data.id, dadosComId.id, 'o registro offline precisa manter um id local válido');
  assert.equal(getPendingSyncQueueSnapshot().pendingCount, 1, 'deve entrar na fila de pendências');
});

test('atualização imediata da listagem: o registro resultante sempre tem id e tipo_registro, online ou offline', async () => {
  clearPendingQueue();

  // Caminho online
  mockValidSupabaseAuthSession(supabase);
  mockInsertSuccess({});
  const dadosOnline = buildNovoAnimalPayload([], DADOS_GRUPO);
  const persistedOnline = await createOperationalRecord('animais', dadosOnline, makeSession());
  const incomingOnline = persistedOnline.data || dadosOnline;
  const listaOnline = [incomingOnline];
  assert.ok(listaOnline.every((animal) => animal.id !== undefined && animal.id !== null));
  assert.equal(listaOnline.filter((a) => (a.tipo_registro || 'grupo') !== 'individual').length, 1);

  // Caminho offline
  clearPendingQueue();
  mockInvalidSupabaseAuthSession(supabase);
  const dadosOffline = buildNovoAnimalPayload(listaOnline, DADOS_GRUPO);
  const persistedOffline = await createOperationalRecord('animais', dadosOffline, makeSession());
  const incomingOffline = persistedOffline.data || dadosOffline;
  const listaCompleta = [...listaOnline, incomingOffline];
  assert.ok(listaCompleta.every((animal) => animal.id !== undefined && animal.id !== null));
  assert.equal(listaCompleta.length, 2, 'o segundo cadastro precisa aparecer imediatamente na listagem');
  assert.notEqual(incomingOffline.id, incomingOnline.id, 'ids locais e de nuvem não podem colidir');
});

test('reload: um registro criado offline sobrevive a uma nova hidratação (merge com a fila pendente)', async () => {
  clearPendingQueue();
  mockInvalidSupabaseAuthSession(supabase);

  const dadosComId = buildNovoAnimalPayload([], DADOS_GRUPO);
  await createOperationalRecord('animais', dadosComId, makeSession());

  const pendingQueue = getPendingSyncQueueSnapshot().queue;
  const snapshotDaNuvemAposReload = []; // ainda não sincronizado, nuvem não tem o registro
  const merged = mergePendingCreatesIntoSnapshot('animais', snapshotDaNuvemAposReload, pendingQueue);

  assert.equal(merged.length, 1, 'o registro pendente deve aparecer mesmo após recarregar a página');
  assert.equal(merged[0].id, dadosComId.id);

  // Se a nuvem já tiver o registro sincronizado, não deve duplicar
  const snapshotJaSincronizado = [{ ...dadosComId, id: 999 }];
  const mergedSemDuplicar = mergePendingCreatesIntoSnapshot('animais', snapshotJaSincronizado, pendingQueue);
  assert.equal(mergedSemDuplicar.length, 1, 'não deve duplicar quando a nuvem já confirmou o registro');
});

test('sincronização posterior: retry automático da fila persiste o registro pendente na nuvem', async () => {
  clearPendingQueue();
  mockInvalidSupabaseAuthSession(supabase);

  const dadosComId = buildNovoAnimalPayload([], DADOS_GRUPO);
  await createOperationalRecord('animais', dadosComId, makeSession());
  assert.equal(getPendingSyncQueueSnapshot().pendingCount, 1);

  // A conectividade volta e a sessão passa a ser válida
  mockValidSupabaseAuthSession(supabase);
  mockInsertSuccess({});

  const result = await processPendingSyncQueue(makeSession(), { maxItems: 10, manual: true });

  assert.equal(result.synced, 1);
  assert.equal(result.pendingCount, 0, 'a fila deve esvaziar após sincronizar com sucesso');
  assert.equal(result.syncedItems.length, 1);
  assert.equal(result.syncedItems[0].table, 'animais');
  assert.equal(String(result.syncedItems[0].localId), String(dadosComId.id));
  assert.equal(result.syncedItems[0].data.id, 501);
});

test('prevenção de duplicidade: reconciliar itens sincronizados substitui o registro local em vez de duplicar', async () => {
  const localId = 7;
  const dbAntes = {
    animais: [{ id: localId, ...DADOS_GRUPO, metadata: { local_id: localId } }],
  };

  const syncedItems = [
    { table: 'animais', action: 'create', localId: String(localId), data: { id: 501, ...DADOS_GRUPO, metadata: { local_id: localId } } },
  ];

  const dbDepois = reconcileSyncedRecords(dbAntes, syncedItems);

  assert.equal(dbDepois.animais.length, 1, 'não pode haver duas linhas para o mesmo animal');
  assert.equal(dbDepois.animais[0].id, 501, 'o id local deve ser substituído pelo id real da nuvem');
});

test('erro de persistência: falha de permissão (RLS) não é reportada como sucesso e fica registrada na fila', async () => {
  clearPendingQueue();
  mockValidSupabaseAuthSession(supabase);
  mockInsertRlsDenied();

  const dadosComId = buildNovoAnimalPayload([], DADOS_GRUPO);
  const result = await createOperationalRecord('animais', dadosComId, makeSession());

  assert.equal(result.persisted, false);
  assert.equal(result.syncStatus, 'pending_sync');
  assert.equal(result.code, 'permission_denied');
  assert.equal(getPendingSyncQueueSnapshot().pendingCount, 1);
});
