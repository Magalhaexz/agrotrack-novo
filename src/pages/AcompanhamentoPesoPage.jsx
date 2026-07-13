import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import PesoChart from '../components/PesoChart';
import { useAuth } from '../auth/useAuth';
import { useToast } from '../hooks/useToast';
import { createOperationalRecord, updateOperationalRecord } from '../services/operationalPersistence';
import { formatarNumero, formatarData } from '../utils/formatters';
import { calcularDias } from '../utils/calculations';
import { gerarNovoId } from '../utils/id';
import { toDateKey } from '../domain/calcHelpers.js';

import { hojeLocalISO } from '../domain/dataCivil.js';
function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeDate(value) {
  const text = String(value || '').trim();
  if (!text) return hojeLocalISO();
  return text.slice(0, 10);
}

function isIndividualAnimal(animal) {
  const tipo = String(animal?.tipo_registro || '').toLowerCase();
  if (tipo === 'individual') return true;
  return Number(animal?.qtd || 0) === 1 && Boolean(String(animal?.identificacao || '').trim());
}

function getLotHeadCount(lote, animaisLote) {
  const candidates = [
    lote?.qtd,
    lote?.quantidade,
    lote?.quantidade_animais,
    lote?.qtd_inicial,
    lote?.cabecas,
    lote?.total_cabecas,
  ];
  for (const value of candidates) {
    const n = toNumber(value, 0);
    if (n > 0) return Math.floor(n);
  }
  const byAnimais = animaisLote.reduce((sum, item) => sum + Math.max(1, toNumber(item?.qtd, 1)), 0);
  return Math.floor(byAnimais);
}

function getLatestByDate(items = []) {
  return [...items]
    .map((item) => ({ ...item, dataKey: toDateKey(item?.data) }))
    .filter((item) => item.dataKey)
    .sort((a, b) => a.dataKey.localeCompare(b.dataKey))
    .at(-1) || null;
}

function getPesagemSelector(existing, payload) {
  if (existing?.id && Number.isFinite(Number(existing.id))) {
    return { type: 'id', value: Number(existing.id) };
  }
  if (existing?.cloud_id) {
    return { type: 'cloud_id', value: String(existing.cloud_id) };
  }
  if (existing?.metadata?.local_id !== undefined && existing?.metadata?.local_id !== null) {
    return { type: 'metadata.local_id', value: String(existing.metadata.local_id) };
  }
  if (String(payload?.tipo || '') === 'animal') {
    return {
      type: 'animal_date_tipo',
      animal_id: Number(payload?.animal_id),
      lote_id: Number(payload?.lote_id),
      tipo: 'animal',
      data: normalizeDate(payload?.data),
    };
  }
  return {
    type: 'lote_date_tipo',
    lote_id: Number(payload?.lote_id),
    tipo: 'lote',
    data: normalizeDate(payload?.data),
  };
}

function logBatchFlow(data = {}) {
  if (!import.meta.env.DEV) return;
  console.debug('[HERDON_BATCH_WEIGHING_FLOW]', data);
}

function logCloudSave(data = {}) {
  if (!import.meta.env.DEV) return;
  console.debug('[HERDON_PESAGEM_CLOUD_SAVE]', data);
}

