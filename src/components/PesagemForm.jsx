import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import ArrobaPreview from './ArrobaPreview';
import { useSubmitOnce } from '../hooks/useSubmitOnce.js';

import { hojeLocalISO } from '../domain/dataCivil.js';
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
  tipo: 'lote',
  lote_id: '',
  data: '',
  peso_medio: '',
  observacao: '',
  rendimento_carcaca: 52,
  preco_arroba: '',
  quantidade_pesada: '',
};

function normalizarInitialData(data) {
  // Nova pesagem: já vem com a data de hoje preenchida (3.1), editável.
  if (!data) return { ...FORM_VAZIO, data: hojeLocalISO() };
  return {
    tipo: data.tipo || data.origem || 'lote',
    lote_id: data.lote_id ?? '',
    data: data.data || hojeLocalISO(),
    peso_medio: data.peso_medio ?? '',
    observacao: data.observacao || '',
    rendimento_carcaca: data.rendimento_carcaca ?? 52,
    preco_arroba: data.preco_arroba ?? '',
    quantidade_pesada: data.quantidade_pesada ?? data.metadata?.quantidade_pesada ?? '',
  };
}

function validarForm(form) {
  if (form.tipo === 'lote' && !form.lote_id) return 'Selecione o lote.';
  if (!form.data) return 'Informe a data da pesagem.';
  if (form.tipo === 'lote') {
    if (!form.peso_medio) return 'Informe o peso médio.';
    if (Number(form.peso_medio || 0) <= 0) return 'Peso médio deve ser maior que zero.';
  }
  if (Number(form.rendimento_carcaca || 0) <= 0) return 'Rendimento de carcaça deve ser maior que zero.';
  return null;
}

