import { useEffect, useState } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import ArrobaPreview from './ArrobaPreview';

const FORM_VAZIO = {
  tipo: 'lote',
  lote_id: '',
  animal_id: '',
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
    animal_id: data.animal_id ?? '',
    data: data.data || '',
    peso_medio: data.peso_medio ?? '',
    observacao: data.observacao || '',
    rendimento_carcaca: data.rendimento_carcaca ?? 52,
    preco_arroba: data.preco_arroba ?? '',
  };
}

function validarForm(form) {
  if (!form.lote_id) return 'Selecione o lote.';
  if (form.tipo === 'animal' && !form.animal_id) return 'Selecione o animal.';
  if (!form.data) return 'Informe a data da pesagem.';
  if (!form.peso_medio) return 'Informe o peso medio.';
  if (Number(form.peso_medio || 0) <= 0) return 'Peso medio deve ser maior que zero.';
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

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setForm(normalizarInitialData(initialData));
    setErro('');
  }, [initialData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => {
      if (name === 'tipo') {
        return {
          ...prev,
          tipo: value,
          animal_id: value === 'animal' ? prev.animal_id : '',
        };
      }

      if (name === 'animal_id') {
        const animalSelecionado = animais.find((item) => Number(item.id) === Number(value));
        return {
          ...prev,
          animal_id: value,
          lote_id: animalSelecionado?.lote_id ? String(animalSelecionado.lote_id) : prev.lote_id,
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
    onSave?.({
      tipo: form.tipo === 'animal' ? 'animal' : 'lote',
      origem: form.tipo === 'animal' ? 'animal' : 'lote',
      lote_id: Number(form.lote_id),
      animal_id: form.tipo === 'animal' ? Number(form.animal_id) : null,
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
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
        <label>
          Tipo de pesagem
          <select className="ui-input" name="tipo" value={form.tipo} onChange={handleChange}>
            <option value="lote">Por lote</option>
            <option value="animal">Por animal</option>
          </select>
        </label>

        <label>
          Lote
          <select className="ui-input" name="lote_id" value={form.lote_id} onChange={handleChange}>
            <option value="">Selecione</option>
            {lotes.map((lote) => (
              <option key={lote.id} value={lote.id}>{lote.nome}</option>
            ))}
          </select>
        </label>

        {form.tipo === 'animal' && (
          <label>
            Animal
            <select className="ui-input" name="animal_id" value={form.animal_id} onChange={handleChange}>
              <option value="">Selecione</option>
              {animais.map((animal) => (
                <option key={animal.id} value={animal.id}>
                  {animal.identificacao || animal.nome || `Animal #${animal.id}`}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="grid-2">
          <label>
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

          <label>
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
            />
          </label>
        </div>

        <label>
          Observacao
          <input
            className="ui-input"
            name="observacao"
            value={form.observacao}
            onChange={handleChange}
            placeholder="Ex: ganho acima do esperado"
          />
        </label>

        <div className="grid-2">
          <label>
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

          <label>
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

        <ArrobaPreview
          peso={form.peso_medio}
          rendimento={form.rendimento_carcaca}
          precoPorArroba={form.preco_arroba}
        />

        {erro && (
          <p style={{ margin: 0, color: 'var(--color-danger)', fontSize: '0.85rem' }}>
            {erro}
          </p>
        )}
      </form>
    </Modal>
  );
}
