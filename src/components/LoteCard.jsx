import { formatCurrency, formatDate, formatNumber } from '../utils/calculations';
import { useArroba } from '../hooks/useArroba';

<<<<<<< HEAD
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

=======
export default function LoteCard({ lote, fazendaNome, indicators }) {
  const suplementoCritico = indicators.diasEstoque < 7;
  const suplementoBaixo = indicators.diasEstoque >= 7 && indicators.diasEstoque < lote.supl_meta_dias;
  const suplementoStatus = suplementoCritico ? 'crit' : suplementoBaixo ? 'warn' : 'ok';
  const suplementoLabel = suplementoCritico ? 'Crítico' : suplementoBaixo ? 'Baixo' : 'OK';
  const gmdProgress = lote.gmd_meta > 0 ? Math.min(100, (indicators.gmdMedio / lote.gmd_meta) * 100) : 0;
  const { arrobaViva } = useArroba({ peso: indicators.pesoAtualMedio });

>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
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
<<<<<<< HEAD
          <div className={`margin-value ${margemTone}`}>
=======
          <div className={`margin-value ${indicators.margem >= 0 ? 'gn' : 'rd'}`}>
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
            {formatCurrency(indicators.margem)}
          </div>
          <div className="margin-sub">Saída {formatDate(lote.saida)}</div>
        </div>
      </div>

      <div className="lote-blocks">
<<<<<<< HEAD
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
=======
        <div className="lote-block">
          <div className="lb-title">Desempenho</div>
          <div className={`lb-main ${indicators.gmdMedio >= lote.gmd_meta * 0.9 ? 'gn' : 'rd'}`}>
            {formatNumber(indicators.gmdMedio, 3)} <span>kg/dia</span>
          </div>
          <div className="lb-row"><span className="lb-lbl">GMD macho</span><span className="lb-val gn">{formatNumber(indicators.gmdMacho, 3)}</span></div>
          <div className="lb-row"><span className="lb-lbl">GMD fêmea</span><span className="lb-val gn">{formatNumber(indicators.gmdFemea, 3)}</span></div>
          <div className="lb-row"><span className="lb-lbl">Meta</span><span className="lb-val">{formatNumber(lote.gmd_meta, 3)}</span></div>
          <div className="prog-bar"><div className={`prog-fill ${indicators.gmdMedio >= lote.gmd_meta * 0.9 ? 'gn' : 'rd'}`} style={{ width: `${gmdProgress}%` }} /></div>
        </div>

        <div className="lote-block">
          <div className="lb-title">Venda & Receita</div>
          <div className="lb-main am">{formatCurrency(indicators.receitaTotal)}</div>
          <div className="lb-row"><span className="lb-lbl">Preço @</span><span className="lb-val am">{formatCurrency(lote.preco_arroba)}</span></div>
          <div className="lb-row"><span className="lb-lbl">Rend. carcaça</span><span className="lb-val">{formatNumber(lote.rendimento_carcaca, 0)}%</span></div>
          <div className="lb-row"><span className="lb-lbl">Arrobas carcaça</span><span className="lb-val am">{formatNumber(indicators.arrobasCarcaca)} @</span></div>
          <div className="lb-row"><span className="lb-lbl">@ viva atual</span><span className="lb-val am">{formatNumber(arrobaViva)} @</span></div>
          <div className="lb-row"><span className="lb-lbl">Receita/cab</span><span className="lb-val am">{formatCurrency(indicators.receitaPorCabeca)}</span></div>
        </div>

        <div className="lote-block">
          <div className="lb-title">Custo & Investimento</div>
          <div className="lb-main br">{formatCurrency(indicators.custoTotalLote)}</div>
          <div className="lb-row"><span className="lb-lbl">Investimento</span><span className="lb-val br">{formatCurrency(lote.investimento)}</span></div>
          <div className="lb-row"><span className="lb-lbl">Operacional</span><span className="lb-val br">{formatCurrency(indicators.totalCustos)}</span></div>
          <div className="lb-row"><span className="lb-lbl">Alimentação</span><span className="lb-val br">{formatCurrency(indicators.costByCategory.alimentacao)}</span></div>
          <div className="lb-row"><span className="lb-lbl">Custo/@</span><span className="lb-val br">{formatCurrency(indicators.custoPorArroba)}</span></div>
        </div>

        <div className="lote-block">
          <div className="lb-title">Suplementação</div>
          <div className={`status-line ${suplementoStatus}`}>
            <span className={`status-dot ${suplementoStatus}`} />
            <span>{lote.supl_nome}</span>
            <small>{suplementoLabel}</small>
          </div>
          <div className="lb-row"><span className="lb-lbl">R$/kg</span><span className="lb-val tl">{formatCurrency(lote.supl_rkg)}</span></div>
          <div className="lb-row"><span className="lb-lbl">% PV</span><span className="lb-val tl">{formatNumber(lote.supl_pv_pct, 2)}%</span></div>
          <div className="lb-row"><span className="lb-lbl">Consumo/dia</span><span className="lb-val tl">{formatNumber(indicators.consumoSuplementoDia, 1)} kg</span></div>
          <div className="lb-row"><span className="lb-lbl">Dias de estoque</span><span className={`lb-val ${suplementoCritico ? 'rd' : suplementoBaixo ? 'am' : 'tl'}`}>{formatNumber(indicators.diasEstoque, 0)}</span></div>
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
        </div>
      </div>
    </div>
  );
<<<<<<< HEAD
}
=======
}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
