import { useMemo, useState } from 'react';
import { formatarNumero } from '../utils/formatters';
import { TIPOS_MOVIMENTACAO_ESTOQUE } from '../utils/constantes';

const tiposSaida = Object.entries(TIPOS_MOVIMENTACAO_ESTOQUE)
  .filter(([value]) => value !== 'entrada')
  .map(([value, label]) => ({ value, label }));

// Props:
// itens: Array<{ id, produto, unidade, quantidade_atual }>
// lotes: Array<{ id, nome, status }>
// itemInicialId: number | string
// handleRegistrarSaidaEstoque: (dados) => void
// onClose: () => void
export default function SaidaEstoqueModal({
  itens = [],
  lotes = [],
  itemInicialId = '',
  handleRegistrarSaidaEstoque,
  onClose,
}) {
  const [salvando, setSalvando] = useState(false);
  const lotesAtivos = lotes.filter((lote) => lote.status === 'ativo');

  const [form, setForm] = useState({
    item_id: itemInicialId ? String(itemInicialId) : (itens[0]?.id ? String(itens[0].id) : ''),
    lote_id: '',
    quantidade: '',
    tipo: 'consumo',
    data: hojeISO(),
    obs: '',
  });

  const itemSelecionado = useMemo(
    () => itens.find((item) => String(item.id) === String(form.item_id)),
    [itens, form.item_id]
  );

  const saldoAtual = Number(itemSelecionado?.quantidade_atual || 0);
  const unidade = itemSelecionado?.unidade || 'un';

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const quantidade = Number(form.quantidade || 0);

    if (!form.item_id) {
      alert('Selecione o item de estoque.');
      return;
    }

    if (quantidade <= 0) {
      alert('Informe uma quantidade válida.');
      return;
    }

    if (quantidade > saldoAtual) {
      alert(`Saldo insuficiente. Disponível: ${formatarNumero(saldoAtual)} ${unidade}`);
      return;
    }

    setSalvando(true);
    await Promise.resolve(handleRegistrarSaidaEstoque({
      itemId: Number(form.item_id),
      loteId: form.lote_id ? Number(form.lote_id) : '',
      quantidade,
      tipo: form.tipo,
      data: form.data,
      obs: form.obs.trim(),
    }));
    setSalvando(false);

    alert('Saída registrada com sucesso');
    onClose();
  }

  return (
    <div style={overlayStyle}>
      <div className="card" style={cardStyle}>
        <div className="card-header">
          <span className="card-title">Registrar saída / consumo</span>
        </div>

        <div className="card-body">
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={labelStyle}>Item</label>
              <select
                name="item_id"
                value={form.item_id}
                onChange={handleChange}
                style={inputStyle}
              >
                <option value="">Selecione</option>
                {itens.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.produto} (Saldo: {formatarNumero(item.quantidade_atual)} {item.unidade})
                  </option>
                ))}
              </select>
            </div>

            <div style={grid2}>
              <div>
                <label style={labelStyle}>Lote vinculado (opcional)</label>
                <select
                  name="lote_id"
                  value={form.lote_id}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="">Sem lote</option>
                  {lotesAtivos.map((lote) => (
                    <option key={lote.id} value={lote.id}>
                      {lote.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Tipo de saída</label>
                <select
                  name="tipo"
                  value={form.tipo}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  {tiposSaida.map((tipo) => (
                    <option key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={grid2}>
              <div>
                <label style={labelStyle}>Quantidade</label>
                <input
                  name="quantidade"
                  type="number"
                  step="0.01"
                  max={saldoAtual}
      min="0"
                  value={form.quantidade}
                  onChange={handleChange}
                  style={inputStyle}
                />
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
              <label style={labelStyle}>Observações</label>
              <textarea
                name="obs"
                value={form.obs}
                onChange={handleChange}
                style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={onClose} style={cancelBtn}>
                Cancelar
              </button>
              <button type="submit" style={saveBtn} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Confirmar saída'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}


const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  zIndex: 999,
};

const cardStyle = {
  width: '100%',
  maxWidth: '680px',
  borderRadius: '16px',
  overflow: 'hidden',
};

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
