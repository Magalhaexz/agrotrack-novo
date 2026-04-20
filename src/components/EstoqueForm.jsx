import { useEffect, useState } from 'react';
import { UNIDADES_ESTOQUE } from '../utils/constantes';

const vazio = {
  produto: '',
  categoria: 'insumo',
  unidade: 'kg',
  quantidade_atual: '',
  quantidade_minima: '',
  valor_unitario: '',
  origem: 'manual',
  numero_nf: '',
  data_entrada: '',
  data_validade: '',
  alerta_dias_antes: 30,
};

export default function EstoqueForm({ initialData, onSave, onCancel }) {
  const [form, setForm] = useState(vazio);

  useEffect(() => {
    if (initialData) {
      setForm({
  produto: initialData.produto || '',
  categoria: initialData.categoria || 'insumo',
  unidade: initialData.unidade || 'kg',
  quantidade_atual: initialData.quantidade_atual ?? '',
  quantidade_minima: initialData.quantidade_minima ?? '',
  valor_unitario: initialData.valor_unitario ?? '',
  origem: initialData.origem || 'manual',
  numero_nf: initialData.numero_nf || '',
  data_entrada: initialData.data_entrada || '',
  data_validade: initialData.data_validade || '',
  alerta_dias_antes: initialData.alerta_dias_antes ?? 30,
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

    if (!form.produto.trim()) {
      alert('Informe o nome do produto.');
      return;
    }

    const validacoesNumericas = [
      { campo: 'Quantidade atual', valor: form.quantidade_atual },
      { campo: 'Quantidade mínima', valor: form.quantidade_minima },
      { campo: 'Valor unitário', valor: form.valor_unitario },
      { campo: 'Alerta de validade (dias)', valor: form.alerta_dias_antes },
    ];

    const campoInvalido = validacoesNumericas.find(
      (item) => Number(item.valor || 0) <= 0
    );

    if (campoInvalido) {
      alert(`${campoInvalido.campo} deve ser maior que zero.`);
      return;
    }

    onSave({
  produto: form.produto.trim(),
  categoria: form.categoria,
  unidade: form.unidade,
  quantidade_atual: Number(form.quantidade_atual || 0),
  quantidade_minima: Number(form.quantidade_minima || 0),
  valor_unitario: Number(form.valor_unitario || 0),
  origem: form.origem,
  numero_nf: form.numero_nf.trim(),
  data_entrada: form.data_entrada,
  data_validade: form.data_validade,
  alerta_dias_antes: Number(form.alerta_dias_antes || 0),
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
            {initialData ? 'Editar item de estoque' : 'Novo item de estoque'}
          </span>
        </div>

        <div className="card-body">
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={labelStyle}>Produto</label>
              <input
                name="produto"
                value={form.produto}
                onChange={handleChange}
                placeholder="Ex: Núcleo proteico 40%"
                style={inputStyle}
              />
            </div>

            <div style={grid2}>
              <div>
                <label style={labelStyle}>Categoria</label>
                <select
                  name="categoria"
                  value={form.categoria}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="insumo">Insumo</option>
                  <option value="sanitário">Sanitário</option>
                  <option value="ração">Ração</option>
                  <option value="mineral">Mineral</option>
                  <option value="outros">Outros</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Unidade</label>
                <select
                  name="unidade"
                  value={form.unidade}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  {UNIDADES_ESTOQUE.map((unidade) => (
                    <option key={unidade} value={unidade === 'unidade' ? 'un' : unidade}>
                      {unidade}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={grid3}>
              <div>
                <label style={labelStyle}>Qtd atual</label>
                <input
                  name="quantidade_atual"
                  type="number"
                  step="0.01"
      min="0"
                  value={form.quantidade_atual}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Qtd mínima</label>
                <input
                  name="quantidade_minima"
                  type="number"
                  step="0.01"
      min="0"
                  value={form.quantidade_minima}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Valor unitário (R$)</label>
                <input
                  name="valor_unitario"
                  type="number"
                  step="0.01"
      min="0"
                  value={form.valor_unitario}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={grid2}>
              <div>
                <label style={labelStyle}>Origem</label>
                <select
                  name="origem"
                  value={form.origem}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="manual">Manual</option>
                  <option value="NF-e">NF-e</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Número da NF</label>
                <input
                  name="numero_nf"
                  value={form.numero_nf}
                  onChange={handleChange}
                  placeholder="Opcional"
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={grid2}>
  <div>
    <label style={labelStyle}>Data de validade</label>
    <input
      name="data_validade"
      type="date"
      max={new Date().toISOString().slice(0, 10)}
      value={form.data_validade}
      onChange={handleChange}
      style={inputStyle}
    />
  </div>

  <div>
    <label style={labelStyle}>Avisar quantos dias antes</label>
    <input
      name="alerta_dias_antes"
      type="number"
      min="0"
      value={form.alerta_dias_antes}
      onChange={handleChange}
      placeholder="Ex: 15"
      style={inputStyle}
    />
  </div>
</div>

            <div>
              <label style={labelStyle}>Data de entrada</label>
              <input
                name="data_entrada"
                type="date"
      max={new Date().toISOString().slice(0, 10)}
                value={form.data_entrada}
                onChange={handleChange}
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
                Salvar item
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

const grid3 = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: 14,
};
