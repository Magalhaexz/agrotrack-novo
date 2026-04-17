import { useEffect, useState } from 'react';

const vazio = {
  lote_id: '',
  sexo: 'macho',
  gen: '',
  qtd: '',
  p_ini: '',
  p_at: '',
  dias: '',
  consumo: '',
};

export default function AnimalForm({
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
        sexo: initialData.sexo || 'macho',
        gen: initialData.gen || '',
        qtd: initialData.qtd ?? '',
        p_ini: initialData.p_ini ?? '',
        p_at: initialData.p_at ?? '',
        dias: initialData.dias ?? '',
        consumo: initialData.consumo ?? '',
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

    if (!form.gen.trim()) {
      alert('Informe a genética/raça.');
      return;
    }

    if (!form.qtd) {
      alert('Informe a quantidade.');
      return;
    }

    onSave({
      lote_id: Number(form.lote_id),
      sexo: form.sexo,
      gen: form.gen.trim(),
      qtd: Number(form.qtd || 0),
      p_ini: Number(form.p_ini || 0),
      p_at: Number(form.p_at || 0),
      dias: Number(form.dias || 0),
      consumo: Number(form.consumo || 0),
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
            {initialData ? 'Editar animais' : 'Novo grupo de animais'}
          </span>
        </div>

        <div className="card-body">
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
            <div style={grid2}>
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

              <div>
                <label style={labelStyle}>Sexo</label>
                <select
                  name="sexo"
                  value={form.sexo}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="macho">Macho</option>
                  <option value="fêmea">Fêmea</option>
                </select>
              </div>
            </div>

            <div style={grid2}>
              <div>
                <label style={labelStyle}>Genética / raça</label>
                <input
                  name="gen"
                  value={form.gen}
                  onChange={handleChange}
                  placeholder="Ex: Nelore PO, Brangus, Cruzado"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Quantidade</label>
                <input
                  name="qtd"
                  type="number"
                  value={form.qtd}
                  onChange={handleChange}
                  placeholder="Ex: 80"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={grid2}>
              <div>
                <label style={labelStyle}>Peso inicial (kg)</label>
                <input
                  name="p_ini"
                  type="number"
                  step="0.01"
                  value={form.p_ini}
                  onChange={handleChange}
                  placeholder="Ex: 320"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Peso atual (kg)</label>
                <input
                  name="p_at"
                  type="number"
                  step="0.01"
                  value={form.p_at}
                  onChange={handleChange}
                  placeholder="Ex: 440"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={grid2}>
              <div>
                <label style={labelStyle}>Dias no lote</label>
                <input
                  name="dias"
                  type="number"
                  value={form.dias}
                  onChange={handleChange}
                  placeholder="Ex: 120"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Consumo (kg/dia)</label>
                <input
                  name="consumo"
                  type="number"
                  step="0.01"
                  value={form.consumo}
                  onChange={handleChange}
                  placeholder="Ex: 12.5"
                  style={inputStyle}
                />
              </div>
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
                Salvar
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