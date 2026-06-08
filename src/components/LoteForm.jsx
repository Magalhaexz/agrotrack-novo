import { useEffect, useMemo, useState } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Input from './ui/Input';

const TIPOS_OPERACAO = ['recria', 'engorda', 'recria+engorda', 'confinamento'];
const SISTEMAS = ['confinamento', 'semi-confinamento', 'pasto'];
const CATEGORIAS_ANIMAL = ['Bezerros', 'Bezerras', 'Garrotes', 'Novilhas', 'Vacas', 'Touros', 'Bois', 'Misto'];
const RACOES = ['Nelore', 'Angus', 'Cruzado', 'Senepol', 'Brahman', 'Tabapuã', 'Outro'];
const TIPOS_CONSUMO = [
  { value: 'percentual_pv', label: '% PV' },
  { value: 'kg_cab_dia', label: 'kg/cab/dia' },
];

const FORM_VAZIO = {
  nome: '',
  faz_id: '',
  pastagem_id: '',
  categoria_animal: '',
  raca: '',
  tipo: 'engorda',
  sistema: 'confinamento',
  entrada: new Date().toISOString().slice(0, 10),
  qtd: '',
  p_ini: '',
  peso_alvo: '',
  gmd_meta: '',
  supl_nome: '',
  consumo_tipo: 'percentual_pv',
  consumo_por_cabeca_dia: '',
  supl_rkg: '',
  preco_arroba: '',
  investimento: '',
  custo_fixo_mensal: '',
  rendimento_carcaca: '52',
  outras_desp_pc_mes: 0,
  tem_recria: false,
  tem_engorda: false,
  dias_recria: 0,
  p_ini_recria: 0,
  p_fim_recria: 0,
  dias_engorda: 0,
  supl_pv_pct: 0,
  supl_estoque_kg: 0,
  supl_meta_dias: 30,
};

function toNumber(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value, fractionDigits = 2) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

