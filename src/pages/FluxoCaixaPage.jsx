import { useMemo, useState } from 'react';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../auth/useAuth';
import { calcularFluxoCaixa } from '../domain/fluxoCaixa';
import { normalizarStatusMovimentacao, getDataCompetencia, getDataVencimento } from '../domain/financeiroStatus';
import { formatarMoeda, formatarData } from '../utils/formatters';

function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_LABELS = {
  previsto: 'Previsto',
  realizado: 'Realizado',
  pago: 'Pago',
  cancelado: 'Cancelado',
};

const STATUS_CORES = {
  previsto: '#ca8a04',
  realizado: '#2563eb',
  pago: '#16a34a',
  cancelado: '#6b7280',
};

function BadgeStatus({ status }) {
  const cor = STATUS_CORES[status] || '#6b7280';
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 12,
      fontWeight: 600,
      color: '#fff',
      background: cor,
    }}>
      {STATUS_LABELS[status] || status || 'Legado'}
    </span>
  );
}

function KpiCard({ label, value, destaque }) {
  return (
    <div style={{
      background: 'var(--color-surface, #fff)',
      border: '1px solid var(--color-border, #e5e7eb)',
      borderRadius: 8,
      padding: '12px 16px',
    }}>
      <div style={{ fontSize: 12, color: 'var(--color-muted, #6b7280)', marginBottom: 4 }}>{label}</div>
      <div style={{
        fontSize: 20,
        fontWeight: 700,
        color: destaque === 'danger' ? 'var(--color-danger, #dc2626)'
          : destaque === 'success' ? 'var(--color-success, #16a34a)'
          : destaque === 'warn' ? 'var(--color-warn, #ca8a04)'
          : 'var(--color-text, #111)',
      }}>
        {value}
      </div>
    </div>
  );
}

