import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import ArrobaPreview from './ArrobaPreview';
import { useSubmitOnce } from '../hooks/useSubmitOnce.js';
import { calcularPesoMedioIndividual } from '../domain/pesagensLote.js';

import { hojeLocalISO } from '../domain/dataCivil.js';

// Faixa de peso plausível para um bovino (kg) — fora disso é só aviso visual,
// nunca bloqueia nem corrige o valor digitado (Sprint Funcional 15, item 5).
const PESO_MIN_RAZOAVEL = 5;
const PESO_MAX_RAZOAVEL = 1200;

function normalizeIdKey(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function isIndividualAnimal(animal) {
  if (!animal) return false;
  const tipoRegistro = String(animal?.tipo_registro || '').toLowerCase();
  if (tipoRegistro === 'individual') return true;
  const qtd = Number(animal?.qtd);
  return Number.isFinite(qtd) && qtd === 1;
}

function getExpectedHeadCount(lote, animaisDoLote = []) {
  if (!lote) return 0;
  const candidates = [
    lote?.qtd,
    lote?.quantidade,
    lote?.quantidade_animais,
    lote?.qtd_inicial,
    lote?.cabecas,
    lote?.total_cabecas,
    lote?.heads,
    lote?.indicators?.totalAnimais,
    lote?.resumo?.totalAnimais,
  ];
  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
  }

  const computed = (Array.isArray(animaisDoLote) ? animaisDoLote : []).reduce((sum, animal) => {
    if (String(animal?.tipo_registro || '').toLowerCase() === 'individual') return sum + 1;
    const qtyCandidates = [animal?.qtd, animal?.quantidade, animal?.quantidade_animais, animal?.cabecas];
    for (const value of qtyCandidates) {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) return sum + Math.floor(parsed);
    }
    return sum + 1;
  }, 0);
  if (computed > 0) return computed;

  return 0;
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

const FORM_VAZIO = {
  lote_id: '',
  data: '',
  observacao: '',
  rendimento_carcaca: 52,
  preco_arroba: '',
};

function normalizarInitialData(data) {
  // Nova pesagem: já vem com a data de hoje preenchida, editável.
  if (!data) return { ...FORM_VAZIO, data: hojeLocalISO() };
  return {
    lote_id: data.lote_id ?? '',
    data: data.data || hojeLocalISO(),
    observacao: data.observacao || '',
    rendimento_carcaca: data.rendimento_carcaca ?? 52,
    preco_arroba: data.preco_arroba ?? '',
  };
}

function validarForm(form) {
  if (!form.lote_id) return 'Selecione o lote.';
  if (!form.data) return 'Informe a data da pesagem.';
  if (Number(form.rendimento_carcaca || 0) <= 0) return 'Rendimento de carcaça deve ser maior que zero.';
  return null;
}