function formatDateBr(value) {
  if (!value) return '';
  const [year, month, day] = String(value).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function addDays(dateValue, days) {
  if (!dateValue || !Number.isFinite(days) || days <= 0) return '';
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function stripPlanningSummary(text) {
  const raw = String(text || '').trim();
  const matchIndex = raw.search(/GMD esperado:/i);
  if (matchIndex === -1) return raw.replace(/\s+\|\s+$/, '').trim();
  return raw.slice(0, matchIndex).replace(/\|\s*$/, '').trim();
}

function buildPlanningSummary({
  gmdEsperado,
  produto,
  consumoTipo,
  consumoInformado,
  dataPrevistaSaida,
  consumoEstimado,
  custoEstimado,
}) {
  return [
    `GMD esperado: ${gmdEsperado}`,
    `Dieta/produto: ${produto}`,
    `Modo de consumo: ${consumoTipo}`,
    `Valor de consumo: ${consumoInformado}`,
    `Saída projetada (informativa): ${dataPrevistaSaida}`,
    `Consumo estimado suplemento (kg): ${consumoEstimado}`,
    `Custo estimado suplemento (R$): ${custoEstimado}`,
  ].join(' | ');
}

function getConsumoTipoLabel(tipo) {
  return TIPOS_CONSUMO.find((item) => item.value === tipo)?.label || '% PV';
}

function getInitialConsumoTipo(data) {
  if (data?.consumo_tipo) return data.consumo_tipo;
  if (Number(data?.consumo_por_cabeca_dia || 0) > 0) return 'kg_cab_dia';
  if (Number(data?.supl_pv_pct || 0) > 0) return 'percentual_pv';
  return 'percentual_pv';
}

function getInitialConsumoValue(data) {
  const tipo = getInitialConsumoTipo(data);
  if (tipo === 'kg_cab_dia') return data?.consumo_por_cabeca_dia ?? '';
  return data?.consumo_por_cabeca_dia ?? data?.supl_pv_pct ?? '';
}

function findPastagemLabel(pastagens, pastagemId) {
  if (!pastagemId) return '';
  return pastagens.find((item) => String(item.id) === String(pastagemId))?.nome || '';
}

function normalizarInitialData(data, pastagens = []) {
  if (!data) return FORM_VAZIO;
  return {
    ...FORM_VAZIO,
    nome: data.nome || '',
    faz_id: data.faz_id ?? '',
    pastagem_id: data.pastagem_id ?? data.pastagemId ?? data.pastagem_atual_id ?? '',
    categoria_animal: data.categoria_animal ?? data.categoria ?? '',
    raca: data.raca ?? data.raca_animal ?? data.gen ?? '',
    tipo: data.tipo || 'engorda',
    sistema: data.sistema || 'confinamento',
    entrada: data.entrada || new Date().toISOString().slice(0, 10),
    qtd: data.qtd ?? '',
    p_ini: data.p_ini ?? data.p_at ?? '',
    peso_alvo: data.peso_alvo ?? '',
    gmd_meta: data.gmd_meta ?? '',
    supl_nome: data.supl_nome ?? '',
    consumo_tipo: getInitialConsumoTipo(data),
    consumo_por_cabeca_dia: getInitialConsumoValue(data),
    supl_rkg: data.supl_rkg ?? data.preco_kg ?? '',
    preco_arroba: data.preco_arroba ?? '',
    investimento: data.investimento ?? '',
    custo_fixo_mensal: data.custo_fixo_mensal ?? '',
    rendimento_carcaca: data.rendimento_carcaca ?? '52',
    outras_desp_pc_mes: data.outras_desp_pc_mes ?? 0,
    tem_recria: data.tem_recria ?? (data.tipo === 'recria' || data.tipo === 'recria+engorda'),
    tem_engorda: data.tem_engorda ?? (data.tipo === 'engorda' || data.tipo === 'recria+engorda' || data.tipo === 'confinamento'),
    dias_recria: data.dias_recria ?? 0,
    p_ini_recria: data.p_ini_recria ?? 0,
    p_fim_recria: data.p_fim_recria ?? 0,
    dias_engorda: data.dias_engorda ?? data.dias_estimados ?? 0,
    supl_pv_pct: data.supl_pv_pct ?? 0,
    supl_estoque_kg: data.supl_estoque_kg ?? 0,
    supl_meta_dias: data.supl_meta_dias ?? data.dias_estimados ?? 30,
    pastagem_nome: data.pastagem_nome || findPastagemLabel(pastagens, data.pastagem_id ?? data.pastagemId ?? data.pastagem_atual_id ?? ''),
  };
}

function calcularPlanejamento(form) {
  const quantidade = toNumber(form.qtd);
  const pesoInicial = toNumber(form.p_ini);
  const pesoAlvo = toNumber(form.peso_alvo);
  const gmdEsperado = toNumber(form.gmd_meta);
  const consumoInformado = toNumber(form.consumo_por_cabeca_dia);
  const precoKg = toNumber(form.supl_rkg);
  const ganhoPlanejado = pesoAlvo - pesoInicial;
  const diasEstimados = ganhoPlanejado > 0 && gmdEsperado > 0
    ? Math.ceil(ganhoPlanejado / gmdEsperado)
    : 0;
  const pesoReferencia = pesoInicial > 0 && pesoAlvo > 0
    ? (pesoInicial + pesoAlvo) / 2
    : Math.max(pesoInicial, pesoAlvo, 0);
  const consumoKgDiaPorAnimal = form.consumo_tipo === 'percentual_pv'
    ? (pesoReferencia * consumoInformado) / 100
    : consumoInformado;
  const consumoTotalEstimado = consumoKgDiaPorAnimal > 0 && quantidade > 0 && diasEstimados > 0
    ? consumoKgDiaPorAnimal * quantidade * diasEstimados
    : 0;
  const custoEstimadoTotal = consumoTotalEstimado > 0 && precoKg > 0
    ? consumoTotalEstimado * precoKg
    : 0;
  const dataPrevistaSaida = addDays(form.entrada, diasEstimados);

  return {
    diasEstimados,
    dataPrevistaSaida,
    consumoTotalEstimado,
    custoEstimadoTotal,
  };
}

function validarForm(form, planejamento) {
  if (!form.nome.trim()) return 'Informe o nome do lote.';
  if (!form.faz_id) return 'Selecione a fazenda.';
  if (!form.entrada) return 'Informe a data de entrada.';
  if (toNumber(form.qtd) <= 0) return 'Informe a quantidade de cabeças.';
  if (toNumber(form.p_ini) <= 0) return 'Informe o peso médio inicial.';
  if (toNumber(form.peso_alvo) <= 0) return 'Informe o peso alvo final.';
  if (toNumber(form.peso_alvo) <= toNumber(form.p_ini)) return 'O peso alvo final deve ser maior que o peso médio inicial.';
  if (toNumber(form.gmd_meta) <= 0) return 'Informe o GMD esperado.';
  if (planejamento.diasEstimados <= 0) return 'Não foi possível calcular os dias estimados com os dados informados.';
  if (!planejamento.dataPrevistaSaida) return 'Não foi possível calcular a data prevista de saída.';
  if (!form.supl_nome.trim()) return 'Informe a dieta ou produto.';
  if (toNumber(form.consumo_por_cabeca_dia) <= 0) return 'Informe o consumo diário por animal.';
  if (toNumber(form.supl_rkg) <= 0) return 'Informe o preço por kg.';
  if (toNumber(form.preco_arroba) <= 0) return 'Informe o valor manual da arroba.';
  return null;
}

export default function LoteForm({ initialData, fazendas = [], pastagens = [], onSave, onCancel }) {
  const [form, setForm] = useState(() => normalizarInitialData(initialData));
  const [erro, setErro] = useState('');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setForm(normalizarInitialData(initialData, pastagens));
    setErro('');
  }, [initialData, pastagens]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const planejamento = useMemo(() => calcularPlanejamento(form), [form]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const erroValidacao = validarForm(form, planejamento);

    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    const tipoConsumoLabel = getConsumoTipoLabel(form.consumo_tipo);
    const consumoInformado = form.consumo_tipo === 'percentual_pv'
      ? `${formatNumber(form.consumo_por_cabeca_dia, 2)} % PV`
      : `${formatNumber(form.consumo_por_cabeca_dia, 3)} kg/cab/dia`;
    const planningSummary = buildPlanningSummary({
      gmdEsperado: `${formatNumber(form.gmd_meta, 3)} kg/dia`,
      produto: form.supl_nome.trim(),
      consumoTipo: tipoConsumoLabel,
      consumoInformado,
      dataPrevistaSaida: formatDateBr(planejamento.dataPrevistaSaida),
      consumoEstimado: formatNumber(planejamento.consumoTotalEstimado, 2),
      custoEstimado: formatNumber(planejamento.custoEstimadoTotal, 2),
    });
    const manualObs = stripPlanningSummary(initialData?.obs || '');
    const pesoInicial = toNumber(form.p_ini);

    setErro('');
    onSave?.({
      nome: form.nome.trim(),
      faz_id: Number(form.faz_id),
      pastagem_id: form.pastagem_id ? Number(form.pastagem_id) : null,
      categoria_animal: form.categoria_animal || '',
      raca: form.raca || '',
      tipo: form.tipo,
      sistema: form.sistema,
      entrada: form.entrada,
      saida: planejamento.dataPrevistaSaida,
      qtd: Number(form.qtd),
      p_ini: pesoInicial,
      p_at: initialData?.p_at ?? pesoInicial,
      peso_alvo: toNumber(form.peso_alvo),
      gmd_meta: toNumber(form.gmd_meta),
      investimento: toNumber(form.investimento),
      custo_fixo_mensal: toNumber(form.custo_fixo_mensal),
      preco_arroba: toNumber(form.preco_arroba),
      rendimento_carcaca: toNumber(form.rendimento_carcaca),
      dias_estimados: planejamento.diasEstimados,
      consumo_tipo: form.consumo_tipo,
      consumo_por_cabeca_dia: toNumber(form.consumo_por_cabeca_dia),
      consumo_total_estimado: planejamento.consumoTotalEstimado,
      custo_total_estimado: planejamento.custoEstimadoTotal,
      preco_kg: toNumber(form.supl_rkg),
      supl_nome: form.supl_nome.trim(),
      supl_rkg: toNumber(form.supl_rkg),
      supl_pv_pct: form.consumo_tipo === 'percentual_pv' ? toNumber(form.consumo_por_cabeca_dia) : 0,
      supl_meta_dias: planejamento.diasEstimados,
      obs: manualObs ? `${manualObs} | ${planningSummary}` : planningSummary,
      outras_desp_pc_mes: initialData?.outras_desp_pc_mes ?? 0,
      tem_recria: initialData?.tem_recria ?? (form.tipo === 'recria' || form.tipo === 'recria+engorda'),
      tem_engorda: initialData?.tem_engorda ?? (form.tipo === 'engorda' || form.tipo === 'recria+engorda' || form.tipo === 'confinamento'),
      dias_recria: initialData?.dias_recria ?? 0,
      p_ini_recria: initialData?.p_ini_recria ?? 0,
      p_fim_recria: initialData?.p_fim_recria ?? 0,
      dias_engorda: planejamento.diasEstimados,
      supl_estoque_kg: initialData?.supl_estoque_kg ?? 0,
    });
  }

  const titulo = initialData ? 'Editar lote' : 'Novo lote';
  const pastagemSelecionada = form.pastagem_id
    ? findPastagemLabel(pastagens, form.pastagem_id)
    : '';
  const consumoLabel = form.consumo_tipo === 'percentual_pv'
    ? 'Consumo diário por animal (% PV)'
    : 'Consumo diário por animal (kg/cab/dia)';

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      <Button onClick={handleSubmit}>Salvar lote</Button>
    </div>
  );

  return (
    <Modal open onClose={onCancel} title={titulo} footer={footer} size="lg">
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
        <label>
          Nome do lote
          <input
            className="ui-input"
            name="nome"
            value={form.nome}
            onChange={handleChange}
            placeholder="Ex: Lote A - Confinamento"
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
        </div>

        <div className="grid-3">
          {pastagens.length > 0 ? (
            <Input
              as="select"
              name="pastagem_id"
              label="Pastagem atual"
              value={form.pastagem_id}
              onChange={handleChange}
              hint="Selecione a pastagem que está vinculada ao lote."
            >
              <option value="">Selecione</option>
              {pastagens.map((pastagem) => (
                <option key={pastagem.id} value={pastagem.id}>{pastagem.nome}</option>
              ))}
              {form.pastagem_id && !pastagemSelecionada ? (
                <option value={form.pastagem_id}>Pastagem vinculada não encontrada</option>
              ) : null}
            </Input>
          ) : (
            <div className="ui-input-wrap">
              <span className="ui-input-label">Pastagem atual</span>
              <div className="ui-input-shell" style={{ minHeight: 48 }}>
                <span className="ui-input-affix">Cadastre uma pastagem para vincular ao lote.</span>
              </div>
            </div>
          )}

          <Input as="select" name="categoria_animal" label="Categoria animal" value={form.categoria_animal} onChange={handleChange}>
            <option value="">Selecione</option>
            {CATEGORIAS_ANIMAL.map((categoria) => (
              <option key={categoria} value={categoria}>{categoria}</option>
            ))}
          </Input>

          <Input as="select" name="raca" label="Raça" value={form.raca} onChange={handleChange}>
            <option value="">Selecione</option>
            {RACOES.map((raca) => (
              <option key={raca} value={raca}>{raca}</option>
            ))}
          </Input>
        </div>

        <div className="grid-3">
          <label>
            Tipo de operação
            <select className="ui-input" name="tipo" value={form.tipo} onChange={handleChange}>
              {TIPOS_OPERACAO.map((tipo) => (
                <option key={tipo} value={tipo}>{tipo[0].toUpperCase() + tipo.slice(1)}</option>
              ))}
            </select>
          </label>

          <label>
            Sistema
            <select className="ui-input" name="sistema" value={form.sistema} onChange={handleChange}>
              {SISTEMAS.map((sistema) => (
                <option key={sistema} value={sistema}>{sistema[0].toUpperCase() + sistema.slice(1)}</option>
              ))}
            </select>
          </label>

          <label>
            Cabeças
            <input
              className="ui-input"
              name="qtd"
              type="number"
              min={0}
              step="1"
              value={form.qtd}
              onChange={handleChange}
              placeholder="Ex: 100"
            />
          </label>
        </div>

        <div className="grid-3">
          <label>
            Peso médio inicial (kg)
            <input
              className="ui-input"
              name="p_ini"
              type="number"
              min={0}
              step="0.01"
              value={form.p_ini}
              onChange={handleChange}
              placeholder="Ex: 320"
            />
          </label>

          <label>
            Peso alvo final (kg)
            <input
              className="ui-input"
              name="peso_alvo"
              type="number"
              min={0}
              step="0.01"
              value={form.peso_alvo}
              onChange={handleChange}
              placeholder="Ex: 520"
            />
          </label>

          <label>
            GMD esperado (kg/dia)
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
            Dias estimados
            <input
              className="ui-input"
              value={planejamento.diasEstimados ? String(planejamento.diasEstimados) : ''}
              readOnly
              placeholder="Calculado automaticamente"
            />
          </label>

          <label>
            Data prevista de saída
            <input
              className="ui-input"
              value={planejamento.dataPrevistaSaida}
              readOnly
              placeholder="Calculada automaticamente"
            />
          </label>
        </div>

        <div className="grid-2">
          <label>
            Dieta/produto
            <input
              className="ui-input"
              name="supl_nome"
              value={form.supl_nome}
              onChange={handleChange}
              placeholder="Ex: Dieta terminação 18%"
            />
          </label>

          <label>
            Tipo de consumo
            <select className="ui-input" name="consumo_tipo" value={form.consumo_tipo} onChange={handleChange}>
              {TIPOS_CONSUMO.map((tipo) => (
                <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid-3">
          <label>
            {consumoLabel}
            <input
              className="ui-input"
              name="consumo_por_cabeca_dia"
              type="number"
              min={0}
              step="0.001"
              value={form.consumo_por_cabeca_dia}
              onChange={handleChange}
              placeholder={form.consumo_tipo === 'percentual_pv' ? 'Ex: 2.20' : 'Ex: 8.500'}
            />
          </label>

          <label>
            Consumo total estimado (kg)
            <input
              className="ui-input"
              value={planejamento.consumoTotalEstimado ? formatNumber(planejamento.consumoTotalEstimado, 2) : ''}
              readOnly
              placeholder="Calculado automaticamente"
            />
          </label>

          <label>
            Preço por kg (R$/kg)
            <input
              className="ui-input"
              name="supl_rkg"
              type="number"
              min={0}
              step="0.01"
              value={form.supl_rkg}
              onChange={handleChange}
              placeholder="Ex: 1.95"
            />
          </label>
        </div>

        <div className="grid-3">
          <label>
            Custo estimado total (R$)
            <input
              className="ui-input"
              value={planejamento.custoEstimadoTotal ? formatNumber(planejamento.custoEstimadoTotal, 2) : ''}
              readOnly
              placeholder="Calculado automaticamente"
            />
          </label>

          <label>
            Valor manual da arroba (R$/@)
            <input
              className="ui-input"
              name="preco_arroba"
              type="number"
              min={0}
              step="0.01"
              value={form.preco_arroba}
              onChange={handleChange}
              placeholder="Ex: 290"
            />
          </label>

          <label>
            Rendimento de carcaça (%)
            <input
              className="ui-input"
              name="rendimento_carcaca"
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={form.rendimento_carcaca}
              onChange={handleChange}
              placeholder="Ex: 52"
            />
          </label>
        </div>

        <div className="grid-2">
          <label>
            Investimento inicial (R$)
            <input
              className="ui-input"
              name="investimento"
              type="number"
              min={0}
              step="0.01"
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
              min={0}
              step="0.01"
              value={form.custo_fixo_mensal}
              onChange={handleChange}
              placeholder="0,00"
            />
          </label>
        </div>

        {erro ? (
          <p style={{ margin: 0, color: 'var(--color-danger)', fontSize: '0.85rem' }}>
            {erro}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
