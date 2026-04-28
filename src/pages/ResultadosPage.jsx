import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  FileText,
  Info,
  Loader2,
  MapPin,
  Package,
  Pill,
  Scale,
  TrendingUp,
  Truck,
} from 'lucide-react';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Table from '../components/ui/Table';
import { calcLote, formatCurrency, formatDate, formatNumber } from '../utils/calculations';
import { getResumoLote } from '../domain/resumoLote';
import '../styles/relatorios.css';

const REPORT_TYPES = [
  {
    id: 'lote',
    title: 'Relatórios por lote',
    description: 'Indicadores produtivos, financeiros e operacionais por lote.',
    purpose: 'Ideal para fechar leitura de lote, conferir custo e acompanhar peso e margem.',
    output: 'Resumo executivo e tabela operacional por lote.',
    icon: FileText,
  },
  {
    id: 'fazenda',
    title: 'Relatórios por fazenda',
    description: 'Consolidação dos resultados por fazenda e capacidade operacional.',
    purpose: 'Bom para comparar unidades, capacidade operacional e concentracao do rebanho.',
    output: 'Consolidado por fazenda com leitura de margem e receita.',
    icon: MapPin,
  },
  {
    id: 'sanitario',
    title: 'Relatórios sanitários',
    description: 'Protocolos aplicados, pendências, responsáveis e agenda de manejo.',
    purpose: 'Ajuda a priorizar vencimentos, proximos manejos e gargalos sanitarios.',
    output: 'Agenda sanitaria e base de protocolos filtrados.',
    icon: Pill,
  },
  {
    id: 'estoque',
    title: 'Relatórios de estoque',
    description: 'Saldo, criticidade, movimentações e cobertura operacional.',
    purpose: 'Serve para compras, reposicao, leitura de saldo e monitoramento de validade.',
    output: 'Saldo consolidado e movimentacoes do periodo.',
    icon: Package,
  },
  {
    id: 'financeiro',
    title: 'Relatórios financeiros',
    description: 'Despesas, receitas, categorias e visão pronta para DRE.',
    purpose: 'Apoia fechamento operacional, leitura de caixa e preparacao para DRE.',
    output: 'Lancamentos filtrados e resumo financeiro do escopo.',
    icon: DollarSign,
  },
  {
    id: 'desempenho',
    title: 'Relatórios de desempenho',
    description: 'Ranking zootécnico, metas de GMD e evolução recente de peso.',
    purpose: 'Facilita priorizacao dos lotes acima ou abaixo da meta de desempenho.',
    output: 'Ranking zootecnico e destaques do periodo.',
    icon: TrendingUp,
  },
];

const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'ativo', label: 'Somente ativos' },
  { value: 'encerrado', label: 'Somente encerrados' },
];

function createDefaultFilters(bounds) {
  return {
    periodo: 'all',
    dataInicio: bounds.min || '',
    dataFim: bounds.max || '',
    fazendaId: 'todas',
    loteId: 'todos',
    status: 'todos',
  };
}