// Sprint Funcional 15: pesagem por cabeça substitui o lançamento manual de
// peso médio. Não existe mais campo para digitar a média — ela é sempre
// calculada (domain/pesagensLote.js::calcularPesoMedioIndividual) a partir
// dos pesos individuais informados aqui, um campo por cabeça do lote.
export default function PesagemForm({
  initialData,
  lotes = [],
  animais = [],
  pesagens = [],
  onSave,
  onCancel,
  onConfirmAction,
}) {
  const { executar, isSubmitting } = useSubmitOnce();
  const [form, setForm] = useState(() => normalizarInitialData(initialData));
  const [erro, setErro] = useState('');
  const [pesosAnimais, setPesosAnimais] = useState({});
  const [observacoesAnimais, setObservacoesAnimais] = useState({});
  const ultimoLotePreenchidoRef = useRef(null);
  const hasSelectedLote = Boolean(form.lote_id);

  const animaisDoLote = hasSelectedLote
    ? animais.filter((animal) => Number(animal?.lote_id) === Number(form.lote_id))
    : [];
  const animaisIndividuais = animaisDoLote.filter((animal) => isIndividualAnimal(animal));
  const loteSelecionado = hasSelectedLote
    ? (lotes.find((lote) => Number(lote?.id) === Number(form.lote_id)) || null)
    : null;
  const expectedHeadCount = hasSelectedLote ? getExpectedHeadCount(loteSelecionado, animaisDoLote) : 0;

  const animalsByIndex = new Map();
  animaisIndividuais.forEach((animal, idx) => {
    const index = getAnimalIndex(animal, idx + 1);
    if (!index || animalsByIndex.has(index)) return;
    animalsByIndex.set(index, animal);
  });

  const rowCount = Math.max(expectedHeadCount, animalsByIndex.size);
  const linhasAnimais = Array.from({ length: rowCount }, (_, idx) => {
    const index = idx + 1;
    const existing = animalsByIndex.get(index) || null;
    if (existing) {
      return {
        ...existing,
        virtual: false,
        rowIndex: index,
      };
    }
    return {
      virtual: true,
      virtualIndex: index,
      rowIndex: index,
      identificacao: `Animal #${index}`,
      lote_id: form.lote_id ? Number(form.lote_id) : null,
    };
  });

  function rowKey(animal) {
    return animal.virtual ? `virtual-${animal.virtualIndex}` : String(Number(animal.id));
  }

  const pesagensDoDiaPorAnimalId = useMemo(() => {
    const map = new Map();
    if (!form.data || !form.lote_id) return map;
    pesagens
      .filter((item) => (
        String(item?.data || '') === String(form.data)
        && Number(item?.lote_id) === Number(form.lote_id)
        && (item?.tipo === 'animal' || item?.origem === 'animal')
      ))
      .forEach((item) => {
        const animalId = normalizeIdKey(item?.animal_id);
        if (animalId && !map.has(animalId)) {
          map.set(animalId, item);
        }
      });
    return map;
  }, [form.data, form.lote_id, pesagens]);

  useEffect(() => {
    setForm(normalizarInitialData(initialData));
    setErro('');
    setPesosAnimais({});
    setObservacoesAnimais({});
  }, [initialData]);

  useEffect(() => {
    if (!form.data || !form.lote_id) return;

    setPesosAnimais((prev) => {
      let changed = false;
      const next = { ...prev };
      linhasAnimais.forEach((animal) => {
        if (animal.virtual) return;
        const animalId = normalizeIdKey(animal.id);
        if (!animalId || next[rowKey(animal)]) return;
        const existingPesagem = pesagensDoDiaPorAnimalId.get(animalId);
        if (existingPesagem?.peso_medio !== undefined && existingPesagem?.peso_medio !== null) {
          next[rowKey(animal)] = String(existingPesagem.peso_medio);
          changed = true;
        }
      });
      return changed ? next : prev;
    });

    setObservacoesAnimais((prev) => {
      let changed = false;
      const next = { ...prev };
      linhasAnimais.forEach((animal) => {
        if (animal.virtual) return;
        const animalId = normalizeIdKey(animal.id);
        if (!animalId || next[rowKey(animal)]) return;
        const existingPesagem = pesagensDoDiaPorAnimalId.get(animalId);
        if (existingPesagem?.observacao) {
          next[rowKey(animal)] = String(existingPesagem.observacao);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.data, form.lote_id, pesagensDoDiaPorAnimalId]);

  useEffect(() => {
    const loteAtual = String(form.lote_id ?? '');
    if (loteAtual === String(ultimoLotePreenchidoRef.current ?? '')) return;
    ultimoLotePreenchidoRef.current = loteAtual;
    setPesosAnimais({});
    setObservacoesAnimais({});
  }, [form.lote_id]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handlePesoKeyDown(event, rowIndex) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const next = document.querySelector(`[data-peso-row="${rowIndex + 1}"]`);
    if (next) {
      next.focus();
    } else {
      event.target.blur();
    }
  }

  const pesosValidosAtuais = linhasAnimais
    .map((animal) => pesosAnimais[rowKey(animal)])
    .filter((valor) => valor !== undefined && valor !== '');
  const resumoAoVivo = useMemo(
    () => calcularPesoMedioIndividual(pesosValidosAtuais),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(pesosValidosAtuais)]
  );
  const cabecasPendentes = Math.max(expectedHeadCount - resumoAoVivo.quantidade, 0);

  // Envolve a chamada de onSave (assíncrona, pode lançar) com a trava de
  // submissão única. Erro fica visível no formulário (setErro), os dados
  // digitados permanecem e uma nova tentativa é permitida — o form só fecha
  // por decisão do pai (onSave), nunca aqui.
  async function submeter(action) {
    try {
      await executar(action);
    } catch (error) {
      setErro(error?.message || 'Não foi possível salvar agora. Tente novamente.');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const erroValidacao = validarForm(form);

    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    setErro('');

    const registros = linhasAnimais
      .map((animal) => {
        const key = rowKey(animal);
        const pesoBruto = String(pesosAnimais[key] ?? '').trim();
        if (!pesoBruto) return null;
        const peso = Number(pesoBruto.replace(',', '.'));
        if (!Number.isFinite(peso) || peso <= 0) return null;

        return {
          tipo: 'animal',
          origem: 'animal',
          lote_id: form.lote_id ? Number(form.lote_id) : null,
          animal_id: animal.virtual ? null : normalizeIdKey(animal.id),
          virtual_animal: animal.virtual
            ? {
                identificacao: animal.identificacao,
                index: animal.virtualIndex,
              }
            : null,
          data: form.data,
          peso_medio: peso,
          rendimento_carcaca: Number(form.rendimento_carcaca || 0),
          preco_arroba: form.preco_arroba === '' ? null : Number(form.preco_arroba),
          observacao: String(observacoesAnimais[key] ?? '').trim(),
        };
      })
      .filter(Boolean);

    if (!registros.length) {
      setErro('Informe ao menos um peso válido para salvar.');
      return;
    }

    if (expectedHeadCount > 0 && registros.length < expectedHeadCount) {
      const mensagem = `Você pesou ${registros.length} de ${expectedHeadCount} cabeças deste lote. A média oficial será calculada só com as cabeças pesadas. Deseja continuar?`;
      const confirmado = onConfirmAction
        ? await onConfirmAction({ title: 'Pesagem parcial', message: mensagem, tone: 'warning' })
        : window.confirm(mensagem);
      if (!confirmado) return;
    }

    await submeter(() => onSave?.({
      tipo: 'animal_batch',
      lote_id: form.lote_id ? Number(form.lote_id) : null,
      data: form.data,
      observacao: form.observacao.trim(),
      expectedHeadCount,
      registros,
      pesagemPrincipalId: initialData?.id && !initialData?._orfao ? initialData.id : null,
    }));
  }

  const titulo = initialData?.id ? 'Editar pesagem' : 'Nova pesagem';

  // Checagem leve só para o estado do botão — handleSubmit roda a validação
  // completa (validarForm) e mostra a mensagem de erro específica no submit.
  const faltaCampoObrigatorio = !form.lote_id || !form.data || resumoAoVivo.quantidade === 0;

  const footer = (
    <div className="modal-footer action-row" style={{ width: '100%' }}>
      <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
      <Button onClick={handleSubmit} disabled={faltaCampoObrigatorio} loading={isSubmitting} loadingLabel="Salvando...">Salvar pesagem</Button>
    </div>
  );

  return (
    <Modal open onClose={onCancel} title={titulo} footer={footer}>
      <form onSubmit={handleSubmit} className="pesagem-form form-section">
        <div className="pesagem-balao-verde" role="note">
          <span className="pesagem-balao-verde__icone" aria-hidden="true">📈</span>
          <span>
            {loteSelecionado && expectedHeadCount > 0
              ? `Pesagem vinculada ao lote ${loteSelecionado.nome || 'selecionado'}. Cabeças esperadas: ${expectedHeadCount}.`
              : 'Selecione o lote para carregar as cabeças e registrar o peso de cada uma.'}
          </span>
        </div>

        <section className="pesagem-form-section-block section-card">
          <div className="pesagem-form-section-head">Lote e data</div>
          <div className="grid-2 pesagem-form-grid">
            <label className="pesagem-form-field">
              Lote
              <select className="ui-input" name="lote_id" value={form.lote_id} onChange={handleChange}>
                <option value="">Selecione</option>
                {lotes.map((lote) => (
                  <option key={lote.id} value={lote.id}>{lote.nome}</option>
                ))}
              </select>
            </label>
            <label className="pesagem-form-field">
              Data
              <input
                className="ui-input"
                name="data"
                type="date"
                max={hojeLocalISO()}
                value={form.data}
                onChange={handleChange}
              />
            </label>
          </div>
        </section>

        <section className="pesagem-form-section-block section-card">
          <div className="pesagem-form-section-head">Peso por cabeça</div>
          {!hasSelectedLote ? (
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
              Selecione um lote para carregar as cabeças.
            </p>
          ) : linhasAnimais.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
              Este lote não tem cabeças cadastradas para pesar.
            </p>
          ) : (
            <>
              <div className="pesagem-resumo-vivo" role="status" aria-live="polite">
                <div className="pesagem-resumo-item">
                  <span className="pesagem-resumo-label">Cabeças do lote</span>
                  <strong className="pesagem-resumo-valor">{expectedHeadCount}</strong>
                </div>
                <div className="pesagem-resumo-item">
                  <span className="pesagem-resumo-label">Preenchidas</span>
                  <strong className="pesagem-resumo-valor">{resumoAoVivo.quantidade}</strong>
                </div>
                <div className="pesagem-resumo-item">
                  <span className="pesagem-resumo-label">Pendentes</span>
                  <strong className={`pesagem-resumo-valor${cabecasPendentes > 0 ? ' is-pendente' : ''}`}>{cabecasPendentes}</strong>
                </div>
                <div className="pesagem-resumo-item">
                  <span className="pesagem-resumo-label">Soma dos pesos</span>
                  <strong className="pesagem-resumo-valor">{resumoAoVivo.soma ? resumoAoVivo.soma.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '0'} kg</strong>
                </div>
                <div className="pesagem-resumo-item">
                  <span className="pesagem-resumo-label">Peso médio calculado</span>
                  <strong className="pesagem-resumo-valor is-destaque">
                    {resumoAoVivo.media !== null ? `${resumoAoVivo.media.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg` : '—'}
                  </strong>
                </div>
              </div>

              <div className="responsive-table-wrap fazendas-table-wrap desktop-table">
                <table className="data-table herdon-table">
                  <thead>
                    <tr>
                      <th>Cabeça</th>
                      <th>Peso (kg)</th>
                      <th>Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasAnimais.map((animal) => {
                      const key = rowKey(animal);
                      const nomeAnimal = animal.identificacao || animal.nome || `Animal #${animal.rowIndex}`;
                      const pesoDigitado = Number(String(pesosAnimais[key] ?? '').replace(',', '.'));
                      const foraDaFaixa = pesosAnimais[key] && Number.isFinite(pesoDigitado)
                        && (pesoDigitado < PESO_MIN_RAZOAVEL || pesoDigitado > PESO_MAX_RAZOAVEL);
                      return (
                        <tr key={key}>
                          <td>
                            <label htmlFor={`peso-cabeca-${animal.rowIndex}`}>{nomeAnimal}</label>
                          </td>
                          <td>
                            <input
                              id={`peso-cabeca-${animal.rowIndex}`}
                              data-peso-row={animal.rowIndex}
                              className="ui-input"
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min={0}
                              value={pesosAnimais[key] ?? ''}
                              onChange={(event) => {
                                const value = event.target.value;
                                setPesosAnimais((prev) => ({ ...prev, [key]: value }));
                              }}
                              onKeyDown={(event) => handlePesoKeyDown(event, animal.rowIndex)}
                              placeholder="Ex.: 412"
                              aria-describedby={foraDaFaixa ? `peso-aviso-${animal.rowIndex}` : undefined}
                            />
                            {foraDaFaixa ? (
                              <small id={`peso-aviso-${animal.rowIndex}`} className="pesagem-peso-aviso">
                                Peso fora da faixa esperada — confira antes de salvar.
                              </small>
                            ) : null}
                          </td>
                          <td>
                            <input
                              className="ui-input"
                              aria-label={`Observação para ${nomeAnimal}`}
                              value={observacoesAnimais[key] ?? ''}
                              onChange={(event) => {
                                const value = event.target.value;
                                setObservacoesAnimais((prev) => ({ ...prev, [key]: value }));
                              }}
                              placeholder="Observação opcional"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mobile-table-cards">
                {linhasAnimais.map((animal) => {
                  const key = rowKey(animal);
                  const nomeAnimal = animal.identificacao || animal.nome || `Animal #${animal.rowIndex}`;
                  const pesoDigitado = Number(String(pesosAnimais[key] ?? '').replace(',', '.'));
                  const foraDaFaixa = pesosAnimais[key] && Number.isFinite(pesoDigitado)
                    && (pesoDigitado < PESO_MIN_RAZOAVEL || pesoDigitado > PESO_MAX_RAZOAVEL);
                  return (
                    <div className="mobile-card pesagem-mobile-card" key={key}>
                      <div className="mobile-card-header">
                        <span className="mobile-card-title">{nomeAnimal}</span>
                      </div>
                      <div className="mobile-card-body">
                        <label className="pesagem-form-field" htmlFor={`peso-cabeca-m-${animal.rowIndex}`}>
                          Peso (kg)
                          <input
                            id={`peso-cabeca-m-${animal.rowIndex}`}
                            data-peso-row={animal.rowIndex}
                            className="ui-input"
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min={0}
                            value={pesosAnimais[key] ?? ''}
                            onChange={(event) => {
                              const value = event.target.value;
                              setPesosAnimais((prev) => ({ ...prev, [key]: value }));
                            }}
                            onKeyDown={(event) => handlePesoKeyDown(event, animal.rowIndex)}
                            placeholder="Ex.: 412"
                          />
                          {foraDaFaixa ? (
                            <small className="pesagem-peso-aviso">Peso fora da faixa esperada — confira antes de salvar.</small>
                          ) : null}
                        </label>
                        <label className="pesagem-form-field">
                          Observação
                          <input
                            className="ui-input"
                            value={observacoesAnimais[key] ?? ''}
                            onChange={(event) => {
                              const value = event.target.value;
                              setObservacoesAnimais((prev) => ({ ...prev, [key]: value }));
                            }}
                            placeholder="Opcional"
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        <label className="pesagem-form-field">
          Observação da pesagem (opcional)
          <input
            className="ui-input"
            name="observacao"
            value={form.observacao}
            onChange={handleChange}
            placeholder="Ex.: ganho acima do esperado"
          />
        </label>

        <section className="pesagem-form-section-block section-card">
          <div className="pesagem-form-section-head">Indicadores de valor</div>
          <div className="grid-2 pesagem-form-grid">
            <label className="pesagem-form-field">
              Rendimento de carcaça (%)
              <input
                className="ui-input"
                name="rendimento_carcaca"
                type="number"
                step="0.1"
                min={0}
                max={100}
                value={form.rendimento_carcaca}
                onChange={handleChange}
              />
            </label>

            <label className="pesagem-form-field">
              Preço por @ (opcional)
              <input
                className="ui-input"
                name="preco_arroba"
                type="number"
                step="0.01"
                min={0}
                value={form.preco_arroba}
                onChange={handleChange}
              />
            </label>
          </div>
        </section>

        <div className="pesagem-preview-wrap">
          <ArrobaPreview
            peso={resumoAoVivo.media || 0}
            rendimento={form.rendimento_carcaca}
            precoPorArroba={form.preco_arroba}
          />
        </div>

        {erro ? (
          <p style={{ margin: 0, color: 'var(--color-danger)', fontSize: '0.85rem' }}>
            {erro}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
