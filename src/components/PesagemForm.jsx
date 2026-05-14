import { useEffect, useMemo, useState } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import ArrobaPreview from './ArrobaPreview';

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
  if (!data) return FORM_VAZIO;
  return {
    tipo: data.tipo || data.origem || 'lote',
    lote_id: data.lote_id ?? '',
    data: data.data || '',
    peso_medio: data.peso_medio ?? '',
    observacao: data.observacao || '',
    rendimento_carcaca: data.rendimento_carcaca ?? 52,
    preco_arroba: data.preco_arroba ?? '',
    quantidade_pesada: data.quantidade_pesada ?? '',
  };
}

function validarForm(form) {
  if (form.tipo === 'lote' && !form.lote_id) return 'Selecione o lote.';
  if (!form.data) return 'Informe a data da pesagem.';
  if (form.tipo === 'lote') {
    if (!form.peso_medio) return 'Informe o peso medio.';
    if (Number(form.peso_medio || 0) <= 0) return 'Peso medio deve ser maior que zero.';
  }
  if (Number(form.rendimento_carcaca || 0) <= 0) return 'Rendimento de carcaca deve ser maior que zero.';
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
  const [form, setForm] = useState(() => normalizarInitialData(initialData));
  const [erro, setErro] = useState('');
  const [pesosAnimais, setPesosAnimais] = useState({});
  const [observacoesAnimais, setObservacoesAnimais] = useState({});
  const hasSelectedLote = Boolean(form.lote_id);
  const safeAnimais = Array.isArray(animais) ? animais : [];
  const safeLotes = Array.isArray(lotes) ? lotes : [];
  const safePesagens = Array.isArray(pesagens) ? pesagens : [];

  const animaisDoLote = hasSelectedLote
    ? safeAnimais.filter((animal) => Number(animal?.lote_id) === Number(form.lote_id))
    : [];
  const animaisIndividuais = animaisDoLote.filter((animal) => isIndividualAnimal(animal));
  const loteSelecionado = hasSelectedLote
    ? (safeLotes.find((lote) => Number(lote?.id) === Number(form.lote_id)) || null)
    : null;
  const expectedHeadCount = hasSelectedLote ? getExpectedHeadCount(loteSelecionado, animaisDoLote) : 0;

  const animalsByIndex = new Map();
  animaisIndividuais.forEach((animal, idx) => {
    const index = getAnimalIndex(animal, idx + 1);
    if (!index || animalsByIndex.has(index)) return;
    animalsByIndex.set(index, animal);
  });

  const rowCount = Math.max(0, Number(expectedHeadCount || 0), animalsByIndex.size);
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
    safePesagens
      .filter((item) => (
        String(item?.data || '') === String(form.data)
        && Number(item?.lote_id) === Number(form.lote_id)
        && (item?.tipo === 'animal' || item?.origem === 'animal')
      ))
      .forEach((item) => {
        const animalId = Number(item?.animal_id);
        if (animalId > 0 && !map.has(animalId)) {
          map.set(animalId, item);
        }
      });
    return map;
  }, [form.tipo, form.data, form.lote_id, safePesagens]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setForm(normalizarInitialData(initialData));
    setErro('');

    if (initialData?.tipo === 'animal' || initialData?.origem === 'animal') {
      const animalId = Number(initialData?.animal_id);
      if (animalId > 0) {
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
        const animalId = Number(animal.id);
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
        const animalId = Number(animal.id);
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

  function handleSubmit(e) {
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
          const key = animal.virtual ? `virtual-${animal.virtualIndex}` : String(Number(animal.id));
          const pesoBruto = String(pesosAnimais[key] ?? '').trim();
          if (!pesoBruto) return null;
          const peso = Number(pesoBruto.replace(',', '.'));
          if (!Number.isFinite(peso) || peso <= 0) return null;
          const base = {
            tipo: 'animal',
            origem: 'animal',
            lote_id: form.lote_id ? Number(form.lote_id) : null,
            animal_id: animal.virtual ? null : Number(animal.id),
            data: form.data,
            peso_medio: peso,
            rendimento_carcaca: Number(form.rendimento_carcaca || 0),
            preco_arroba: form.preco_arroba === '' ? null : Number(form.preco_arroba),
            observacao: String(observacoesAnimais[key] ?? '').trim(),
          };
          if (!base.lote_id || !base.data || !base.peso_medio) return null;
          if (animal.virtual) {
            base.virtual_animal = {
              identificacao: animal.identificacao,
              index: animal.virtualIndex,
            };
          }
          return base;
        })
        .filter(Boolean);

      if (!registros.length) {
        setErro('Informe ao menos um peso valido para salvar.');
        return;
      }

      onSave?.({
        tipo: 'animal_batch',
        lote_id: form.lote_id ? Number(form.lote_id) : null,
        expectedHeadCount,
        registros,
      });
      return;
    }

    onSave?.({
      tipo: 'lote',
      origem: 'lote',
      lote_id: form.lote_id ? Number(form.lote_id) : null,
      data: form.data,
      peso_medio: Number(form.peso_medio),
      quantidade_pesada: form.quantidade_pesada === '' ? null : Number(form.quantidade_pesada),
      observacao: form.observacao.trim(),
    });
  }

  const titulo = initialData ? 'Editar pesagem' : 'Nova pesagem';

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      <Button onClick={handleSubmit}>Salvar pesagem</Button>
    </div>
  );

  return (
    <Modal open onClose={onCancel} title={titulo} footer={footer}>
      <form onSubmit={handleSubmit} className="pesagem-form">
        <section className="pesagem-form-section-block">
        <div className="pesagem-form-section-head">Tipo e referencia</div>
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

        {form.tipo === 'animal' && (
          <section className="pesagem-form-section-block">
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
              <div className="fazendas-table-wrap">
                <table className="data-table herdon-table">
                  <thead>
                    <tr>
                      <th>Animal</th>
                      <th>Peso atual kg</th>
                      <th>Observacao</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasAnimais.map((animal) => {
                      const key = animal.virtual ? `virtual-${animal.virtualIndex}` : String(Number(animal.id));
                      const nomeAnimal = animal.identificacao || animal.nome || `Animal #${animal.rowIndex}`;
                      return (
                        <tr key={key}>
                          <td>
                            {nomeAnimal}
                          </td>
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
                              placeholder="Ex: 412"
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
                              placeholder="Observacao opcional"
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
        )}

        <section className="pesagem-form-section-block">
          <div className="pesagem-form-section-head">{form.tipo === 'animal' ? 'Data da pesagem' : 'Medicao'}</div>
        <div className="grid-2 pesagem-form-grid">
          <label className="pesagem-form-field">
            Data
            <input
              className="ui-input"
              name="data"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={form.data}
              onChange={handleChange}
            />
          </label>

          {form.tipo === 'lote' && (
            <>
              <label className="pesagem-form-field">
                Peso medio (kg)
                <input className="ui-input" name="peso_medio" type="number" step="0.01" min={0} value={form.peso_medio} onChange={handleChange} placeholder="Ex: 412" />
              </label>
              <label className="pesagem-form-field">
                Quantidade pesada (cabecas)
                <input className="ui-input" name="quantidade_pesada" type="number" step="1" min={0} value={form.quantidade_pesada} onChange={handleChange} placeholder="Ex: 80" />
              </label>
            </>
          )}
        </div>
        </section>

        {form.tipo === 'lote' && (
          <label className="pesagem-form-field">
            Observacao
            <input
              className="ui-input"
              name="observacao"
              value={form.observacao}
              onChange={handleChange}
              placeholder="Ex: ganho acima do esperado"
            />
          </label>
        )}

        <section className="pesagem-form-section-block">
          <div className="pesagem-form-section-head">Indicadores de valor</div>
        <div className="grid-2 pesagem-form-grid">
          <label className="pesagem-form-field">
            Rendimento de carcaca (%)
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
            Preco por @ (opcional)
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
              ? (
                (() => {
                  const values = Object.values(pesosAnimais)
                    .map((value) => Number(String(value).replace(',', '.')))
                    .filter((value) => Number.isFinite(value) && value > 0);
                  if (!values.length) return 0;
                  const total = values.reduce((sum, value) => sum + value, 0);
                  return total / values.length;
                })()
              )
              : form.peso_medio}
            rendimento={form.rendimento_carcaca}
            precoPorArroba={form.preco_arroba}
          />
        </div>

        {erro && (
          <p style={{ margin: 0, color: 'var(--color-danger)', fontSize: '0.85rem' }}>
            {erro}
          </p>
        )}
      </form>
    </Modal>
  );
}
