import { useEffect, useState } from 'react';

const vazio = {
  nome: '',
  local: '',
  resp: '',
};

export default function FazendaForm({ initialData, onSave, onCancel }) {
  const [form, setForm] = useState(vazio);

  useEffect(() => {
    if (initialData) {
      setForm({
        nome: initialData.nome || '',
        local: initialData.local || '',
        resp: initialData.resp || '',
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

    if (!form.nome.trim()) {
      alert('Informe o nome da fazenda.');
      return;
    }

    onSave({
      nome: form.nome.trim(),
      local: form.local.trim(),
      resp: form.resp.trim(),
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
          maxWidth: '520px',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        <div className="card-header">
          <span className="card-title">
            {initialData ? 'Editar fazenda' : 'Nova fazenda'}
          </span>
        </div>

        <div className="card-body">
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6 }}>Nome da fazenda</label>
              <input
                name="nome"
                value={form.nome}
                onChange={handleChange}
                placeholder="Ex: Fazenda Santa Rita"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6 }}>Localização</label>
              <input
                name="local"
                value={form.local}
                onChange={handleChange}
                placeholder="Ex: Uberaba, MG"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6 }}>Responsável</label>
              <input
                name="resp"
                value={form.resp}
                onChange={handleChange}
                placeholder="Ex: João Silva"
                style={inputStyle}
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '8px',
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

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '10px',
  border: '1px solid #2e4020',
  background: '#0f160b',
  color: '#cce0a8',
  outline: 'none',
};

const cancelBtn = {
  padding: '10px 14px',
  borderRadius: '10px',
  border: '1px solid #2e4020',
  background: 'transparent',
  color: '#7a9e62',
  cursor: 'pointer',
};

const saveBtn = {
  padding: '10px 14px',
  borderRadius: '10px',
  border: 'none',
  background: '#6bb520',
  color: '#081006',
  fontWeight: 700,
  cursor: 'pointer',
};
