import { useEffect, useState } from 'react';
<<<<<<< HEAD
import Modal from '../ui/Modal';
import Button from '../ui/Button';

const TIPOS_OPERACAO = ['recria', 'engorda', 'recria+engorda', 'confinamento'];
const SISTEMAS = ['confinamento', 'semi-confinamento', 'pasto'];

const FORM_VAZIO = {
=======

const vazio = {
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
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
<<<<<<< HEAD
  // Valores padrão para campos que não estão no formulário mas são enviados no onSave
  outras_desp_pc_mes: 0,
  tem_recria: false,
  tem_engorda: false,
  dias_recria: 0,
  p_ini_recria: 0,
  p_fim_recria: 0,
  dias_engorda: 0,
  supl_nome: '',
  supl_rkg: 0,
  supl_pv_pct: 0,
  supl_estoque_kg: 0,
  supl_meta_dias: 30,
};

const VALIDACOES_NUMERICAS = [
  { campo: 'Meta de GMD', key: 'gmd_meta' },
  { campo: 'Investimento', key: 'investimento' },
  { campo: 'Custo fixo mensal', key: 'custo_fixo_mensal' },
  { campo: 'Preço da arroba', key: 'preco_arroba' },
  { campo: 'Rendimento de carcaça', key: 'rendimento_carcaca' },
];

function normalizarInitialData(data) {
  if (!data) return FORM_VAZIO;
  return {
    ...FORM_VAZIO, // Garante que todos os campos existam, mesmo os não visíveis no form
    nome: data.nome || '',
    faz_id: data.faz_id ?? '',
    tipo: data.tipo || 'engorda',
    sistema: data.sistema || 'confinamento',
    entrada: data.entrada || '',
    saida: data.saida || '',
    investimento: data.investimento ?? '',
    custo_fixo_mensal: data.custo_fixo_mensal ?? '',
    preco_arroba: data.preco_arroba ?? '',
    rendimento_carcaca: data.rendimento_carcaca ?? '',
    gmd_meta: data.gmd_meta ?? '',
    // Mantém os valores de initialData para os campos não visíveis no form
    outras_desp_pc_mes: data.outras_desp_pc_mes ?? 0,
    tem_recria: data.tem_recria ?? (data.tipo === 'recria' || data.tipo === 'recria+engorda'),
    tem_engorda: data.tem_engorda ?? (data.tipo === 'engorda' || data.tipo === 'recria+engorda' || data.tipo === 'confinamento'),
    dias_recria: data.dias_recria ?? 0,
    p_ini_recria: data.p_ini_recria ?? 0,
    p_fim_recria: data.p_fim_recria ?? 0,
    dias_engorda: data.dias_engorda ?? 0,
    supl_nome: data.supl_nome ?? '',
    supl_rkg: data.supl_rkg ?? 0,
    supl_pv_pct: data.supl_pv_pct ?? 0,
    supl_estoque_kg: data.supl_estoque_kg ?? 0,
    supl_meta_dias: data.supl_meta_dias ?? 30,
  };
}

function validarForm(form) {
  if (!form.nome.trim()) return 'Informe o nome do lote.';
  if (!form.faz_id) return 'Selecione a fazenda.';

  const campoInvalido = VALIDACOES_NUMERICAS.find(
    (item) => Number(form[item.key] || 0) <= 0
  );
  if (campoInvalido) return `${campoInvalido.campo} deve ser maior que zero.`;

  return null;
}

export default function LoteForm({ initialData, fazendas = [], onSave, onCancel }) {
  const [form, setForm] = useState(() => normalizarInitialData(initialData));
  const [erro, setErro] = useState('');

  useEffect(() => {
    setForm(normalizarInitialData(initialData));
    setErro('');
=======
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
    const tipo = form.tipo;
    onSave?.({
      nome: form.nome.trim(),
      faz_id: Number(form.faz_id),
      tipo: tipo,
      sistema: form.sistema,
      entrada: form.entrada,
      saida: form.saida,
=======

    if (!form.nome.trim()) {
      alert('Informe o nome do lote.');
      return;
    }

    if (!form.faz_id) {
      alert('Selecione a fazenda.');
      return;
    }

    const validacoesNumericas = [
      { campo: 'Meta de GMD', valor: form.gmd_meta },
      { campo: 'Investimento', valor: form.investimento },
      { campo: 'Custo fixo mensal', valor: form.custo_fixo_mensal },
      { campo: 'Preço da arroba', valor: form.preco_arroba },
      { campo: 'Rendimento de carcaça', valor: form.rendimento_carcaca },
    ];

    const campoInvalido = validacoesNumericas.find(
      (item) => Number(item.valor || 0) <= 0
    );

    if (campoInvalido) {
      alert(`${campoInvalido.campo} deve ser maior que zero.`);
      return;
    }

    onSave({
      nome: form.nome.trim(),
      faz_id: Number(form.faz_id),
      tipo: form.tipo,
      sistema: form.sistema,
      entrada: form.entrada,
      saida: form.saida,

>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
      investimento: Number(form.investimento || 0),
      custo_fixo_mensal: Number(form.custo_fixo_mensal || 0),
      preco_arroba: Number(form.preco_arroba || 0),
      rendimento_carcaca: Number(form.rendimento_carcaca || 0),
      gmd_meta: Number(form.gmd_meta || 0),

<<<<<<< HEAD
      // Campos que não estão no formulário, mas precisam ser enviados
      outras_desp_pc_mes: initialData?.outras_desp_pc_mes ?? 0,
      tem_recria: initialData?.tem_recria ?? (tipo === 'recria' || tipo === 'recria+engorda'),
      tem_engorda: initialData?.tem_engorda ?? (tipo === 'engorda' || tipo === 'recria+engorda' || tipo === 'confinamento'),
=======
      outras_desp_pc_mes: initialData?.outras_desp_pc_mes ?? 0,
      tem_recria:
        initialData?.tem_recria ??
        (form.tipo === 'recria' || form.tipo === 'recria+engorda'),
      tem_engorda:
        initialData?.tem_engorda ??
        (form.tipo === 'engorda' ||
          form.tipo === 'recria+engorda' ||
          form.tipo === 'confinamento'),
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
      dias_recria: initialData?.dias_recria ?? 0,
      p_ini_recria: initialData?.p_ini_recria ?? 0,
      p_fim_recria: initialData?.p_fim_recria ?? 0,
      dias_engorda: initialData?.dias_engorda ?? 0,
<<<<<<< HEAD
=======

>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
      supl_nome: initialData?.supl_nome ?? '',
      supl_rkg: initialData?.supl_rkg ?? 0,
      supl_pv_pct: initialData?.supl_pv_pct ?? 0,
      supl_estoque_kg: initialData?.supl_estoque_kg ?? 0,
      supl_meta_dias: initialData?.supl_meta_dias ?? 30,
    });
  }

<<<<<<< HEAD
  const titulo = initialData ? 'Editar lote' : 'Novo lote';

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      <Button onClick={handleSubmit}>Salvar lote</Button>
    </div>
  );

  return (
    <Modal open onClose={onCancel} title={titulo} footer={footer}>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>

        <label>
          Nome do lote
          <input
            className="ui-input"
            name="nome"
            value={form.nome}
            onChange={handleChange}
            placeholder="Ex: Lote A — Confinamento"
          />
        </label>

        <div className="grid-2">
          <label>
            Fazenda
            <select className="ui-input" name="faz_id" value={form.faz_id} onChange={handleChange}>
              <option value="">Selecione</option>
              {fazendas.map((fazenda) => (
                <option key={fazenda.id} value={fazenda.id}>{fazenda.nome}</option>
              ))}
            </select>
          </label>

          <label>
            Tipo de operação
            <select className="ui-input" name="tipo" value={form.tipo} onChange={handleChange}>
              {TIPOS_OPERACAO.map((tipo) => (
                <option key={tipo} value={tipo}>{tipo[0].toUpperCase() + tipo.slice(1)}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid-2">
          <label>
            Sistema
            <select className="ui-input" name="sistema" value={form.sistema} onChange={handleChange}>
              {SISTEMAS.map((sistema) => (
                <option key={sistema} value={sistema}>{sistema[0].toUpperCase() + sistema.slice(1)}</option>
              ))}
            </select>
          </label>

          <label>
            Meta de GMD (kg/dia)
            <input
              className="ui-input"
              name="gmd_meta"
              type="number"
              step="0.001"
              min={0}
              value={form.gmd_meta}
              onChange={handleChange}
              placeholder="Ex: 1.200"
            />
          </label>
        </div>

        <div className="grid-2">
          <label>
            Data de entrada
            <input
              className="ui-input"
              name="entrada"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={form.entrada}
              onChange={handleChange}
            />
          </label>

          <label>
            Saída prevista
            <input
              className="ui-input"
              name="saida"
              type="date"
              value={form.saida}
              onChange={handleChange}
            />
          </label>
        </div>

        <div className="grid-3">
          <label>
            Investimento (R$)
            <input
              className="ui-input"
              name="investimento"
              type="number"
              step="0.01"
              min={0}
              value={form.investimento}
              onChange={handleChange}
              placeholder="0,00"
            />
          </label>

          <label>
            Custo fixo mensal (R$)
            <input
              className="ui-input"
              name="custo_fixo_mensal"
              type="number"
              step="0.01"
              min={0}
              value={form.custo_fixo_mensal}
              onChange={handleChange}
              placeholder="0,00"
            />
          </label>

          <label>
            Preço da arroba (R$)
            <input
              className="ui-input"
              name="preco_arroba"
              type="number"
              step="0.01"
              min={0}
              value={form.preco_arroba}
              onChange={handleChange}
              placeholder="0,00"
            />
          </label>
        </div>

        <label>
          Rendimento de carcaça (%)
          <input
            className="ui-input"
            name="rendimento_carcaca"
            type="number"
            step="0.1"
            min={0}
            max={100}
            value={form.rendimento_carcaca}
            onChange={handleChange}
            placeholder="Ex: 52"
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
      min="0"
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
      max={new Date().toISOString().slice(0, 10)}
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
      max={new Date().toISOString().slice(0, 10)}
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
      min="0"
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
      min="0"
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
      min="0"
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
      min="0"
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
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
