import { useEffect, useMemo, useState } from 'react';

const vazio = {
  lote_id: '',
  item_estoque_id: '',
  modo: 'por_cabeca',
  consumo_por_cabeca_dia: '',
  consumo_total_dia: '',
  obs: '',
};

export default function SuplementacaoForm({
  initialData,
  lotes = [],
  estoque = [],
  onSave,
  onCancel,
}) {
  const [form, setForm] = useState(vazio);

  const itensDisponiveis = useMemo(() => {
    return estoque.filter((item) =>
      ['insumo', 'ração', 'mineral', 'outros'].includes(
        String(item.categoria || '').toLowerCase()
      )
    );
  }, [estoque]);

  useEffect(() => {
    if (initialData) {
      setForm({
        lote_id: initialData.lote_id ?? '',
        item_estoque_id: initialData.item_estoque_id ?? '',
        modo: initialData.modo || 'por_cabeca',
        consumo_por_cabeca_dia: initialData.consumo_por_cabeca_dia ?? '',
        consumo_total_dia: initialData.consumo_total_dia ?? '',
        obs: initialData.obs || '',
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

    if (!form.item_estoque_id) {
      alert('Selecione o item do estoque.');
      return;
    }

    if (
      form.modo === 'por_cabeca' &&
      !Number(form.consumo_por_cabeca_dia || 0)
    ) {
      alert('Informe o consumo por cabeça/dia.');
      return;
    }

    if (
      form.modo === 'total_lote' &&
      !Number(form.consumo_total_dia || 0)
    ) {
      alert('Informe o consumo total do lote/dia.');
      return;
    }

    onSave({
      lote_id: Number(form.lote_id),
      item_estoque_id: Number(form.item_estoque_id),
      modo: form.modo,
      consumo_por_cabeca_dia: Number(form.consumo_por_cabeca_dia || 0),
      consumo_total_dia: Number(form.consumo_total_dia || 0),
      obs: form.obs.trim(),
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
          maxWidth: '640px',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        <div className="card-header">
          <span className="card-title">
            {initialData ? 'Editar suplementação' : 'Nova suplementação'}
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
                <label style={labelStyle}>Item do estoque</label>
                <select
                  name="item_estoque_id"
                  value={form.item_estoque_id}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="">Selecione</option>
                  {itensDisponiveis.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.produto}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Modo de consumo</label>
              <select
                name="modo"
                value={form.modo}
                onChange={handleChange}
                style={inputStyle}
              >
                <option value="por_cabeca">Por cabeça / dia</option>
                <option value="total_lote">Total do lote / dia</option>
              </select>
            </div>

            {form.modo === 'por_cabeca' ? (
              <div>
                <label style={labelStyle}>Consumo por cabeça / dia</label>
                <input
                  name="consumo_por_cabeca_dia"
                  type="number"
                  step="0.001"
                  value={form.consumo_por_cabeca_dia}
                  onChange={handleChange}
                  placeholder="Ex: 0.500"
                  style={inputStyle}
                />
              </div>
            ) : (
              <div>
                <label style={labelStyle}>Consumo total do lote / dia</label>
                <input
                  name="consumo_total_dia"
                  type="number"
                  step="0.001"
                  value={form.consumo_total_dia}
                  onChange={handleChange}
                  placeholder="Ex: 48"
                  style={inputStyle}
                />
              </div>
            )}

            <div>
              <label style={labelStyle}>Observação</label>
              <input
                name="obs"
                value={form.obs}
                onChange={handleChange}
                placeholder="Opcional"
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
                Salvar suplementação
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