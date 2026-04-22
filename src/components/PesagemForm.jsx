import { useEffect, useState } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import ArrobaPreview from './ArrobaPreview';

const FORM_VAZIO = {
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
    lote_id: data.lote_id ?? '',
    data: data.data || '',
    peso_medio: data.peso_medio ?? '',
    observacao: data.observacao || '',
    rendimento_carcaca: data.rendimento_carcaca ?? 52,
    preco_arroba: data.preco_arroba ?? '',
  };
}

function validarForm(form) {
  if (!form.lote_id) return 'Selecione o lote.';
  if (!form.data) return 'Informe a data da pesagem.';
  if (!form.peso_medio) return 'Informe o peso médio.';
  if (Number(form.peso_medio || 0) <= 0) return 'Peso médio deve ser maior que zero.';
  if (Number(form.rendimento_carcaca || 0) <= 0) return 'Rendimento de carcaça deve ser maior que zero.';
  return null;
}

export default function PesagemForm({ initialData, lotes = [], onSave, onCancel }) {
  const [form, setForm] = useState(() => normalizarInitialData(initialData));
  const [erro, setErro] = useState('');

  useEffect(() => {
    setForm(normalizarInitialData(initialData));
    setErro('');
  }, [initialData]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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
      lote_id: Number(form.lote_id),
      data: form.data,
      peso_medio: Number(form.peso_medio),
      observacao: form.observacao.trim(),
      // Estes campos são usados no ArrobaPreview, mas não são salvos diretamente no onSave
      // Se precisarem ser salvos, devem ser incluídos aqui.
      // rendimento_carcaca: Number(form.rendimento_carcaca),
      // preco_arroba: Number(form.preco_arroba),
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
          Lote
          <select className="ui-input" name="lote_id" value={form.lote_id} onChange={handleChange}>
            <option value="">Selecione</option>
            {lotes.map((lote) => (
              <option key={lote.id} value={lote.id}>{lote.nome}</option>
            ))}
          </select>
        </label>

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
            Peso médio (kg)
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
          Observação
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
            Rendimento de carcaça (%)
            <input
              className="ui-input"
              name="rendimento_carcaca"
              type="number"
              step="0.1"
              min={0}
              max={100} // Adicionado max para rendimento
              value={form.rendimento_carcaca}
              onChange={handleChange}
            />
          </label>

          <label>
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
