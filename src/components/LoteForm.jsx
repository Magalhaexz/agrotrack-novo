import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

const TIPOS_OPERACAO = ['recria', 'engorda', 'recria+engorda', 'confinamento'];
const SISTEMAS = ['confinamento', 'semi-confinamento', 'pasto'];

const FORM_VAZIO = {
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
  }, [initialData]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
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
      investimento: Number(form.investimento || 0),
      custo_fixo_mensal: Number(form.custo_fixo_mensal || 0),
      preco_arroba: Number(form.preco_arroba || 0),
      rendimento_carcaca: Number(form.rendimento_carcaca || 0),
      gmd_meta: Number(form.gmd_meta || 0),

      // Campos que não estão no formulário, mas precisam ser enviados
      outras_desp_pc_mes: initialData?.outras_desp_pc_mes ?? 0,
      tem_recria: initialData?.tem_recria ?? (tipo === 'recria' || tipo === 'recria+engorda'),
      tem_engorda: initialData?.tem_engorda ?? (tipo === 'engorda' || tipo === 'recria+engorda' || tipo === 'confinamento'),
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