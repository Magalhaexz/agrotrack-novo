import { useEffect, useMemo, useState } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Input from './ui/Input';
import {
  addDaysToDate,
  calculateDailyConsumptionKg,
  calculateConsumptionCost,
  calculateEstimatedDays,
  toDateKey,
  toNumber,
} from '../domain/calcHelpers.js';

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

function formatNumber(value, fractionDigits = 2) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(toNumber(value));
}

function formatDateBr(value) {
  const dateKey = toDateKey(value);
  if (!dateKey) return '';
  const [year, month, day] = dateKey.split('-');
  return `${day}/${month}/${year}`;
}

function addDays(dateValue, days) {
  return addDaysToDate(dateValue, days);
}

function stripPlanningSummary(text) {
  const raw = String(text || '').trim();
  const matchIndex = raw.search(/GMD esperado:/i);
  if (matchIndex === -1) return raw.replace(/\s+\|\s+$/, '').trim();
  return raw.slice(0, matchIndex).replace(/\|\s*$/, '').trim();
}

function isWholePositiveInteger(value) {
  const text = String(value ?? '').trim();
  return /^\d+$/.test(text) && Number(text) > 0;
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
    `Consumo esperado: ${consumoTipo}`,
    `Consumo esperado informado: ${consumoInformado}`,
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
  if (toNumber(data?.consumo_por_cabeca_dia) > 0) return 'kg_cab_dia';
  if (toNumber(data?.supl_pv_pct) > 0) return 'percentual_pv';
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

function normalizarInitialData(data, pastagens = [], fazendaAtiva = null) {
  if (!data) {
    return {
      ...FORM_VAZIO,
      faz_id: fazendaAtiva?.id ?? '',
    };
  }
  return {
    ...FORM_VAZIO,
    nome: data.nome || '',
    faz_id: data.faz_id ?? data.fazenda_id ?? fazendaAtiva?.id ?? '',
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
  const diasEstimados = calculateEstimatedDays(pesoInicial, pesoAlvo, gmdEsperado);
  const consumoKgDiaPorAnimal = calculateDailyConsumptionKg({
    mode: form.consumo_tipo,
    heads: 1,
    pesoInicial,
    pesoFinal: pesoAlvo,
    percentualPv: consumoInformado,
    kgPorCabeca: consumoInformado,
  });
  const consumoTotalEstimado = quantidade > 0 && diasEstimados > 0
    ? consumoKgDiaPorAnimal * quantidade * diasEstimados
    : 0;
  const custoEstimadoTotal = calculateConsumptionCost(consumoTotalEstimado, precoKg);
  const dataPrevistaSaida = addDays(form.entrada, Math.round(diasEstimados));

  return {
    diasEstimados,
    dataPrevistaSaida,
    consumoTotalEstimado,
    custoEstimadoTotal,
  };
}

function validarForm(form, planejamento, pastagensDisponiveis = []) {
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
  if (!isWholePositiveInteger(form.supl_meta_dias)) return 'Informe um número inteiro de dias.';
  if (form.sistema === 'pasto' && !form.pastagem_id && pastagensDisponiveis.length > 0) {
    return 'Selecione o pasto vinculado ao lote (obrigatório para sistema a pasto).';
  }
  return null;
}

export default function LoteForm({ initialData, fazendas = [], pastagens = [], fazendaAtiva = null, onSave, onCancel }) {
  const [form, setForm] = useState(() => normalizarInitialData(initialData, pastagens, fazendaAtiva));
  const [erro, setErro] = useState('');

  const planejamento = useMemo(() => calcularPlanejamento(form), [form]);
  const pastagensCompativeis = useMemo(() => {
    if (!form.faz_id) return pastagens;
    return pastagens.filter((pastagem) => {
      const fazendaId = pastagem?.fazenda_id ?? pastagem?.faz_id ?? null;
      return !fazendaId || String(fazendaId) === String(form.faz_id);
    });
  }, [form.faz_id, pastagens]);

  const fazendaSelecionada = useMemo(
    () => fazendas.find((item) => String(item.id) === String(form.faz_id)) || fazendaAtiva || null,
    [fazendas, form.faz_id, fazendaAtiva]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (initialData) {
        setForm(normalizarInitialData(initialData, pastagens, fazendaAtiva));
        return;
      }

      if (fazendaAtiva?.id) {
        setForm((prev) => {
          if (String(prev.faz_id) === String(fazendaAtiva.id)) return prev;
          const novaFazId = String(fazendaAtiva.id);
          const pastoAindaValido = prev.pastagem_id && pastagens.some((p) => {
            const fazId = p?.fazenda_id ?? p?.faz_id ?? null;
            return String(p.id) === String(prev.pastagem_id) && (!fazId || String(fazId) === novaFazId);
          });
          return { ...prev, faz_id: novaFazId, pastagem_id: pastoAindaValido ? prev.pastagem_id : '' };
        });
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [initialData, pastagens, fazendaAtiva]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const erroValidacao = validarForm(form, planejamento, pastagensCompativeis);

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
    const metaDias = Number(form.supl_meta_dias);

    setErro('');
    onSave?.({
      nome: form.nome.trim(),
      faz_id: Number(form.faz_id),
      pastagem_id: form.pastagem_id || null,
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
      supl_meta_dias: metaDias,
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
  const modoFazenda = initialData ? 'Lote vinculado' : 'Fazenda ativa';
  const pastagemSelecionada = form.pastagem_id
    ? findPastagemLabel(pastagens, form.pastagem_id)
    : '';
  const helperPastagem = form.faz_id
    ? 'Nenhum pasto cadastrado para esta fazenda. Cadastre os pastos antes de vincular o lote.'
    : 'Selecione a fazenda para listar os pastos disponíveis.';
  const consumoLabel = form.consumo_tipo === 'percentual_pv'
    ? 'Consumo esperado por animal (% PV)'
    : 'Consumo esperado por animal (kg/cab/dia)';

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      <Button onClick={handleSubmit}>Salvar lote</Button>
    </div>
  );

  return (
    <Modal open onClose={onCancel} title={titulo} footer={footer} size="lg">
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>

        {/* ── Bloco 1: Identificação ── */}
        <div className="section-card">
          <div className="section-header"><h4>Identificação</h4></div>

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
            <div className="ui-input-wrap">
              <label className="ui-input-label">{modoFazenda}</label>
              <div className="ui-input-shell" style={{ minHeight: 48 }}>
                <span className="ui-input-affix">{fazendaSelecionada?.nome || 'Selecione uma fazenda ativa antes de cadastrar o lote.'}</span>
              </div>
            </div>

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
        </div>

        {/* ── Bloco 2: Operação ── */}
        <div className="section-card">
          <div className="section-header"><h4>Operação</h4></div>

          <div className="grid-3">
            {pastagensCompativeis.length > 0 ? (
              <Input
                as="select"
                name="pastagem_id"
                label="Pasto atual"
                value={form.pastagem_id}
                onChange={handleChange}
                hint="Selecione a pastagem que está vinculada ao lote."
              >
                <option value="">Selecione</option>
                {pastagensCompativeis.map((pastagem) => (
                  <option key={pastagem.id} value={pastagem.id}>{pastagem.nome}</option>
                ))}
                {form.pastagem_id && !pastagemSelecionada ? (
                  <option value={form.pastagem_id}>Pasto vinculado não encontrado</option>
                ) : null}
              </Input>
            ) : (
              <div className="ui-input-wrap">
                <span className="ui-input-label">Pasto atual</span>
                <div className="ui-input-shell" style={{ minHeight: 48 }}>
                  <span className="ui-input-affix">{helperPastagem}</span>
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
        </div>

        {/* ── Bloco 3: Metas zootécnicas ── */}
        <div className="section-card">
          <div className="section-header"><h4>Metas zootécnicas</h4></div>

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
                min={0}
                step="0.001"
                value={form.gmd_meta}
                onChange={handleChange}
                placeholder="Ex: 1,45"
              />
            </label>
          </div>
        </div>

        {/* ── Bloco 4: Nutrição / manejo ── */}
        <div className="section-card">
          <div className="section-header"><h4>Nutrição / manejo</h4></div>

          <div className="grid-3">
            <label>
              Dieta / produto
              <input
                className="ui-input"
                name="supl_nome"
                value={form.supl_nome}
                onChange={handleChange}
                placeholder="Ex: Ração 18%"
              />
            </label>

            <Input as="select" name="consumo_tipo" label="Modo de consumo esperado" value={form.consumo_tipo} onChange={handleChange}>
              {TIPOS_CONSUMO.map((tipo) => (
                <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
              ))}
            </Input>

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
                placeholder={form.consumo_tipo === 'percentual_pv' ? 'Ex: 2,20' : 'Ex: 8,500'}
              />
            </label>
          </div>

          <div className="grid-2">
            <label>
              Preço do suplemento (R$/kg)
              <input
                className="ui-input"
                name="supl_rkg"
                type="number"
                min={0}
                step="0.01"
                value={form.supl_rkg}
                onChange={handleChange}
                placeholder="Ex: 2,85"
              />
            </label>

            <label>
              Duração estimada do ciclo (dias)
              <input
                className="ui-input"
                name="supl_meta_dias"
                type="number"
                min={1}
                step="1"
                value={form.supl_meta_dias}
                onChange={handleChange}
                placeholder="Ex: 30"
              />
            </label>
          </div>
        </div>

        {/* ── Bloco 5: Financeiro ── */}
        <div className="section-card">
          <div className="section-header"><h4>Financeiro</h4></div>

          <div className="grid-2">
            <label>
              Preço da arroba (R$)
              <input
                className="ui-input"
                name="preco_arroba"
                type="number"
                min={0}
                step="0.01"
                value={form.preco_arroba}
                onChange={handleChange}
                placeholder="Ex: 250,00"
              />
            </label>

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
                placeholder="Ex: 150000"
              />
            </label>
          </div>
        </div>

        {/* ── Bloco 6: Resumo / projeção ── */}
        <div className="section-card">
          <div className="section-header"><h4>Resumo / projeção</h4></div>

          <div className="grid-2">
            <div className="ui-input-wrap">
              <label className="ui-input-label">Dias estimados</label>
              <div className="ui-input-shell" style={{ minHeight: 48 }}>
                <span className="ui-input-affix">{planejamento.diasEstimados ? `${planejamento.diasEstimados} dias` : '—'}</span>
              </div>
            </div>

            <div className="ui-input-wrap">
              <label className="ui-input-label">Saída prevista</label>
              <div className="ui-input-shell" style={{ minHeight: 48 }}>
                <span className="ui-input-affix">{planejamento.dataPrevistaSaida ? formatDateBr(planejamento.dataPrevistaSaida) : '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {erro ? <p className="err">{erro}</p> : null}
      </form>
    </Modal>
  );
}