export default function FluxoCaixaPage({ db }) {
  const { hasPermission } = useAuth();

  const lotes = useMemo(() => (Array.isArray(db?.lotes) ? db.lotes : []), [db]);

  const [filtros, setFiltros] = useState({
    loteId: '',
    statusFiltro: 'todos',
    dataInicio: '',
    dataFim: getTodayIso(),
  });

  const movimentacoesBase = useMemo(() => (
    Array.isArray(db?.movimentacoes_financeiras) ? db.movimentacoes_financeiras : []
  ), [db]);

  const movimentacoesFiltradas = useMemo(() => {
    let lista = movimentacoesBase;

    if (filtros.loteId) {
      lista = lista.filter((mov) => Number(mov?.lote_id) === Number(filtros.loteId));
    }

    if (filtros.statusFiltro !== 'todos') {
      lista = lista.filter((mov) => {
        const status = normalizarStatusMovimentacao(mov);
        if (filtros.statusFiltro === 'legado') return !mov?.status;
        return status === filtros.statusFiltro;
      });
    }

    if (filtros.dataInicio) {
      lista = lista.filter((mov) => {
        const dc = getDataCompetencia(mov);
        return dc && dc >= filtros.dataInicio;
      });
    }

    if (filtros.dataFim) {
      lista = lista.filter((mov) => {
        const dc = getDataCompetencia(mov);
        return dc && dc <= filtros.dataFim;
      });
    }

    return lista;
  }, [movimentacoesBase, filtros]);

  const resumo = useMemo(() => calcularFluxoCaixa(movimentacoesFiltradas, {
    hoje: getTodayIso(),
    loteId: filtros.loteId ? Number(filtros.loteId) : undefined,
  }), [movimentacoesFiltradas, filtros.loteId]);

  if (!hasPermission('financeiro:ver')) {
    return (
      <div className="page">
        <PageHeader title="Fluxo de Caixa" subtitle="Sem permissão para acessar esta página." />
      </div>
    );
  }

  const linhasTabela = [...movimentacoesFiltradas]
    .sort((a, b) => {
      const da = getDataCompetencia(a) || '';
      const db2 = getDataCompetencia(b) || '';
      return db2.localeCompare(da);
    })
    .slice(0, 200);

  return (
    <div className="page">
      <PageHeader
        title="Fluxo de Caixa"
        subtitle="Visão de entradas, saídas e posição financeira por status."
      />

      <Card title="Filtros">
        <div className="form-grid two">
          <Input
            as="select"
            label="Lote"
            value={filtros.loteId}
            onChange={(e) => setFiltros((prev) => ({ ...prev, loteId: e.target.value }))}
          >
            <option value="">Todos os lotes</option>
            {lotes.map((lote) => (
              <option key={lote.id} value={lote.id}>{lote.nome || `Lote ${lote.id}`}</option>
            ))}
          </Input>

          <Input
            as="select"
            label="Status"
            value={filtros.statusFiltro}
            onChange={(e) => setFiltros((prev) => ({ ...prev, statusFiltro: e.target.value }))}
          >
            <option value="todos">Todos</option>
            <option value="pago">Pago</option>
            <option value="realizado">Realizado (não pago)</option>
            <option value="previsto">Previsto</option>
            <option value="cancelado">Cancelado</option>
            <option value="legado">Legado (sem status)</option>
          </Input>

          <Input
            label="Data competência — de"
            type="date"
            value={filtros.dataInicio}
            onChange={(e) => setFiltros((prev) => ({ ...prev, dataInicio: e.target.value }))}
          />
          <Input
            label="Data competência — até"
            type="date"
            value={filtros.dataFim}
            onChange={(e) => setFiltros((prev) => ({ ...prev, dataFim: e.target.value }))}
          />
        </div>
      </Card>

      <Card title="Resumo de caixa">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          <KpiCard label="Total recebido" value={formatarMoeda(resumo.totalRecebido)} destaque="success" />
          <KpiCard label="Total pago" value={formatarMoeda(resumo.totalPago)} destaque="danger" />
          <KpiCard
            label="Saldo de caixa"
            value={formatarMoeda(resumo.saldoCaixa)}
            destaque={resumo.saldoCaixa >= 0 ? 'success' : 'danger'}
          />
          <KpiCard label="A receber" value={formatarMoeda(resumo.contasAReceber)} />
          <KpiCard label="A pagar" value={formatarMoeda(resumo.contasAPagar)} />
          <KpiCard label="Previsto futuro" value={formatarMoeda(resumo.previstoFuturo)} destaque="warn" />
          <KpiCard
            label="Vencido"
            value={formatarMoeda(resumo.vencido)}
            destaque={resumo.vencido > 0 ? 'danger' : undefined}
          />
        </div>
      </Card>

      <Card title={`Movimentações (${linhasTabela.length} de ${movimentacoesFiltradas.length})`}>
        {!movimentacoesFiltradas.length ? (
          <div className="empty-state">
            <strong>Nenhuma movimentação encontrada.</strong>
            <span>Ajuste os filtros ou registre movimentações financeiras.</span>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data comp.</th>
                  <th>Tipo</th>
                  <th>Categoria</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Vencimento</th>
                </tr>
              </thead>
              <tbody>
                {linhasTabela.map((mov) => {
                  const status = normalizarStatusMovimentacao(mov);
                  const dataComp = getDataCompetencia(mov);
                  const dataVenc = getDataVencimento(mov);
                  const isReceita = mov?.tipo === 'receita';
                  return (
                    <tr key={mov.id}>
                      <td>{formatarData(dataComp)}</td>
                      <td>
                        <span style={{ color: isReceita ? 'var(--color-success, #16a34a)' : 'var(--color-danger, #dc2626)', fontWeight: 600 }}>
                          {isReceita ? '↑ Receita' : '↓ Despesa'}
                        </span>
                      </td>
                      <td>{mov?.categoria || '—'}</td>
                      <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {mov?.descricao || '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        <span style={{ color: isReceita ? 'var(--color-success, #16a34a)' : 'inherit' }}>
                          {formatarMoeda(mov?.valor)}
                        </span>
                      </td>
                      <td><BadgeStatus status={mov?.status ? status : null} /></td>
                      <td>{dataVenc !== dataComp ? formatarData(dataVenc) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
