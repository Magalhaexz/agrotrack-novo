import { useMemo, useState } from 'react';
import PesagemForm from '../components/PesagemForm';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import EmptyState from '../components/EmptyState';
import { formatarNumero, formatarData } from '../utils/formatters';
import { gerarNovoId } from '../utils/id';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../auth/useAuth';
import { daysBetween, toDateKey } from '../domain/calcHelpers.js';
import {
  createOperationalRecord,
  deleteOperationalRecord,
  persistCollectionMutation,
  updateOperationalRecord,
} from '../services/operationalPersistence';

function toFiniteNumber(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function normalizeIdKey(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function idsMatch(left, right) {
  const leftKey = normalizeIdKey(left);
  const rightKey = normalizeIdKey(right);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

function getAnimalIndex(animal, fallbackIndex = null) {
  const fromMetadata = Number(animal?.metadata?.index);
  if (Number.isFinite(fromMetadata) && fromMetadata > 0) return Math.floor(fromMetadata);
  const identificacao = String(animal?.identificacao || animal?.nome || '');
  const match = identificacao.match(/#\s*(\d+)/i);
  if (match) {
    const fromLabel = Number(match[1]);
    if (Number.isFinite(fromLabel) && fromLabel > 0) return Math.floor(fromLabel);
  }
  return Number.isFinite(Number(fallbackIndex)) ? Number(fallbackIndex) : null;
}

function isValidUuid(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text);
}

function logBatchWeighingSave(event = {}) {
  if (!import.meta.env.DEV) return;
  console.info('[HERDON_BATCH_WEIGHING_SAVE]', {
    stage: event.stage || null,
    table: event.table || null,
    action: event.action || null,
    payloadKeys: Array.isArray(event.payloadKeys) ? event.payloadKeys : [],
    loteIdPresent: Boolean(event.loteIdPresent),
    animalIdPresent: Boolean(event.animalIdPresent),
    virtualIndex: event.virtualIndex ?? null,
    identification: event.identification || null,
    syncStatus: event.syncStatus || null,
    code: event.code || null,
    safeMessage: event.safeMessage || null,
  });
}

function buildSafeAnimalPayload(payload = {}, lote = null, virtualIndex = null) {
  const loteId = Number(payload?.lote_id ?? lote?.id);
  const identificacao = String(payload?.identificacao || `Animal #${virtualIndex || ''}`).trim();
  const metadata = {
    ...(typeof payload?.metadata === 'object' && payload?.metadata ? payload.metadata : {}),
    generated_from_weighing: true,
    index: Number(virtualIndex || payload?.metadata?.index || 0) || undefined,
  };
  return {
    lote_id: Number.isFinite(loteId) && loteId > 0 ? loteId : null,
    identificacao: identificacao || null,
    tipo_registro: 'individual',
    qtd: 1,
    status: String(payload?.status || 'ativo'),
    p_ini: Number.isFinite(Number(payload?.p_ini)) ? Number(payload?.p_ini) : (Number.isFinite(Number(lote?.p_ini)) ? Number(lote?.p_ini) : null),
    p_at: Number.isFinite(Number(payload?.p_at)) ? Number(payload?.p_at) : (Number.isFinite(Number(lote?.p_at)) ? Number(lote?.p_at) : null),
    metadata: Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined)),
  };
}

function buildSafePesagemPayload(payload = {}) {
  const metadata = {
    ...(typeof payload?.metadata === 'object' && payload?.metadata ? payload.metadata : {}),
  };
  if (payload?.virtual_animal?.index) metadata.virtualIndex = Number(payload.virtual_animal.index);
  if (payload?.virtual_animal?.identificacao) metadata.animal_identificacao = String(payload.virtual_animal.identificacao);
  if (payload?.animal_identificacao) metadata.animal_identificacao = String(payload.animal_identificacao);

  const safe = {
    lote_id: Number.isFinite(Number(payload?.lote_id)) ? Number(payload.lote_id) : null,
    animal_id: normalizeIdKey(payload?.animal_id),
    data: payload?.data ? String(payload.data) : null,
    tipo: 'animal',
    peso_medio: Number.isFinite(Number(payload?.peso_medio)) ? Number(payload.peso_medio) : null,
    observacao: payload?.observacao ? String(payload.observacao) : null,
    metadata: Object.keys(metadata).length ? metadata : undefined,
  };
  if (Number.isFinite(Number(payload?.rendimento_carcaca))) safe.rendimento_carcaca = Number(payload.rendimento_carcaca);
  if (payload?.preco_arroba !== null && payload?.preco_arroba !== undefined && payload?.preco_arroba !== '' && Number.isFinite(Number(payload.preco_arroba))) {
    safe.preco_arroba = Number(payload.preco_arroba);
  }
  return Object.fromEntries(Object.entries(safe).filter(([, value]) => value !== undefined));
}

function resolveTipoPesagem(item) {
  if (item?.tipo === 'animal' || item?.origem === 'animal') return 'animal';
  return 'lote';
}

function resolveLatestPesagem(pesagens) {
  return [...(pesagens || [])]
    .map((item) => ({ ...item, data: toDateKey(item?.data) }))
    .filter((item) => item?.data)
    .sort((a, b) => {
      if (a.data !== b.data) return b.data.localeCompare(a.data);
      return toFiniteNumber(b.id) - toFiniteNumber(a.id);
    })[0] || null;
}

function calculateAverageGmdByLote(pesagens = []) {
  const pesagensPorLote = new Map();

  (pesagens || []).forEach((pesagem) => {
    if (resolveTipoPesagem(pesagem) !== 'lote') return;
    const loteId = Number(pesagem?.lote_id);
    if (!Number.isFinite(loteId) || loteId <= 0) return;
    if (!pesagensPorLote.has(loteId)) pesagensPorLote.set(loteId, []);
    pesagensPorLote.get(loteId).push(pesagem);
  });

  const gmdValues = [];
  pesagensPorLote.forEach((lotePesagens) => {
    const sorted = [...lotePesagens]
      .map((item) => ({ ...item, data: toDateKey(item?.data) }))
      .filter((item) => item?.data && Number.isFinite(Number(item?.peso_medio)))
      .sort((a, b) => a.data.localeCompare(b.data));

    if (sorted.length < 2) return;

    const primeira = sorted[0];
    const ultima = sorted[sorted.length - 1];
    const dias = daysBetween(primeira.data, ultima.data);
    if (!Number.isFinite(dias) || dias <= 0) return;

    const ganho = Number(ultima.peso_medio) - Number(primeira.peso_medio);
    const gmd = ganho / dias;
    if (Number.isFinite(gmd)) gmdValues.push(gmd);
  });

  if (!gmdValues.length) return null;
  const media = gmdValues.reduce((total, value) => total + value, 0) / gmdValues.length;
  return Number.isFinite(media) ? media : null;
}

function recalculateLoteFromPesagens(prevDb, loteId, nextPesagens) {
  const lotes = Array.isArray(prevDb?.lotes) ? prevDb.lotes : [];
  const animais = Array.isArray(prevDb?.animais) ? prevDb.animais : [];
  const normalizedLoteId = Number(loteId);

  const pesagensLote = (nextPesagens || []).filter((item) => (
    resolveTipoPesagem(item) === 'lote' && Number(item?.lote_id) === normalizedLoteId
  ));
  const latestPesagem = resolveLatestPesagem(pesagensLote);

  const fallbackPesoFromAnimais = (() => {
    const grupos = animais.filter((item) => Number(item?.lote_id) === normalizedLoteId);
    const qtd = grupos.reduce((sum, item) => sum + toFiniteNumber(item?.qtd), 0);
    if (qtd <= 0) return 0;
    const pesoTotal = grupos.reduce(
      (sum, item) => sum + toFiniteNumber(item?.p_at) * toFiniteNumber(item?.qtd),
      0
    );
    return qtd > 0 ? pesoTotal / qtd : 0;
  })();

  const nextPesoAtual = latestPesagem
    ? toFiniteNumber(latestPesagem.peso_medio, fallbackPesoFromAnimais)
    : fallbackPesoFromAnimais;
  const nextUltimaPesagem = latestPesagem?.data || null;

  const nextLotes = lotes.map((lote) => {
    if (Number(lote?.id) !== normalizedLoteId) return lote;
    return {
      ...lote,
      p_at: nextPesoAtual,
      peso_atual: nextPesoAtual,
      peso_medio_atual: nextPesoAtual,
      ultima_pesagem: nextUltimaPesagem,
    };
  });

  return {
    ...prevDb,
    pesagens: nextPesagens,
    lotes: nextLotes,
  };
}

function shouldUpdateLote(record) {
  return resolveTipoPesagem(record) === 'lote' && Number(record?.lote_id) > 0;
}

export default function PesagensPage({ db, setDb, onConfirmAction, navigationIntent = null, onNavigate }) {
  const { hasPermission, session } = useAuth();
  const { showToast } = useToast();
  const mensagemSemPermissao = 'Você não tem permissão para executar esta ação.';

  const shouldStartWithNewPesagem = navigationIntent?.page === 'pesagens' && navigationIntent?.action === 'novo';
  const [abrirForm, setAbrirForm] = useState(shouldStartWithNewPesagem);
  const [pesagemEditando, setPesagemEditando] = useState(null);
  const [ultimoResumoBatch, setUltimoResumoBatch] = useState(null);

  const lotes = db?.lotes;
  const animais = db?.animais;
  const pesagens = db?.pesagens;

  const lotesMap = useMemo(() => {
    const map = new Map();
    (lotes || []).forEach((lote) => map.set(Number(lote.id), lote));
    return map;
  }, [lotes]);

  const animaisMap = useMemo(() => {
    const map = new Map();
    (animais || []).forEach((animal) => {
      const idKey = normalizeIdKey(animal?.id);
      const cloudKey = normalizeIdKey(animal?.cloud_id);
      const localKey = normalizeIdKey(animal?.metadata?.local_id);
      if (idKey) map.set(`id:${idKey}`, animal);
      if (cloudKey) map.set(`cloud:${cloudKey}`, animal);
      if (localKey) map.set(`local:${localKey}`, animal);
    });
    return map;
  }, [animais]);

  const dadosTabela = useMemo(() => {
    const pesagensPorLote = new Map();
    (pesagens || []).forEach((pesagem) => {
      if (resolveTipoPesagem(pesagem) !== 'lote') return;
      const loteId = Number(pesagem.lote_id);
      if (!pesagensPorLote.has(loteId)) pesagensPorLote.set(loteId, []);
      pesagensPorLote.get(loteId).push(pesagem);
    });

    const variacaoPorPesagem = new Map();
    pesagensPorLote.forEach((lotePesagens) => {
      lotePesagens.sort((a, b) => toDateKey(a.data).localeCompare(toDateKey(b.data)));
      for (let i = 0; i < lotePesagens.length; i += 1) {
        const atual = lotePesagens[i];
        const anterior = i > 0 ? lotePesagens[i - 1] : null;
        const variacao = anterior ? Number(atual.peso_medio) - Number(anterior.peso_medio) : null;
        variacaoPorPesagem.set(atual.id, variacao);
      }
    });

    return [...(pesagens || [])]
      .map((pesagem) => ({ ...pesagem, data: toDateKey(pesagem?.data) }))
      .filter((pesagem) => pesagem.data)
      .map((pesagem) => {
        const tipo = resolveTipoPesagem(pesagem);
        const animalId = normalizeIdKey(pesagem?.animal_id);
        const cloudAnimalId = normalizeIdKey(pesagem?.metadata?.animal_cloud_id);
        const localAnimalId = normalizeIdKey(pesagem?.metadata?.animal_local_id);
        const animal = (
          (animalId ? animaisMap.get(`id:${animalId}`) : null)
          || (cloudAnimalId ? animaisMap.get(`cloud:${cloudAnimalId}`) : null)
          || (localAnimalId ? animaisMap.get(`local:${localAnimalId}`) : null)
          || null
        );
        const fallbackAnimalName = (
          pesagem?.metadata?.animal_identificacao
          || (pesagem?.metadata?.virtualIndex ? `Animal #${pesagem.metadata.virtualIndex}` : null)
          || (pesagem?.metadata?.index ? `Animal #${pesagem.metadata.index}` : null)
          || null
        );
        return {
          ...pesagem,
          tipo,
          loteNome: lotesMap.get(Number(pesagem.lote_id))?.nome || '—',
          animalNome: animal?.identificacao || animal?.nome || fallbackAnimalName,
          variacao: tipo === 'lote' ? variacaoPorPesagem.get(pesagem.id) ?? null : null,
        };
      })
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [pesagens, lotesMap, animaisMap]);

  const resumo = useMemo(() => {
    const basePesagens = pesagens || [];
    const totalPesagens = basePesagens.length;
    const lotesComPesagem = new Set();
    let ultimaData = '';
    let latestTimestamp = 0;
    let totalPesoMedio = 0;
    let totalPesagensAnimal = 0;

    basePesagens.forEach((pesagem) => {
      lotesComPesagem.add(pesagem.lote_id);
      totalPesoMedio += Number(pesagem.peso_medio || 0);
      if (resolveTipoPesagem(pesagem) === 'animal') totalPesagensAnimal += 1;
      const currentTimestamp = new Date(`${toDateKey(pesagem.data)}T00:00:00`).getTime();
      if (currentTimestamp > latestTimestamp) {
        latestTimestamp = currentTimestamp;
        ultimaData = pesagem.data;
      }
    });

    const gmdMedio = calculateAverageGmdByLote(basePesagens);

    return {
      totalPesagens,
      totalPesagensAnimal,
      totalPesagensLote: totalPesagens - totalPesagensAnimal,
      lotesComPesagem: lotesComPesagem.size,
      ultimaData,
      pesoMedioGeral: totalPesagens ? totalPesoMedio / totalPesagens : 0,
      gmdMedio,
      gmdMedioDisponivel: Number.isFinite(gmdMedio),
    };
  }, [pesagens]);

  function abrirNovaPesagem() {
    if (!hasPermission('pesagens:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    setPesagemEditando(null);
    setAbaAtiva('nova');
  }

  function editarPesagem(item) {
    if (!hasPermission('pesagens:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    setPesagemEditando(item);
    setAbrirForm(true);
  }

  async function excluirPesagem(id) {
    if (!hasPermission('pesagens:excluir')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    const confirmado = typeof onConfirmAction === 'function'
      ? await onConfirmAction({
          title: 'Excluir pesagem',
          message: 'Deseja excluir esta pesagem?',
          tone: 'danger',
        })
      : window.confirm('Deseja excluir esta pesagem?');
    if (!confirmado) return;

    const pesagemAlvo = (pesagens || []).find((item) => item.id === id) || null;
    const persistedDelete = await deleteOperationalRecord('pesagens', id, session);
    if (!persistedDelete.persisted) {
      showToast({ type: 'warning', message: persistedDelete.error || 'Não foi possível confirmar a exclusão agora.' });
      return;
    }

    if (shouldUpdateLote(pesagemAlvo)) {
      const novoLote = recalculateLoteFromPesagens(
        db,
        pesagemAlvo.lote_id,
        (pesagens || []).filter((item) => item.id !== id)
      )?.lotes?.find((item) => Number(item.id) === Number(pesagemAlvo.lote_id));

      if (novoLote) {
        const lotePersist = await updateOperationalRecord('lotes', novoLote.id, {
          p_at: novoLote.p_at,
          peso_atual: novoLote.peso_atual,
          peso_medio_atual: novoLote.peso_medio_atual,
          ultima_pesagem: novoLote.ultima_pesagem,
        }, session);
        if (!lotePersist.persisted) {
          showToast({ type: 'warning', message: lotePersist.error || 'Não foi possível confirmar a exclusão agora.' });
          return;
        }
      }
    }

    setDb((prev) => {
      const pesagensAtuais = Array.isArray(prev?.pesagens) ? prev.pesagens : [];
      const pesagemRemovida = pesagensAtuais.find((item) => item.id === id);
      const pesagensRestantes = pesagensAtuais.filter((item) => item.id !== id);

      if (!shouldUpdateLote(pesagemRemovida)) {
        return { ...prev, pesagens: pesagensRestantes };
      }
      return recalculateLoteFromPesagens(prev, pesagemRemovida.lote_id, pesagensRestantes);
    });

    showToast({ type: 'success', message: 'Pesagem excluida com sucesso!' });
  }

  async function salvarPesagem(dados) {
    if (!hasPermission('pesagens:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }

    if (dados?.tipo === 'animal_generate_missing') {
      const loteId = Number(dados?.lote_id);
      const lote = (lotes || []).find((item) => Number(item?.id) === loteId);
      if (!loteId || !lote) {
        showToast({ type: 'error', message: 'Selecione um lote valido para gerar os animais.' });
        return;
      }

      const missingIndexes = Array.isArray(dados?.missingIndexes) ? dados.missingIndexes : [];
      if (!missingIndexes.length) {
        showToast({ type: 'info', message: 'Todos os animais individuais esperados ja existem no lote.' });
        return;
      }

      const animaisAtuais = Array.isArray(animais) ? animais : [];
      const loteAnimais = animaisAtuais.filter((item) => Number(item?.lote_id) === loteId);
      const existingIndexes = new Set(loteAnimais.map((item, idx) => getAnimalIndex(item, idx + 1)).filter(Boolean));
      const payloads = missingIndexes
        .filter((idx) => !existingIndexes.has(Number(idx)))
        .map((idx) => buildSafeAnimalPayload({
          lote_id: loteId,
          identificacao: `Animal #${idx}`,
          p_ini: Number(lote?.p_ini || lote?.peso_inicial || lote?.peso_atual || lote?.p_at || 0) || null,
          p_at: Number(lote?.p_at || lote?.peso_atual || lote?.p_ini || lote?.peso_inicial || 0) || null,
          metadata: { generated_from_weighing: true, index: Number(idx) },
        }, lote, idx));

      const persisted = [];
      const criados = [];
      for (const payload of payloads) {
        logBatchWeighingSave({
          stage: 'before_create_missing',
          table: 'animais',
          action: 'create',
          payloadKeys: Object.keys(payload),
          loteIdPresent: payload?.lote_id != null,
          animalIdPresent: false,
          identification: payload?.identificacao,
        });
        const result = await createOperationalRecord('animais', payload, session);
        logBatchWeighingSave({
          stage: 'after_create_missing',
          table: 'animais',
          action: 'create',
          payloadKeys: Object.keys(payload),
          loteIdPresent: payload?.lote_id != null,
          animalIdPresent: Boolean(result?.data?.id),
          identification: payload?.identificacao,
          syncStatus: result?.syncStatus,
          code: result?.code,
          safeMessage: result?.error || null,
        });
        persisted.push(result);
        criados.push(result.data || { id: gerarNovoId([...(animaisAtuais || []), ...criados]), ...payload });
      }

      const batch = await persistCollectionMutation(persisted.map((item) => Promise.resolve(item)));
      if (!batch.persisted) {
        showToast({ type: 'warning', message: 'Não foi possível confirmar todos os cadastros agora.' });
        return;
      }

      if (criados.length) {
        setDb((prev) => ({
          ...prev,
          animais: [...(Array.isArray(prev?.animais) ? prev.animais : []), ...criados],
        }));
      }

      showToast({ type: 'success', message: 'Animais do lote gerados com sucesso.' });
      return;
    }

    if (dados?.tipo === 'animal_batch') {
      const registros = Array.isArray(dados.registros) ? dados.registros : [];
      if (!registros.length) {
        showToast({ type: 'error', message: 'Nenhuma pesagem individual válida para salvar.' });
        return;
      }

      const loteId = Number(dados?.lote_id);
      const lote = (lotes || []).find((item) => Number(item?.id) === loteId);
      const animaisAtuais = Array.isArray(animais) ? animais : [];
      const loteAnimais = animaisAtuais.filter((item) => Number(item?.lote_id) === loteId);
      const animalsByIndex = new Map();
      loteAnimais.forEach((animal, idx) => {
        const index = getAnimalIndex(animal, idx + 1);
        if (index && !animalsByIndex.has(index)) animalsByIndex.set(index, animal);
      });

      const createdAnimais = [];
      const createAnimalResults = [];
      const normalizedRegistros = [];
      const failedRecords = [];
      const indexToAnimal = new Map();
      loteAnimais.forEach((animal, idx) => {
        const index = getAnimalIndex(animal, idx + 1);
        if (index && !indexToAnimal.has(index)) indexToAnimal.set(index, animal);
      });

      for (const registro of registros) {
        const directAnimalId = normalizeIdKey(registro?.animal_id);
        if (directAnimalId) {
          normalizedRegistros.push(buildSafePesagemPayload({
            ...registro,
            animal_id: directAnimalId,
          }));
          continue;
        }
        const virtualIndex = Number(registro?.virtual_animal?.index);
        if (!Number.isFinite(virtualIndex) || virtualIndex <= 0) continue;

        let animalTarget = indexToAnimal.get(virtualIndex) || animalsByIndex.get(virtualIndex) || null;
        if (!animalTarget) {
          const payloadAnimal = buildSafeAnimalPayload({
            lote_id: loteId,
            identificacao: `Animal #${virtualIndex}`,
            p_ini: Number(lote?.p_ini || lote?.peso_inicial || lote?.peso_atual || lote?.p_at || 0) || null,
            p_at: Number(registro?.peso_medio || lote?.p_at || lote?.peso_atual || lote?.p_ini || lote?.peso_inicial || 0) || null,
            metadata: { generated_from_weighing: true, index: virtualIndex },
          }, lote, virtualIndex);
          logBatchWeighingSave({
            stage: 'before_create_virtual',
            table: 'animais',
            action: 'create',
            payloadKeys: Object.keys(payloadAnimal),
            loteIdPresent: payloadAnimal?.lote_id != null,
            animalIdPresent: false,
            virtualIndex,
            identification: payloadAnimal?.identificacao,
          });
          const created = await createOperationalRecord('animais', payloadAnimal, session);
          logBatchWeighingSave({
            stage: 'after_create_virtual',
            table: 'animais',
            action: 'create',
            payloadKeys: Object.keys(payloadAnimal),
            loteIdPresent: payloadAnimal?.lote_id != null,
            animalIdPresent: Boolean(created?.data?.id),
            virtualIndex,
            identification: payloadAnimal?.identificacao,
            syncStatus: created?.syncStatus,
            code: created?.code,
            safeMessage: created?.error || null,
          });
          createAnimalResults.push(created);
          animalTarget = created.data || { id: gerarNovoId([...(animaisAtuais || []), ...createdAnimais]), ...payloadAnimal };
          createdAnimais.push(animalTarget);
          animalsByIndex.set(virtualIndex, animalTarget);
          indexToAnimal.set(virtualIndex, animalTarget);
        }

        const resolvedAnimalId = normalizeIdKey(
          animalTarget?.cloud_id
          ?? animalTarget?.id
          ?? animalTarget?.metadata?.cloud_id
          ?? animalTarget?.metadata?.local_id
        );
        if (!resolvedAnimalId) {
          logBatchWeighingSave({
            stage: 'skip_pesagem_missing_animal_id',
            table: 'pesagens',
            action: 'create',
            payloadKeys: Object.keys(registro || {}),
            loteIdPresent: Boolean(registro?.lote_id),
            animalIdPresent: false,
            virtualIndex,
            identification: registro?.virtual_animal?.identificacao || `Animal #${virtualIndex}`,
            syncStatus: 'skipped',
            code: 'ANIMAL_ID_MISSING',
            safeMessage: 'Animal não persistido para vincular pesagem.',
          });
          failedRecords.push({
            identification: registro?.virtual_animal?.identificacao || `Animal #${virtualIndex}`,
            message: 'Nao foi possivel vincular a pesagem ao animal criado.',
          });
          continue;
        }

        const safePesagem = buildSafePesagemPayload({
          ...registro,
          animal_id: resolvedAnimalId,
          metadata: {
            ...(registro?.metadata || {}),
            virtualIndex,
            animal_identificacao: registro?.virtual_animal?.identificacao || `Animal #${virtualIndex}`,
            animal_local_id: normalizeIdKey(animalTarget?.metadata?.local_id ?? animalTarget?.id),
            animal_cloud_id: isValidUuid(animalTarget?.cloud_id) ? animalTarget.cloud_id : undefined,
          },
        });
        normalizedRegistros.push({
          ...safePesagem,
        });
      }

      const basePesagens = Array.isArray(pesagens) ? pesagens : [];
      const nextPesagens = [...basePesagens];
      const resultados = [...createAnimalResults];

      for (const payload of normalizedRegistros) {
        const loteId = Number(payload?.lote_id);
        const animalId = normalizeIdKey(payload?.animal_id);
        const data = payload?.data;
        if (!animalId) {
          failedRecords.push({
            identification: payload?.metadata?.animal_identificacao || 'Animal sem identificacao',
            message: 'Pesagem sem identificador valido para o animal.',
          });
          continue;
        }
        const existente = nextPesagens.find((item) => (
          resolveTipoPesagem(item) === 'animal'
          && Number(item?.lote_id) === loteId
          && idsMatch(item?.animal_id, animalId)
          && String(item?.data || '') === String(data || '')
        ));

        if (existente) {
          logBatchWeighingSave({
            stage: 'before_update_pesagem',
            table: 'pesagens',
            action: 'update',
            payloadKeys: Object.keys(payload),
            loteIdPresent: payload?.lote_id != null,
            animalIdPresent: payload?.animal_id != null,
            virtualIndex: payload?.metadata?.virtualIndex,
            identification: payload?.metadata?.animal_identificacao,
          });
          const persisted = await updateOperationalRecord('pesagens', existente.id, payload, session);
          const atualizado = { ...existente, ...(persisted.data || payload) };
          const idx = nextPesagens.findIndex((item) => item.id === existente.id);
          if (idx >= 0) nextPesagens[idx] = atualizado;
          resultados.push(persisted);
          logBatchWeighingSave({
            stage: 'after_update_pesagem',
            table: 'pesagens',
            action: 'update',
            payloadKeys: Object.keys(payload),
            loteIdPresent: payload?.lote_id != null,
            animalIdPresent: payload?.animal_id != null,
            virtualIndex: payload?.metadata?.virtualIndex,
            identification: payload?.metadata?.animal_identificacao,
            syncStatus: persisted?.syncStatus,
            code: persisted?.code,
            safeMessage: persisted?.error || null,
          });
          if (!persisted?.persisted) {
            failedRecords.push({
              identification: payload?.metadata?.animal_identificacao || 'Animal sem identificacao',
              message: persisted?.error || 'Pesagem atualizada com sucesso.',
            });
          }
        } else {
          logBatchWeighingSave({
            stage: 'before_create_pesagem',
            table: 'pesagens',
            action: 'create',
            payloadKeys: Object.keys(payload),
            loteIdPresent: payload?.lote_id != null,
            animalIdPresent: payload?.animal_id != null,
            virtualIndex: payload?.metadata?.virtualIndex,
            identification: payload?.metadata?.animal_identificacao,
          });
          const persisted = await createOperationalRecord('pesagens', payload, session);
          const novo = persisted.data || { id: gerarNovoId(nextPesagens), ...payload };
          nextPesagens.push(novo);
          resultados.push(persisted);
          logBatchWeighingSave({
            stage: 'after_create_pesagem',
            table: 'pesagens',
            action: 'create',
            payloadKeys: Object.keys(payload),
            loteIdPresent: payload?.lote_id != null,
            animalIdPresent: payload?.animal_id != null,
            virtualIndex: payload?.metadata?.virtualIndex,
            identification: payload?.metadata?.animal_identificacao,
            syncStatus: persisted?.syncStatus,
            code: persisted?.code,
            safeMessage: persisted?.error || null,
          });
          if (!persisted?.persisted) {
            failedRecords.push({
              identification: payload?.metadata?.animal_identificacao || 'Animal sem identificacao',
              message: persisted?.error || 'Pesagem criada com sucesso.',
            });
          }
        }
      }

      const persistedBatch = await persistCollectionMutation(resultados.map((item) => Promise.resolve(item)));
      const totalFalhas = failedRecords.length;
      const totalSucessos = normalizedRegistros.length - totalFalhas;
      if (totalFalhas || !persistedBatch.persisted) {
        setUltimoResumoBatch({ failedRecords, totalSucessos, totalFalhas });
        showToast({ type: 'warning', message: 'Não foi possível confirmar a pesagem agora.' });
        return null;
      }

      setDb((prev) => ({
        ...prev,
        animais: [
          ...(Array.isArray(prev?.animais) ? prev.animais : []),
          ...createdAnimais,
        ],
        pesagens: nextPesagens,
      }));

      setUltimoResumoBatch(null);
      showToast({ type: 'success', message: 'Pesagem salva com sucesso.' });

      setAbrirForm(false);
      setPesagemEditando(null);
      return;
    }

    if (pesagemEditando?.id) {
      const pesagemPersistida = await updateOperationalRecord('pesagens', pesagemEditando.id, dados, session);
      const registroAtualizado = { ...pesagemEditando, ...(pesagemPersistida.data || dados) };

      setDb((prev) => {
        const pesagensAtuais = Array.isArray(prev?.pesagens) ? prev.pesagens : [];
        const pesagensAtualizadas = pesagensAtuais.map((item) => (
          item.id === pesagemEditando.id ? registroAtualizado : item
        ));

        const loteAnterior = shouldUpdateLote(pesagemEditando) ? pesagemEditando.lote_id : null;
        const loteNovo = shouldUpdateLote(registroAtualizado) ? registroAtualizado.lote_id : null;

        let nextState = { ...prev, pesagens: pesagensAtualizadas };
        if (loteAnterior) nextState = recalculateLoteFromPesagens(nextState, loteAnterior, pesagensAtualizadas);
        if (loteNovo && Number(loteNovo) !== Number(loteAnterior)) {
          nextState = recalculateLoteFromPesagens(nextState, loteNovo, pesagensAtualizadas);
        }
        if (loteNovo && Number(loteNovo) === Number(loteAnterior)) {
          nextState = recalculateLoteFromPesagens(nextState, loteNovo, pesagensAtualizadas);
        }
        return nextState;
      });

      const promises = [Promise.resolve(pesagemPersistida)];
      if (shouldUpdateLote(registroAtualizado)) {
        const loteRecalculado = recalculateLoteFromPesagens(
          db,
          registroAtualizado.lote_id,
          (pesagens || []).map((item) => (item.id === pesagemEditando.id ? registroAtualizado : item))
        )?.lotes?.find((item) => Number(item.id) === Number(registroAtualizado.lote_id));

        if (loteRecalculado) {
          promises.push(updateOperationalRecord('lotes', loteRecalculado.id, {
            p_at: loteRecalculado.p_at,
            peso_atual: loteRecalculado.peso_atual,
            peso_medio_atual: loteRecalculado.peso_medio_atual,
            ultima_pesagem: loteRecalculado.ultima_pesagem,
          }, session));
        }
      }

      const persistedBatch = await persistCollectionMutation(promises);
      if (!persistedBatch.persisted) {
        showToast({ type: 'warning', message: 'Não foi possível confirmar a alteração agora.' });
        return;
      }
      showToast({ type: 'success', message: 'Pesagem atualizada com sucesso!' });
    } else {
      const pesagemPersistida = await createOperationalRecord('pesagens', dados, session);
      const novaPesagem = pesagemPersistida.data || { id: gerarNovoId(pesagens || []), ...dados };

      const promises = [Promise.resolve(pesagemPersistida)];
      if (shouldUpdateLote(novaPesagem)) {
        const loteRecalculado = recalculateLoteFromPesagens(db, novaPesagem.lote_id, [...(pesagens || []), novaPesagem])
          ?.lotes?.find((item) => Number(item.id) === Number(novaPesagem.lote_id));
        if (loteRecalculado) {
          promises.push(updateOperationalRecord('lotes', loteRecalculado.id, {
            p_at: loteRecalculado.p_at,
            peso_atual: loteRecalculado.peso_atual,
            peso_medio_atual: loteRecalculado.peso_medio_atual,
            ultima_pesagem: loteRecalculado.ultima_pesagem,
          }, session));
        }
      }

      const persistedBatch = await persistCollectionMutation(promises);
      if (!persistedBatch.persisted) {
        showToast({ type: 'warning', message: 'Não foi possível confirmar a pesagem agora.' });
        return;
      }
      setDb((prev) => {
        const pesagensAtuais = Array.isArray(prev?.pesagens) ? prev.pesagens : [];
        const pesagensAtualizadas = [...pesagensAtuais, novaPesagem];
        if (!shouldUpdateLote(novaPesagem)) return { ...prev, pesagens: pesagensAtualizadas };
        return recalculateLoteFromPesagens(prev, novaPesagem.lote_id, pesagensAtualizadas);
      });
      showToast({ type: 'success', message: 'Pesagem registrada com sucesso!' });
    }

    setAbrirForm(false);
    setPesagemEditando(null);
  }

  const [abaAtiva, setAbaAtiva] = useState('nova');

  const alertas = useMemo(() => {
    const hoje = new Date();
    const diasSemPesagem = 30;
    const lotesSemPesagem = (lotes || []).filter((lote) => {
      const data = toDateKey(lote?.ultima_pesagem);
      if (!data) return true;
      return daysBetween(data, hoje.toISOString().slice(0, 10)) > diasSemPesagem;
    });
    const animaisSemPesagem = (animais || []).filter((animal) => !dadosTabela.some((p) => (
      p.tipo === 'animal' && idsMatch(p.animal_id, animal.id)
    )));
    return { lotesSemPesagem, animaisSemPesagem, diasSemPesagem };
  }, [lotes, animais, dadosTabela]);

  return (
    <div className="page page--pesagens page--kpi-compact"> 
      <section className="animais-hero pesagens-hero">
        <div>
          <h1>Pesagens</h1>
          <p>Registre pesagens para acompanhar ganho de peso, desempenho e resultado.</p>
        </div>
      </section>
      <div className="segmented-control tab-bar">
        <button type="button" className={`segment ${abaAtiva === 'nova' ? 'active' : ''}`} onClick={() => setAbaAtiva('nova')}>Nova pesagem</button>
        <button type="button" className={`segment ${abaAtiva === 'historico' ? 'active' : ''}`} onClick={() => setAbaAtiva('historico')}>Histórico</button>
        <button type="button" className={`segment ${abaAtiva === 'evolucao' ? 'active' : ''}`} onClick={() => setAbaAtiva('evolucao')}>Evolução</button>
        <button type="button" className={`segment ${abaAtiva === 'alertas' ? 'active' : ''}`} onClick={() => setAbaAtiva('alertas')}>Alertas</button>
      </div>

      <div className="dashboard-grid dashboard-grid--kpi-main">
        <div className="kpi-card kpi-card--compact">
          <div className="kpi-content">
            <div className="kpi-label">Última pesagem</div>
            <div className="kpi-value">{formatarData(resumo.ultimaData)}</div>
          </div>
        </div>
        <div className="kpi-card kpi-card--compact">
          <div className="kpi-content">
            <div className="kpi-label">Lotes sem pesagem recente</div>
            <div className={alertas.lotesSemPesagem.length > 0 ? 'kpi-val rd' : 'kpi-value'}>{alertas.lotesSemPesagem.length}</div>
          </div>
        </div>
        <div className="kpi-card kpi-card--compact">
          <div className="kpi-content">
            <div className="kpi-label">Total de pesagens</div>
            <div className="kpi-value">{resumo.totalPesagens}</div>
          </div>
        </div>
        <div className="kpi-card kpi-card--compact">
          <div className="kpi-content">
            <div className="kpi-label">GMD médio</div>
            {resumo.gmdMedioDisponivel ? (
              <div className="kpi-value">{formatarNumero(resumo.gmdMedio, 3)} kg/dia</div>
            ) : (
              <div className="kpi-hint" style={{ fontSize: '0.95rem', marginTop: 4 }}>Sem dados suficientes</div>
            )}
          </div>
        </div>
      </div>

      {ultimoResumoBatch?.totalFalhas ? (
        <Card title="Pendências da última pesagem" subtitle="Revise os registros que não foram concluídos totalmente.">
          <p style={{ marginTop: 0 }}>
            {ultimoResumoBatch.totalSucessos > 0
              ? `${ultimoResumoBatch.totalSucessos} registro(s) foram processados e ${ultimoResumoBatch.totalFalhas} ficaram com pendencia.`
              : `${ultimoResumoBatch.totalFalhas} registro(s) ficaram com pendencia.`}
          </p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {ultimoResumoBatch.failedRecords.map((item, index) => (
              <li key={`${item.identification}-${index}`}>{item.identification}: {item.message}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      {abaAtiva === 'nova' && (lotes || []).length === 0 && (
        <EmptyState
          title="Nenhum lote disponível para pesagem."
          subtitle="Cadastre um lote antes de registrar pesagens."
          action={onNavigate ? <Button size="sm" onClick={() => onNavigate('lotes')}>Ir para Lotes</Button> : null}
        />
      )}

      {abaAtiva === 'historico' && (
        <div className="fazendas-card">
          <div className="fazendas-table-wrap">
            {dadosTabela.length === 0 ? (
              <EmptyState
                title="Você ainda não registrou nenhuma pesagem."
                subtitle="Registre a primeira pesagem para acompanhar evolução, GMD e desempenho."
                action={<Button size="sm" onClick={abrirNovaPesagem}>Registrar pesagem</Button>}
              />
            ) : (
              <table className="data-table herdon-table herdon-table--pesagens">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Lote</th>
                    <th>Animal</th>
                    <th>Peso</th>
                    <th>Observação</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {dadosTabela.map((item) => (
                    <tr key={item.id}>
                      <td>{formatarData(item.data)}</td>
                      <td>{item.tipo === 'animal' ? 'Animal' : 'Lote'}</td>
                      <td>{item.loteNome}</td>
                      <td>{item.tipo === 'animal' ? (item.animalNome || 'Animal') : '-'}</td>
                      <td>{formatarNumero(item.peso_medio)} kg</td>
                      <td>{item.observacao || '-'}</td>
                      <td>
                        <div className="row-actions row-actions--tight">
                          <button className="action-btn" onClick={() => editarPesagem(item)}>Editar</button>
                          <button className="action-btn action-btn-danger" onClick={() => excluirPesagem(item.id)}>Cancelar registro</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {abaAtiva === 'evolucao' && (
        <div className="fazendas-card">
          {dadosTabela.length < 2 ? (
            <EmptyState
              title="Sem dados suficientes para evolução."
              subtitle="Registre pelo menos duas pesagens do mesmo lote para ver a evolução de peso e o GMD."
            />
          ) : (
            <p>Peso médio por lote e GMD disponíveis no histórico de pesagens.</p>
          )}
        </div>
      )}
      {abaAtiva === 'alertas' && (
        <div className="fazendas-card">
          <p>Lotes sem pesagem há mais de {alertas.diasSemPesagem} dias: {alertas.lotesSemPesagem.length}</p>
          <p>Animais sem pesagem recente: {alertas.animaisSemPesagem.length}</p>
          <Button size="sm" onClick={abrirNovaPesagem}>Registrar pesagem</Button>
        </div>
      )}

      {(abrirForm || (abaAtiva === 'nova' && (lotes || []).length > 0)) && (
        <PesagemForm initialData={pesagemEditando} lotes={lotes || []} animais={animais || []} pesagens={pesagens || []} onSave={salvarPesagem} onCancel={() => { setAbrirForm(false); setPesagemEditando(null); }} />
      )}
    </div>
  );

}