export default function AcompanhamentoPesoPage({ db, setDb }) {
  const { hasPermission, session } = useAuth();
  const { showToast } = useToast();
  const mensagemSemPermissao = 'Você não tem permissão para executar esta ação.';

  const [abaAtiva, setAbaAtiva] = useState('pesagem_lote');
  const [fazendaSelecionada, setFazendaSelecionada] = useState('');
  const [loteSelecionado, setLoteSelecionado] = useState('');
  const [dataPesagem, setDataPesagem] = useState(() => hojeLocalISO());
  const [draftPesos, setDraftPesos] = useState({});
  const [draftObs, setDraftObs] = useState({});
  const [resumoFinal, setResumoFinal] = useState(null);
  const [saving, setSaving] = useState(false);

  const fazendas = useMemo(() => (Array.isArray(db?.fazendas) ? db.fazendas : []), [db]);
  const lotes = useMemo(() => (Array.isArray(db?.lotes) ? db.lotes : []), [db]);
  const animais = useMemo(() => (Array.isArray(db?.animais) ? db.animais : []), [db]);
  const pesagens = useMemo(() => (Array.isArray(db?.pesagens) ? db.pesagens : []), [db]);

  const lotesFiltrados = useMemo(() => {
    if (!fazendaSelecionada) return lotes;
    return lotes.filter((item) => String(item?.faz_id) === String(fazendaSelecionada));
  }, [fazendaSelecionada, lotes]);

  const loteAtual = useMemo(
    () => lotes.find((item) => String(item.id) === String(loteSelecionado)) || null,
    [lotes, loteSelecionado]
  );

  const animaisDoLote = useMemo(
    () => animais.filter((item) => String(item?.lote_id) === String(loteSelecionado)),
    [animais, loteSelecionado]
  );
  const animaisIndividuais = useMemo(() => animaisDoLote.filter(isIndividualAnimal), [animaisDoLote]);

  const pesagensLote = useMemo(() => {
    return pesagens
      .filter((item) => String(item?.lote_id) === String(loteSelecionado))
      .map((item) => ({ ...item, data: toDateKey(item?.data) }))
      .filter((item) => item.data)
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [pesagens, loteSelecionado]);
  const pesagensLoteTipoLote = useMemo(
    () => pesagensLote.filter((item) => String(item?.tipo || '') !== 'animal'),
    [pesagensLote]
  );

  const pesagensAnimalDataAtual = useMemo(() => {
    const map = new Map();
    pesagens
      .filter((item) => String(item?.tipo || '') === 'animal')
      .filter((item) => String(item?.lote_id) === String(loteSelecionado))
      .filter((item) => normalizeDate(item?.data) === normalizeDate(dataPesagem))
      .forEach((item) => map.set(String(item?.animal_id), item));
    return map;
  }, [pesagens, loteSelecionado, dataPesagem]);

  const historicoAnimalMap = useMemo(() => {
    const map = new Map();
    pesagens
      .filter((item) => String(item?.tipo || '') === 'animal')
      .filter((item) => String(item?.lote_id) === String(loteSelecionado))
      .forEach((item) => {
        const key = String(item?.animal_id);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(item);
      });
    map.forEach((list) => list.sort((a, b) => toDateKey(a.data).localeCompare(toDateKey(b.data))));
    return map;
  }, [pesagens, loteSelecionado]);

  const headCount = useMemo(() => getLotHeadCount(loteAtual, animaisDoLote), [loteAtual, animaisDoLote]);
  const canGenerate = Boolean(loteAtual) && headCount > 0 && animaisIndividuais.length < headCount;

  const resumoHistorico = useMemo(() => {
    if (!pesagensLoteTipoLote.length) return { primeira: null, ultima: null, ganho: 0, dias: 0, gmd: 0 };
    const primeira = pesagensLoteTipoLote[0];
    const ultima = pesagensLoteTipoLote[pesagensLoteTipoLote.length - 1];
    const ganho = toNumber(ultima?.peso_medio) - toNumber(primeira?.peso_medio);
    const dias = calcularDias(primeira?.data, ultima?.data);
    return { primeira, ultima, ganho, dias, gmd: dias > 0 ? ganho / dias : 0 };
  }, [pesagensLoteTipoLote]);

  const animaisPesagemView = useMemo(() => {
    return animaisIndividuais.map((animal) => {
      const key = String(animal.id);
      const existing = pesagensAnimalDataAtual.get(key);
      return {
        ...animal,
        pesoAtual: draftPesos[key] ?? (existing ? String(existing?.peso_medio ?? '') : ''),
        observacaoAtual: draftObs[key] ?? (existing?.observacao || ''),
        existingPesagem: existing || null,
      };
    });
  }, [animaisIndividuais, draftObs, draftPesos, pesagensAnimalDataAtual]);

  async function gerarAnimais() {
    if (!hasPermission('animais:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    if (!loteAtual || headCount <= 0) {
      showToast({ type: 'warning', message: 'Lote sem quantidade de cabeças para geração.' });
      return;
    }

    const existingIndexes = new Set(
      animaisIndividuais
        .map((item) => {
          const match = String(item?.identificacao || '').match(/animal\s*#\s*(\d+)/i);
          return match ? Number(match[1]) : null;
        })
        .filter((n) => Number.isFinite(n))
    );

    const payloads = [];
    for (let i = 1; i <= headCount; i += 1) {
      if (existingIndexes.has(i)) continue;
      payloads.push({
        lote_id: loteAtual.id,
        fazenda_id: loteAtual?.faz_id ?? null,
        identificacao: `Animal #${i}`,
        tipo_registro: 'individual',
        qtd: 1,
        status: 'ativo',
        p_ini: toNumber(loteAtual?.p_ini ?? loteAtual?.peso_inicial ?? 0),
        p_at: toNumber(loteAtual?.p_at ?? loteAtual?.peso_atual ?? loteAtual?.peso_inicial ?? 0),
        dias: 0,
        consumo: 0,
      });
    }

    logBatchFlow({
      hasSession: Boolean(session),
      hasUserId: Boolean(session?.user?.id),
      fazendaIdPresent: Boolean(loteAtual?.faz_id),
      loteIdPresent: Boolean(loteAtual?.id),
      lotHeadCount: headCount,
      existingAnimalCount: animaisIndividuais.length,
      generatedAnimalCount: payloads.length,
      selectedDate: normalizeDate(dataPesagem),
    });

    if (!payloads.length) {
      showToast({ type: 'info', message: 'Nenhum novo animal necessário para este lote.' });
      return;
    }

    const results = await Promise.all(payloads.map((payload) => createOperationalRecord('animais', payload, session)));
    const hasFailure = results.some((item) => !item?.persisted);
    if (hasFailure) {
      showToast({ type: 'warning', message: 'Não foi possível confirmar todos os cadastros agora.' });
      return;
    }

    const created = results.map((result) => result?.data).filter(Boolean);
    if (!created.length) return;

    setDb((prev) => ({
      ...prev,
      animais: [...(Array.isArray(prev?.animais) ? prev.animais : []), ...created],
    }));

    showToast({ type: 'success', message: 'Animais do lote gerados com sucesso.' });
  }

  function updateDraftPeso(animalId, value) {
    setDraftPesos((prev) => ({ ...prev, [String(animalId)]: String(value ?? '').replace(',', '.') }));
  }
  function updateDraftObs(animalId, value) {
    setDraftObs((prev) => ({ ...prev, [String(animalId)]: String(value ?? '') }));
  }

  async function salvarPesagens({ finalizar }) {
    if (!hasPermission('pesagens:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return null;
    }
    if (!loteAtual) {
      showToast({ type: 'warning', message: 'Selecione um lote para pesagem.' });
      return null;
    }
    const dateIso = normalizeDate(dataPesagem);
    const ops = [];
    const entries = [];

    for (const animal of animaisPesagemView) {
      const pesoRaw = String(animal?.pesoAtual ?? '').trim();
      if (!pesoRaw) continue;
      const pesoNum = Number(pesoRaw);
      if (!Number.isFinite(pesoNum) || pesoNum <= 0) continue;
      const payload = {
        lote_id: Number(loteAtual.id),
        fazenda_id: loteAtual?.faz_id ? Number(loteAtual.faz_id) : null,
        animal_id: Number(animal.id),
        data: dateIso,
        tipo: 'animal',
        peso_medio: pesoNum,
        observacao: String(animal?.observacaoAtual || '').trim() || null,
        metadata: {
          local_id: animal?.existingPesagem?.metadata?.local_id ?? animal?.existingPesagem?.id ?? null,
        },
      };
      const existing = animal?.existingPesagem || null;
      const selector = getPesagemSelector(existing, payload);
      if (existing) {
        ops.push(updateOperationalRecord('pesagens', existing.id || payload.animal_id, payload, session, { selector }));
        entries.push({ action: 'update', payload, existing, selector });
      } else {
        ops.push(createOperationalRecord('pesagens', payload, session));
        entries.push({ action: 'create', payload, existing: null, selector: null });
      }
    }

    if (!ops.length) {
      showToast({ type: 'warning', message: 'Preencha ao menos um peso válido.' });
      return null;
    }

    setSaving(true);
    const results = await Promise.all(ops);
    results.forEach((result, index) => {
      logCloudSave({
        action: entries[index]?.action || null,
        tipo: entries[index]?.payload?.tipo || null,
        syncStatus: result?.syncStatus || null,
        code: result?.code || null,
        safeMessage: result?.error || (result?.persisted ? 'ok' : 'fallback'),
        selectorType: entries[index]?.selector?.type || null,
        payloadKeys: Object.keys(entries[index]?.payload || {}),
      });
    });

    let fallbackPesagemId = gerarNovoId(pesagens);
    const persistedPesagens = results.map((result, index) => result?.data || { id: fallbackPesagemId + index, ...entries[index].payload });
    const existingAnimalPesagens = pesagens.filter((item) => String(item?.tipo || '') === 'animal');
    const nonAnimalPesagens = pesagens.filter((item) => String(item?.tipo || '') !== 'animal');
    const dedupeAnimalMap = new Map();
    [...existingAnimalPesagens, ...persistedPesagens].forEach((item) => {
      const key = `${item?.animal_id}-${normalizeDate(item?.data)}-${item?.tipo || 'animal'}`;
      dedupeAnimalMap.set(key, item);
    });

    const animaisMap = new Map((animais || []).map((item) => [String(item.id), item]));
    persistedPesagens.forEach((pesagem) => {
      const key = String(pesagem?.animal_id);
      if (!animaisMap.has(key)) return;
      const original = animaisMap.get(key);
      animaisMap.set(key, { ...original, p_at: toNumber(pesagem?.peso_medio, toNumber(original?.p_at, 0)) });
    });
    const nextAnimais = Array.from(animaisMap.values());

    const pesos = persistedPesagens
      .map((item) => toNumber(item?.peso_medio, 0))
      .filter((value) => value > 0);
    const media = pesos.length
      ? pesos.reduce((sum, value) => sum + value, 0) / pesos.length
      : toNumber(loteAtual?.p_at ?? loteAtual?.peso_atual, 0);

    const lotePatch = {
      p_at: media,
      peso_atual: media,
      peso_medio_atual: media,
      ultima_pesagem: dateIso,
      data_ultima_pesagem: dateIso,
    };
    const loteResult = await updateOperationalRecord('lotes', loteAtual.id, lotePatch, session);
    logCloudSave({
      action: 'update',
      tipo: 'lote',
      syncStatus: loteResult?.syncStatus || null,
      code: loteResult?.code || null,
      safeMessage: loteResult?.error || (loteResult?.persisted ? 'ok' : 'fallback'),
      selectorType: 'id',
      payloadKeys: Object.keys(lotePatch),
    });

    let extraLotePesagem = null;
    if (finalizar) {
      const lotePayload = {
        lote_id: Number(loteAtual.id),
        fazenda_id: loteAtual?.faz_id ? Number(loteAtual.faz_id) : null,
        data: dateIso,
        tipo: 'lote',
        peso_medio: media,
        quantidade: persistedPesagens.length,
        observacao: 'Pesagem individual por lote finalizada',
      };
      const existingLotePesagem = pesagensLoteTipoLote.find((item) => normalizeDate(item?.data) === dateIso) || null;
      if (existingLotePesagem) {
        const selector = getPesagemSelector(existingLotePesagem, lotePayload);
        extraLotePesagem = await updateOperationalRecord('pesagens', existingLotePesagem.id || loteAtual.id, lotePayload, session, { selector });
        logCloudSave({
          action: 'update',
          tipo: 'lote',
          syncStatus: extraLotePesagem?.syncStatus || null,
          code: extraLotePesagem?.code || null,
          safeMessage: extraLotePesagem?.error || (extraLotePesagem?.persisted ? 'ok' : 'fallback'),
          selectorType: selector?.type || null,
          payloadKeys: Object.keys(lotePayload),
        });
      } else {
        extraLotePesagem = await createOperationalRecord('pesagens', lotePayload, session);
        logCloudSave({
          action: 'create',
          tipo: 'lote',
          syncStatus: extraLotePesagem?.syncStatus || null,
          code: extraLotePesagem?.code || null,
          safeMessage: extraLotePesagem?.error || (extraLotePesagem?.persisted ? 'ok' : 'fallback'),
          selectorType: null,
          payloadKeys: Object.keys(lotePayload),
        });
      }
    }

    const loteAtualizado = { ...loteAtual, ...(loteResult?.data || lotePatch) };
    const extraLoteRecord = extraLotePesagem?.data || (extraLotePesagem ? { id: gerarNovoId(pesagens), lote_id: Number(loteAtual.id), data: dateIso, tipo: 'lote', peso_medio: media } : null);
    const lotesMap = new Map((lotes || []).map((item) => [Number(item.id), item]));
    lotesMap.set(Number(loteAtualizado.id), loteAtualizado);

    const nextPesagens = (() => {
      const loteMap = new Map();
      [...nonAnimalPesagens, ...(extraLoteRecord ? [extraLoteRecord] : [])].forEach((item) => {
        loteMap.set(`${item?.lote_id}-${normalizeDate(item?.data)}-${item?.tipo || 'lote'}`, item);
      });
      return [...Array.from(dedupeAnimalMap.values()), ...Array.from(loteMap.values())];
    })();

    const hasFailure = results.some((item) => !item?.persisted)
      || !loteResult?.persisted
      || (extraLotePesagem ? !extraLotePesagem?.persisted : false);
    if (hasFailure) {
      showToast({ type: 'warning', message: 'Não foi possível confirmar a pesagem agora.' });
      setSaving(false);
      return null;
    }

    setDb((prev) => ({
      ...prev,
      animais: nextAnimais,
      lotes: (Array.isArray(prev?.lotes) ? prev.lotes : []).map((item) => (
        Number(item.id) === Number(loteAtualizado.id) ? loteAtualizado : item
      )),
      pesagens: nextPesagens,
    }));

    showToast({ type: 'success', message: 'Pesagem salva com sucesso.' });

    setSaving(false);
    return { nextAnimais, nextPesagens, loteAtualizado, pesos };
  }

  function buildResumo(result) {
    const dateIso = normalizeDate(dataPesagem);
    const individuais = result.nextAnimais.filter((item) => String(item?.lote_id) === String(result.loteAtualizado.id)).filter(isIndividualAnimal);
    const pesagensDia = result.nextPesagens
      .filter((item) => String(item?.tipo || '') === 'animal')
      .filter((item) => String(item?.lote_id) === String(result.loteAtualizado.id))
      .filter((item) => normalizeDate(item?.data) === dateIso);
    const pesagemMap = new Map(pesagensDia.map((item) => [String(item?.animal_id), item]));
    const pesados = individuais.filter((item) => pesagemMap.has(String(item.id)));
    const pesos = pesados.map((item) => toNumber(pesagemMap.get(String(item.id))?.peso_medio, 0)).filter((v) => v > 0);
    const media = pesos.length ? pesos.reduce((a, b) => a + b, 0) / pesos.length : 0;
    const maior = pesos.length ? Math.max(...pesos) : 0;
    const menor = pesos.length ? Math.min(...pesos) : 0;

    const diffs = [];
    let comGanho = 0;
    let comPerda = 0;
    individuais.forEach((animal) => {
      const atual = pesagemMap.get(String(animal.id));
      if (!atual) return;
      const anteriores = (historicoAnimalMap.get(String(animal.id)) || [])
        .filter((item) => normalizeDate(item?.data) !== dateIso);
      const anterior = getLatestByDate(anteriores);
      if (!anterior) return;
      const diff = toNumber(atual?.peso_medio, 0) - toNumber(anterior?.peso_medio, 0);
      diffs.push(diff);
      if (diff >= 0) comGanho += 1;
      else comPerda += 1;
    });

    const fazendaNome = fazendas.find((item) => String(item.id) === String(result.loteAtualizado?.faz_id))?.nome || '—';
    return {
      fazendaNome,
      loteNome: result.loteAtualizado?.nome || '—',
      data: dateIso,
      totalAnimais: individuais.length,
      pesados: pesados.length,
      semPesagem: Math.max(0, individuais.length - pesados.length),
      media,
      maior,
      menor,
      variacao: maior - menor,
      ganhoInfo: diffs.length
        ? {
            hasData: true,
            ganhoMedio: diffs.reduce((sum, v) => sum + v, 0) / diffs.length,
            evolucaoMedia: diffs.reduce((sum, v) => sum + v, 0) / diffs.length,
            comGanho,
            comPerda,
          }
        : { hasData: false },
    };
  }

  async function onSalvarProgresso() {
    const result = await salvarPesagens({ finalizar: false });
    if (!result) return;
    setResumoFinal(null);
  }

  async function onFinalizar() {
    const result = await salvarPesagens({ finalizar: true });
    if (!result) return;
    setResumoFinal(buildResumo(result));
  }

  return (
    <div className="page page--pesagens">
      <PageHeader
        title="Acompanhamento de Peso"
        subtitle="Histórico de lotes e fluxo operacional de pesagem individual por lote."
      />

      <div className="fazendas-card pesagens-mode-shell" style={{ marginBottom: 16 }}>
        <div className="segmented-control" role="tablist" aria-label="Abas de pesagem">
          <button type="button" className={`segment ${abaAtiva === 'pesagem_lote' ? 'active' : ''}`} onClick={() => setAbaAtiva('pesagem_lote')}>
            Pesagem individual por lote
          </button>
          <button type="button" className={`segment ${abaAtiva === 'historico_lote' ? 'active' : ''}`} onClick={() => setAbaAtiva('historico_lote')}>
            Histórico de lotes
          </button>
        </div>
      </div>

      {abaAtiva === 'pesagem_lote' ? (
        <>
          <div className="fazendas-card" style={{ marginBottom: 16 }}>
            <div className="fazendas-card-header">
              <span className="fazendas-card-title">Pesagem individual por lote</span>
            </div>
            <div className="form-grid three">
              <label className="ui-input-wrap">
                <span className="ui-input-label">Fazenda</span>
                <select className="ui-input" value={fazendaSelecionada} onChange={(e) => { setFazendaSelecionada(e.target.value); setLoteSelecionado(''); setResumoFinal(null); }}>
                  <option value="">Selecione</option>
                  {fazendas.map((fazenda) => <option key={fazenda.id} value={fazenda.id}>{fazenda.nome}</option>)}
                </select>
              </label>
              <label className="ui-input-wrap">
                <span className="ui-input-label">Lote</span>
                <select className="ui-input" value={loteSelecionado} onChange={(e) => { setLoteSelecionado(e.target.value); setResumoFinal(null); }}>
                  <option value="">Selecione</option>
                  {lotesFiltrados.map((lote) => <option key={lote.id} value={lote.id}>{lote.nome}</option>)}
                </select>
              </label>
              <label className="ui-input-wrap">
                <span className="ui-input-label">Data da pesagem</span>
                <input className="ui-input" type="date" value={dataPesagem} onChange={(e) => { setDataPesagem(e.target.value); setResumoFinal(null); }} />
              </label>
            </div>
          </div>

          {loteAtual ? (
            <div className="fazendas-card">
              <div className="fazendas-card-header">
                <span className="fazendas-card-title">Animais do lote</span>
              </div>

              {canGenerate ? (
                <div className="empty-box" style={{ marginBottom: 12 }}>
                  <strong>Este lote possui {headCount} cabeças e {animaisIndividuais.length} animais individuais registrados.</strong>
                  <span>Gere os animais faltantes para pesar todos individualmente.</span>
                  <button type="button" className="ui-button ui-button--primary" onClick={gerarAnimais}>
                    Gerar animais individuais para este lote
                  </button>
                </div>
              ) : null}

              {animaisPesagemView.length === 0 ? (
                <div className="empty-box">
                  <strong>Nenhum animal individual listado para este lote.</strong>
                  <span>Use o botão de geração para criar os animais individuais.</span>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Animal</th>
                        <th>Peso atual</th>
                        <th>Observação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {animaisPesagemView.map((animal) => (
                        <tr key={animal.id}>
                          <td className="text-h">{animal.identificacao || `Animal #${animal.id}`}</td>
                          <td>
                            <input
                              className="ui-input"
                              type="number"
                              min="0"
                              step="0.01"
                              value={animal.pesoAtual}
                              onChange={(e) => updateDraftPeso(animal.id, e.target.value)}
                              placeholder="kg"
                            />
                          </td>
                          <td>
                            <input
                              className="ui-input"
                              type="text"
                              value={animal.observacaoAtual}
                              onChange={(e) => updateDraftObs(animal.id, e.target.value)}
                              placeholder="Observação opcional"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <button type="button" className="ui-button ui-button--outline" disabled={saving} onClick={onSalvarProgresso}>
                  Salvar progresso
                </button>
                <button type="button" className="ui-button ui-button--primary" disabled={saving} onClick={onFinalizar}>
                  Finalizar pesagem do lote
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-box">
              <strong>Selecione fazenda e lote para iniciar.</strong>
              <span>Depois da seleção, os animais do lote serão exibidos para pesagem individual.</span>
            </div>
          )}

          {resumoFinal ? (
            <div className="fazendas-card" style={{ marginTop: 16 }}>
              <div className="fazendas-card-header">
                <span className="fazendas-card-title">Resumo da pesagem</span>
              </div>
              <div className="peso-summary-grid">
                <div className="peso-summary-card"><div className="peso-summary-value">{resumoFinal.totalAnimais}</div><div className="peso-summary-label">Total de animais do lote</div></div>
                <div className="peso-summary-card"><div className="peso-summary-value">{resumoFinal.pesados}</div><div className="peso-summary-label">Animais pesados</div></div>
                <div className="peso-summary-card"><div className="peso-summary-value">{resumoFinal.semPesagem}</div><div className="peso-summary-label">Animais sem pesagem</div></div>
                <div className="peso-summary-card"><div className="peso-summary-value">{formatarNumero(resumoFinal.media)}</div><div className="peso-summary-label">Peso médio</div></div>
                <div className="peso-summary-card"><div className="peso-summary-value">{formatarNumero(resumoFinal.maior)}</div><div className="peso-summary-label">Maior peso</div></div>
                <div className="peso-summary-card"><div className="peso-summary-value">{formatarNumero(resumoFinal.menor)}</div><div className="peso-summary-label">Menor peso</div></div>
                <div className="peso-summary-card"><div className="peso-summary-value">{formatarNumero(resumoFinal.variacao)}</div><div className="peso-summary-label">Variação entre maior e menor peso</div></div>
              </div>
              <div style={{ marginTop: 12 }}>
                <p><strong>Data da pesagem:</strong> {formatarData(resumoFinal.data)}</p>
                <p><strong>Fazenda:</strong> {resumoFinal.fazendaNome}</p>
                <p><strong>Lote:</strong> {resumoFinal.loteNome}</p>
                {resumoFinal.ganhoInfo?.hasData ? (
                  <>
                    <p><strong>Ganho médio desde a última pesagem:</strong> {formatarNumero(resumoFinal.ganhoInfo.ganhoMedio)} kg</p>
                    <p><strong>Evolução do peso médio:</strong> {formatarNumero(resumoFinal.ganhoInfo.evolucaoMedia)} kg</p>
                    <p><strong>Animais com ganho:</strong> {resumoFinal.ganhoInfo.comGanho}</p>
                    <p><strong>Animais com perda:</strong> {resumoFinal.ganhoInfo.comPerda}</p>
                  </>
                ) : (
                  <p><strong>Ganho médio:</strong> Sem pesagem anterior suficiente para calcular ganho.</p>
                )}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="kpi-grid-3 kpi-grid-3--compact">
            <div className="kpi-card kpi-card--compact">
              <div className="kpi-label">Primeira pesagem</div>
              <div className="kpi-value">{resumoHistorico.primeira ? `${formatarNumero(resumoHistorico.primeira.peso_medio)} kg` : '—'}</div>
              <div className="kpi-sub">{resumoHistorico.primeira ? formatarData(resumoHistorico.primeira.data) : 'sem dados'}</div>
            </div>
            <div className="kpi-card kpi-card--compact">
              <div className="kpi-label">Última pesagem</div>
              <div className="kpi-value">{resumoHistorico.ultima ? `${formatarNumero(resumoHistorico.ultima.peso_medio)} kg` : '—'}</div>
              <div className="kpi-sub">{resumoHistorico.ultima ? formatarData(resumoHistorico.ultima.data) : 'sem dados'}</div>
            </div>
            <div className="kpi-card kpi-card--compact">
              <div className="kpi-label">Ganho total</div>
              <div className="kpi-value">{pesagensLoteTipoLote.length ? `${formatarNumero(resumoHistorico.ganho)} kg` : '—'}</div>
              <div className="kpi-sub">{resumoHistorico.dias > 0 ? `${resumoHistorico.dias} dias · GMD ${formatarNumero(resumoHistorico.gmd)} kg/dia` : 'dados insuficientes'}</div>
            </div>
          </div>
          <div className="grid-2">
            <div className="fazendas-card">
              <div className="fazendas-card-header"><span className="fazendas-card-title">Evolução do lote {loteAtual?.nome || '—'}</span></div>
              <div className="card-body"><PesoChart data={pesagensLoteTipoLote} metaGmd={loteAtual?.gmd_meta || 0} /></div>
            </div>
            <div className="fazendas-card">
              <div className="fazendas-card-header"><span className="fazendas-card-title">Histórico detalhado</span></div>
              <div className="fazendas-table-wrap">
                {pesagensLoteTipoLote.length === 0 ? (
                  <div className="empty-box"><strong>Sem pesagens de lote.</strong><span>Finalize uma pesagem individual para atualizar o histórico.</span></div>
                ) : (
                  <table className="data-table">
                    <thead><tr><th>Data</th><th>Peso médio</th><th>Observação</th></tr></thead>
                    <tbody>
                      {pesagensLoteTipoLote.map((item) => (
                        <tr key={item.id}>
                          <td>{formatarData(item.data)}</td>
                          <td className="text-h">{formatarNumero(item.peso_medio)} kg</td>
                          <td>{item.observacao || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
