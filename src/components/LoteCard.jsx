import { formatCurrency, formatDate, formatNumber } from '../utils/calculations';

export default function LoteCard({ lote, fazendaNome, indicators }) {
  const suplementoCritico = indicators.diasEstoque < 7;
  const suplementoBaixo = indicators.diasEstoque >= 7 && indicators.diasEstoque < lote.supl_meta_dias;
  const suplementoStatus = suplementoCritico ? 'crit' : suplementoBaixo ? 'warn' : 'ok';
  const suplementoLabel = suplementoCritico ? 'Crítico' : suplementoBaixo ? 'Baixo' : 'OK';
  const gmdProgress = lote.gmd_meta > 0 ? Math.min(100, (indicators.gmdMedio / lote.gmd_meta) * 100) : 0;

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
          <div className={`margin-value ${indicators.margem >= 0 ? 'gn' : 'rd'}`}>
            {formatCurrency(indicators.margem)}
          </div>
          <div className="margin-sub">Saída {formatDate(lote.saida)}</div>
        </div>
      </div>

      <div className="lote-blocks">
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
        </div>
      </div>
    </div>
  );
}
