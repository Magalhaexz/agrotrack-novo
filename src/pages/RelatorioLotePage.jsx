import { useMemo, useRef, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import AcoesRelatorio from '../components/relatorios/AcoesRelatorio';
import RelatorioLotePreview from '../components/relatorios/RelatorioLotePreview';
import { gerarResumoRelatorioLote } from '../domain/relatorioLote';
import { gerarResumoLoteTexto } from '../domain/whatsappResumo';
import { formatCurrency, formatDate, formatNumber } from '../utils/calculations';

export default function RelatorioLotePage({ db, onNavigate }) {
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const [loteId, setLoteId] = useState(lotes[0]?.id ?? '');
  const containerRef = useRef(null);

  const relatorio = useMemo(() => (loteId ? gerarResumoRelatorioLote(db, loteId) : null), [db, loteId]);

  if (!lotes.length) {
    return (
      <div className="page reports-page">
        <PageHeader title="Relatório do Lote" />
        <EmptyState
          title="Cadastre um lote para gerar este relatório."
          subtitle="Cada lote representa um grupo de animais acompanhado em conjunto — peso, custo e resultado."
          action={<Button size="sm" onClick={() => onNavigate?.('lotes')}>Ir para Lotes</Button>}
        />
      </div>
    );
  }

  return (
    <div className="page reports-page">
      <PageHeader
        title="Relatório do Lote"
        subtitle="Selecione um lote para ver peso, desempenho, custos e resultado."
        actions={(
          <select
            className="ui-input"
            value={loteId}
            onChange={(e) => setLoteId(e.target.value)}
          >
            {lotes.map((lote) => (
              <option key={lote.id} value={lote.id}>{lote.nome}</option>
            ))}
          </select>
        )}
      />

      {relatorio?.encontrado ? (
        <>
          <AcoesRelatorio
            containerRef={containerRef}
            getTexto={() => gerarResumoLoteTexto(relatorio)}
            titulo="Relatório do Lote"
            fazendaNome={relatorio.fazendaNome}
            nomeArquivo={`relatorio-lote-${relatorio.lote?.nome || loteId}`}
          />

          <div ref={containerRef}>
            <RelatorioLotePreview relatorio={relatorio} />

            <Card title="Resultado realizado (histórico completo)" subtitle="Receita e lucro já registrados para este lote — diferente da simulação de venda hoje, mostrada acima.">
              <div className="summary-list">
                <Row label="Receita total" value={formatCurrency(relatorio.receitaTotal)} />
                <Row label="Lucro/prejuízo" value={formatCurrency(relatorio.lucroTotal)} />
                <Row label="ROI (margem)" value={`${formatNumber(relatorio.margemPct, 1)}%`} />
              </div>
            </Card>

            <Card title="Decisão de venda e custo por arroba">
              <div className="summary-list">
                <Row label="Arrobas estimadas" value={`${formatNumber(relatorio.arrobasCarcaca, 1)} @`} />
                <Row label="Custo por arroba" value={formatCurrency(relatorio.custoPorArroba)} />
                <Row label="Lucro por arroba" value={formatCurrency(relatorio.lucroPorArroba)} />
                <Row label="Ponto de equilíbrio da arroba" value={formatCurrency(relatorio.custoPorArroba)} />
                <Row label="Preço-alvo da arroba" value={formatCurrency(relatorio.precoArroba)} />
                <Row label="Status" value={relatorio.decisaoVenda?.statusLabel} />
              </div>
              <p className="ui-input-hint">{relatorio.decisaoVenda?.mensagem}</p>

              {relatorio.simulacaoVenda ? (
                <div className="summary-list">
                  <Row label="Se vender hoje" value={`Lucro estimado de ${formatCurrency(relatorio.simulacaoVenda.vendaHoje.lucro)}`} />
                  <Row label="Se manter por 30 dias" value={`Lucro estimado de ${formatCurrency(relatorio.simulacaoVenda.manter.lucroProjetado)}`} />
                  <Row label="Diferença estimada" value={formatCurrency(relatorio.simulacaoVenda.diferenca)} />
                  <Row label="Aviso" value={relatorio.simulacaoVenda.aviso} />
                </div>
              ) : null}

              {relatorio.sinaisComplementaresVenda?.length ? (
                <div className="summary-list">
                  {relatorio.sinaisComplementaresVenda.map((sinal) => (
                    <p key={sinal} className="ui-input-hint">{sinal}</p>
                  ))}
                </div>
              ) : null}
            </Card>

            <Card title="Manejo, sanidade e suplementação">
              {!relatorio.manejoResultado?.encontrado || (!relatorio.manejoResultado.sanidade?.totalOcorrenciasPeriodo && !relatorio.manejoResultado.suplementacao?.temRegistro) ? (
                <EmptyState compact title="Ainda não há registros suficientes de sanidade ou suplementação para este lote." />
              ) : (
                <>
                  <div className="summary-list">
                    <Row label="Sanidade" value={relatorio.manejoResultado.sanidade?.statusLabel} />
                    <Row label="Suplementação" value={relatorio.manejoResultado.suplementacao?.temRegistro ? `${formatCurrency(relatorio.manejoResultado.suplementacao.custoSuplementoTotal)} no período` : 'Sem registro no período'} />
                    {relatorio.manejoResultado.suplementacao?.temRegistro ? (
                      <>
                        <Row label="Custo de suplemento/cabeça" value={formatCurrency(relatorio.manejoResultado.suplementacao.custoPorCabeca)} />
                        <Row label="Custo de suplemento/@" value={formatCurrency(relatorio.manejoResultado.suplementacao.custoPorArroba)} />
                      </>
                    ) : null}
                  </div>
                  {relatorio.manejoResultado.insights.map((insight) => (
                    <p key={insight} className="ui-input-hint">{insight}</p>
                  ))}
                </>
              )}
            </Card>

            <Card title="Últimas pesagens">
              {!relatorio.ultimasPesagens?.length ? (
                <EmptyState compact title="Ainda não há pesagens para este lote." />
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr><th>Data</th><th>Peso médio</th><th>Observação</th></tr>
                    </thead>
                    <tbody>
                      {relatorio.ultimasPesagens.map((p) => (
                        <tr key={p.id}>
                          <td>{formatDate(p.data)}</td>
                          <td>{formatNumber(p.peso_medio, 1)} kg</td>
                          <td>{p.observacao || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </>
      ) : (
        <EmptyState
          title="Selecione um lote para ver o relatório."
          subtitle="Escolha um lote no campo acima para ver peso, desempenho, custos e resultado."
        />
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="summary-row">
      <span className="summary-row__label">{label}</span>
      <strong className="summary-row__value">{value ?? '—'}</strong>
    </div>
  );
}
