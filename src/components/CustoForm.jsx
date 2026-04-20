import { useEffect, useState } from 'react';

const vazio = {
  lote_id: '',
  cat: 'alimentação',
  desc: '',
  data: '',
  val: '',
};

export default function CustoForm({
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
        cat: initialData.cat || 'alimentação',
        desc: initialData.desc || '',
        data: initialData.data || '',
        val: initialData.val ?? '',
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

    if (!form.desc.trim()) {
      alert('Informe a descrição do custo.');
      return;
    }

    if (!form.data) {
      alert('Informe a data.');
      return;
    }

    if (!form.val) {
      alert('Informe o valor.');
      return;
    }

    if (Number(form.val || 0) <= 0) {
      alert('Valor deve ser maior que zero.');
      return;
    }

    onSave({
      lote_id: Number(form.lote_id),
      cat: form.cat,
      desc: form.desc.trim(),
      data: form.data,
      val: Number(form.val || 0),
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
          maxWidth: '620px',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        <div className="card-header">
          <span className="card-title">
            {initialData ? 'Editar custo' : 'Novo custo'}
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
                <label style={labelStyle}>Categoria</label>
                <select
                  name="cat"
                  value={form.cat}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="alimentação">Alimentação</option>
                  <option value="sanitário">Sanitário</option>
                  <option value="mão de obra">Mão de obra</option>
                  <option value="combustível">Combustível</option>
                  <option value="manutenção">Manutenção</option>
                  <option value="administrativo">Administrativo</option>
                  <option value="outros">Outros</option>
                </select>
              </div>

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
            </div>

            <div>
              <label style={labelStyle}>Descrição</label>
              <input
                name="desc"
                value={form.desc}
                onChange={handleChange}
                placeholder="Ex: Compra de silagem, vacina, diesel..."
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Valor (R$)</label>
              <input
                name="val"
                type="number"
                step="0.01"
      min="0"
                value={form.val}
                onChange={handleChange}
                placeholder="0,00"
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
                Salvar custo
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
};

const saveBtn = {
  padding: '10px 14px',
  borderRadius: 10,
  border: 'none',
  background: '#6bb520',
  color: '#081006',
  fontWeight: 700,
};

const grid2 = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 14,
};