export default function PesagemForm({
  initialData,
  lotes = [],
  animais = [],
  pesagens = [],
  onSave,
  onCancel,
}) {
  const { executar, isSubmitting } = useSubmitOnce();
  const [form, setForm] = useState(() => normalizarInitialData(initialData));
  const [erro, setErro] = useState('');
  const [pesosAnimais, setPesosAnimais] = useState({});
  const [observacoesAnimais, setObservacoesAnimais] = useState({});
  // Guarda o último lote para o qual a quantidade foi preenchida automaticamente,
  // permitindo reabastecer ao trocar de lote sem sobrescrever edição manual no mesmo lote.
  const ultimoLotePreenchidoRef = useRef(normalizarInitialData(initialData).lote_id ?? '');
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

  const pesagensDoDiaPorAnimalId = useMemo(() => {
    const map = new Map();
    if (form.tipo !== 'animal' || !form.data) return map;
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
  }, [form.tipo, form.data, form.lote_id, pesagens]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setForm(normalizarInitialData(initialData));
    setErro('');

    if (initialData?.tipo === 'animal' || initialData?.origem === 'animal') {
      const animalId = normalizeIdKey(initialData?.animal_id);
      if (animalId) {
        setPesosAnimais({ [animalId]: String(initialData?.peso_medio ?? '') });
        setObservacoesAnimais({ [animalId]: initialData?.observacao || '' });
      } else {
        setPesosAnimais({});
        setObservacoesAnimais({});
      }
      return;
    }

    setPesosAnimais({});
    setObservacoesAnimais({});
  }, [initialData]);

  useEffect(() => {
    if (form.tipo !== 'animal') return;
    if (!form.data) return;

    setPesosAnimais((prev) => {
      let changed = false;
      const next = { ...prev };
      linhasAnimais.forEach((animal) => {
        if (animal.virtual) return;
        const animalId = normalizeIdKey(animal.id);
        if (!animalId || next[animalId]) return;
        const existingPesagem = pesagensDoDiaPorAnimalId.get(animalId);
        if (existingPesagem?.peso_medio !== undefined && existingPesagem?.peso_medio !== null) {
          next[animalId] = String(existingPesagem.peso_medio);
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
        if (!animalId || next[animalId]) return;
        const existingPesagem = pesagensDoDiaPorAnimalId.get(animalId);
        if (existingPesagem?.observacao) {
          next[animalId] = String(existingPesagem.observacao);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [form.tipo, form.data, linhasAnimais, pesagensDoDiaPorAnimalId]);

  // Pesagem por lote: ao selecionar/trocar o lote, puxa automaticamente a
  // quantidade de cabeças do lote para o campo "Quantidade pesada", mantendo
  // edição manual posterior (só reabastece quando o lote realmente muda).
  useEffect(() => {
    if (form.tipo !== 'lote') return;
    const loteAtual = String(form.lote_id ?? '');
    if (loteAtual === String(ultimoLotePreenchidoRef.current ?? '')) return;
    ultimoLotePreenchidoRef.current = loteAtual;
    if (!loteAtual) return;
    if (expectedHeadCount > 0) {
      setForm((prev) => ({ ...prev, quantidade_pesada: String(expectedHeadCount) }));
    }
  }, [form.tipo, form.lote_id, expectedHeadCount]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => {
      if (name === 'tipo') {
        return {
          ...prev,
          tipo: value,
        };
      }

      return { ...prev, [name]: value };
    });
  }

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
    if (form.tipo === 'animal') {
      if (!form.lote_id) {
        setErro('Selecione um lote para registrar pesagens por animal.');
        return;
      }

      const registros = linhasAnimais
        .map((animal) => {
          const key = animal.virtual ? `virtual-${animal.virtualIndex}` : normalizeIdKey(animal.id);
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

      await submeter(() => onSave?.({
        tipo: 'animal_batch',
        lote_id: form.lote_id ? Number(form.lote_id) : null,
        expectedHeadCount,
        registros,
      }));
      return;
    }

    await submeter(() => onSave?.({
      tipo: 'lote',
      origem: 'lote',
      lote_id: form.lote_id ? Number(form.lote_id) : null,
      data: form.data,
      peso_medio: Number(form.peso_medio),
      quantidade_pesada: form.quantidade_pesada === '' ? null : Number(form.quantidade_pesada),
      observacao: form.observacao.trim(),
    }));
  }

  const titulo = initialData?.id ? 'Editar pesagem' : 'Nova pesagem';

  // Checagem leve só para o estado do botão — handleSubmit roda a validação
  // completa (validarForm) e mostra a mensagem de erro específica no submit.
  const faltaCampoObrigatorio = !form.lote_id || !form.data
    || (form.tipo === 'lote' && !form.peso_medio);

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
              ? `Pesagem vinculada ao lote ${loteSelecionado.nome || 'selecionado'}. Quantidade sugerida: ${expectedHeadCount} ${expectedHeadCount === 1 ? 'cabeça' : 'cabeças'}.`
              : 'Registre a pesagem para acompanhar GMD, evolução do lote e ponto de venda.'}
          </span>
        </div>

        <section className="pesagem-form-section-block section-card">
          <div className="pesagem-form-section-head">Tipo e referência</div>
          <div className="pesagem-form-section">
            <label className="pesagem-form-field">
              Tipo de pesagem
              <select className="ui-input" name="tipo" value={form.tipo} onChange={handleChange}>
                <option value="lote">Por lote</option>
                <option value="animal">Por animal</option>
              </select>
            </label>

            <label className="pesagem-form-field">
              Lote
              <select className="ui-input" name="lote_id" value={form.lote_id} onChange={handleChange}>
                <option value="">Selecione</option>
                {lotes.map((lote) => (
                  <option key={lote.id} value={lote.id}>{lote.nome}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {form.tipo === 'animal' ? (
          <section className="pesagem-form-section-block section-card">
            <div className="pesagem-form-section-head">Pesagem individual por lote</div>
            {!hasSelectedLote ? (
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Selecione um lote para carregar os animais.
              </p>
            ) : linhasAnimais.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Nenhum animal individual encontrado para este lote.
              </p>
            ) : (
              <div className="responsive-table-wrap fazendas-table-wrap">
                <table className="data-table herdon-table">
                  <thead>
                    <tr>
                      <th>Animal</th>
                      <th>Peso atual (kg)</th>
                      <th>Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasAnimais.map((animal) => {
                      const key = animal.virtual ? `virtual-${animal.virtualIndex}` : String(Number(animal.id));
                      const nomeAnimal = animal.identificacao || animal.nome || `Animal #${animal.rowIndex}`;
                      return (
                        <tr key={key}>
                          <td>{nomeAnimal}</td>
                          <td>
                            <input
                              className="ui-input"
                              type="number"
                              step="0.01"
                              min={0}
                              value={pesosAnimais[key] ?? ''}
                              onChange={(event) => {
                                const value = event.target.value;
                                setPesosAnimais((prev) => ({ ...prev, [key]: value }));
                              }}
                              placeholder="Ex.: 412"
                            />
                          </td>
                          <td>
                            <input
                              className="ui-input"
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
            )}
          </section>
        ) : null}

        <section className="pesagem-form-section-block section-card">
          <div className="pesagem-form-section-head">{form.tipo === 'animal' ? 'Data da pesagem' : 'Medição'}</div>
          <div className="grid-2 pesagem-form-grid">
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

            {form.tipo === 'lote' ? (
              <>
                <label className="pesagem-form-field">
                  Peso médio (kg)
                  <input className="ui-input" name="peso_medio" type="number" step="0.01" min={0} value={form.peso_medio} onChange={handleChange} placeholder="Ex.: 412" />
                </label>
                <label className="pesagem-form-field">
                  Quantidade pesada (cabeças)
                  <input className="ui-input" name="quantidade_pesada" type="number" step="1" min={0} value={form.quantidade_pesada} onChange={handleChange} placeholder="Ex.: 80" />
                  {hasSelectedLote && expectedHeadCount === 0 ? (
                    <small style={{ color: 'var(--color-warning, #b45309)', fontSize: '0.78rem' }}>
                      Este lote não tem quantidade de cabeças cadastrada. Informe manualmente.
                    </small>
                  ) : null}
                </label>
              </>
            ) : null}
          </div>
        </section>

        {form.tipo === 'lote' ? (
          <label className="pesagem-form-field">
            Observação
            <input
              className="ui-input"
              name="observacao"
              value={form.observacao}
              onChange={handleChange}
              placeholder="Ex.: ganho acima do esperado"
            />
          </label>
        ) : null}

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
            peso={form.tipo === 'animal'
              ? (() => {
                  const values = Object.values(pesosAnimais)
                    .map((value) => Number(String(value).replace(',', '.')))
                    .filter((value) => Number.isFinite(value) && value > 0);
                  if (!values.length) return 0;
                  const total = values.reduce((sum, value) => sum + value, 0);
                  return total / values.length;
                })()
              : form.peso_medio}
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
