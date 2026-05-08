import { useMemo, useState } from 'react';
import PesoChart from '../components/PesoChart';
import { useAuth } from '../auth/useAuth';
import { useToast } from '../hooks/useToast';
import {
  createOperationalRecord,
  persistCollectionMutation,
  updateOperationalRecord,
} from '../services/operationalPersistence';
import { formatarNumero, formatarData } from '../utils/formatters';
import { calcularDias } from '../utils/calculations';
import { gerarNovoId } from '../utils/id';

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeDateIso(dateValue) {
  const raw = String(dateValue || '').trim();
  if (!raw) return new Date().toISOString().slice(0, 10);
  return raw.slice(0, 10);
}

function buildPlaceholderLabel(index) {
  return `Animal #${index}`;
}

function isSameDate(a, b) {
  return normalizeDateIso(a) === normalizeDateIso(b);
}

function isIndividualAnimal(animal) {
  if (!animal || typeof animal !== 'object') return false;
  if (String(animal?.tipo_registro || '').toLowerCase() === 'individual') return true;
  return toNumber(animal?.qtd, 0) === 1 && Boolean(String(animal?.identificacao || '').trim());
}

function resolveLoteTotalHeads(lote, animaisLote) {
  const loteQtd = toNumber(
    lote?.qtd
    ?? lote?.qtd_inicial
    ?? lote?.heads
    ?? lote?.quantidade
    ?? lote?.total_cabecas
    ?? 0
  );
  if (loteQtd > 0) return loteQtd;
  return animaisLote.reduce((sum, item) => sum + Math.max(1, toNumber(item?.qtd, 1)), 0);
}

function resolveLatestPesagem(pesagens) {
  return [...(pesagens || [])]
    .filter((item) => item?.data)
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
    .at(-1) || null;
}

