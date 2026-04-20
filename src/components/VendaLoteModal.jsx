import { useMemo, useState } from 'react';
import ArrobaPreview from './ArrobaPreview';
import { formatarNumero } from '../utils/formatters';
import { TIPOS_SAIDA_ANIMAL } from '../utils/constantes';

const tiposSaida = Object.entries(TIPOS_SAIDA_ANIMAL).map(([value, label]) => ({ value, label }));

// Props:
// lote: { id, nome, qtd, status }
// qtdAtual: number
// handleRegistrarSaidaAnimal: (dados) => void
// onClose: () => void
export default function VendaLoteModal({
  lote,
  qtdAtual = 0,
  handleRegistrarSaidaAnimal,
  onClose,
}) {
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    tipo: 'venda',
    data: hojeISO(),
    qtd: '',
    peso_medio: '',
    rendimento_carcaca: 52,
    preco_arroba: '',
    destino: '',
    obs: '',
  });

  const arrobaViva = useMemo(() => {
    return Number(form.peso_medio || 0) / 15;
  }, [form.peso_medio]);

  const valorTotal = useMemo(() => {
    if (form.tipo !== 'venda') return 0;
    const preco = Number(form.preco_arroba || 0);
    const qtd = Number(form.qtd || 0);
    return arrobaViva * preco * qtd;
  }, [arrobaViva, form.preco_arroba, form.qtd, form.tipo]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const qtd = Number(form.qtd || 0);
    const pesoMedio = Number(form.peso_medio || 0);
    const precoArroba = Number(form.preco_arroba || 0);
    const rendimento = Number(form.rendimento_carcaca || 0);

    if (!form.data) {
      alert('Informe a data da saída.');
      return;
    }

    if (qtd <= 0) {
      alert('Informe uma quantidade válida de cabeças.');
      return;
    }

    if (qtd > Number(qtdAtual || 0)) {
      alert(`Quantidade não pode ser maior que o saldo atual (${qtdAtual}).`);
      return;
    }

    if (pesoMedio <= 0) {
      alert('Informe o peso médio da saída.');
      return;
    }

    if (rendimento <= 0) {
      alert('Informe o rendimento de carcaça.');
      return;
    }

    if (form.tipo === 'venda' && precoArroba <= 0) {
      alert('Informe o preço por arroba para venda.');
      return;
    }

    setSalvando(true);
    await Promise.resolve(handleRegistrarSaidaAnimal({
      loteId: lote.id,
      qtd,
      pesoMedio,
      valorTotal: form.tipo === 'venda' ? valorTotal : 0,
      data: form.data,
      comprador: form.destino.trim(),
      tipo: form.tipo,
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
          <span className="card-title">Registrar saída — {lote?.nome || 'Lote'}</span>
        </div>

        <div className="card-body">
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
            <div style={grid2}>
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
            </div>

            <div style={grid2}>
              <div>
                <label style={labelStyle}>Quantidade de cabeças</label>
                <input
                  name="qtd"
                  type="number"
                  min={1}
                  max={Number(qtdAtual || 0)}
                  value={form.qtd}
                  onChange={handleChange}
                  placeholder={`Máximo: ${qtdAtual}`}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Peso médio na saída (kg)</label>
                <input
                  name="peso_medio"
                  type="number"
                  step="0.01"
      min="0"
                  value={form.peso_medio}
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

            <div style={grid2}>
              <div>
                <label style={labelStyle}>@ viva</label>
                <input
                  value={formatarNumero(arrobaViva)}
                  readOnly
                  style={{ ...inputStyle, opacity: 0.75 }}
                />
              </div>

              {form.tipo === 'venda' ? (
                <div>
                  <label style={labelStyle}>Preço por @ (R$)</label>
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
              ) : (
                <div>
                  <label style={labelStyle}>Preço por @ (R$)</label>
                  <input
                    value="—"
                    readOnly
                    style={{ ...inputStyle, opacity: 0.75 }}
                  />
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle}>Valor total estimado (R$)</label>
              <input
                value={form.tipo === 'venda' ? formatarNumero(valorTotal) : '—'}
                readOnly
                style={{ ...inputStyle, opacity: 0.75 }}
              />
            </div>

            <div>
              <label style={labelStyle}>Comprador/destino</label>
              <input
                name="destino"
                value={form.destino}
                onChange={handleChange}
                placeholder="Ex: Frigorífico XPTO / Fazenda destino"
                style={inputStyle}
              />
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
  const now = new Date();
  return now.toISOString().slice(0, 10);
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
  maxWidth: '700px',
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
