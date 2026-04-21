import { useEffect, useMemo, useState } from 'react';
<<<<<<< HEAD
import Modal from '../ui/Modal';
import Button from '../ui/Button';

const FORM_VAZIO = {
=======

const vazio = {
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  lote_id: '',
  item_estoque_id: '',
  modo: 'por_cabeca',
  consumo_por_cabeca_dia: '',
  consumo_total_dia: '',
  obs: '',
};

<<<<<<< HEAD
function normalizarInitialData(data) {
  if (!data) return FORM_VAZIO;
  return {
    lote_id: data.lote_id ?? '',
    item_estoque_id: data.item_estoque_id ?? '',
    modo: data.modo || 'por_cabeca',
    consumo_por_cabeca_dia: data.consumo_por_cabeca_dia ?? '',
    consumo_total_dia: data.consumo_total_dia ?? '',
    obs: data.obs || '',
  };
}

function validarForm(form) {
  if (!form.lote_id) return 'Selecione o lote.';
  if (!form.item_estoque_id) return 'Selecione o item do estoque.';

  if (form.modo === 'por_cabeca') {
    if (!Number(form.consumo_por_cabeca_dia || 0)) return 'Informe o consumo por cabeça/dia.';
    if (Number(form.consumo_por_cabeca_dia || 0) <= 0) return 'Consumo por cabeça/dia deve ser maior que zero.';
  } else { // modo === 'total_lote'
    if (!Number(form.consumo_total_dia || 0)) return 'Informe o consumo total do lote/dia.';
    if (Number(form.consumo_total_dia || 0) <= 0) return 'Consumo total do lote/dia deve ser maior que zero.';
  }
  return null;
}

=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
export default function SuplementacaoForm({
  initialData,
  lotes = [],
  estoque = [],
  onSave,
  onCancel,
}) {
<<<<<<< HEAD
  const [form, setForm] = useState(() => normalizarInitialData(initialData));
  const [erro, setErro] = useState('');
=======
  const [form, setForm] = useState(vazio);
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d

  const itensDisponiveis = useMemo(() => {
    return estoque.filter((item) =>
      ['insumo', 'ração', 'mineral', 'outros'].includes(
        String(item.categoria || '').toLowerCase()
      )
    );
  }, [estoque]);

  useEffect(() => {
<<<<<<< HEAD
    setForm(normalizarInitialData(initialData));
    setErro('');
=======
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

    if (
      form.modo === 'por_cabeca' &&
      Number(form.consumo_por_cabeca_dia || 0) <= 0
    ) {
      alert('Consumo por cabeça/dia deve ser maior que zero.');
      return;
    }

    if (
      form.modo === 'total_lote' &&
      Number(form.consumo_total_dia || 0) <= 0
    ) {
      alert('Consumo total do lote/dia deve ser maior que zero.');
      return;
    }

    onSave({
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
      lote_id: Number(form.lote_id),
      item_estoque_id: Number(form.item_estoque_id),
      modo: form.modo,
      consumo_por_cabeca_dia: Number(form.consumo_por_cabeca_dia || 0),
      consumo_total_dia: Number(form.consumo_total_dia || 0),
      obs: form.obs.trim(),
    });
  }

<<<<<<< HEAD
  const titulo = initialData ? 'Editar suplementação' : 'Nova suplementação';

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      <Button onClick={handleSubmit}>Salvar suplementação</Button>
    </div>
  );

  return (
    <Modal open onClose={onCancel} title={titulo} footer={footer}>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>

        <div className="grid-2">
          <label className="ui-input-wrap">
            <span className="ui-input-label">Lote</span>
            <select className="ui-input" name="lote_id" value={form.lote_id} onChange={handleChange}>
              <option value="">Selecione</option>
              {lotes.map((lote) => (
                <option key={lote.id} value={lote.id}>{lote.nome}</option>
              ))}
            </select>
          </label>

          <label className="ui-input-wrap">
            <span className="ui-input-label">Item do estoque</span>
            <select className="ui-input" name="item_estoque_id" value={form.item_estoque_id} onChange={handleChange}>
              <option value="">Selecione</option>
              {itensDisponiveis.map((item) => (
                <option key={item.id} value={item.id}>{item.produto}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="ui-input-wrap">
          <span className="ui-input-label">Modo de consumo</span>
          <select className="ui-input" name="modo" value={form.modo} onChange={handleChange}>
            <option value="por_cabeca">Por cabeça / dia</option>
            <option value="total_lote">Total do lote / dia</option>
          </select>
        </label>

        {form.modo === 'por_cabeca' ? (
          <label className="ui-input-wrap">
            <span className="ui-input-label">Consumo por cabeça / dia</span>
            <input
              className="ui-input"
              name="consumo_por_cabeca_dia"
              type="number"
              step="0.001"
              min={0}
              value={form.consumo_por_cabeca_dia}
              onChange={handleChange}
              placeholder="Ex: 0.500"
            />
          </label>
        ) : (
          <label className="ui-input-wrap">
            <span className="ui-input-label">Consumo total do lote / dia</span>
            <input
              className="ui-input"
              name="consumo_total_dia"
              type="number"
              step="0.001"
              min={0}
              value={form.consumo_total_dia}
              onChange={handleChange}
              placeholder="Ex: 48"
            />
          </label>
        )}

        <label className="ui-input-wrap">
          <span className="ui-input-label">Observação</span>
          <input
            className="ui-input"
            name="obs"
            value={form.obs}
            onChange={handleChange}
            placeholder="Opcional"
          />
        </label>

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
      min="0"
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
      min="0"
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
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
