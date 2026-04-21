import { formatCurrency, formatDate, formatNumber } from '../utils/calculations';
import { useArroba } from '../hooks/useArroba';

// Componente auxiliar para uma linha de indicador
function IndicatorRow({ label, value, unit = '', tone = '' }) {
  return (
    <div className="lb-row">
      <span className="lb-lbl">{label}</span>
      <span className={`lb-val ${tone}`}>{value} {unit}</span>
    </div>
  );
}

export default function LoteCard({ lote, fazendaNome, indicators }) {
  const suplementoCritico = indicators.diasEstoque < 7;
  const suplementoBaixo = indicators.diasEstoque >= 7 && indicators.diasEstoque < lote.supl_meta_dias;
  const suplementoStatusClass = suplementoCritico ? 'crit' : suplementoBaixo ? 'warn' : 'ok';
  const suplementoLabel = suplementoCritico ? 'Crítico' : suplementoBaixo ? 'Baixo' : 'OK';

  const gmdProgress = lote.gmd_meta > 0 ? Math.min(100, (indicators.gmdMedio / lote.gmd_meta) * 100) : 0;
  const gmdTone = indicators.gmdMedio >= lote.gmd_meta * 0.9 ? 'gn' : 'rd';

  const { arrobaViva } = useArroba({ peso: indicators.pesoAtualMedio });

  const margemTone = indicators.margem >= 0 ? 'gn' : 'rd';

  return (
    <div className="lote-card">
      <div className="lote-header">
        <div>
          <div className="lote-title">{lote.nome}</div>
          <div className="lote-sub">
            <span className="dot-live" />
            {fazendaNome} · {lote.tipo} · {lote.sistema}
          </div>
        </div>
        <div className="lote-margin">
          <div className="margin-label">Margem estimada</div>
          <div className={`margin-value ${margemTone}`}>
            {formatCurrency(indicators.margem)}
          </div>
          <div className="margin-sub">Saída {formatDate(lote.saida)}</div>
        </div>
      </div>

      <div className="lote-blocks">
        {/* Bloco de Desempenho */}
        <div className="lote-block">
          <div className="lb-title">Desempenho</div>
          <div className={`lb-main ${gmdTone}`}>
            {formatNumber(indicators.gmdMedio, 3)} <span>kg/dia</span>
          </div>
          <IndicatorRow label="GMD macho" value={formatNumber(indicators.gmdMacho, 3)} tone="gn" />
          <IndicatorRow label="GMD fêmea" value={formatNumber(indicators.gmdFemea, 3)} tone="gn" />
          <IndicatorRow label="Meta" value={formatNumber(lote.gmd_meta, 3)} />
          <div className="prog-bar">
            <div className={`prog-fill ${gmdTone}`} style={{ width: `${gmdProgress}%` }} />
          </div>
        </div>

        {/* Bloco de Venda & Receita */}
        <div className="lote-block">
          <div className="lb-title">Venda & Receita</div>
          <div className="lb-main am">{formatCurrency(indicators.receitaTotal)}</div>
          <IndicatorRow label="Preço @" value={formatCurrency(lote.preco_arroba)} tone="am" />
          <IndicatorRow label="Rend. carcaça" value={`${formatNumber(lote.rendimento_carcaca, 0)}%`} />
          <IndicatorRow label="Arrobas carcaça" value={formatNumber(indicators.arrobasCarcaca)} unit="@" tone="am" />
          <IndicatorRow label="@ viva atual" value={formatNumber(arrobaViva)} unit="@" tone="am" />
          <IndicatorRow label="Receita/cab" value={formatCurrency(indicators.receitaPorCabeca)} tone="am" />
        </div>

        {/* Bloco de Custo & Investimento */}
        <div className="lote-block">
          <div className="lb-title">Custo & Investimento</div>
          <div className="lb-main br">{formatCurrency(indicators.custoTotalLote)}</div>
          <IndicatorRow label="Investimento" value={formatCurrency(lote.investimento)} tone="br" />
          <IndicatorRow label="Operacional" value={formatCurrency(indicators.totalCustos)} tone="br" />
          <IndicatorRow label="Alimentação" value={formatCurrency(indicators.costByCategory.alimentacao)} tone="br" />
          <IndicatorRow label="Custo/@" value={formatCurrency(indicators.custoPorArroba)} tone="br" />
        </div>

        {/* Bloco de Suplementação */}
        <div className="lote-block">
          <div className="lb-title">Suplementação</div>
          <div className={`status-line ${suplementoStatusClass}`}>
            <span className={`status-dot ${suplementoStatusClass}`} />
            <span>{lote.supl_nome}</span>
            <small>{suplementoLabel}</small>
          </div>
          <IndicatorRow label="R$/kg" value={formatCurrency(lote.supl_rkg)} tone="tl" />
          <IndicatorRow label="% PV" value={`${formatNumber(lote.supl_pv_pct, 2)}%`} tone="tl" />
          <IndicatorRow label="Consumo/dia" value={formatNumber(indicators.consumoSuplementoDia, 1)} unit="kg" tone="tl" />
          <IndicatorRow
            label="Dias de estoque"
            value={formatNumber(indicators.diasEstoque, 0)}
            tone={suplementoCritico ? 'rd' : suplementoBaixo ? 'am' : 'tl'}
          />
        </div>
      </div>
    </div>
  );
}