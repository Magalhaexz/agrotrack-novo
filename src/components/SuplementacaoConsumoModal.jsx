import { useMemo, useState } from 'react';
import Button from './ui/Button';
import Input from './ui/Input';
import Modal from './ui/Modal';
import { getResumoLote } from '../domain/resumoLote';
import { gerarNovoId } from '../utils/id';
import { formatNumber } from '../utils/calculations';

function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toNumberSafe(value, fallback = 0) {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getProdutosNutricionais(db) {
  return (db?.estoque || []).filter(
    (item) => String(item?.categoria || '').toLowerCase().includes('nutrição')
      || String(item?.metadata?.modulo || '').toLowerCase() === 'nutricao'
  );
}

function getDietasNormalizadas(db) {
  return Array.isArray(db?.dietas) ? db.dietas : [];
}

function normalizeConsumptionSelection(db, form, fallbackRecord = null) {
  const produtos = getProdutosNutricionais(db);
  const dietas = getDietasNormalizadas(db);
  const origem = String(form?.origem || fallbackRecord?.origem_tipo || (fallbackRecord?.dieta_nome ? 'dieta' : 'produto')).toLowerCase();

  if (origem === 'dieta') {
    const dieta =
      dietas.find((item) => Number(item.id) === Number(form?.ref_id))
      || dietas.find((item) => Number(item.id) === Number(fallbackRecord?.dieta_id))
      || dietas.find((item) => String(item.nome || '').toLowerCase() === String(fallbackRecord?.dieta_nome || '').toLowerCase())
      || null;

    const produtoId = dieta?.itens?.[0]?.item_estoque_id ?? fallbackRecord?.item_estoque_id ?? null;
    const produto =
      produtos.find((item) => Number(item.id) === Number(produtoId))
      || produtos.find((item) => String(item.produto || '').toLowerCase() === String(fallbackRecord?.produto_nome || '').toLowerCase())
      || null;

    return {
      origem: 'dieta',
      dieta,
      produto,
      refId: dieta?.id ?? form?.ref_id ?? fallbackRecord?.dieta_id ?? '',
      unidadePadrao: produto?.unidade_medida || produto?.unidade || 'kg',
    };
  }

  const produto =
    produtos.find((item) => Number(item.id) === Number(form?.ref_id))
    || produtos.find((item) => Number(item.id) === Number(fallbackRecord?.item_estoque_id))
    || produtos.find((item) => String(item.produto || '').toLowerCase() === String(fallbackRecord?.produto_nome || '').toLowerCase())
    || null;

  return {
    origem: 'produto',
    dieta: null,
    produto,
    refId: produto?.id ?? form?.ref_id ?? fallbackRecord?.item_estoque_id ?? '',
    unidadePadrao: produto?.unidade_medida || produto?.unidade || 'kg',
  };
}

function normalizeConsumptionMode(record = null) {
  const raw = String(record?.modo_consumo || record?.modo || '').toLowerCase();
  if (raw === 'total_manual' || raw === 'manual_total' || raw === 'total_lote') return 'manual_total';
  if (raw === 'percentual_peso' || raw === 'percentual_peso_vivo' || raw === '%_peso_vivo') return 'percentual_peso';
  if (raw === 'por_cabeca' || raw === 'kg_cabeca' || raw === 'kg_cabeça_dia' || raw === 'kg/cab/dia') return 'por_cabeca';
  if (Number(record?.consumo_por_cabeca_dia || 0) > 0) return 'por_cabeca';
  if (Number(record?.percentual_peso_vivo || 0) > 0 || Number(record?.percentual_pv || 0) > 0 || Number(record?.supl_pv_pct || 0) > 0) return 'percentual_peso';
  return 'manual_total';
}

function getLoteContext(db, loteId) {
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const animais = Array.isArray(db?.animais) ? db.animais : [];
  const lote = loteId ? lotes.find((item) => Number(item.id) === Number(loteId)) || null : null;
  const resumo = lote ? getResumoLote(db, lote.id) : null;
  const headsFromResumo = toNumberSafe(resumo?.totalAnimais, 0);
  const headsFromLote = toNumberSafe(lote?.qtd ?? lote?.quantidade ?? lote?.quantidade_animais ?? lote?.qtd_inicial ?? lote?.cabecas ?? lote?.total_cabecas, 0);
  const headsFromAnimais = animais
    .filter((animal) => Number(animal?.lote_id) === Number(loteId))
    .reduce((sum, animal) => sum + toNumberSafe(animal?.qtd, 1), 0);
  const heads = headsFromResumo > 0 ? headsFromResumo : (headsFromLote > 0 ? headsFromLote : headsFromAnimais);
  const pesoFromResumo = toNumberSafe(resumo?.pesoAtualMedio, 0);
  const pesoFromLote = toNumberSafe(lote?.p_at ?? lote?.peso_medio_atual ?? lote?.peso_medio ?? lote?.p_ini, 0);
  const pesoMedio = pesoFromResumo > 0 ? pesoFromResumo : pesoFromLote;

  return {
    lote,
    resumo,
    heads,
    pesoMedio,
    hasHeadsFromLote: headsFromResumo > 0 || headsFromLote > 0 || headsFromAnimais > 0,
    hasPesoMedio: pesoMedio > 0,
  };
}

function calculateTotal({ mode, heads, pesoMedio, manualTotal, perHead, percentual }) {
  if (mode === 'por_cabeca') {
    return toNumberSafe(perHead, 0) * toNumberSafe(heads, 0);
  }
  if (mode === 'percentual_peso') {
    return toNumberSafe(heads, 0) * toNumberSafe(pesoMedio, 0) * (toNumberSafe(percentual, 0) / 100);
  }
  return toNumberSafe(manualTotal, 0);
}

function getConsumptionCost(quantity, produto) {
  return Number(quantity || 0) * Number(produto?.valor_unitario || produto?.custo_unitario || produto?.preco_unitario || 0);
}

function buildInitialData(db, record = null) {
  if (!record) {
    return {
      data: getTodayIso(),
      lote_id: '',
      origem: 'produto',
      ref_id: '',
      modo: 'manual_total',
      quantidade_total: '',
      consumo_por_cabeca_dia: '',
      percentual_peso_vivo: '',
      unidade: 'kg',
      obs: '',
    };
  }

  const selection = normalizeConsumptionSelection(
    db,
    {
      origem: record?.origem_tipo || (record?.dieta_nome ? 'dieta' : 'produto'),
      ref_id: record?.dieta_id || record?.item_estoque_id || '',
    },
    record
  );

  return {
    data: record?.data || getTodayIso(),
    lote_id: record?.lote_id ?? '',
    origem: selection.origem,
    ref_id: selection.refId,
    modo: normalizeConsumptionMode(record),
    quantidade_total: record?.qtd_total ?? record?.quantidade_total ?? record?.quantidade ?? '',
    consumo_por_cabeca_dia: record?.consumo_por_cabeca_dia ?? '',
    percentual_peso_vivo: record?.percentual_peso_vivo ?? record?.percentual_pv ?? record?.supl_pv_pct ?? '',
    unidade: record?.unidade || selection.unidadePadrao || 'kg',
    obs: record?.obs || '',
  };
}

function buildPreview({ db, form, initialData }) {
  const context = getLoteContext(db, form.lote_id ? Number(form.lote_id) : null);
  const selection = normalizeConsumptionSelection(db, form, initialData);
  const total = calculateTotal({
    mode: String(form.modo || 'manual_total'),
    heads: context.heads,
    pesoMedio: context.pesoMedio,
    manualTotal: form.quantidade_total,
    perHead: form.consumo_por_cabeca_dia,
    percentual: form.percentual_peso_vivo,
  });
  const selectedProduct = selection.produto || null;
  const availableStock = toNumberSafe(selectedProduct?.quantidade_atual, 0);
  const previousTotal = initialData ? toNumberSafe(initialData?.qtd_total ?? initialData?.quantidade_total ?? initialData?.quantidade, 0) : 0;
  const sameProduct = Boolean(initialData?.id && selectedProduct && Number(initialData?.item_estoque_id) === Number(selectedProduct?.id));
  const adjustedAvailable = availableStock + (sameProduct ? previousTotal : 0);
  const remaining = adjustedAvailable - total;

  return {
    context,
    selection,
    selectedProduct,
    total,
    availableStock,
    remaining,
    warningInsufficient: remaining < 0,
  };
}

function getModeLabel(mode) {
  if (mode === 'por_cabeca') return 'Quantidade por cabeça';
  if (mode === 'percentual_peso') return '% do peso vivo';
  return 'Total manual';
}

export default function SuplementacaoConsumoModal({ db, setDb, onClose, showToast, initialData = null }) {
  const [form, setForm] = useState(() => buildInitialData(db, initialData));
  const [erro, setErro] = useState('');

  const currentSelection = useMemo(() => normalizeConsumptionSelection(db, {}, initialData), [db, initialData]);
  const preview = useMemo(() => buildPreview({ db, form, initialData }), [db, form, initialData]);
  const custoEstimado = useMemo(() => getConsumptionCost(preview.total, preview.selectedProduct), [preview.total, preview.selectedProduct]);

  function validar() {
    if (!form.data) return 'Informe a data.';
    if (!form.lote_id) return 'Selecione o lote.';
    if (!form.ref_id) return 'Selecione o produto ou dieta.';
    if (!preview.context.lote) return 'O lote selecionado não foi encontrado.';
    if (!preview.selectedProduct) {
      return preview.selection.origem === 'dieta'
        ? 'A dieta vinculada não possui produto nutricional válido.'
        : 'O produto selecionado não foi encontrado.';
    }
    if (preview.context.hasHeadsFromLote && preview.context.heads <= 0) {
      return 'Não foi possível carregar as cabeças do lote selecionado.';
    }
    if (!preview.context.hasHeadsFromLote && String(form.modo) !== 'manual_total') {
      return 'O lote selecionado precisa ter cabeças para calcular por cabeça ou por peso.';
    }
    if (String(form.modo) === 'por_cabeca' && Number(form.consumo_por_cabeca_dia || 0) <= 0) {
      return 'Informe o consumo por cabeça/dia.';
    }
    if (String(form.modo) === 'percentual_peso' && Number(form.percentual_peso_vivo || 0) <= 0) {
      return 'Informe o percentual do peso vivo.';
    }
    if (String(form.modo) === 'percentual_peso' && !preview.context.hasPesoMedio) {
      return 'O lote selecionado não possui peso médio para calcular com percentual do peso vivo.';
    }
    if (String(form.modo) === 'manual_total' && Number(form.quantidade_total || 0) <= 0) {
      return 'Informe a quantidade total consumida.';
    }
    if (preview.total <= 0) {
      return 'Não foi possível calcular o consumo total.';
    }
    return null;
  }

  function salvar() {
    const erroValidacao = validar();
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    if (preview.warningInsufficient && !window.confirm('Consumo maior que estoque disponível. Deseja continuar com saldo negativo?')) {
      return;
    }

    const quantidadeConsumida = preview.total;
    const payloadBase = {
      data: form.data,
      lote_id: Number(form.lote_id),
      modo: form.modo,
      origem_tipo: preview.selection.origem,
      ref_id: preview.selection.refId,
      quantidade_total: quantidadeConsumida,
      quantidade: quantidadeConsumida,
      consumo_por_cabeca_dia: String(form.modo) === 'por_cabeca' ? toNumberSafe(form.consumo_por_cabeca_dia, 0) : null,
      percentual_peso_vivo: String(form.modo) === 'percentual_peso' ? toNumberSafe(form.percentual_peso_vivo, 0) : null,
      unidade: form.unidade || preview.selection.unidadePadrao || 'kg',
      obs: form.obs || '',
      cabeças_lote: preview.context.heads,
      peso_medio_usado: preview.context.pesoMedio,
    };

    setDb((prev) => {
      const existingRecord = initialData
        || (prev.consumo_suplementacao || []).find((item) => Number(item.id) === Number(initialData?.id))
        || null;

      if (existingRecord) {
        const currentSelectionBase = normalizeConsumptionSelection(prev, {}, existingRecord);
        const currentQty = toNumberSafe(existingRecord?.qtd_total ?? existingRecord?.quantidade_total ?? existingRecord?.quantidade, 0);
        const nextQty = quantidadeConsumida;
              const nextCost = getConsumptionCost(nextQty, preview.selectedProduct);
        const restoredStockId = currentSelectionBase.produto?.id != null ? Number(currentSelectionBase.produto.id) : null;
        const consumedStockId = preview.selectedProduct?.id != null ? Number(preview.selectedProduct.id) : null;

        const estoqueAtualizado = (prev.estoque || []).map((item) => {
          const itemId = Number(item.id);
          let saldo = Number(item.quantidade_atual || 0);
          let touched = false;

          if (restoredStockId !== null && itemId === restoredStockId) {
            saldo += currentQty;
            touched = true;
          }

          if (consumedStockId !== null && itemId === consumedStockId) {
            saldo -= nextQty;
            touched = true;
          }

          return touched ? { ...item, quantidade_atual: saldo } : item;
        });

        const consumoAtualizado = {
          ...existingRecord,
          data: payloadBase.data,
          lote_id: payloadBase.lote_id,
          modo: payloadBase.modo,
          origem_tipo: payloadBase.origem_tipo,
          item_estoque_id: consumedStockId,
          dieta_id: preview.selection.dieta?.id ?? null,
          produto_nome: preview.selectedProduct?.produto || existingRecord?.produto_nome || null,
          dieta_nome: preview.selection.dieta?.nome || null,
          qtd_total: nextQty,
          quantidade_total: nextQty,
          quantidade: nextQty,
          consumo_por_cabeca_dia: payloadBase.consumo_por_cabeca_dia,
          percentual_peso_vivo: payloadBase.percentual_peso_vivo,
          cabeças_lote: payloadBase.cabeças_lote,
          peso_medio_usado: payloadBase.peso_medio_usado,
          unidade: payloadBase.unidade,
          custo_total: nextCost,
          obs: payloadBase.obs,
        };

        const consumoId = Number(existingRecord.id);
        const movimentacoesFinanceiras = Array.isArray(prev.movimentacoes_financeiras) ? prev.movimentacoes_financeiras : [];
        const financeIndex = movimentacoesFinanceiras.findIndex(
          (mov) => String(mov?.origem_tipo || '') === 'consumo_suplementacao' && Number(mov?.origem_id) === consumoId
        );
        const descricaoFinanceira = `Consumo nutricional - ${preview.selectedProduct?.produto || preview.selection.dieta?.nome || 'Item'}`;
        const movimentoFinanceiroBase = {
          tipo: 'despesa',
          categoria: 'nutricao',
          subcategoria: 'alimentacao',
          lote_id: payloadBase.lote_id,
          valor: nextCost,
          data: payloadBase.data,
          descricao: descricaoFinanceira,
          origem_tipo: 'consumo_suplementacao',
          origem_id: consumoId,
        };

        const movimentacoesFinanceirasAtualizadas = financeIndex >= 0
          ? movimentacoesFinanceiras.map((mov, index) => (index === financeIndex ? { ...mov, ...movimentoFinanceiroBase } : mov))
          : [
              ...movimentacoesFinanceiras,
              {
                id: gerarNovoId(movimentacoesFinanceiras),
                ...movimentoFinanceiroBase,
              },
            ];

        return {
          ...prev,
          estoque: estoqueAtualizado,
          consumo_suplementacao: (prev.consumo_suplementacao || []).map((item) => (
            Number(item.id) === Number(existingRecord.id) ? consumoAtualizado : item
          )),
          movimentacoes_financeiras: movimentacoesFinanceirasAtualizadas,
        };
      }

      const consumoId = gerarNovoId(prev.consumo_suplementacao || []);
      const novoConsumo = {
        id: consumoId,
        data: payloadBase.data,
        lote_id: payloadBase.lote_id,
        modo: payloadBase.modo,
        origem_tipo: payloadBase.origem_tipo,
        item_estoque_id: preview.selectedProduct?.id ?? null,
        dieta_id: preview.selection.dieta?.id ?? null,
        produto_nome: preview.selectedProduct?.produto || null,
        dieta_nome: preview.selection.dieta?.nome || null,
        qtd_total: payloadBase.quantidade_total,
        quantidade_total: payloadBase.quantidade_total,
        quantidade: payloadBase.quantidade_total,
        consumo_por_cabeca_dia: payloadBase.consumo_por_cabeca_dia,
        percentual_peso_vivo: payloadBase.percentual_peso_vivo,
        cabeças_lote: payloadBase.cabeças_lote,
        peso_medio_usado: payloadBase.peso_medio_usado,
        unidade: payloadBase.unidade,
        custo_total: custoEstimado,
        obs: payloadBase.obs,
      };

      const estoqueAtualizado = (prev.estoque || []).map((item) => (
        Number(item.id) === Number(preview.selectedProduct.id)
          ? { ...item, quantidade_atual: Number(item.quantidade_atual || 0) - quantidadeConsumida }
          : item
      ));

      const movimentacoesFinanceiras = [
        ...(prev.movimentacoes_financeiras || []),
        {
          id: gerarNovoId(prev.movimentacoes_financeiras || []),
          tipo: 'despesa',
          categoria: 'nutricao',
          subcategoria: 'alimentacao',
          lote_id: payloadBase.lote_id,
          valor: custoEstimado,
          data: payloadBase.data,
          descricao: `Consumo nutricional - ${preview.selectedProduct?.produto || preview.selection.dieta?.nome || 'Item'}`,
          origem_tipo: 'consumo_suplementacao',
          origem_id: consumoId,
        },
      ];

      return {
        ...prev,
        estoque: estoqueAtualizado,
        consumo_suplementacao: [...(prev.consumo_suplementacao || []), novoConsumo],
        movimentacoes_financeiras: movimentacoesFinanceiras,
      };
    });

    showToast({
      type: 'success',
      message: initialData ? 'Consumo atualizado com sucesso.' : 'Consumo registrado com baixa de estoque e custo financeiro.',
    });
    onClose();
  }

  const isEdit = Boolean(initialData?.id);
  const loteLabel = preview.context.lote?.nome || '—';
  const headsLabel = preview.context.heads > 0 ? formatNumber(preview.context.heads, 0) : '—';
  const pesoLabel = preview.context.hasPesoMedio ? `${formatNumber(preview.context.pesoMedio, 2)} kg` : 'Peso médio não informado';
  const perHeadLabel = String(form.modo) === 'por_cabeca'
    ? `${formatNumber(form.consumo_por_cabeca_dia || 0, 3)} ${form.unidade || preview.selection.unidadePadrao || 'kg'}`
    : String(form.modo) === 'percentual_peso'
      ? `${formatNumber(form.percentual_peso_vivo || 0, 2)} % do peso vivo`
      : '—';
  const saldoLabel = preview.remaining >= 0
    ? `${formatNumber(preview.remaining, 2)} ${preview.selectedProduct?.unidade_medida || preview.selectedProduct?.unidade || form.unidade || 'kg'}`
    : `- ${formatNumber(Math.abs(preview.remaining), 2)} ${preview.selectedProduct?.unidade_medida || preview.selectedProduct?.unidade || form.unidade || 'kg'}`;

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Editar consumo diário' : 'Registrar consumo diário'}
      footer={<Button onClick={salvar}>{isEdit ? 'Salvar alterações' : 'Salvar consumo'}</Button>}
    >
      <div style={{ display: 'grid', gap: 16 }}>
        <section className="section-card" style={{ padding: 16 }}>
          <div className="section-header" style={{ marginBottom: 12 }}>
            <h4 style={{ margin: 0 }}>Base do cálculo</h4>
          </div>
          <div className="summary-panel">
            <div className="summary-list">
              <div className="summary-row">
                <span className="summary-row__label">Lote selecionado</span>
                <strong className="summary-row__value">{loteLabel}</strong>
              </div>
              <div className="summary-row">
                <span className="summary-row__label">Cabeças do lote</span>
                <strong className="summary-row__value">{headsLabel}</strong>
              </div>
              <div className="summary-row">
                <span className="summary-row__label">Peso médio usado</span>
                <strong className="summary-row__value">{pesoLabel}</strong>
              </div>
              <div className="summary-row">
                <span className="summary-row__label">Modo de cálculo</span>
                <strong className="summary-row__value">{getModeLabel(form.modo)}</strong>
              </div>
              <div className="summary-row">
                <span className="summary-row__label">Consumo por cabeça</span>
                <strong className="summary-row__value">{perHeadLabel}</strong>
              </div>
              <div className="summary-row">
                <span className="summary-row__label">Produto/insumo</span>
                <strong className="summary-row__value">{preview.selectedProduct?.produto || currentSelection.produto?.produto || '—'}</strong>
              </div>
              <div className="summary-row">
                <span className="summary-row__label">Estoque disponível</span>
                <strong className="summary-row__value">{formatNumber(preview.availableStock, 2)}</strong>
              </div>
              <div className="summary-row">
                <span className="summary-row__label">Saldo após consumo</span>
                <strong className="summary-row__value" style={{ color: preview.remaining < 0 ? 'var(--color-danger)' : 'inherit' }}>{saldoLabel}</strong>
              </div>
            </div>
          </div>
          {String(form.modo) === 'percentual_peso' && !preview.context.hasPesoMedio ? (
            <p style={{ margin: '12px 0 0', color: 'var(--color-warning, #c48f00)' }}>
              O cálculo em % do peso vivo precisa de peso médio do lote.
            </p>
          ) : null}
          {preview.warningInsufficient ? (
            <p style={{ margin: '12px 0 0', color: 'var(--color-danger)' }}>
              O consumo calculado é maior que o estoque disponível. O saldo ficará negativo se salvar.
            </p>
          ) : null}
        </section>

        <div className="form-grid two">
          <Input label="Data" type="date" value={form.data} onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))} />
          <label className="ui-input-wrap">
            <span className="ui-input-label">Lote</span>
            <select className="ui-input" value={form.lote_id} onChange={(e) => setForm((p) => ({ ...p, lote_id: e.target.value }))}>
              <option value="">Selecione</option>
              {(db.lotes || []).map((lote) => <option key={lote.id} value={lote.id}>{lote.nome}</option>)}
            </select>
          </label>
          <label className="ui-input-wrap">
            <span className="ui-input-label">Produto ou dieta</span>
            <select className="ui-input" value={form.origem} onChange={(e) => setForm((p) => ({ ...p, origem: e.target.value, ref_id: '' }))}>
              <option value="produto">Produto</option>
              <option value="dieta">Dieta</option>
            </select>
          </label>
          <label className="ui-input-wrap">
            <span className="ui-input-label">Seleção</span>
            <select className="ui-input" value={form.ref_id} onChange={(e) => setForm((p) => ({ ...p, ref_id: e.target.value }))}>
              <option value="">Selecione</option>
              {(form.origem === 'produto' ? getProdutosNutricionais(db) : getDietasNormalizadas(db)).map((item) => (
                <option key={item.id} value={item.id}>{item.produto || item.nome}</option>
              ))}
              {form.ref_id && !preview.selectedProduct ? (
                <option value={form.ref_id}>
                  {form.origem === 'produto' ? 'Produto vinculado não encontrado' : 'Dieta vinculada não encontrada'}
                </option>
              ) : null}
            </select>
          </label>
          <label className="ui-input-wrap">
            <span className="ui-input-label">Modo de cálculo</span>
            <select className="ui-input" value={form.modo} onChange={(e) => setForm((p) => ({ ...p, modo: e.target.value }))}>
              <option value="manual_total">Manual total</option>
              <option value="por_cabeca">Quantidade por cabeça</option>
              <option value="percentual_peso">Percentual do peso vivo</option>
            </select>
          </label>

          {String(form.modo) === 'manual_total' ? (
            <Input
              label={`Quantidade total consumida (${form.unidade || preview.selection.unidadePadrao || 'kg'})`}
              type="number"
              value={form.quantidade_total}
              onChange={(e) => setForm((p) => ({ ...p, quantidade_total: e.target.value }))}
            />
          ) : null}

          {String(form.modo) === 'por_cabeca' ? (
            <Input
              label={`Consumo por cabeça/dia (${form.unidade || preview.selection.unidadePadrao || 'kg'})`}
              type="number"
              value={form.consumo_por_cabeca_dia}
              onChange={(e) => setForm((p) => ({ ...p, consumo_por_cabeca_dia: e.target.value }))}
            />
          ) : null}

          {String(form.modo) === 'percentual_peso' ? (
            <Input
              label="Percentual do peso vivo (%)"
              type="number"
              value={form.percentual_peso_vivo}
              onChange={(e) => setForm((p) => ({ ...p, percentual_peso_vivo: e.target.value }))}
            />
          ) : null}

          <label className="ui-input-wrap">
            <span className="ui-input-label">Unidade</span>
            <select className="ui-input" value={form.unidade} onChange={(e) => setForm((p) => ({ ...p, unidade: e.target.value }))}>
              <option>kg</option>
              <option>g</option>
              <option>litro</option>
              <option>unidade</option>
            </select>
          </label>
          <Input label="Observação" value={form.obs} onChange={(e) => setForm((p) => ({ ...p, obs: e.target.value }))} />
        </div>

        <p style={{ margin: 0 }}>
          Produto base:
          {' '}
          <strong>{preview.selectedProduct?.produto || currentSelection.produto?.produto || '—'}</strong>
        </p>
        <p style={{ margin: 0 }}>
          Consumo total:
          {' '}
          <strong>{formatNumber(preview.total, 2)} {form.unidade || preview.selection.unidadePadrao || 'kg'}</strong>
        </p>
        <p style={{ margin: 0 }}>
          Custo estimado:
          {' '}
          <strong>R$ {formatNumber(custoEstimado, 2)}</strong>
        </p>
        {erro ? <p style={{ margin: 0, color: 'var(--color-danger)', fontSize: '0.85rem' }}>{erro}</p> : null}
      </div>
    </Modal>
  );
}
