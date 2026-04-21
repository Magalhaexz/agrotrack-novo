import { useEffect, useState } from 'react';
<<<<<<< HEAD
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import ArrobaPreview from './ArrobaPreview';

const FORM_VAZIO = {
=======
import ArrobaPreview from './ArrobaPreview';

const vazio = {
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  lote_id: '',
  data: '',
  peso_medio: '',
  observacao: '',
  rendimento_carcaca: 52,
  preco_arroba: '',
};

<<<<<<< HEAD
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
=======
export default function PesagemForm({
  initialData,
  lotes = [],
  onSave,
  onCancel,
}) {
  const [form, setForm] = useState(vazio);

  useEffect(() => {
    if (initialData) {
      setForm({
        lote_id: initialData.lote_id ?? '',
        data: initialData.data || '',
        peso_medio: initialData.peso_medio ?? '',
        observacao: initialData.observacao || '',
        rendimento_carcaca: initialData.rendimento_carcaca ?? 52,
        preco_arroba: initialData.preco_arroba ?? '',
      });
    } else {
      setForm(vazio);
    }
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  }, [initialData]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
<<<<<<< HEAD
    const erroValidacao = validarForm(form);

    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    setErro('');
    onSave?.({
=======

    if (!form.lote_id) {
      alert('Selecione o lote.');
      return;
    }

    if (!form.data) {
      alert('Informe a data da pesagem.');
      return;
    }

    if (!form.peso_medio) {
      alert('Informe o peso médio.');
      return;
    }

    if (Number(form.peso_medio || 0) <= 0) {
      alert('Peso médio deve ser maior que zero.');
      return;
    }

    if (Number(form.rendimento_carcaca || 0) <= 0) {
      alert('Rendimento de carcaça deve ser maior que zero.');
      return;
    }

    onSave({
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
      lote_id: Number(form.lote_id),
      data: form.data,
      peso_medio: Number(form.peso_medio),
      observacao: form.observacao.trim(),
<<<<<<< HEAD
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
=======
    });
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        zIndex: 999,
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '560px',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        <div className="card-header">
          <span className="card-title">
            {initialData ? 'Editar pesagem' : 'Nova pesagem'}
          </span>
        </div>

        <div className="card-body">
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={labelStyle}>Lote</label>
              <select
                name="lote_id"
                value={form.lote_id}
                onChange={handleChange}
                style={inputStyle}
              >
                <option value="">Selecione</option>
                {lotes.map((lote) => (
                  <option key={lote.id} value={lote.id}>
                    {lote.nome}
                  </option>
                ))}
              </select>
            </div>

            <div style={grid2}>
              <div>
                <label style={labelStyle}>Data</label>
                <input
                  name="data"
                  type="date"
      max={new Date().toISOString().slice(0, 10)}
                  value={form.data}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Peso médio (kg)</label>
                <input
                  name="peso_medio"
                  type="number"
                  step="0.01"
      min="0"
                  value={form.peso_medio}
                  onChange={handleChange}
                  placeholder="Ex: 412"
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Observação</label>
              <input
                name="observacao"
                value={form.observacao}
                onChange={handleChange}
                placeholder="Ex: ganho acima do esperado"
                style={inputStyle}
              />
            </div>

            <div style={grid2}>
              <div>
                <label style={labelStyle}>Rendimento de carcaça (%)</label>
                <input
                  name="rendimento_carcaca"
                  type="number"
                  step="0.1"
      min="0"
                  value={form.rendimento_carcaca}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Preço por @ (opcional)</label>
                <input
                  name="preco_arroba"
                  type="number"
                  step="0.01"
      min="0"
                  value={form.preco_arroba}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
            </div>

            <ArrobaPreview
              peso={form.peso_medio}
              rendimento={form.rendimento_carcaca}
              precoPorArroba={form.preco_arroba}
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 8,
              }}
            >
              <button type="button" onClick={onCancel} style={cancelBtn}>
                Cancelar
              </button>
              <button type="submit" style={saveBtn}>
                Salvar pesagem
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  marginBottom: 6,
  fontSize: 12,
};

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid #2e4020',
  background: '#0f160b',
  color: '#cce0a8',
  outline: 'none',
};

const cancelBtn = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #2e4020',
  background: 'transparent',
  color: '#7a9e62',
  cursor: 'pointer',
};

const saveBtn = {
  padding: '10px 14px',
  borderRadius: 10,
  border: 'none',
  background: '#6bb520',
  color: '#081006',
  fontWeight: 700,
  cursor: 'pointer',
};

const grid2 = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 14,
};
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