export default function AcompanhamentoPesoPage({ db, setDb }) {
  const { hasPermission, session } = useAuth();
  const { showToast } = useToast();
  const mensagemSemPermissao = 'Você não tem permissão para executar esta ação.';

  const fazendas = Array.isArray(db?.fazendas) ? db.fazendas : [];
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const animais = Array.isArray(db?.animais) ? db.animais : [];
  const pesagens = Array.isArray(db?.pesagens) ? db.pesagens : [];

  const [fazendaSelecionada, setFazendaSelecionada] = useState('');
  const [loteSelecionado, setLoteSelecionado] = useState('');
  const [dataPesagem, setDataPesagem] = useState(() => new Date().toISOString().slice(0, 10));
  const [pesosDraft, setPesosDraft] = useState({});
  const [notasDraft, setNotasDraft] = useState({});
  const [resumoFinal, setResumoFinal] = useState(null);
  const [saving, setSaving] = useState(false);

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

  const animaisIndividuaisDoLote = useMemo(
    () => animaisDoLote.filter(isIndividualAnimal),
    [animaisDoLote]
  );

  const pesagensLote = useMemo(() => {
    return pesagens
      .filter((item) => String(item?.lote_id) === String(loteSelecionado))
      .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
  }, [pesagens, loteSelecionado]);

  const pesagensLoteTipoLote = useMemo(
    () => pesagensLote.filter((item) => String(item?.tipo || '') !== 'animal'),
    [pesagensLote]
  );

  const resumoHistorico = useMemo(() => {
    if (!pesagensLoteTipoLote.length) {
      return {
        primeiraPesagem: null,
        ultimaPesagem: null,
        ganhoTotal: 0,
        dias: 0,
        gmd: 0,
      };
    }
    const primeira = pesagensLoteTipoLote[0];
    const ultima = pesagensLoteTipoLote[pesagensLoteTipoLote.length - 1];
    const ganhoTotal = toNumber(ultima?.peso_medio) - toNumber(primeira?.peso_medio);
    const dias = calcularDias(primeira?.data, ultima?.data);
    const gmd = dias > 0 ? ganhoTotal / dias : 0;
    return {
      primeiraPesagem: primeira,
      ultimaPesagem: ultima,
      ganhoTotal,
      dias,
      gmd,
    };
  }, [pesagensLoteTipoLote]);

  const pesagensAnimalNaData = useMemo(() => {
    const map = new Map();
    pesagens
      .filter((item) => String(item?.tipo || '') === 'animal')
      .filter((item) => String(item?.lote_id) === String(loteSelecionado))
      .filter((item) => isSameDate(item?.data, dataPesagem))
      .forEach((item) => {
        map.set(String(item?.animal_id), item);
      });
    return map;
  }, [pesagens, loteSelecionado, dataPesagem]);

  const pesagensAnimalHistoricoPorAnimal = useMemo(() => {
    const map = new Map();
    pesagens
      .filter((item) => String(item?.tipo || '') === 'animal')
      .filter((item) => String(item?.lote_id) === String(loteSelecionado))
      .forEach((item) => {
        const key = String(item?.animal_id);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(item);
      });
    map.forEach((lista) => {
      lista.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
    });
    return map;
  }, [pesagens, loteSelecionado]);

  const animaisComPesagem = useMemo(() => {
    return animaisIndividuaisDoLote.map((animal) => {
      const key = String(animal.id);
      const pesagemHoje = pesagensAnimalNaData.get(key) || null;
      const draftPeso = pesosDraft[key];
      const draftNota = notasDraft[key];
      const pesoAtual = draftPeso ?? (pesagemHoje ? String(pesagemHoje?.peso_medio ?? '') : '');
      const observacaoAtual = draftNota ?? (pesagemHoje?.observacao || '');
      return {
        ...animal,
        pesoRegistroAtual: pesoAtual,
        observacaoRegistroAtual: observacaoAtual,
        pesagemHojeId: pesagemHoje?.id ?? null,
      };
    });
  }, [animaisIndividuaisDoLote, notasDraft, pesosDraft, pesagensAnimalNaData]);

  const canGenerateAnimals = Boolean(loteAtual) && animaisIndividuaisDoLote.length === 0;

  function handlePesoChange(animalId, value) {
    const text = String(value ?? '').replace(',', '.');
    setPesosDraft((prev) => ({ ...prev, [String(animalId)]: text }));
  }

  function handleNotaChange(animalId, value) {
    setNotasDraft((prev) => ({ ...prev, [String(animalId)]: String(value ?? '') }));
  }

  async function gerarAnimaisIndividuais() {
    if (!hasPermission('animais:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    if (!loteAtual) return;
    const totalCabecas = resolveLoteTotalHeads(loteAtual, animaisDoLote);
    if (totalCabecas <= 0) {
      showToast({ type: 'warning', message: 'Este lote não possui quantidade de cabeças para gerar animais individuais.' });
      return;
    }

    const labelsExistentes = new Set(
      animaisIndividuaisDoLote.map((item) => String(item?.identificacao || '').trim().toLowerCase())
    );
    const novosPayloads = [];
    for (let i = 1; i <= totalCabecas; i += 1) {
      const label = buildPlaceholderLabel(i);
      if (labelsExistentes.has(label.toLowerCase())) continue;
      novosPayloads.push({
        lote_id: loteAtual.id,
        identificacao: label,
        tipo_registro: 'individual',
        qtd: 1,
        status: 'ativo',
        p_ini: toNumber(loteAtual?.p_ini ?? loteAtual?.peso_inicial ?? 0),
        p_at: toNumber(loteAtual?.p_at ?? loteAtual?.peso_atual ?? loteAtual?.peso_inicial ?? 0),
        dias: 0,
        consumo: 0,
      });
    }

    if (!novosPayloads.length) {
      showToast({ type: 'info', message: 'Os animais individuais deste lote já foram gerados.' });
      return;
    }

    const baseAnimais = Array.isArray(db?.animais) ? db.animais : [];
    const persistPromises = novosPayloads.map((payload) => createOperationalRecord('animais', payload, session));
    const persistedResults = await Promise.all(persistPromises);

    setDb((prev) => {
      let nextIdBase = gerarNovoId(baseAnimais);
      const created = persistedResults.map((result, index) => {
        if (result?.data) return result.data;
        const fallback = { id: nextIdBase + index, ...novosPayloads[index] };
        return fallback;
      });
      return {
        ...prev,
        animais: [...(Array.isArray(prev?.animais) ? prev.animais : []), ...created],
      };
    });

    const hasCloudFailure = persistedResults.some((item) => !item?.persisted);
    if (hasCloudFailure) {
      showToast({
        type: 'warning',
        message: 'Animais gerados localmente. Sincronização pendente para alguns registros.',
      });
    } else {
      showToast({ type: 'success', message: 'Animais individuais gerados para o lote.' });
    }
  }

  async function persistirPesagensDoLote({ finalizar = false } = {}) {
    if (!hasPermission('pesagens:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return null;
    }
    if (!loteAtual) {
      showToast({ type: 'warning', message: 'Selecione um lote para pesar.' });
      return null;
    }
    if (!animaisComPesagem.length) {
      showToast({ type: 'warning', message: 'Este lote não possui animais individuais para pesagem.' });
      return null;
    }

    const operations = [];
    const context = [];
    animaisComPesagem.forEach((animal) => {
      const raw = String(animal?.pesoRegistroAtual ?? '').trim();
      if (!raw) return;
      const numeric = Number(raw.replace(',', '.'));
      if (!Number.isFinite(numeric) || numeric <= 0) return;
      const observacao = String(animal?.observacaoRegistroAtual || '').trim();
      const payload = {
        lote_id: loteAtual.id,
        animal_id: animal.id,
        data: normalizeDateIso(dataPesagem),
        peso_medio: numeric,
        observacao: observacao || null,
        tipo: 'animal',
        origem: 'animal',
      };
      const existing = pesagensAnimalNaData.get(String(animal.id)) || null;
      if (existing?.id) {
        operations.push(updateOperationalRecord('pesagens', existing.id, payload, session));
        context.push({ type: 'update', animal, payload, existing });
      } else {
        operations.push(createOperationalRecord('pesagens', payload, session));
        context.push({ type: 'create', animal, payload, existing: null });
      }
    });

    if (!operations.length) {
      showToast({ type: 'warning', message: 'Informe pelo menos um peso válido para salvar.' });
      return null;
    }

    setSaving(true);
    const persistedResults = await Promise.all(operations);
    const persistedBatch = await persistCollectionMutation(persistedResults.map((item) => Promise.resolve(item)));

    const newPesagens = [];
    let fallbackId = gerarNovoId(pesagens);
    context.forEach((item, index) => {
      const persisted = persistedResults[index];
      const payload = item.payload;
      const record = persisted?.data || {
        id: item.type === 'update' ? item.existing?.id : fallbackId + index,
        ...payload,
      };
      newPesagens.push(record);
    });

    const pesagensPorAnimalData = new Map(
      (pesagens || []).map((item) => [`${item?.animal_id}-${normalizeDateIso(item?.data)}`, item])
    );
    newPesagens.forEach((item) => {
      pesagensPorAnimalData.set(`${item?.animal_id}-${normalizeDateIso(item?.data)}`, item);
    });
    const nextPesagens = Array.from(pesagensPorAnimalData.values());

    const animaisAtualizadosMap = new Map((animais || []).map((item) => [String(item.id), item]));
    context.forEach((item) => {
      const key = String(item.animal.id);
      const original = animaisAtualizadosMap.get(key);
      if (!original) return;
      const updated = {
        ...original,
        p_at: toNumber(item.payload.peso_medio, toNumber(original?.p_at, 0)),
      };
      animaisAtualizadosMap.set(key, updated);
    });
    const nextAnimais = Array.from(animaisAtualizadosMap.values());

    const pesosValidos = context
      .map((item) => toNumber(item.payload.peso_medio, NaN))
      .filter((value) => Number.isFinite(value) && value > 0);
    const mediaAtual = pesosValidos.length
      ? pesosValidos.reduce((sum, value) => sum + value, 0) / pesosValidos.length
      : toNumber(loteAtual?.p_at ?? loteAtual?.peso_atual ?? loteAtual?.p_ini, 0);

    const lotePatch = {
      p_at: mediaAtual,
      peso_atual: mediaAtual,
      peso_medio_atual: mediaAtual,
      ultima_pesagem: normalizeDateIso(dataPesagem),
    };
    const lotePersist = await updateOperationalRecord('lotes', loteAtual.id, lotePatch, session);
    const loteAtualizado = { ...loteAtual, ...(lotePersist?.data || lotePatch) };

    if (finalizar) {
      const payloadLotePesagem = {
        lote_id: loteAtual.id,
        data: normalizeDateIso(dataPesagem),
        peso_medio: mediaAtual,
        observacao: 'Pesagem individual por lote finalizada',
        tipo: 'lote',
        origem: 'lote',
        quantidade: context.length,
      };
      const lotePesagemExistente = pesagensLoteTipoLote.find((item) => isSameDate(item?.data, dataPesagem)) || null;
      if (lotePesagemExistente?.id) {
        const updateLotePesagem = await updateOperationalRecord('pesagens', lotePesagemExistente.id, payloadLotePesagem, session);
        newPesagens.push(updateLotePesagem?.data || { ...payloadLotePesagem, id: lotePesagemExistente.id });
      } else {
        const createLotePesagem = await createOperationalRecord('pesagens', payloadLotePesagem, session);
        newPesagens.push(createLotePesagem?.data || { ...payloadLotePesagem, id: gerarNovoId(nextPesagens) });
      }
    }

    const nextPesagensFinal = (() => {
      const map = new Map();
      [...(pesagens || []), ...newPesagens].forEach((item) => {
        if (String(item?.tipo || '') === 'animal') {
          map.set(`animal-${item?.animal_id}-${normalizeDateIso(item?.data)}`, item);
        } else {
          map.set(`lote-${item?.lote_id}-${normalizeDateIso(item?.data)}`, item);
        }
      });
      return Array.from(map.values());
    })();

    setDb((prev) => ({
      ...prev,
      animais: nextAnimais,
      pesagens: nextPesagensFinal,
      lotes: (Array.isArray(prev?.lotes) ? prev.lotes : []).map((item) => (
        Number(item.id) === Number(loteAtualizado.id) ? loteAtualizado : item
      )),
    }));

    if (!persistedBatch?.persisted || !lotePersist?.persisted) {
      showToast({ type: 'warning', message: 'Pesagem salva localmente. Sincronização pendente.' });
    } else {
      showToast({ type: 'success', message: 'Pesagem salva na nuvem.' });
    }

    setSaving(false);
    return {
      nextAnimais,
      nextPesagens: nextPesagensFinal,
      loteAtualizado,
      pesosValidos,
    };
  }

  function montarResumoFinal({ nextAnimais, nextPesagens, loteAtualizado, pesosValidos }) {
    const animaisDoLoteAtualizado = nextAnimais.filter((item) => String(item?.lote_id) === String(loteAtualizado?.id));
    const individuais = animaisDoLoteAtualizado.filter(isIndividualAnimal);
    const totalAnimais = individuais.length;
    const pesagensNoDia = nextPesagens
      .filter((item) => String(item?.tipo || '') === 'animal')
      .filter((item) => String(item?.lote_id) === String(loteAtualizado?.id))
      .filter((item) => isSameDate(item?.data, dataPesagem));
    const mapPesagemAnimal = new Map(pesagensNoDia.map((item) => [String(item?.animal_id), item]));
    const pesados = individuais.filter((item) => mapPesagemAnimal.has(String(item?.id)));
    const semPesagem = Math.max(0, totalAnimais - pesados.length);
    const pesos = pesados.map((item) => toNumber(mapPesagemAnimal.get(String(item?.id))?.peso_medio, 0)).filter((v) => v > 0);
    const pesoMedio = pesos.length ? pesos.reduce((sum, v) => sum + v, 0) / pesos.length : 0;
    const maiorPeso = pesos.length ? Math.max(...pesos) : 0;
    const menorPeso = pesos.length ? Math.min(...pesos) : 0;
    const variacao = pesos.length ? maiorPeso - menorPeso : 0;

    const evolucao = (() => {
      let ganhos = 0;
      let perdas = 0;
      const diffs = [];
      individuais.forEach((animal) => {
        const historico = (pesagensAnimalHistoricoPorAnimal.get(String(animal.id)) || [])
          .filter((item) => !isSameDate(item?.data, dataPesagem));
        const anterior = resolveLatestPesagem(historico);
        const atual = mapPesagemAnimal.get(String(animal.id));
        if (!anterior || !atual) return;
        const diff = toNumber(atual?.peso_medio, 0) - toNumber(anterior?.peso_medio, 0);
        diffs.push(diff);
        if (diff >= 0) ganhos += 1;
        if (diff < 0) perdas += 1;
      });

      if (!diffs.length) {
        return {
          hasData: false,
          ganhoMedio: 0,
          evolucaoPesoMedio: 0,
          quantidadeGanho: 0,
          quantidadePerda: 0,
        };
      }

      const ganhoMedio = diffs.reduce((sum, value) => sum + value, 0) / diffs.length;
      const mediaAnteriorAnimais = (() => {
        const prevPesos = [];
        individuais.forEach((animal) => {
          const historico = (pesagensAnimalHistoricoPorAnimal.get(String(animal.id)) || [])
            .filter((item) => !isSameDate(item?.data, dataPesagem));
          const anterior = resolveLatestPesagem(historico);
          if (!anterior) return;
          prevPesos.push(toNumber(anterior?.peso_medio, 0));
        });
        return prevPesos.length ? prevPesos.reduce((sum, v) => sum + v, 0) / prevPesos.length : 0;
      })();
      return {
        hasData: true,
        ganhoMedio,
        evolucaoPesoMedio: pesoMedio - mediaAnteriorAnimais,
        quantidadeGanho: ganhos,
        quantidadePerda: perdas,
      };
    })();

    return {
      fazendaNome: fazendas.find((item) => String(item.id) === String(loteAtualizado?.faz_id))?.nome || '—',
      loteNome: loteAtualizado?.nome || '—',
      dataPesagem: normalizeDateIso(dataPesagem),
      totalAnimais,
      pesados: pesados.length,
      semPesagem,
      pesoMedio,
      maiorPeso,
      menorPeso,
      variacao,
      evolucao,
      pesosValidos,
    };
  }

  async function salvarProgresso() {
    const result = await persistirPesagensDoLote({ finalizar: false });
    if (!result) return;
    setResumoFinal(null);
  }

  async function finalizarPesagem() {
    const result = await persistirPesagensDoLote({ finalizar: true });
    if (!result) return;
    const resumo = montarResumoFinal(result);
    setResumoFinal(resumo);
  }

  return (
    <div className="page page--pesagens">
      <div className="page-header page-topbar">
        <div>
          <h1>Pesagem individual por lote</h1>
          <p>Selecione fazenda e lote, pese animal por animal e finalize com resumo operacional.</p>
        </div>
      </div>

      <div className="fazendas-card" style={{ marginBottom: 16 }}>
        <div className="fazendas-card-header">
          <span className="fazendas-card-title">Configuração da pesagem</span>
        </div>
        <div className="form-grid three">
          <label className="ui-input-wrap">
            <span className="ui-input-label">Selecionar fazenda</span>
            <select
              className="ui-input"
              value={fazendaSelecionada}
              onChange={(e) => {
                setFazendaSelecionada(e.target.value);
                setLoteSelecionado('');
                setResumoFinal(null);
              }}
            >
              <option value="">Todas</option>
              {fazendas.map((fazenda) => (
                <option key={fazenda.id} value={fazenda.id}>{fazenda.nome}</option>
              ))}
            </select>
          </label>
          <label className="ui-input-wrap">
            <span className="ui-input-label">Selecionar lote</span>
            <select
              className="ui-input"
              value={loteSelecionado}
              onChange={(e) => {
                setLoteSelecionado(e.target.value);
                setResumoFinal(null);
              }}
            >
              <option value="">Selecione</option>
              {lotesFiltrados.map((lote) => (
                <option key={lote.id} value={lote.id}>{lote.nome}</option>
              ))}
            </select>
          </label>
          <label className="ui-input-wrap">
            <span className="ui-input-label">Data da pesagem</span>
            <input
              type="date"
              className="ui-input"
              value={dataPesagem}
              onChange={(e) => {
                setDataPesagem(e.target.value);
                setResumoFinal(null);
              }}
            />
          </label>
        </div>
      </div>

      {loteAtual ? (
        <>
          <div className="fazendas-card" style={{ marginBottom: 16 }}>
            <div className="fazendas-card-header">
              <span className="fazendas-card-title">Animais do lote</span>
            </div>

            {canGenerateAnimals ? (
              <div className="empty-box" style={{ marginBottom: 12 }}>
                <strong>Este lote ainda não possui animais individuais vinculados.</strong>
                <span>Para pesagem individual, gere os animais com base no total de cabeças do lote.</span>
                <button type="button" className="primary-btn" onClick={gerarAnimaisIndividuais}>
                  Gerar animais individuais para este lote
                </button>
              </div>
            ) : null}

            {animaisComPesagem.length === 0 ? (
              <div className="empty-box">
                <strong>Nenhum animal individual disponível.</strong>
                <span>Gere os animais individuais para iniciar a pesagem por lote.</span>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Animal</th>
                      <th>Peso atual (kg)</th>
                      <th>Observações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {animaisComPesagem.map((animal) => (
                      <tr key={animal.id}>
                        <td className="text-h">{animal.identificacao || `Animal ${animal.id}`}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="ui-input"
                            value={animal.pesoRegistroAtual}
                            onChange={(e) => handlePesoChange(animal.id, e.target.value)}
                            placeholder="Informe o peso"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="ui-input"
                            value={animal.observacaoRegistroAtual}
                            onChange={(e) => handleNotaChange(animal.id, e.target.value)}
                            placeholder="Observação (opcional)"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <button type="button" className="ui-button ui-button--outline" disabled={saving} onClick={salvarProgresso}>
                Salvar progresso
              </button>
              <button type="button" className="primary-btn" disabled={saving} onClick={finalizarPesagem}>
                Finalizar pesagem do lote
              </button>
            </div>
          </div>

          {resumoFinal ? (
            <div className="fazendas-card" style={{ marginBottom: 16 }}>
              <div className="fazendas-card-header">
                <span className="fazendas-card-title">Resumo da pesagem</span>
              </div>
              <div className="peso-summary-grid">
                <div className="peso-summary-card">
                  <div className="peso-summary-value">{resumoFinal.totalAnimais}</div>
                  <div className="peso-summary-label">Total de animais do lote</div>
                </div>
                <div className="peso-summary-card">
                  <div className="peso-summary-value">{resumoFinal.pesados}</div>
                  <div className="peso-summary-label">Animais pesados</div>
                </div>
                <div className="peso-summary-card">
                  <div className="peso-summary-value">{resumoFinal.semPesagem}</div>
                  <div className="peso-summary-label">Animais sem pesagem</div>
                </div>
                <div className="peso-summary-card">
                  <div className="peso-summary-value">{formatarNumero(resumoFinal.pesoMedio)}</div>
                  <div className="peso-summary-label">Peso médio</div>
                </div>
                <div className="peso-summary-card">
                  <div className="peso-summary-value">{formatarNumero(resumoFinal.maiorPeso)}</div>
                  <div className="peso-summary-label">Maior peso</div>
                </div>
                <div className="peso-summary-card">
                  <div className="peso-summary-value">{formatarNumero(resumoFinal.menorPeso)}</div>
                  <div className="peso-summary-label">Menor peso</div>
                </div>
                <div className="peso-summary-card">
                  <div className="peso-summary-value">{formatarNumero(resumoFinal.variacao)}</div>
                  <div className="peso-summary-label">Variação entre maior e menor</div>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <p><strong>Data da pesagem:</strong> {formatarData(resumoFinal.dataPesagem)}</p>
                <p><strong>Fazenda:</strong> {resumoFinal.fazendaNome}</p>
                <p><strong>Lote:</strong> {resumoFinal.loteNome}</p>
                {resumoFinal.evolucao?.hasData ? (
                  <>
                    <p><strong>Ganho médio desde a última pesagem:</strong> {formatarNumero(resumoFinal.evolucao.ganhoMedio)} kg</p>
                    <p><strong>Evolução do peso médio:</strong> {formatarNumero(resumoFinal.evolucao.evolucaoPesoMedio)} kg</p>
                    <p><strong>Quantidade de animais com ganho:</strong> {resumoFinal.evolucao.quantidadeGanho}</p>
                    <p><strong>Quantidade de animais com perda:</strong> {resumoFinal.evolucao.quantidadePerda}</p>
                  </>
                ) : (
                  <p><strong>Ganho médio:</strong> Sem pesagem anterior suficiente para calcular ganho.</p>
                )}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="empty-box" style={{ marginBottom: 16 }}>
          <strong>Selecione fazenda e lote para iniciar.</strong>
          <span>O fluxo de pesagem individual por lote fica disponível após a seleção.</span>
        </div>
      )}

      <div className="kpi-grid-3 kpi-grid-3--compact">
        <div className="kpi-card kpi-card--compact">
          <div className="kpi-label">Primeira pesagem</div>
          <div className="kpi-value">
            {resumoHistorico.primeiraPesagem ? `${formatarNumero(resumoHistorico.primeiraPesagem.peso_medio)} kg` : '—'}
          </div>
          <div className="kpi-sub">{resumoHistorico.primeiraPesagem ? formatarData(resumoHistorico.primeiraPesagem.data) : 'sem dados'}</div>
        </div>
        <div className="kpi-card kpi-card--compact">
          <div className="kpi-label">Última pesagem</div>
          <div className="kpi-value">
            {resumoHistorico.ultimaPesagem ? `${formatarNumero(resumoHistorico.ultimaPesagem.peso_medio)} kg` : '—'}
          </div>
          <div className="kpi-sub">{resumoHistorico.ultimaPesagem ? formatarData(resumoHistorico.ultimaPesagem.data) : 'sem dados'}</div>
        </div>
        <div className="kpi-card kpi-card--compact">
          <div className="kpi-label">Ganho total</div>
          <div className="kpi-value">
            {pesagensLoteTipoLote.length ? `${formatarNumero(resumoHistorico.ganhoTotal)} kg` : '—'}
          </div>
          <div className="kpi-sub">
            {resumoHistorico.dias > 0
              ? `${resumoHistorico.dias} dias · GMD ${formatarNumero(resumoHistorico.gmd)} kg/dia`
              : 'dados insuficientes'}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="fazendas-card">
          <div className="fazendas-card-header">
            <span className="fazendas-card-title">Evolução do lote {loteAtual?.nome || '—'}</span>
          </div>
          <div className="card-body">
            <PesoChart data={pesagensLoteTipoLote} metaGmd={loteAtual?.gmd_meta || 0} />
          </div>
        </div>
        <div className="fazendas-card">
          <div className="fazendas-card-header">
            <span className="fazendas-card-title">Histórico detalhado</span>
          </div>
          <div className="fazendas-table-wrap">
            {pesagensLoteTipoLote.length === 0 ? (
              <div className="empty-box">
                <strong>Este lote ainda não possui pesagens de lote.</strong>
                <span>Finalize uma pesagem individual para alimentar o histórico de produtividade.</span>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Peso médio</th>
                    <th>Variação</th>
                    <th>Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {pesagensLoteTipoLote.map((item, index) => {
                    const anterior = index > 0 ? pesagensLoteTipoLote[index - 1] : null;
                    const variacao = anterior ? toNumber(item?.peso_medio) - toNumber(anterior?.peso_medio) : null;
                    return (
                      <tr key={item.id}>
                        <td>{formatarData(item.data)}</td>
                        <td className="text-h">{formatarNumero(item.peso_medio)} kg</td>
                        <td>{renderVariacao(variacao)}</td>
                        <td>{item.observacao || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function renderVariacao(variacao) {
  if (variacao === null || variacao === undefined) return '—';
  if (variacao > 0) return <span className="badge badge-g">+{formatarNumero(variacao)} kg</span>;
  if (variacao < 0) return <span className="badge badge-r">{formatarNumero(variacao)} kg</span>;
  return <span className="badge">0,00 kg</span>;
}
