import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bell,
  BellRing,
  CalendarClock,
  CheckCircle2,
  DollarSign,
  Package,
  Scale,
  Tractor,
  Users,
  Weight,
  CheckSquare,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { calcLote, formatCurrency, formatDate, formatNumber } from '../utils/calculations';
import { formatarMoeda } from '../utils/formatters';
import '../styles/dashboard.css';

const KPI_VARIANTS = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
  neutral: 'neutral',
};

/**
 * Página do Dashboard, exibindo uma visão consolidada de desempenho, riscos e operação dos lotes.
 *
 * @param {object} props - As propriedades do componente.
 * @param {object} props.db - O objeto do banco de dados.
 * @param {Array<object>} [props.alerts=[]] - Lista de alertas pendentes.
 * @param {function} [props.onNavigate=null] - Função de callback para navegação.
 * @param {function} [props.onResolveAlert=null] - Função de callback para resolver um alerta.
 * @param {string} [props.tabAtiva='geral'] - A aba ativa do dashboard ('geral', 'estoque', 'alertas').
 * @param {function} props.setTabAtiva - Função para definir a aba ativa.
 */
export default function DashboardPage({ db, alerts = [], onNavigate = null, onResolveAlert = null, tabAtiva = 'geral', setTabAtiva }) {
  const [hiddenLines, setHiddenLines] = useState({});

  // Pré-indexar lotes para buscas eficientes
  const lotesMap = useMemo(() => {
    return new Map((db.lotes || []).map(l => [l.id, l]));
  }, [db.lotes]);

  const lotesAtivos = useMemo(() => (db.lotes || []).filter((lote) => lote.status === 'ativo'), [db.lotes]);

  const lotesStats = useMemo(
    () =>
      lotesAtivos.map((lote) => ({
        lote,
        indicators: calcLote(db, lote.id), // calcLote é potencialmente caro, mas é memoizado aqui
      })),
    [db, lotesAtivos]
  );

  // --- KPIs Principais ---
  const totalCabecasAtivas = useMemo(() => lotesStats.reduce((sum, item) => sum + item.indicators.totalAnimais, 0), [lotesStats]);
  const arrobaMedia = useMemo(() => totalCabecasAtivas
    ? lotesStats.reduce((sum, item) => sum + item.indicators.pesoAtualMedio * item.indicators.totalAnimais, 0) / totalCabecasAtivas / 15
    : 0, [lotesStats, totalCabecasAtivas]);
  const receitaMes = useMemo(() => lotesStats.reduce((sum, item) => sum + item.indicators.receitaTotal, 0), [lotesStats]);
  const custoMes = useMemo(() => (db.custos || []).reduce((sum, item) => sum + Number(item.val || 0), 0), [db.custos]);
  const resultadoMes = useMemo(() => receitaMes - custoMes, [receitaMes, custoMes]);

  // --- KPIs Secundários ---
  const gmdMedio = useMemo(() => lotesStats.length
    ? lotesStats.reduce((sum, item) => sum + item.indicators.gmdMedio, 0) / lotesStats.length
    : 0, [lotesStats]);

  const estoqueCritico = useMemo(() => (db.estoque || [])
    .map((item) => {
      const atual = Number(item.quantidade_atual || 0);
      const min = Number(item.quantidade_minima || 0);
      const ratio = min ? Math.min((atual / min) * 100, 100) : 100;
      return { ...item, ratio, critico: atual <= min };
    })
    .filter((item) => item.critico)
    .sort((a, b) => a.ratio - b.ratio), [db.estoque]);

  const itensCriticos = useMemo(() => estoqueCritico.length, [estoqueCritico]);

  const valorTotalEstoque = useMemo(() => (db.estoque || []).reduce(
    (acc, i) => acc + (Number(i.preco_unitario || 0) * Number(i.quantidade_atual || 0)),
    0
  ), [db.estoque]);

  const eventosCalendario = useMemo(() => (db.sanitario || [])
    .map((item) => {
      const lote = lotesMap.get(item.lote_id); // Usar loteMap
      const dias = daysUntil(item.proxima);
      return { ...item, loteNome: lote?.nome || 'Sem lote', dias };
    })
    .filter((item) => Number.isFinite(item.dias))
    .sort((a, b) => a.dias - b.dias)
    .slice(0, 8), [db.sanitario, lotesMap]);

  const alertasPendentesCalendario = useMemo(() => eventosCalendario.filter((item) => item.dias <= 3).length, [eventosCalendario]);

  const kpisMain = useMemo(() => [
    {
      title: 'Total de cabeças ativas',
      value: formatNumber(totalCabecasAtivas, 0),
      variation: getVariation(totalCabecasAtivas, totalCabecasAtivas * 0.92), // Variação de exemplo
      icon: Users,
      variant: KPI_VARIANTS.info,
    },
    {
      title: 'Lotes ativos',
      value: formatNumber(lotesAtivos.length, 0),
      variation: getVariation(lotesAtivos.length, Math.max(1, lotesAtivos.length - 1)), // Variação de exemplo
      icon: Tractor,
      variant: KPI_VARIANTS.neutral,
    },
    {
      title: '@ média estimada do rebanho',
      value: `${formatNumber(arrobaMedia, 2)} @`,
      variation: getVariation(arrobaMedia, arrobaMedia * 0.95), // Variação de exemplo
      icon: Weight,
      variant: KPI_VARIANTS.success,
    },
    {
      title: 'Resultado financeiro do mês',
      value: formatCurrency(resultadoMes),
      variation: getVariation(resultadoMes, resultadoMes * 0.85), // Variação de exemplo
      icon: DollarSign,
      variant: resultadoMes >= 0 ? KPI_VARIANTS.success : KPI_VARIANTS.danger,
    },
  ], [totalCabecasAtivas, lotesAtivos.length, arrobaMedia, resultadoMes]);

  const kpisSecondary = useMemo(() => [
    {
      title: 'GMD médio dos lotes ativos',
      value: `${formatNumber(gmdMedio, 3)} kg/dia`,
      variation: getVariation(gmdMedio, gmdMedio * 0.96), // Variação de exemplo
      icon: Scale,
      variant: KPI_VARIANTS.info,
    },
    {
      title: 'Itens com estoque crítico',
      value: formatNumber(estoqueCritico.length, 0),
      variation: getVariation(estoqueCritico.length, Math.max(0, estoqueCritico.length - 1)), // Variação de exemplo
      icon: Package,
      variant: estoqueCritico.length ? KPI_VARIANTS.warning : KPI_VARIANTS.success,
    },
    {
      title: 'Alertas pendentes do calendário',
      value: formatNumber(alertasPendentesCalendario, 0),
      variation: getVariation(alertasPendentesCalendario, Math.max(0, alertasPendentesCalendario - 1)), // Variação de exemplo
      icon: BellRing,
      variant: alertasPendentesCalendario ? KPI_VARIANTS.warning : KPI_VARIANTS.success,
    },
  ], [gmdMedio, estoqueCritico.length, alertasPendentesCalendario]);

  const chartRows = useMemo(() => {
    const pesagens = db.pesagens || [];
    const activeIds = new Set(lotesAtivos.map((l) => l.id));
    const timelineMap = new Map();

    pesagens
      .filter((p) => activeIds.has(p.lote_id))
      .sort((a, b) => new Date(a.data) - new Date(b.data))
      .forEach((p) => {
        if (!timelineMap.has(p.data)) {
          timelineMap.set(p.data, { data: p.data, label: formatDate(p.data) });
        }
        const loteNome = lotesMap.get(p.lote_id)?.nome; // Usar loteMap
        if (loteNome) { // Apenas adiciona se o lote for encontrado
          timelineMap.get(p.data)[loteNome] = Number(p.peso_medio || 0);
        }
      });

    return Array.from(timelineMap.values());
  }, [db.pesagens, lotesAtivos, lotesMap]);

  const lotesColorMap = useMemo(
    () =>
      lotesAtivos.reduce((acc, lote, index) => {
        acc[lote.nome] = ['#1b4332', '#2b6cb0', '#b7791f', '#9f1239', '#4c1d95'][index % 5];
        return acc;
      }, {}),
    [lotesAtivos]
  );

  const movimentacoesRecentes = useMemo(() => (db.movimentacoes_animais || [])
    .slice()
    .sort((a, b) => new Date(b.data || b.created_at) - new Date(a.data || a.created_at))
    .slice(0, 6), [db.movimentacoes_animais]);

  const tarefasUrgentes = useMemo(() => (db.tarefas || [])
    .map((item) => ({
      ...item,
      dias: daysUntil(item.data_vencimento),
    }))
    .filter((item) => item.status !== 'concluida')
    .sort((a, b) => {
      const rankDiff = prioridadeRank(b.prioridade) - prioridadeRank(a.prioridade);
      if (rankDiff !== 0) return rankDiff;
      return a.dias - b.dias;
    })
    .slice(0, 5), [db.tarefas]);

  const tarefasResumo = useMemo(() => (db.tarefas || []).reduce(
    (acc, item) => {
      if (item.status === 'pendente') acc.pendente += 1;
      if (item.status === 'em_andamento') acc.em_andamento += 1;
      if (item.status === 'concluida') acc.concluida += 1;
      return acc;
    },
    { pendente: 0, em_andamento: 0, concluida: 0 }
  ), [db.tarefas]);

  // Alertas já vêm memoizados via props, mas a transformação interna também é memoizada
  const alertasFormatados = useMemo(
    () =>
      (alerts || []).map((alert, index) => ({
        ...alert,
        id: alert.id || alert.ackKey || `alert-${index}`,
        titulo: alert.titulo || alert.title || 'Alerta do sistema',
        descricao: alert.descricao || alert.description || 'Sem descrição',
        prioridade: alert.prioridade || (urgencyVariant(alert) === 'danger' ? 'alta' : urgencyVariant(alert) === 'warning' ? 'media' : 'baixa'),
        acao: alert.acao || { label: 'Abrir', rota: alert.route || 'dashboard' },
      })),
    [alerts]
  );

  return (
    <div className="dashboard-page">
      <header className="dashboard-title">
        <h1>Dashboard</h1>
        <p>Visão consolidada de desempenho, riscos e operação dos lotes.</p>
      </header>

      {tabAtiva === 'geral' && (
        <>
          <section className="dashboard-grid dashboard-grid--kpi-main">
            {kpisMain.map((item) => (
              <KpiPanel key={item.title} {...item} />
            ))}
          </section>

          <section className="dashboard-grid dashboard-grid--kpi-secondary">
            {kpisSecondary.map((item) => (
              <KpiPanel key={item.title} {...item} compact />
            ))}
          </section>

          <Card title="Evolução de peso por lote" subtitle="Peso médio (kg) ao longo do tempo" className="dashboard-chart-card">
            <div className="chart-legend">
              {Object.entries(lotesColorMap).map(([nome, cor]) => (
                <button key={nome} type="button" onClick={() => setHiddenLines((prev) => ({ ...prev, [nome]: !prev[nome] }))}>
                  <span style={{ background: cor, opacity: hiddenLines[nome] ? 0.3 : 1 }} />
                  {nome}
                </button>
              ))}
            </div>
            <div className="chart-shell">
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={chartRows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis unit="kg" />
                  <Tooltip content={<PesoTooltip />} />
                  {Object.entries(lotesColorMap).map(([nome, cor]) => (
                    <Line key={nome} dataKey={nome} stroke={cor} strokeWidth={2} hide={!!hiddenLines[nome]} dot={{ r: 3 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <section className="dashboard-grid dashboard-grid--dual">
            <Card title="Lotes ativos" subtitle="Clique para abrir detalhes">
              <div className="table-responsive">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Nome</th><th>Cabeças</th><th>Peso Médio</th><th>@ Viva</th><th>GMD</th><th>Dias</th><th>Custo/Cab</th><th>Resultado</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotesStats.map(({ lote, indicators }) => (
                      <tr key={lote.id} onClick={() => onNavigate?.('lotes')}>
                        <td>{lote.nome}</td>
                        <td>{indicators.totalAnimais}</td>
                        <td>{formatNumber(indicators.pesoAtualMedio, 1)} kg</td>
                        <td>{formatNumber(indicators.pesoAtualMedio / 15, 2)} @</td>
                        <td>{formatNumber(indicators.gmdMedio, 3)}</td>
                        <td>{indicators.dias}</td>
                        <td>{formatCurrency(indicators.custoPorCabeca)}</td>
                        <td className={indicators.margem >= 0 ? 'positive' : 'negative'}>{formatCurrency(indicators.margem)}</td>
                        <td><Badge variant={lote.status === 'ativo' ? 'success' : 'neutral'}>{lote.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="Próximos eventos do calendário" subtitle="Ordenados por urgência">
              <div className="alerts-list">
                {eventosCalendario.length === 0 ? <p>Sem eventos próximos.</p> : eventosCalendario.map((item) => {
                  const variant = item.dias < 0 ? 'danger' : item.dias <= 3 ? 'warning' : 'success';
                  return (
                    <div key={item.id} className="alert-item">
                      <Badge variant={variant}>{item.dias < 0 ? 'Atrasado' : item.dias <= 3 ? 'Urgente' : 'Programado'}</Badge>
                      <div>
                        <strong>{item.desc}</strong>
                        <p>{item.loteNome} · {formatDate(item.proxima)}</p>
                      </div>
                      <Button size="sm" variant="outline" icon={<CalendarClock size={14} />} onClick={() => onResolveAlert?.({ id: item.id, ackKey: `sanitario-${item.id}` })}>Resolver</Button>
                    </div>
                  );
                })}
              </div>
            </Card>
          </section>

          <section className="dashboard-grid dashboard-grid--dual">
            <Card title="Tarefas prioritárias" subtitle="Próximos vencimentos">
              <div className="alerts-list">
                {tarefasUrgentes.length === 0 ? <p>Nenhuma tarefa urgente.</p> : tarefasUrgentes.map((item) => (
                  <div key={item.id} className="alert-item">
                    <Badge variant={item.dias < 0 ? 'danger' : item.dias === 0 ? 'warning' : 'info'}>{item.dias < 0 ? 'Vencida' : item.dias === 0 ? 'Hoje' : 'Futura'}</Badge>
                    <div>
                      <strong>{item.titulo}</strong>
                      <p>{formatDate(item.data_vencimento)} · {item.prioridade}</p>
                    </div>
                    <Button size="sm" variant="outline" icon={<CheckSquare size={14} />} onClick={() => onResolveAlert?.({ id: item.id, ackKey: `tarefa-${item.id}` })}>Concluir</Button>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Movimentações recentes" subtitle="Últimas 6 movimentações de animais">
              <div className="alerts-list">
                {movimentacoesRecentes.length === 0 ? <p>Nenhuma movimentação recente.</p> : movimentacoesRecentes.map((mov) => (
                  <div key={mov.id} className="alert-item">
                    <Badge variant={mov.tipo === 'saida' ? 'danger' : 'info'}>{mov.tipo || 'mov'}</Badge>
                    <div>
                      <strong>{mov.qtd || 0} cabeças</strong>
                      <p>{formatDate(mov.data)} · {mov.observacao || 'Movimentação registrada'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          <section className="dashboard-grid dashboard-grid--dual">
            <Card title="Estoque crítico" subtitle="Progresso versus mínimo recomendado">
              <div className="stock-list">
                {estoqueCritico.length === 0 ? <p>Sem itens críticos no momento.</p> : estoqueCritico.map((item) => (
                  <div key={item.id} className="stock-item">
                    <div className="stock-head">
                      <span>{item.produto || item.nome}</span>
                      <span>{formatNumber(item.ratio, 0)}%</span>
                    </div>
                    <div className="stock-bar"><span style={{ width: `${Math.max(item.ratio, 4)}%` }} /></div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Alertas pendentes" subtitle="Ordenados por urgência">
              {alertasFormatados.length === 0 ? <p>Nenhum alerta pendente.</p> : alertasFormatados.slice().sort((a, b) => urgencyRank(a) - urgencyRank(b)).map((alert) => {
                const variant = urgencyVariant(alert);
                return (
                  <div className="alert-item" key={alert.id}>
                    <AlertTriangle size={16} />
                    <div>
                      <strong>{alert.titulo}</strong>
                      <p>{alert.descricao}</p>
                    </div>
                    <Badge variant={variant}>{variant}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => onResolveAlert?.(alert)}>Resolver</Button>
                  </div>
                );
              })}
            </Card>
          </section>
        </>
      )}

      {tabAtiva === 'estoque' && (
        <div className="dashboard-tab-content">
          <div className="kpi-grid dashboard-kpi-stock-summary"> {/* Adicionada classe para o grid */}
            <div className="kpi-card">
              <div className="kpi-icon-wrapper">
                <Package size={22} />
              </div>
              <div>
                <p className="kpi-label">Total de itens</p>
                <p className="kpi-value">{db.estoque?.length || 0}</p>
                <p className="kpi-sub">no estoque</p>
              </div>
            </div>

            <div className={`kpi-card ${itensCriticos > 0 ? 'kpi-card--danger' : ''}`}> {/* Usando classe */}
              <div className={`kpi-icon-wrapper ${itensCriticos > 0 ? 'kpi-icon-wrapper--danger' : ''}`}> {/* Usando classe */}
                <AlertTriangle size={22} className={itensCriticos > 0 ? 'text-danger' : ''} /> {/* Usando classe */}
              </div>
              <div>
                <p className="kpi-label">Estoque crítico</p>
                <p className={`kpi-value ${itensCriticos > 0 ? 'text-danger' : ''}`}>{itensCriticos}</p> {/* Usando classe */}
                <p className="kpi-sub">itens abaixo do mínimo</p>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon-wrapper">
                <DollarSign size={22} />
              </div>
              <div>
                <p className="kpi-label">Valor em estoque</p>
                <p className="kpi-value">{formatarMoeda(valorTotalEstoque)}</p>
                <p className="kpi-sub">valor estimado</p>
              </div>
            </div>
          </div>

          <div className="card dashboard-stock-card">
            <div className="card-header dashboard-tab-header">
              <h3>Itens em Estoque</h3>
              <button className="btn-primary btn-sm" onClick={() => onNavigate?.('estoque')} type="button">Ver tudo</button>
            </div>
            <table className="history-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Categoria</th>
                  <th>Quantidade</th>
                  <th>Mínimo</th>
                  <th>Status</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {(db.estoque || []).map((item) => {
                  const critico = Number(item.quantidade_atual) <= Number(item.quantidade_minima || 0);
                  return (
                    <tr key={item.id}>
                      <td>{item.nome || item.produto}</td>
                      <td>
                        <span className="badge-categoria">{item.categoria}</span>
                      </td>
                      <td>{item.quantidade_atual} {item.unidade}</td>
                      <td>{item.quantidade_minima || '-'} {item.unidade}</td>
                      <td>
                        <span className={critico ? 'text-danger' : 'text-success'}> {/* Usando classes */}
                          {critico ? '⚠ Crítico' : '✓ Normal'}
                        </span>
                      </td>
                      <td>
                        {item.preco_unitario
                          ? formatarMoeda(item.preco_unitario * item.quantidade_atual)
                          : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(!db.estoque || db.estoque.length === 0) && (
              <div className="empty-state">
                <p>Nenhum item no estoque.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tabAtiva === 'alertas' && (
        <div className="dashboard-tab-content">
          <div className="kpi-grid dashboard-kpi-alerts-summary"> {/* Adicionada classe para o grid */}
            <div className="kpi-card kpi-card--danger"> {/* Usando classe */}
              <div className="kpi-icon-wrapper kpi-icon-wrapper--danger"> {/* Usando classe */}
                <AlertTriangle size={22} className="text-danger" /> {/* Usando classe */}
              </div>
              <div>
                <p className="kpi-label">Alta prioridade</p>
                <p className="kpi-value text-danger">{alertasFormatados.filter((a) => a.prioridade === 'alta').length}</p> {/* Usando classe */}
                <p className="kpi-sub">requer ação imediata</p>
              </div>
            </div>

            <div className="kpi-card kpi-card--warning"> {/* Usando classe */}
              <div className="kpi-icon-wrapper kpi-icon-wrapper--warning"> {/* Usando classe */}
                <Bell size={22} className="text-warning" /> {/* Usando classe */}
              </div>
              <div>
                <p className="kpi-label">Média prioridade</p>
                <p className="kpi-value text-warning">{alertasFormatados.filter((a) => a.prioridade === 'media').length}</p> {/* Usando classe */}
                <p className="kpi-sub">atenção recomendada</p>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon-wrapper">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <p className="kpi-label">Total de alertas</p>
                <p className="kpi-value">{alertasFormatados.length}</p>
                <p className="kpi-sub">pendentes</p>
              </div>
            </div>
          </div>

          <div className="card dashboard-alerts-card">
            <div className="card-header dashboard-tab-header">
              <h3>Todos os Alertas</h3>
              <button className="btn-primary btn-sm" onClick={() => setTabAtiva?.('geral')} type="button">Voltar ao Geral</button>
            </div>

            {alertasFormatados.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <CheckCircle2 size={28} />
                </div>
                <p className="empty-state-title">Nenhum alerta pendente</p>
                <p className="empty-state-desc">Sua operação está em dia!</p>
              </div>
            ) : (
              alertasFormatados.map((alerta) => (
                <div key={alerta.id} className="alert-item">
                  <div className={`alert-dot ${alerta.prioridade}`} />
                  <div style={{ flex: 1 }}>
                    <p className="alert-item-title">{alerta.titulo}</p>
                    <p className="alert-item-desc">{alerta.descricao}</p>
                  </div>
                  <button
                    className="alert-action-btn"
                    onClick={() => onNavigate?.(alerta.acao?.rota || 'dashboard')}
                    type="button"
                  >
                    {alerta.acao?.label || 'Abrir'} →
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Componente para exibir um painel de KPI.
 * @param {object} props - As propriedades do componente.
 * @param {string} props.title - Título do KPI.
 * @param {string} props.value - Valor do KPI.
 * @param {number} props.variation - Variação percentual.
 * @param {React.ComponentType} props.icon - Ícone a ser exibido.
 * @param {string} [props.variant='neutral'] - Variante de estilo ('success', 'warning', 'danger', 'info', 'neutral').
 * @param {boolean} [props.compact=false] - Se o painel deve ser compacto.
 */
function KpiPanel({ title, value, variation, icon, variant = 'neutral', compact = false }) {
  const IconComp = icon;

  return (
    <Card className={`kpi-panel kpi-panel--${variant} ${compact ? 'kpi-panel--compact' : ''}`}>
      <div className="kpi-panel-header">
        <IconComp size={20} />
      </div>
      <strong>{value}</strong>
      <span>{title}</span>
      <div className={`kpi-variation ${variation >= 0 ? 'up' : 'down'}`}>
        {variation >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
        {formatNumber(Math.abs(variation), 1)}%
      </div>
    </Card>
  );
}

/**
 * Calcula a variação percentual entre dois valores.
 * @param {number} current - Valor atual.
 * @param {number} previous - Valor anterior.
 * @returns {number} A variação percentual.
 */
function getVariation(current, previous) {
  if (!previous) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Mapeia um valor de prioridade para um rank numérico.
 * @param {string} valor - O valor da prioridade ('critica', 'alta', 'media', 'baixa').
 * @returns {number} O rank numérico.
 */
function prioridadeRank(valor) {
  if (valor === 'critica') return 4;
  if (valor === 'alta') return 3;
  if (valor === 'media') return 2;
  return 1;
}

/**
 * Calcula o número de dias até uma data.
 * @param {string} dateStr - A string da data no formato 'YYYY-MM-DD'.
 * @returns {number} O número de dias até a data, ou Infinity se a data for inválida.
 */
function daysUntil(dateStr) {
  if (!dateStr) return Number.POSITIVE_INFINITY;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - now) / 86400000);
}

/**
 * Determina a variante de urgência de um alerta com base no seu título/descrição.
 * @param {object} alert - O objeto do alerta.
 * @returns {string} A variante de urgência ('danger', 'warning', 'success').
 */
function urgencyVariant(alert) {
  const text = `${alert.title || ''} ${alert.description || ''}`.toLowerCase();
  if (text.includes('atrasad') || text.includes('venc')) return 'danger';
  if (text.includes('3 dia') || text.includes('urg')) return 'warning';
  return 'success';
}

/**
 * Mapeia a variante de urgência para um rank numérico para ordenação.
 * @param {object} alert - O objeto do alerta.
 * @returns {number} O rank numérico da urgência.
 */
function urgencyRank(alert) {
  const variant = urgencyVariant(alert);
  if (variant === 'danger') return 0;
  if (variant === 'warning') return 1;
  return 2;
}

/**
 * Componente de Tooltip personalizado para o gráfico de peso.
 * @param {object} props - As propriedades do componente.
 * @param {boolean} props.active - Se o tooltip está ativo.
 * @param {Array<object>} props.payload - Dados do tooltip.
 * @param {string} props.label - Label do tooltip (data).
 */
function PesoTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="peso-tooltip">
      <strong>{label}</strong>
      {payload.filter((item) => item.value != null).map((item) => (
        <div key={item.dataKey}>
          {item.dataKey}: {formatNumber(item.value, 1)} kg ({formatNumber(item.value / 15, 2)} @)
        </div>
      ))}
    </div>
  );
}