export default function ResultadosPage({ db }) {
  const timerRef = useRef(null);
  const dateBounds = useMemo(() => getDateBounds(db), [db]);
  const defaultFilters = useMemo(() => createDefaultFilters(dateBounds), [dateBounds]);
  const [selectedReport, setSelectedReport] = useState('lote');
  const [draftFilters, setDraftFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [isGenerating, setIsGenerating] = useState(false);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    setDraftFilters((prev) => ({
      ...defaultFilters,
      fazendaId: prev?.fazendaId || defaultFilters.fazendaId,
      loteId: prev?.loteId || defaultFilters.loteId,
      status: prev?.status || defaultFilters.status,
    }));
    setAppliedFilters((prev) => ({
      ...defaultFilters,
      fazendaId: prev?.fazendaId || defaultFilters.fazendaId,
      loteId: prev?.loteId || defaultFilters.loteId,
      status: prev?.status || defaultFilters.status,
    }));
  }, [defaultFilters]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const fazendas = useMemo(() => db?.fazendas || [], [db?.fazendas]);
  const lotes = useMemo(() => {
    const todos = db?.lotes || [];
    if (draftFilters.fazendaId === 'todas') {
      return todos;
    }
    return todos.filter((lote) => String(lote.faz_id) === String(draftFilters.fazendaId));
  }, [db?.lotes, draftFilters.fazendaId]);

  const reportBundle = useMemo(() => buildReportBundle(db, appliedFilters), [db, appliedFilters]);
  const activeReport = reportBundle[selectedReport];
  const selectedReportMeta = useMemo(
    () => REPORT_TYPES.find((report) => report.id === selectedReport) || REPORT_TYPES[0],
    [selectedReport]
  );
  const reportCatalogSummary = useMemo(
    () => [
      {
        label: 'Modulo ativo',
        value: selectedReportMeta.title
          .replace('Relatórios por ', '')
          .replace('Relatórios de ', '')
          .replace('Relatório ', ''),
        helper: 'leitura principal selecionada',
      },
      { label: 'Escopo atual', value: activeReport.exportConfig.sheets.length, helper: 'abas consolidadas nesta visao' },
      { label: 'Base exportavel', value: activeReport.exportConfig.totalRows, helper: 'linhas preparadas para futura exportacao' },
    ],
    [activeReport, selectedReportMeta]
  );
  const filterSummary = useMemo(
    () => [
      {
        label: 'Periodo aplicado',
        value: activeReport.periodLabel,
        helper: 'janela mestre usada em todos os cards e tabelas',
      },
      {
        label: 'Escopo operacional',
        value: activeReport.scopeLabel,
        helper: 'fazenda, lote e status refletidos na mesma leitura',
      },
      {
        label: 'Saida sugerida',
        value: selectedReportMeta.output,
        helper: 'estrutura pronta para leitura e futura exportacao',
      },
    ],
    [activeReport.periodLabel, activeReport.scopeLabel, selectedReportMeta.output]
  );
  const workflowSteps = useMemo(
    () => [
      {
        label: '1. Defina o escopo',
        value: 'Use o filtro mestre para travar periodo, fazenda, lote e status antes da leitura.',
      },
      {
        label: '2. Escolha o relatorio',
        value: selectedReportMeta.purpose,
      },
      {
        label: '3. Leia e exporte',
        value: 'A tela ja entrega resumo, destaques, tabelas e base preparada para PDF ou XLSX.',
      },
    ],
    [selectedReportMeta.purpose]
  );

  function applyFilters() {
    if (draftFilters.dataInicio && draftFilters.dataFim && draftFilters.dataInicio > draftFilters.dataFim) {
      setValidationError('A data inicial precisa ser menor ou igual à data final.');
      return;
    }

    setValidationError('');
    setIsGenerating(true);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setAppliedFilters(draftFilters);
      setIsGenerating(false);
    }, 280);
  }

  function resetFilters() {
    setValidationError('');
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
  }

  function applyPreset(periodo) {
    const range = getPresetRange(periodo, dateBounds);
    setDraftFilters((prev) => ({
      ...prev,
      periodo,
      dataInicio: range.start,
      dataFim: range.end,
    }));
  }

  return (
    <div className="reports-page">
      <PageHeader
        title="Relatórios"
        subtitle="Fechamento operacional completo com filtros por período, leitura executiva e base pronta para exportação futura."
        actions={(
          <div className="reports-page-actions">
            <Badge variant="info">Deploy ready</Badge>
            <Button variant="outline" onClick={resetFilters}>
              Limpar filtros
            </Button>
            <Button loading={isGenerating} onClick={applyFilters}>
              Atualizar visão
            </Button>
          </div>
        )}
      />

      <div className="reports-module-strip">
        {reportCatalogSummary.map((item) => (
          <div key={item.label} className="reports-module-chip">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.helper}</small>
          </div>
        ))}
      </div>

      <div className="reports-layout">
        <Card className="reports-filter-card" title="Filtro mestre" subtitle="Defina um escopo único para leitura, comparação e futura exportação do módulo inteiro.">
          <div className="reports-filter-meta">
            <Badge variant="neutral">Base: {formatDate(dateBounds.min) || '--'} até {formatDate(dateBounds.max) || '--'}</Badge>
            <Badge variant="info">Exportação futura preparada</Badge>
          </div>

          <div className="reports-preset-row">
            {[
              { id: 'all', label: 'Tudo' },
              { id: '30', label: '30d' },
              { id: '90', label: '90d' },
              { id: 'year', label: 'Ano-base' },
              { id: 'custom', label: 'Customizado' },
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`reports-preset-button ${draftFilters.periodo === preset.id ? 'active' : ''}`}
                onClick={() => applyPreset(preset.id)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="reports-filter-grid">
            <Input
              label="Data inicial"
              type="date"
              value={draftFilters.dataInicio}
              onChange={(event) => setDraftFilters((prev) => ({ ...prev, periodo: 'custom', dataInicio: event.target.value }))}
            />
            <Input
              label="Data final"
              type="date"
              value={draftFilters.dataFim}
              onChange={(event) => setDraftFilters((prev) => ({ ...prev, periodo: 'custom', dataFim: event.target.value }))}
            />

            <label className="ui-input-wrap">
              <span className="ui-input-label">Fazenda</span>
              <select
                className="ui-input"
                value={draftFilters.fazendaId}
                onChange={(event) => {
                  const fazendaId = event.target.value;
                  setDraftFilters((prev) => ({
                    ...prev,
                    fazendaId,
                    loteId: fazendaId === 'todas' ? prev.loteId : 'todos',
                  }));
                }}
              >
                <option value="todas">Todas as fazendas</option>
                {fazendas.map((fazenda) => (
                  <option key={fazenda.id} value={String(fazenda.id)}>
                    {fazenda.nome}
                  </option>
                ))}
              </select>
            </label>

            <label className="ui-input-wrap">
              <span className="ui-input-label">Lote</span>
              <select
                className="ui-input"
                value={draftFilters.loteId}
                onChange={(event) => setDraftFilters((prev) => ({ ...prev, loteId: event.target.value }))}
              >
                <option value="todos">Todos os lotes</option>
                {lotes.map((lote) => (
                  <option key={lote.id} value={String(lote.id)}>
                    {lote.nome}
                  </option>
                ))}
              </select>
            </label>

            <label className="ui-input-wrap full">
              <span className="ui-input-label">Status do lote</span>
              <select
                className="ui-input"
                value={draftFilters.status}
                onChange={(event) => setDraftFilters((prev) => ({ ...prev, status: event.target.value }))}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {validationError ? (
            <div className="reports-error-banner">
              <AlertTriangle size={16} />
              <span>{validationError}</span>
            </div>
          ) : null}

          <div className="reports-filter-foot">
            <div>
              <span className="reports-filter-label">Escopo atual</span>
              <strong>{activeReport.scopeLabel}</strong>
            </div>
            <Button variant="outline" onClick={applyFilters} loading={isGenerating}>
              Aplicar filtros
            </Button>
          </div>

          <div className="reports-filter-summary-grid">
            {filterSummary.map((item) => (
              <div key={item.label} className="reports-filter-summary-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.helper}</small>
              </div>
            ))}
          </div>
        </Card>

        <div className="reports-content">
          <div className="reports-type-grid">
            {REPORT_TYPES.map((report) => {
              const Icon = report.icon;
              const data = reportBundle[report.id];
              const active = selectedReport === report.id;

              return (
                <button
                  key={report.id}
                  type="button"
                  className={`report-type-card ${active ? 'active' : ''}`}
                  onClick={() => setSelectedReport(report.id)}
                >
                  <div className="report-type-card-head">
                    <div className="report-type-icon">
                      <Icon size={18} aria-hidden="true" />
                    </div>
                    <Badge variant={data.catalogTone}>{data.catalogBadge}</Badge>
                  </div>
                  <strong>{report.title}</strong>
                  <p>{report.description}</p>
                  <div className="report-type-card-copy">
                    <span>Serve para</span>
                    <small>{report.purpose}</small>
                  </div>
                  <div className="report-type-card-foot">
                    <span>{data.catalogMetric}</span>
                    <small>{report.output}</small>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="reports-context-band">
            <div className="reports-context-head">
              <div>
                <span className="reports-context-kicker">Faixa contextual</span>
                <strong>{selectedReportMeta.title}</strong>
                <p>{selectedReportMeta.purpose}</p>
              </div>
              <Badge variant="info">{activeReport.periodLabel}</Badge>
            </div>

            <div className="reports-workflow-strip">
              {workflowSteps.map((step) => (
                <div key={step.label} className="reports-workflow-card">
                  <span>{step.label}</span>
                  <strong>{step.value}</strong>
                </div>
              ))}
            </div>
          </div>

          {isGenerating ? (
            <Card className="reports-loading-card">
              <div className="reports-loading-state">
                <Loader2 size={22} className="ui-spin" />
                <div>
                  <strong>Atualizando relatórios</strong>
                  <p>Aplicando período, escopo operacional e preparando a base visual e futura de exportação.</p>
                </div>
              </div>
            </Card>
          ) : (
            <>
              <Card
                className="report-hero-card"
                title={activeReport.title}
                subtitle={activeReport.description}
                action={<Badge variant="info">Estrutura pronta para exportação</Badge>}
              >
                <div className="report-hero-badges">
                  <Badge variant="neutral">{activeReport.scopeLabel}</Badge>
                  <Badge variant="neutral">{activeReport.periodLabel}</Badge>
                  <Badge variant={activeReport.healthTone}>{activeReport.healthLabel}</Badge>
                </div>

                <div className="report-export-summary">
                  <div>
                    <span className="report-export-label">Arquivo sugerido</span>
                    <strong>{activeReport.exportConfig.filename}</strong>
                    <p>
                      {activeReport.exportConfig.sheets.length} abas prontas, {activeReport.exportConfig.totalRows} linhas mapeadas e
                      payload com filtros, metadados e resumo.
                    </p>
                  </div>
                  <Button variant="outline" disabled>
                    PDF / XLSX em breve
                  </Button>
                </div>
              </Card>

              {activeReport.notes.length ? (
                <div className="report-note-stack">
                  {activeReport.notes.map((note) => (
                    <div key={note.title} className={`report-note report-note--${note.variant}`}>
                      {note.variant === 'warning' ? <AlertTriangle size={16} /> : note.variant === 'success' ? <CheckCircle2 size={16} /> : <Info size={16} />}
                      <div>
                        <strong>{note.title}</strong>
                        <span>{note.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="reports-kpi-grid">
                {activeReport.summary.map((item) => (
                  <article key={item.label} className={`report-stat-card report-stat-card--${item.variant}`}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    <small>{item.helper}</small>
                  </article>
                ))}
              </div>

              <div className="reports-detail-grid">
                <Card title="Leitura executiva" subtitle="Destaques do período e pontos de atenção">
                  {activeReport.highlights.length ? (
                    <div className="report-highlight-list">
                      {activeReport.highlights.map((highlight) => (
                        <div key={highlight.label} className="report-highlight-item">
                          <div>
                            <strong>{highlight.label}</strong>
                            <p>{highlight.value}</p>
                          </div>
                          <span>{highlight.detail}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      compact
                      title="Nenhum destaque calculado"
                      subtitle="Ajuste o período ou amplie o escopo para gerar uma leitura executiva."
                    />
                  )}
                </Card>

                <Card title="Base para exportação futura" subtitle="A mesma estrutura já serve para PDF, XLSX ou integrações">
                  <div className="report-export-sheet-list">
                    {activeReport.exportConfig.sheets.map((sheet) => (
                      <div key={sheet.name} className="report-export-sheet">
                        <strong>{sheet.name}</strong>
                        <span>{sheet.rowCount} linhas</span>
                        <small>{sheet.columns.join(' • ') || 'Sem colunas mapeadas'}</small>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {activeReport.tables.map((table) => (
                <Card
                  key={table.id}
                  title={table.title}
                  subtitle={table.description}
                  action={<Badge variant={table.badgeVariant}>{table.badgeLabel}</Badge>}
                >
                  <Table
                    columns={table.columns}
                    rows={table.rows}
                    emptyTitle={table.emptyTitle}
                    emptySubtitle={table.emptySubtitle}
                    mobileTitleKey={table.mobileTitleKey}
                    mobileSubtitleKey={table.mobileSubtitleKey}
                  />
                </Card>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function buildReportBundle(db, filters) {
  const fazendas = Array.isArray(db?.fazendas) ? db.fazendas : [];
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const sanitario = Array.isArray(db?.sanitario) ? db.sanitario : [];
  const estoque = Array.isArray(db?.estoque) ? db.estoque : [];
  const pesagens = Array.isArray(db?.pesagens) ? db.pesagens : [];
  const movimentacoesEstoque = Array.isArray(db?.movimentacoes_estoque) ? db.movimentacoes_estoque : [];
  const movimentacoesFinanceiras = Array.isArray(db?.movimentacoes_financeiras) ? db.movimentacoes_financeiras : [];
  const movimentacoesAnimais = Array.isArray(db?.movimentacoes_animais) ? db.movimentacoes_animais : [];
  const funcionarios = Array.isArray(db?.funcionarios) ? db.funcionarios : [];

  const fazendaMap = new Map(fazendas.map((fazenda) => [Number(fazenda.id), fazenda]));
  const loteMap = new Map(lotes.map((lote) => [Number(lote.id), lote]));
  const estoqueMap = new Map(estoque.map((item) => [Number(item.id), item]));
  const funcionarioMap = new Map(funcionarios.map((funcionario) => [Number(funcionario.id), funcionario]));

  const visibleLotes = lotes
    .filter((lote) => matchesFarm(lote, filters.fazendaId))
    .filter((lote) => matchesLote(lote, filters.loteId))
    .filter((lote) => matchesStatus(lote, filters.status))
    .map((lote) => {
      const indicadoresProdutivos = calcLote(db, lote.id);
      const resumo = getResumoLote(db, lote.id);
      const indicadores = {
        ...indicadoresProdutivos,
        custoTotalLote: Number(resumo.custoTotal || 0),
        receitaTotal: Number(resumo.receitaTotal || 0),
        margem: Number(resumo.lucroTotal || 0),
        margemPct: Number(resumo.margemPct || 0),
        custoPorCabeca: Number(resumo.custoPorCabeca || 0),
        custoPorArroba: Number(resumo.custoPorArroba || 0),
        lucroPorCabeca: Number(resumo.lucroPorCabeca || 0),
        lucroPorArroba: Number(resumo.lucroPorArroba || 0),
      };
      const fazenda = fazendaMap.get(Number(lote.faz_id));
      const custosPeriodo = movimentacoesFinanceiras.filter(
        (item) =>
          item.tipo === 'despesa' &&
          Number(item.lote_id) === Number(lote.id) &&
          dateInRange(item.data, filters.dataInicio, filters.dataFim)
      );
      const pesagensPeriodo = pesagens.filter(
        (item) => Number(item.lote_id) === Number(lote.id) && dateInRange(item.data, filters.dataInicio, filters.dataFim)
      );
      const sanitarioPeriodo = sanitario.filter(
        (item) =>
          Number(item.lote_id) === Number(lote.id) &&
          dateRangeIncludes([item.data_aplic, item.proxima], filters.dataInicio, filters.dataFim)
      );

      return {
        lote,
        fazenda,
        indicadores,
        custosPeriodo,
        pesagensPeriodo,
        sanitarioPeriodo,
      };
    });

  const visibleLoteIds = new Set(visibleLotes.map((item) => Number(item.lote.id)));
  const visibleFazendaIds = new Set(visibleLotes.map((item) => Number(item.lote.faz_id)));

  const sanitaryRows = sanitario
    .filter((item) => visibleLoteIds.has(Number(item.lote_id)))
    .filter((item) => dateRangeIncludes([item.data_aplic, item.proxima], filters.dataInicio, filters.dataFim))
    .map((item) => {
      const lote = loteMap.get(Number(item.lote_id));
      const fazenda = fazendaMap.get(Number(lote?.faz_id));
      const status = resolveSanitaryStatus(item);
      return {
        id: item.id,
        tipo: capitalize(item.tipo || 'manejo'),
        descricao: item.desc || item.descricao || '-',
        lote: lote?.nome || '-',
        fazenda: fazenda?.nome || '-',
        aplicacao: formatDate(item.data_aplic),
        proxima: formatDate(item.proxima),
        responsavel: funcionarioMap.get(Number(item.funcionario_responsavel_id))?.nome || '-',
        status,
        observacao: item.obs || '-',
      };
    })
    .sort((a, b) => priorityRank(a.status) - priorityRank(b.status));

  const stockItemRows = estoque.map((item) => {
    const saldo = Number(item.quantidade_atual || 0);
    const minimo = Number(item.quantidade_minima || 0);
    const ratio = minimo > 0 ? saldo / minimo : saldo > 0 ? 2 : 0;
    const status = ratio <= 1 ? 'Crítico' : ratio <= 1.4 ? 'Baixo' : 'Saudável';
    const movimentosRelacionados = movimentacoesEstoque.filter((movimento) => Number(movimento.item_estoque_id) === Number(item.id));
    const consumos = movimentosRelacionados.filter((movimento) => ['saida', 'consumo', 'tratamento', 'perda'].includes(movimento.tipo));
    const consumoMedio = consumos.length
      ? consumos.reduce((total, movimento) => total + Number(movimento.quantidade || 0), 0) / consumos.length
      : 0;
    const cobertura = consumoMedio > 0 ? saldo / consumoMedio : null;

    return {
      id: item.id,
      item: item.produto || item.nome || '-',
      categoria: capitalize(item.categoria || 'outros'),
      saldo: `${formatNumber(saldo, 0)} ${item.unidade || ''}`.trim(),
      minimo: `${formatNumber(minimo, 0)} ${item.unidade || ''}`.trim(),
      valor: formatCurrency(saldo * Number(item.valor_unitario || 0)),
      cobertura: cobertura == null ? 'Sem consumo' : `${formatNumber(cobertura, 1)} dias`,
      status,
      validade: formatDate(item.data_validade),
    };
  });

  const stockMovementRows = movimentacoesEstoque
    .filter((movimento) => dateInRange(movimento.data, filters.dataInicio, filters.dataFim))
    .filter((movimento) => {
      if (filters.loteId !== 'todos') {
        return Number(movimento.lote_id) === Number(filters.loteId);
      }
      if (filters.fazendaId !== 'todas') {
        const lote = loteMap.get(Number(movimento.lote_id));
        return lote ? Number(lote.faz_id) === Number(filters.fazendaId) : false;
      }
      return true;
    })
    .map((movimento) => ({
      id: movimento.id,
      data: formatDate(movimento.data),
      item: estoqueMap.get(Number(movimento.item_estoque_id))?.produto || '-',
      tipo: capitalize(movimento.tipo || '-'),
      lote: loteMap.get(Number(movimento.lote_id))?.nome || 'Operação geral',
      quantidade: formatNumber(movimento.quantidade, 1),
      valor: formatCurrency(movimento.valor_total || 0),
    }))
    .sort((a, b) => sortDateDesc(a.data, b.data));

  const financialRows = movimentacoesFinanceiras
    .filter((item) => dateInRange(item.data, filters.dataInicio, filters.dataFim))
    .filter((item) => {
      if (filters.loteId !== 'todos') {
        return Number(item.lote_id) === Number(filters.loteId);
      }
      if (filters.fazendaId !== 'todas') {
        const lote = loteMap.get(Number(item.lote_id));
        return lote ? Number(lote.faz_id) === Number(filters.fazendaId) : !item.lote_id;
      }
      return true;
    })
    .map((item) => ({
      id: `fin-${item.id}`,
      categoria: item.categoria || (item.tipo === 'receita' ? 'Receita geral' : 'Despesa geral'),
      origem: item.descricao || item.observacao || item.fornecedor || item.comprador || '-',
      lote: loteMap.get(Number(item.lote_id))?.nome || 'Geral',
      fazenda: fazendaMap.get(Number(loteMap.get(Number(item.lote_id))?.faz_id))?.nome || 'Geral',
      tipo: item.tipo === 'receita' ? 'Receita' : 'Despesa',
      data: formatDate(item.data),
      valor: Number(item.valor || 0),
    }));

  const animalRevenueRows = movimentacoesAnimais
    .filter((item) => item.tipo === 'venda')
    .filter((item) => dateInRange(item.data, filters.dataInicio, filters.dataFim))
    .filter((item) => visibleLoteIds.has(Number(item.lote_id)))
    .map((item) => ({
      id: `venda-${item.id}`,
      categoria: 'Venda de animais',
      origem: item.comprador_fornecedor || 'Cliente',
      lote: loteMap.get(Number(item.lote_id))?.nome || '-',
      fazenda: fazendaMap.get(Number(loteMap.get(Number(item.lote_id))?.faz_id))?.nome || '-',
      tipo: 'Receita',
      data: formatDate(item.data),
      valor: Number(item.valor_total || 0),
    }));

  const ledgerRows = [...financialRows, ...animalRevenueRows];
  const ledgerExpense = ledgerRows.filter((row) => row.tipo !== 'Receita').reduce((total, row) => total + row.valor, 0);
  const ledgerRevenue = ledgerRows.filter((row) => row.tipo === 'Receita').reduce((total, row) => total + row.valor, 0);
  const potentialRevenue = visibleLotes.reduce((total, item) => total + Number(item.indicadores.receitaTotal || 0), 0);

  const performanceRows = visibleLotes.map((item) => {
    const ultimaPesagem = item.pesagensPeriodo.slice().sort((a, b) => String(a.data).localeCompare(String(b.data))).at(-1);
    const gmdMeta = Number(item.lote.gmd_meta || 0);
    const gap = Number(item.indicadores.gmdMedio || 0) - gmdMeta;
    return {
      id: item.lote.id,
      lote: item.lote.nome,
      fazenda: item.fazenda?.nome || '-',
      gmd: Number(item.indicadores.gmdMedio || 0),
      meta: gmdMeta,
      gap,
      pesoAtual: ultimaPesagem?.peso_medio || item.indicadores.pesoAtualMedio || 0,
      custoCabeca: Number(item.indicadores.custoPorCabeca || 0),
      margem: Number(item.indicadores.margem || 0),
      status: gap >= 0 ? 'Acima da meta' : 'Abaixo da meta',
      pesagem: formatDate(ultimaPesagem?.data),
    };
  });

  const farmRows = Array.from(visibleFazendaIds).map((fazendaId) => {
    const fazenda = fazendaMap.get(Number(fazendaId));
    const lotesDaFazenda = visibleLotes.filter((item) => Number(item.lote.faz_id) === Number(fazendaId));
    const animais = lotesDaFazenda.reduce((total, item) => total + Number(item.indicadores.totalAnimais || 0), 0);
    const margem = lotesDaFazenda.reduce((total, item) => total + Number(item.indicadores.margem || 0), 0);
    const receita = lotesDaFazenda.reduce((total, item) => total + Number(item.indicadores.receitaTotal || 0), 0);
    const custoPeriodo = lotesDaFazenda.reduce(
      (total, item) => total + item.custosPeriodo.reduce((subtotal, custo) => subtotal + Number(custo.valor || 0), 0),
      0
    );
    const consumoEstoque = movimentacoesEstoque
      .filter((movimento) => dateInRange(movimento.data, filters.dataInicio, filters.dataFim))
      .filter((movimento) => {
        const lote = loteMap.get(Number(movimento.lote_id));
        return lote ? Number(lote.faz_id) === Number(fazendaId) : false;
      })
      .reduce((total, movimento) => total + Number(movimento.valor_total || 0), 0);

    return {
      id: fazendaId,
      fazenda: fazenda?.nome || '-',
      lotes: lotesDaFazenda.length,
      animais,
      receita,
      custoPeriodo,
      margem,
      consumoEstoque,
      ocupacao: fazenda?.capacidade_ua
        ? `${formatNumber((animais / Number(fazenda.capacidade_ua || 1)) * 100, 1)}%`
        : 'Sem capacidade',
    };
  });

  const lotReportRows = visibleLotes.map((item) => ({
    id: item.lote.id,
    lote: item.lote.nome,
    fazenda: item.fazenda?.nome || '-',
    status: item.lote.status || 'ativo',
    animais: Number(item.indicadores.totalAnimais || 0),
    gmd: Number(item.indicadores.gmdMedio || 0),
    pesoAtual: Number(item.indicadores.pesoAtualMedio || 0),
    custoPeriodo: item.custosPeriodo.reduce((total, custo) => total + Number(custo.valor || 0), 0),
    margem: Number(item.indicadores.margem || 0),
    sanidadePendente: item.sanitarioPeriodo.filter((registro) => resolveSanitaryStatus(registro) !== 'Em dia').length,
  }));

  const stockCriticalCount = stockItemRows.filter((item) => item.status === 'Crítico').length;
  const lotMarginTotal = lotReportRows.reduce((total, item) => total + item.margem, 0);
  const totalAnimals = lotReportRows.reduce((total, item) => total + item.animais, 0);
  const performanceAboveMeta = performanceRows.filter((item) => item.gap >= 0).length;
  const averageGmd = performanceRows.length
    ? performanceRows.reduce((total, item) => total + item.gmd, 0) / performanceRows.length
    : 0;

  const reports = {
    lote: {
      title: 'Relatório por lote',
      description: 'Panorama executivo de lote com foco em margem, evolução e pressão sanitária.',
      scopeLabel: describeScope(filters, visibleLotes.length),
      periodLabel: describePeriod(filters.dataInicio, filters.dataFim),
      healthLabel: lotMarginTotal >= 0 ? 'Margem consolidada positiva' : 'Margem consolidada em alerta',
      healthTone: lotMarginTotal >= 0 ? 'success' : 'warning',
      catalogBadge: lotReportRows.length ? 'Operando' : 'Sem dados',
      catalogTone: lotReportRows.length ? 'info' : 'neutral',
      catalogMetric: `${lotReportRows.length} lotes no escopo`,
      notes: [],
      summary: [
        createSummary('Lotes analisados', String(lotReportRows.length), 'Com filtros aplicados', 'info'),
        createSummary('Animais no escopo', formatNumber(totalAnimals, 0), 'Base atual consolidada', 'neutral'),
        createSummary(
          'Custos no período',
          formatCurrency(lotReportRows.reduce((total, item) => total + item.custoPeriodo, 0)),
          'Somente despesas operacionais filtradas',
          'warning'
        ),
        createSummary('Margem estimada', formatCurrency(lotMarginTotal), 'Receita potencial menos custo total', lotMarginTotal >= 0 ? 'success' : 'danger'),
      ],
      highlights: buildLotHighlights(lotReportRows),
      exportConfig: createExportConfig('relatorio-lote', filters, [
        { name: 'Resumo', rows: lotReportRows.map((row) => ({ lote: row.lote, fazenda: row.fazenda, animais: row.animais, margem: row.margem })) },
        { name: 'Sanidade', rows: sanitaryRows.map((row) => ({ lote: row.lote, status: row.status, proxima: row.proxima })) },
      ]),
      tables: [
        {
          id: 'lotes',
          title: 'Panorama por lote',
          description: 'Resumo produtivo, financeiro e sanitário em uma única visão.',
          badgeLabel: `${lotReportRows.length} registros`,
          badgeVariant: 'neutral',
          emptyTitle: 'Nenhum lote encontrado',
          emptySubtitle: 'Amplie o período ou remova filtros específicos para visualizar os lotes.',
          mobileTitleKey: 'lote',
          mobileSubtitleKey: 'fazenda',
          columns: [
            { key: 'lote', label: 'Lote' },
            { key: 'fazenda', label: 'Fazenda' },
            { key: 'animais', label: 'Animais', render: (row) => formatNumber(row.animais, 0) },
            { key: 'gmd', label: 'GMD', render: (row) => `${formatNumber(row.gmd, 3)} kg/dia` },
            { key: 'pesoAtual', label: 'Peso médio', render: (row) => `${formatNumber(row.pesoAtual, 1)} kg` },
            { key: 'custoPeriodo', label: 'Custos', render: (row) => formatCurrency(row.custoPeriodo) },
            { key: 'margem', label: 'Margem', render: (row) => <span className={row.margem >= 0 ? 'text-success' : 'text-danger'}>{formatCurrency(row.margem)}</span> },
            { key: 'status', label: 'Status', render: (row) => <Badge variant={row.status === 'ativo' ? 'success' : 'neutral'}>{capitalize(row.status)}</Badge> },
          ],
          rows: lotReportRows,
        },
      ],
    },
    fazenda: {
      title: 'Relatório por fazenda',
      description: 'Consolidação dos lotes, estoque e pressão econômica por unidade produtiva.',
      scopeLabel: describeScope(filters, farmRows.length),
      periodLabel: describePeriod(filters.dataInicio, filters.dataFim),
      healthLabel: farmRows.length ? 'Consolidação disponível' : 'Sem fazendas no escopo',
      healthTone: farmRows.length ? 'success' : 'warning',
      catalogBadge: farmRows.length ? 'Consolidado' : 'Sem dados',
      catalogTone: farmRows.length ? 'success' : 'neutral',
      catalogMetric: `${farmRows.length} fazendas no recorte`,
      notes: [],
      summary: [
        createSummary('Fazendas consolidadas', String(farmRows.length), 'Somente fazendas com lotes visíveis', 'info'),
        createSummary('Lotes distribuídos', formatNumber(visibleLotes.length, 0), 'Operação acompanhada', 'neutral'),
        createSummary(
          'Receita potencial',
          formatCurrency(farmRows.reduce((total, item) => total + item.receita, 0)),
          'Estimativa atual dos lotes no escopo',
          'success'
        ),
        createSummary(
          'Margem consolidada',
          formatCurrency(farmRows.reduce((total, item) => total + item.margem, 0)),
          'Resultado estimado por fazenda',
          farmRows.reduce((total, item) => total + item.margem, 0) >= 0 ? 'success' : 'danger'
        ),
      ],
      highlights: buildFarmHighlights(farmRows),
      exportConfig: createExportConfig('relatorio-fazenda', filters, [
        { name: 'Resumo', rows: farmRows },
        { name: 'Lotes', rows: lotReportRows.map((row) => ({ lote: row.lote, fazenda: row.fazenda, margem: row.margem })) },
      ]),
      tables: [
        {
          id: 'fazendas',
          title: 'Consolidação por fazenda',
          description: 'Capacidade, estoque e resultado potencial lado a lado.',
          badgeLabel: `${farmRows.length} fazendas`,
          badgeVariant: 'neutral',
          emptyTitle: 'Nenhuma fazenda encontrada',
          emptySubtitle: 'Crie uma fazenda ou ajuste o escopo dos relatórios.',
          mobileTitleKey: 'fazenda',
          columns: [
            { key: 'fazenda', label: 'Fazenda' },
            { key: 'lotes', label: 'Lotes', render: (row) => formatNumber(row.lotes, 0) },
            { key: 'animais', label: 'Animais', render: (row) => formatNumber(row.animais, 0) },
            { key: 'receita', label: 'Receita potencial', render: (row) => formatCurrency(row.receita) },
            { key: 'custoPeriodo', label: 'Custos', render: (row) => formatCurrency(row.custoPeriodo) },
            { key: 'margem', label: 'Margem', render: (row) => formatCurrency(row.margem) },
            { key: 'consumoEstoque', label: 'Insumos no período', render: (row) => formatCurrency(row.consumoEstoque) },
            { key: 'ocupacao', label: 'Ocupação' },
          ],
          rows: farmRows,
        },
      ],
    },
    sanitario: {
      title: 'Relatório sanitário',
      description: 'Pendências, agenda próxima, histórico do período e responsáveis por manejo.',
      scopeLabel: describeScope(filters, sanitaryRows.length),
      periodLabel: describePeriod(filters.dataInicio, filters.dataFim),
      healthLabel: sanitaryRows.some((row) => row.status === 'Vencido') ? 'Existem protocolos vencidos' : 'Calendário está controlado',
      healthTone: sanitaryRows.some((row) => row.status === 'Vencido') ? 'warning' : 'success',
      catalogBadge: sanitaryRows.some((row) => row.status === 'Vencido') ? 'Atenção' : 'Em dia',
      catalogTone: sanitaryRows.some((row) => row.status === 'Vencido') ? 'warning' : 'success',
      catalogMetric: `${sanitaryRows.length} manejos no período`,
      notes: sanitaryRows.length
        ? []
        : [
            {
              title: 'Sem manejos no período',
              text: 'O módulo continua pronto; basta ampliar a janela de datas para recuperar o histórico.',
              variant: 'info',
            },
          ],
      summary: [
        createSummary('Manejos no período', formatNumber(sanitaryRows.length, 0), 'Vacinas, vermífugos e tratamentos', 'info'),
        createSummary(
          'Protocolos concluídos',
          formatNumber(sanitaryRows.filter((row) => row.status === 'Em dia').length, 0),
          'Sem pendências imediatas',
          'success'
        ),
        createSummary(
          'Próximos ou vencidos',
          formatNumber(sanitaryRows.filter((row) => row.status !== 'Em dia').length, 0),
          'Requer acompanhamento',
          'warning'
        ),
        createSummary(
          'Lotes com pressão sanitária',
          formatNumber(new Set(sanitaryRows.filter((row) => row.status !== 'Em dia').map((row) => row.lote)).size, 0),
          'Escopo com risco ativo',
          'danger'
        ),
      ],
      highlights: buildSanitaryHighlights(sanitaryRows),
      exportConfig: createExportConfig('relatorio-sanitario', filters, [
        { name: 'Resumo', rows: sanitaryRows },
      ]),
      tables: [
        {
          id: 'sanitario',
          title: 'Agenda sanitária',
          description: 'Lista ordenada por prioridade e pronta para conferência em campo.',
          badgeLabel: `${sanitaryRows.length} registros`,
          badgeVariant: 'neutral',
          emptyTitle: 'Nenhum registro sanitário encontrado',
          emptySubtitle: 'Cadastre manejos ou revise o intervalo selecionado.',
          mobileTitleKey: 'descricao',
          mobileSubtitleKey: (row) => `${row.lote} • ${row.status}`,
          columns: [
            { key: 'tipo', label: 'Tipo' },
            { key: 'descricao', label: 'Descrição' },
            { key: 'lote', label: 'Lote' },
            { key: 'fazenda', label: 'Fazenda' },
            { key: 'aplicacao', label: 'Aplicação' },
            { key: 'proxima', label: 'Próxima' },
            { key: 'responsavel', label: 'Responsável' },
            { key: 'status', label: 'Status', render: (row) => <Badge variant={sanitizeBadge(row.status)}>{row.status}</Badge> },
          ],
          rows: sanitaryRows,
        },
      ],
    },
    estoque: {
      title: 'Relatório de estoque',
      description: 'Saldo atual, itens críticos, validade e movimentações com contexto operacional.',
      scopeLabel: describeScope(filters, stockItemRows.length),
      periodLabel: describePeriod(filters.dataInicio, filters.dataFim),
      healthLabel: stockCriticalCount > 0 ? 'Existem itens críticos' : 'Cobertura operacional está estável',
      healthTone: stockCriticalCount > 0 ? 'warning' : 'success',
      catalogBadge: stockCriticalCount > 0 ? 'Críticos' : 'Estável',
      catalogTone: stockCriticalCount > 0 ? 'warning' : 'success',
      catalogMetric: `${stockItemRows.length} itens em estoque`,
      notes: stockMovementRows.length
        ? []
        : [
            {
              title: 'Sem movimentações no período',
              text: 'Os saldos continuam visíveis e a estrutura já está pronta para exportar entradas e saídas futuramente.',
              variant: 'info',
            },
          ],
      summary: [
        createSummary('Itens cadastrados', formatNumber(stockItemRows.length, 0), 'Inventário atual', 'info'),
        createSummary('Itens críticos', formatNumber(stockCriticalCount, 0), 'Abaixo ou próximos do mínimo', stockCriticalCount > 0 ? 'warning' : 'success'),
        createSummary(
          'Valor em estoque',
          formatCurrency(stockItemRows.reduce((total, item) => total + currencyToNumber(item.valor), 0)),
          'Saldo financeiro do inventário',
          'neutral'
        ),
        createSummary('Movimentações no período', formatNumber(stockMovementRows.length, 0), 'Entradas, saídas e consumos', 'info'),
      ],
      highlights: buildStockHighlights(stockItemRows, stockMovementRows),
      exportConfig: createExportConfig('relatorio-estoque', filters, [
        { name: 'Saldo', rows: stockItemRows },
        { name: 'Movimentacoes', rows: stockMovementRows },
      ]),
      tables: [
        {
          id: 'saldo',
          title: 'Saldo por item',
          description: 'Leitura rápida para operação, compras e validade.',
          badgeLabel: `${stockCriticalCount} críticos`,
          badgeVariant: stockCriticalCount > 0 ? 'warning' : 'success',
          emptyTitle: 'Nenhum item de estoque cadastrado',
          emptySubtitle: 'Adicione itens para liberar o relatório de estoque.',
          mobileTitleKey: 'item',
          mobileSubtitleKey: 'categoria',
          columns: [
            { key: 'item', label: 'Item' },
            { key: 'categoria', label: 'Categoria' },
            { key: 'saldo', label: 'Saldo' },
            { key: 'minimo', label: 'Mínimo' },
            { key: 'cobertura', label: 'Cobertura' },
            { key: 'valor', label: 'Valor' },
            { key: 'validade', label: 'Validade' },
            { key: 'status', label: 'Status', render: (row) => <Badge variant={stockBadge(row.status)}>{row.status}</Badge> },
          ],
          rows: stockItemRows,
        },
        {
          id: 'movimentacoes',
          title: 'Movimentações do período',
          description: 'Histórico operacional filtrado por período, lote e fazenda.',
          badgeLabel: `${stockMovementRows.length} movimentos`,
          badgeVariant: 'neutral',
          emptyTitle: 'Nenhuma movimentação encontrada',
          emptySubtitle: 'O saldo continua monitorado, mas não houve entradas ou saídas no período selecionado.',
          mobileTitleKey: 'item',
          mobileSubtitleKey: (row) => `${row.tipo} • ${row.data}`,
          columns: [
            { key: 'data', label: 'Data' },
            { key: 'item', label: 'Item' },
            { key: 'tipo', label: 'Tipo' },
            { key: 'lote', label: 'Lote' },
            { key: 'quantidade', label: 'Quantidade' },
            { key: 'valor', label: 'Valor' },
          ],
          rows: stockMovementRows,
        },
      ],
    },
    financeiro: {
      title: 'Relatório financeiro',
      description: 'Visão consolidada de despesas, receitas registradas e receita potencial da operação.',
      scopeLabel: describeScope(filters, ledgerRows.length || visibleLotes.length),
      periodLabel: describePeriod(filters.dataInicio, filters.dataFim),
      healthLabel: ledgerRevenue > 0 ? 'Fluxo realizado disponível' : 'Receita realizada ainda não lançada',
      healthTone: ledgerRevenue > 0 ? 'success' : 'warning',
      catalogBadge: ledgerRows.length ? 'Fluxo' : 'Potencial',
      catalogTone: ledgerRows.length ? 'info' : 'warning',
      catalogMetric: `${ledgerRows.length} linhas financeiras`,
      notes: ledgerRevenue === 0
        ? [
            {
              title: 'Receita realizada ainda zerada',
              text: 'Enquanto os lançamentos ou vendas não forem registrados, o relatório usa a receita potencial dos lotes para apoiar a leitura executiva.',
              variant: 'warning',
            },
          ]
        : [],
      summary: [
        createSummary('Despesas do período', formatCurrency(ledgerExpense), 'Custos operacionais + despesas lançadas', 'danger'),
        createSummary('Receita realizada', formatCurrency(ledgerRevenue), 'Lançamentos financeiros e vendas registradas', 'success'),
        createSummary('Receita potencial', formatCurrency(potentialRevenue), 'Estimativa atual dos lotes filtrados', 'info'),
        createSummary(
          'Resultado líquido',
          formatCurrency(ledgerRevenue - ledgerExpense),
          'Somente o que já foi efetivamente lançado',
          ledgerRevenue - ledgerExpense >= 0 ? 'success' : 'danger'
        ),
      ],
      highlights: buildFinancialHighlights(ledgerRows, potentialRevenue, ledgerExpense),
      exportConfig: createExportConfig('relatorio-financeiro', filters, [
        { name: 'Lancamentos', rows: ledgerRows },
        { name: 'Resumo', rows: [{ receita_realizada: ledgerRevenue, despesa: ledgerExpense, receita_potencial: potentialRevenue }] },
      ]),
      tables: [
        {
          id: 'financeiro-ledger',
          title: 'Lançamentos consolidados',
          description: 'Base única para futuro PDF, XLSX e integrações contábeis.',
          badgeLabel: `${ledgerRows.length} linhas`,
          badgeVariant: 'neutral',
          emptyTitle: 'Sem lançamentos financeiros no período',
          emptySubtitle: 'Cadastre receitas e despesas ou mantenha a leitura apenas pela receita potencial.',
          mobileTitleKey: 'categoria',
          mobileSubtitleKey: (row) => `${row.tipo} • ${row.data}`,
          columns: [
            { key: 'data', label: 'Data' },
            { key: 'tipo', label: 'Tipo', render: (row) => <Badge variant={row.tipo === 'Receita' ? 'success' : 'danger'}>{row.tipo}</Badge> },
            { key: 'categoria', label: 'Categoria' },
            { key: 'origem', label: 'Origem' },
            { key: 'lote', label: 'Lote' },
            { key: 'fazenda', label: 'Fazenda' },
            { key: 'valor', label: 'Valor', render: (row) => formatCurrency(row.valor) },
          ],
          rows: ledgerRows,
        },
      ],
    },
    desempenho: {
      title: 'Relatório de desempenho',
      description: 'Ranking zootécnico com foco em GMD, peso médio, custo por cabeça e aderência à meta.',
      scopeLabel: describeScope(filters, performanceRows.length),
      periodLabel: describePeriod(filters.dataInicio, filters.dataFim),
      healthLabel: performanceAboveMeta === performanceRows.length && performanceRows.length ? 'Metas sustentadas no recorte' : 'Existem lotes abaixo da meta',
      healthTone: performanceAboveMeta === performanceRows.length && performanceRows.length ? 'success' : 'warning',
      catalogBadge: performanceAboveMeta === performanceRows.length && performanceRows.length ? 'Meta' : 'Ajustar',
      catalogTone: performanceAboveMeta === performanceRows.length && performanceRows.length ? 'success' : 'warning',
      catalogMetric: `${performanceRows.length} lotes avaliados`,
      notes: performanceRows.length
        ? []
        : [
            {
              title: 'Sem pesagens suficientes no período',
              text: 'O ranking fica disponível assim que houver pesagens ou lotes ativos dentro do escopo.',
              variant: 'info',
            },
          ],
      summary: [
        createSummary('GMD médio', `${formatNumber(averageGmd, 3)} kg/dia`, 'Média dos lotes filtrados', 'info'),
        createSummary(
          'Acima da meta',
          formatNumber(performanceAboveMeta, 0),
          'Lotes atendendo ou superando a meta',
          performanceAboveMeta === performanceRows.length && performanceRows.length ? 'success' : 'warning'
        ),
        createSummary(
          'Peso médio atual',
          performanceRows.length
            ? `${formatNumber(performanceRows.reduce((total, item) => total + item.pesoAtual, 0) / performanceRows.length, 1)} kg`
            : '--',
          'Base mais recente disponível',
          'neutral'
        ),
        createSummary(
          'Margem combinada',
          formatCurrency(performanceRows.reduce((total, item) => total + item.margem, 0)),
          'Sinal financeiro do desempenho atual',
          performanceRows.reduce((total, item) => total + item.margem, 0) >= 0 ? 'success' : 'danger'
        ),
      ],
      highlights: buildPerformanceHighlights(performanceRows),
      exportConfig: createExportConfig('relatorio-desempenho', filters, [
        { name: 'Ranking', rows: performanceRows },
      ]),
      tables: [
        {
          id: 'performance',
          title: 'Ranking de desempenho',
          description: 'Ordenado por GMD para facilitar a tomada de decisão.',
          badgeLabel: `${performanceAboveMeta}/${performanceRows.length} na meta`,
          badgeVariant: performanceAboveMeta === performanceRows.length && performanceRows.length ? 'success' : 'warning',
          emptyTitle: 'Nenhum lote com desempenho calculado',
          emptySubtitle: 'É preciso haver lotes ativos e pesagens para montar o ranking.',
          mobileTitleKey: 'lote',
          mobileSubtitleKey: 'fazenda',
          columns: [
            { key: 'lote', label: 'Lote' },
            { key: 'fazenda', label: 'Fazenda' },
            { key: 'gmd', label: 'GMD', render: (row) => `${formatNumber(row.gmd, 3)} kg/dia` },
            { key: 'meta', label: 'Meta', render: (row) => `${formatNumber(row.meta, 3)} kg/dia` },
            { key: 'pesoAtual', label: 'Peso atual', render: (row) => `${formatNumber(row.pesoAtual, 1)} kg` },
            { key: 'custoCabeca', label: 'Custo/cab', render: (row) => formatCurrency(row.custoCabeca) },
            { key: 'margem', label: 'Margem', render: (row) => formatCurrency(row.margem) },
            { key: 'status', label: 'Meta', render: (row) => <Badge variant={row.gap >= 0 ? 'success' : 'warning'}>{row.status}</Badge> },
          ],
          rows: performanceRows.sort((a, b) => b.gmd - a.gmd),
        },
      ],
    },
  };

  return reports;
}

function createSummary(label, value, helper, variant) {
  return { label, value, helper, variant };
}

function createExportConfig(baseName, filters, sheets) {
  const start = filters.dataInicio || 'inicio';
  const end = filters.dataFim || 'fim';
  const mappedSheets = sheets.map((sheet) => ({
    name: sheet.name,
    rowCount: sheet.rows.length,
    columns: sheet.rows.length ? Object.keys(sheet.rows[0]) : [],
  }));

  return {
    filename: `${baseName}-${start}-${end}`,
    totalRows: sheets.reduce((total, sheet) => total + sheet.rows.length, 0),
    sheets: mappedSheets,
  };
}

function buildLotHighlights(rows) {
  if (!rows.length) {
    return [];
  }

  const bestMargin = rows.slice().sort((a, b) => b.margem - a.margem)[0];
  const bestGmd = rows.slice().sort((a, b) => b.gmd - a.gmd)[0];
  const highestCost = rows.slice().sort((a, b) => b.custoPeriodo - a.custoPeriodo)[0];

  return [
    {
      label: 'Melhor margem estimada',
      value: bestMargin.lote,
      detail: formatCurrency(bestMargin.margem),
    },
    {
      label: 'Melhor ganho médio diário',
      value: bestGmd.lote,
      detail: `${formatNumber(bestGmd.gmd, 3)} kg/dia`,
    },
    {
      label: 'Maior custo no período',
      value: highestCost.lote,
      detail: formatCurrency(highestCost.custoPeriodo),
    },
  ];
}

function buildFarmHighlights(rows) {
  if (!rows.length) {
    return [];
  }

  const maiorMargem = rows.slice().sort((a, b) => b.margem - a.margem)[0];
  const maiorReceita = rows.slice().sort((a, b) => b.receita - a.receita)[0];
  const maiorRebanho = rows.slice().sort((a, b) => b.animais - a.animais)[0];

  return [
    {
      label: 'Fazenda com maior margem',
      value: maiorMargem.fazenda,
      detail: formatCurrency(maiorMargem.margem),
    },
    {
      label: 'Maior receita potencial',
      value: maiorReceita.fazenda,
      detail: formatCurrency(maiorReceita.receita),
    },
    {
      label: 'Maior concentração animal',
      value: maiorRebanho.fazenda,
      detail: `${formatNumber(maiorRebanho.animais, 0)} cabeças`,
    },
  ];
}

function buildSanitaryHighlights(rows) {
  if (!rows.length) {
    return [];
  }

  const vencido = rows.find((row) => row.status === 'Vencido');
  const proximo = rows.find((row) => row.status === 'Próximo');
  const responsavel = frequency(rows.map((row) => row.responsavel)).at(0);

  return [
    {
      label: 'Maior prioridade sanitária',
      value: vencido ? `${vencido.descricao} - ${vencido.lote}` : 'Sem manejos vencidos',
      detail: vencido ? vencido.proxima : 'Operação em dia',
    },
    {
      label: 'Próximo manejo',
      value: proximo ? `${proximo.descricao} - ${proximo.lote}` : 'Sem protocolo próximo',
      detail: proximo ? proximo.proxima : 'Sem agenda crítica',
    },
    {
      label: 'Responsável mais recorrente',
      value: responsavel?.value || 'Sem responsável definido',
      detail: responsavel ? `${responsavel.count} registros` : 'Sem concentração',
    },
  ];
}

function buildStockHighlights(items, movements) {
  if (!items.length) {
    return [];
  }

  const critico = items.find((item) => item.status === 'Crítico');
  const maiorValor = items.slice().sort((a, b) => currencyToNumber(b.valor) - currencyToNumber(a.valor))[0];
  const ultimoMovimento = movements[0];

  return [
    {
      label: 'Item mais sensível',
      value: critico?.item || 'Sem itens críticos',
      detail: critico?.saldo || 'Cobertura estável',
    },
    {
      label: 'Maior valor parado em estoque',
      value: maiorValor.item,
      detail: maiorValor.valor,
    },
    {
      label: 'Última movimentação registrada',
      value: ultimoMovimento ? `${ultimoMovimento.item} - ${ultimoMovimento.tipo}` : 'Sem movimentação no período',
      detail: ultimoMovimento?.data || 'Sem data',
    },
  ];
}

function buildFinancialHighlights(rows, potentialRevenue, ledgerExpense) {
  const principalCategoria = frequency(rows.map((row) => row.categoria)).at(0);
  const maiorLinha = rows.slice().sort((a, b) => b.valor - a.valor)[0];

  return [
    {
      label: 'Principal categoria',
      value: principalCategoria?.value || 'Sem lançamentos',
      detail: principalCategoria ? `${principalCategoria.count} ocorrências` : 'Sem dados no período',
    },
    {
      label: 'Maior lançamento individual',
      value: maiorLinha?.categoria || 'Sem lançamento',
      detail: maiorLinha ? formatCurrency(maiorLinha.valor) : '--',
    },
    {
      label: 'Cobertura potencial da despesa',
      value: ledgerExpense > 0 ? `${formatNumber((potentialRevenue / ledgerExpense) * 100, 1)}%` : 'Sem despesa',
      detail: 'Receita potencial versus gasto filtrado',
    },
  ];
}

function buildPerformanceHighlights(rows) {
  if (!rows.length) {
    return [];
  }

  const melhor = rows.slice().sort((a, b) => b.gmd - a.gmd)[0];
  const pior = rows.slice().sort((a, b) => a.gmd - b.gmd)[0];
  const maiorPeso = rows.slice().sort((a, b) => b.pesoAtual - a.pesoAtual)[0];

  return [
    {
      label: 'Melhor GMD',
      value: melhor.lote,
      detail: `${formatNumber(melhor.gmd, 3)} kg/dia`,
    },
    {
      label: 'Ponto de atenção',
      value: pior.lote,
      detail: `${formatNumber(pior.gmd, 3)} kg/dia`,
    },
    {
      label: 'Maior peso atual',
      value: maiorPeso.lote,
      detail: `${formatNumber(maiorPeso.pesoAtual, 1)} kg`,
    },
  ];
}

function getDateBounds(db) {
  const candidates = [];

  const collections = [
    db?.lotes || [],
    db?.custos || [],
    db?.sanitario || [],
    db?.pesagens || [],
    db?.movimentacoes_estoque || [],
    db?.movimentacoes_financeiras || [],
    db?.movimentacoes_animais || [],
    db?.tarefas || [],
  ];

  collections.forEach((collection) => {
    collection.forEach((item) => {
      [item.entrada, item.saida, item.data, item.data_aplic, item.proxima, item.data_entrada, item.data_validade, item.data_vencimento]
        .filter(Boolean)
        .forEach((value) => candidates.push(String(value).slice(0, 10)));
    });
  });

  if (!candidates.length) {
    const today = new Date().toISOString().slice(0, 10);
    return { min: today, max: today };
  }

  const ordered = candidates.sort();
  return {
    min: ordered[0],
    max: ordered[ordered.length - 1],
  };
}

function getPresetRange(periodo, bounds) {
  if (periodo === 'all') {
    return { start: bounds.min || '', end: bounds.max || '' };
  }

  if (periodo === 'custom') {
    return { start: bounds.min || '', end: bounds.max || '' };
  }

  const end = bounds.max || new Date().toISOString().slice(0, 10);
  const endDate = new Date(`${end}T00:00:00`);
  const startDate = new Date(endDate);

  if (periodo === '30') {
    startDate.setDate(startDate.getDate() - 29);
  } else if (periodo === '90') {
    startDate.setDate(startDate.getDate() - 89);
  } else if (periodo === 'year') {
    startDate.setMonth(0, 1);
  }

  return {
    start: startDate.toISOString().slice(0, 10),
    end,
  };
}

function matchesFarm(lote, fazendaId) {
  return fazendaId === 'todas' || String(lote.faz_id) === String(fazendaId);
}

function matchesLote(lote, loteId) {
  return loteId === 'todos' || String(lote.id) === String(loteId);
}

function matchesStatus(lote, status) {
  return status === 'todos' || String(lote.status || 'ativo') === String(status);
}

function dateInRange(value, start, end) {
  if (!value) {
    return false;
  }

  const date = String(value).slice(0, 10);

  if (start && date < start) {
    return false;
  }
  if (end && date > end) {
    return false;
  }

  return true;
}

function dateRangeIncludes(values, start, end) {
  return values.some((value) => dateInRange(value, start, end));
}

function resolveSanitaryStatus(item) {
  const target = item?.proxima || item?.data_aplic;
  if (!target) {
    return 'Sem data';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${String(target).slice(0, 10)}T00:00:00`);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);

  if (diff < 0) {
    return 'Vencido';
  }
  if (diff <= Number(item?.alerta_dias_antes || 0)) {
    return 'Próximo';
  }
  return 'Em dia';
}

function describeScope(filters, count) {
  const scope = [];
  if (filters.fazendaId !== 'todas') {
    scope.push('fazenda filtrada');
  }
  if (filters.loteId !== 'todos') {
    scope.push('lote filtrado');
  }
  if (filters.status !== 'todos') {
    scope.push(`status ${filters.status}`);
  }

  if (!scope.length) {
    return `${count} registros no escopo geral`;
  }

  return `${count} registros com ${scope.join(', ')}`;
}

function describePeriod(start, end) {
  if (!start && !end) {
    return 'Sem período definido';
  }

  return `${formatDate(start)} até ${formatDate(end)}`;
}

function capitalize(value) {
  if (!value) {
    return '-';
  }
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

function sanitizeBadge(status) {
  if (status === 'Vencido') {
    return 'danger';
  }
  if (status === 'Próximo') {
    return 'warning';
  }
  if (status === 'Em dia') {
    return 'success';
  }
  return 'neutral';
}

function stockBadge(status) {
  if (status === 'Crítico') {
    return 'danger';
  }
  if (status === 'Baixo') {
    return 'warning';
  }
  return 'success';
}

function priorityRank(status) {
  if (status === 'Vencido') {
    return 0;
  }
  if (status === 'Próximo') {
    return 1;
  }
  if (status === 'Em dia') {
    return 2;
  }
  return 3;
}

function frequency(values) {
  const counts = values.reduce((acc, value) => {
    if (!value || value === '-') {
      return acc;
    }
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

function currencyToNumber(value) {
  if (!value) {
    return 0;
  }

  return Number(String(value).replace(/[^\d,-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
}

function sortDateDesc(a, b) {
  const first = a === '-' ? '' : String(a).split('/').reverse().join('-');
  const second = b === '-' ? '' : String(b).split('/').reverse().join('-');
  return String(second).localeCompare(String(first));
}
