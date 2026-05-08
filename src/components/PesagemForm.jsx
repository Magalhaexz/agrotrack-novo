import { useEffect, useState } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import ArrobaPreview from './ArrobaPreview';

const FORM_VAZIO = {
  tipo: 'lote',
  lote_id: '',
  data: '',
  peso_medio: '',
  observacao: '',
  rendimento_carcaca: 52,
  preco_arroba: '',
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
  onSave,
  onCancel,
}) {
  const [form, setForm] = useState(() => normalizarInitialData(initialData));
  const [erro, setErro] = useState('');
  const [pesosAnimais, setPesosAnimais] = useState({});
  const [observacoesAnimais, setObservacoesAnimais] = useState({});

  const animaisDoLote = animais.filter(
    (animal) => Number(animal?.lote_id) === Number(form.lote_id)
  );

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
      const registros = animaisDoLote
        .map((animal) => {
          const animalId = Number(animal.id);
          const pesoBruto = String(pesosAnimais[animalId] ?? '').trim();
          if (!pesoBruto) return null;
          const peso = Number(pesoBruto.replace(',', '.'));
          if (!Number.isFinite(peso) || peso <= 0) return null;

          return {
            tipo: 'animal',
            origem: 'animal',
            lote_id: form.lote_id ? Number(form.lote_id) : null,
            animal_id: animalId,
            data: form.data,
            peso_medio: peso,
            rendimento_carcaca: Number(form.rendimento_carcaca || 0),
            preco_arroba: form.preco_arroba === '' ? null : Number(form.preco_arroba),
            observacao: String(observacoesAnimais[animalId] ?? '').trim(),
          };
        })
        .filter(Boolean);

      if (!registros.length) {
        setErro('Informe ao menos um peso valido para salvar.');
        return;
      }

      onSave?.({
        tipo: 'animal_batch',
        registros,
      });
      return;
    }

    onSave?.({
      tipo: 'lote',
      origem: 'lote',
      lote_id: form.lote_id ? Number(form.lote_id) : null,
      animal_id: null,
      data: form.data,
      peso_medio: Number(form.peso_medio),
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
            {!form.lote_id ? (
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Selecione um lote para listar os animais.
              </p>
            ) : animaisDoLote.length === 0 ? (
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
                    {animaisDoLote.map((animal) => {
                      const animalId = Number(animal.id);
                      const nomeAnimal = animal.identificacao || animal.nome || `Animal #${animalId}`;
                      return (
                        <tr key={animal.id}>
                          <td>{nomeAnimal}</td>
                          <td>
                            <input
                              className="ui-input"
                              type="number"
                              step="0.01"
                              min={0}
                              value={pesosAnimais[animalId] ?? ''}
                              onChange={(event) => {
                                const value = event.target.value;
                                setPesosAnimais((prev) => ({ ...prev, [animalId]: value }));
                              }}
                              placeholder="Ex: 412"
                            />
                          </td>
                          <td>
                            <input
                              className="ui-input"
                              value={observacoesAnimais[animalId] ?? ''}
                              onChange={(event) => {
                                const value = event.target.value;
                                setObservacoesAnimais((prev) => ({ ...prev, [animalId]: value }));
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
          <div className="pesagem-form-section-head">Medicao</div>
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

          <label className="pesagem-form-field">
            Peso medio (kg)
            <input
              className="ui-input"
              name="peso_medio"
              type="number"
              step="0.01"
              min={0}
              value={form.peso_medio}
              onChange={handleChange}
              placeholder="Ex: 412"
              disabled={form.tipo === 'animal'}
            />
          </label>
        </div>
        </section>

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
            peso={form.peso_medio}
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
