import { useEffect, useState } from 'react';

const vazio = {
  nome: '',
  faz_id: '',
  tipo: 'engorda',
  sistema: 'confinamento',
  entrada: '',
  saida: '',
  investimento: '',
  custo_fixo_mensal: '',
  preco_arroba: '',
  rendimento_carcaca: '',
  gmd_meta: '',
};

export default function LoteForm({
  initialData,
  fazendas = [],
  onSave,
  onCancel,
}) {
  const [form, setForm] = useState(vazio);

  useEffect(() => {
    if (initialData) {
      setForm({
        nome: initialData.nome || '',
        faz_id: initialData.faz_id ?? '',
        tipo: initialData.tipo || 'engorda',
        sistema: initialData.sistema || 'confinamento',
        entrada: initialData.entrada || '',
        saida: initialData.saida || '',
        investimento: initialData.investimento ?? '',
        custo_fixo_mensal: initialData.custo_fixo_mensal ?? '',
        preco_arroba: initialData.preco_arroba ?? '',
        rendimento_carcaca: initialData.rendimento_carcaca ?? '',
        gmd_meta: initialData.gmd_meta ?? '',
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
      alert('Informe o nome do lote.');
      return;
    }

    if (!form.faz_id) {
      alert('Selecione a fazenda.');
      return;
    }

    onSave({
      nome: form.nome.trim(),
      faz_id: Number(form.faz_id),
      tipo: form.tipo,
      sistema: form.sistema,
      entrada: form.entrada,
      saida: form.saida,

      investimento: Number(form.investimento || 0),
      custo_fixo_mensal: Number(form.custo_fixo_mensal || 0),
      preco_arroba: Number(form.preco_arroba || 0),
      rendimento_carcaca: Number(form.rendimento_carcaca || 0),
      gmd_meta: Number(form.gmd_meta || 0),

      outras_desp_pc_mes: initialData?.outras_desp_pc_mes ?? 0,
      tem_recria:
        initialData?.tem_recria ??
        (form.tipo === 'recria' || form.tipo === 'recria+engorda'),
      tem_engorda:
        initialData?.tem_engorda ??
        (form.tipo === 'engorda' ||
          form.tipo === 'recria+engorda' ||
          form.tipo === 'confinamento'),
      dias_recria: initialData?.dias_recria ?? 0,
      p_ini_recria: initialData?.p_ini_recria ?? 0,
      p_fim_recria: initialData?.p_fim_recria ?? 0,
      dias_engorda: initialData?.dias_engorda ?? 0,

      supl_nome: initialData?.supl_nome ?? '',
      supl_rkg: initialData?.supl_rkg ?? 0,
      supl_pv_pct: initialData?.supl_pv_pct ?? 0,
      supl_estoque_kg: initialData?.supl_estoque_kg ?? 0,
      supl_meta_dias: initialData?.supl_meta_dias ?? 30,
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
            {initialData ? 'Editar lote' : 'Novo lote'}
          </span>
        </div>

        <div className="card-body">
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={labelStyle}>Nome do lote</label>
              <input
                name="nome"
                value={form.nome}
                onChange={handleChange}
                placeholder="Ex: Lote A — Confinamento"
                style={inputStyle}
              />
            </div>

            <div style={grid2}>
              <div>
                <label style={labelStyle}>Fazenda</label>
                <select
                  name="faz_id"
                  value={form.faz_id}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="">Selecione</option>
                  {fazendas.map((fazenda) => (
                    <option key={fazenda.id} value={fazenda.id}>
                      {fazenda.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Tipo de operação</label>
                <select
                  name="tipo"
                  value={form.tipo}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="recria">Recria</option>
                  <option value="engorda">Engorda</option>
                  <option value="recria+engorda">Recria + Engorda</option>
                  <option value="confinamento">Confinamento</option>
                </select>
              </div>
            </div>

            <div style={grid2}>
              <div>
                <label style={labelStyle}>Sistema</label>
                <select
                  name="sistema"
                  value={form.sistema}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="confinamento">Confinamento</option>
                  <option value="semi-confinamento">Semi-confinamento</option>
                  <option value="pasto">Pasto</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Meta de GMD (kg/dia)</label>
                <input
                  name="gmd_meta"
                  type="number"
                  step="0.001"
                  value={form.gmd_meta}
                  onChange={handleChange}
                  placeholder="Ex: 1.200"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={grid2}>
              <div>
                <label style={labelStyle}>Data de entrada</label>
                <input
                  name="entrada"
                  type="date"
                  value={form.entrada}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Saída prevista</label>
                <input
                  name="saida"
                  type="date"
                  value={form.saida}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={grid3}>
              <div>
                <label style={labelStyle}>Investimento (R$)</label>
                <input
                  name="investimento"
                  type="number"
                  step="0.01"
                  value={form.investimento}
                  onChange={handleChange}
                  placeholder="0,00"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Custo fixo mensal (R$)</label>
                <input
                  name="custo_fixo_mensal"
                  type="number"
                  step="0.01"
                  value={form.custo_fixo_mensal}
                  onChange={handleChange}
                  placeholder="0,00"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Preço da arroba (R$)</label>
                <input
                  name="preco_arroba"
                  type="number"
                  step="0.01"
                  value={form.preco_arroba}
                  onChange={handleChange}
                  placeholder="0,00"
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Rendimento de carcaça (%)</label>
              <input
                name="rendimento_carcaca"
                type="number"
                step="0.1"
                value={form.rendimento_carcaca}
                onChange={handleChange}
                placeholder="Ex: 52"
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
                Salvar lote
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