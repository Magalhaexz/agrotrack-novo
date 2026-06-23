import { useMemo, useRef, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import AcoesRelatorio from '../components/relatorios/AcoesRelatorio';
import { buildRelatorioLote } from '../domain/relatorios';
import { gerarResumoLoteTexto } from '../domain/whatsappResumo';
import { formatCurrency, formatDate, formatNumber } from '../utils/calculations';

export default function RelatorioLotePage({ db, onNavigate }) {
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const [loteId, setLoteId] = useState(lotes[0]?.id ?? '');
  const containerRef = useRef(null);

  const relatorio = useMemo(() => (loteId ? buildRelatorioLote(db, loteId) : null), [db, loteId]);

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
            <div className="dashboard-grid dashboard-grid--dual">
              <Card title="Identificação">
                <div className="summary-list">
                  <Row label="Lote" value={relatorio.lote?.nome} />
                  <Row label="Fazenda" value={relatorio.fazendaNome} />
                  <Row label="Pasto atual" value={relatorio.pastagemNome || 'Sem pasto vinculado'} />
                  <Row label="Sistema" value={relatorio.sistema || '—'} />
                  <Row label="Categoria" value={relatorio.categoria || '—'} />
                  <Row label="Cabeças" value={formatNumber(relatorio.totalAnimais, 0)} />
                  <Row label="Situação" value={relatorio.situacao} />
                </div>
              </Card>

              <Card title="Desempenho e resultado">
                <div className="summary-list">
                  <Row label="Peso inicial" value={`${formatNumber(relatorio.pesoInicialMedio, 1)} kg`} />
                  <Row label="Peso atual" value={`${formatNumber(relatorio.pesoAtualMedio, 1)} kg`} />
                  <Row label="GMD" value={`${formatNumber(relatorio.gmdMedio, 2)} kg/dia`} />
                  <Row label="Meta de GMD" value={relatorio.gmdMeta ? `${formatNumber(relatorio.gmdMeta, 2)} kg/dia` : 'Sem meta definida'} />
                  <Row label="Dias no ciclo" value={formatNumber(relatorio.dias, 0)} />
                  <Row label="Custo total" value={formatCurrency(relatorio.custoTotal)} />
                  <Row label="Receita total" value={formatCurrency(relatorio.receitaTotal)} />
                  <Row label="Lucro/prejuízo" value={formatCurrency(relatorio.lucroTotal)} />
                  <Row label="ROI (margem)" value={`${formatNumber(relatorio.margemPct, 1)}%`} />
                </div>
              </Card>
            </div>

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
