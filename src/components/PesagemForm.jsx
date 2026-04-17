import { useEffect, useState } from 'react';

const vazio = {
  lote_id: '',
  data: '',
  peso_medio: '',
  observacao: '',
};

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
      });
    } else {
      setForm(vazio);
    }
  }, [initialData]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();

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

    onSave({
      lote_id: Number(form.lote_id),
      data: form.data,
      peso_medio: Number(form.peso_medio),
      observacao: form.observacao.trim(),
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