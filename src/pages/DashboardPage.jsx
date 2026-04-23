import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bell,
  BellRing,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  DollarSign,
  Package,
  Scale,
  Tractor,
  Users,
  Weight,
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

export default function DashboardPage({
  db,
  alerts = [],
  onNavigate = null,
  onResolveAlert = null,
  tabAtiva = 'geral',
  setTabAtiva,
}) {
  const [hiddenLines, setHiddenLines] = useState({});

  const lotesMap = useMemo(() => new Map((db.lotes || []).map((lote) => [lote.id, lote])), [db.lotes]);
  const lotesAtivos = useMemo(() => (db.lotes || []).filter((lote) => lote.status === 'ativo'), [db.lotes]);

  const lotesStats = useMemo(
    () =>
      lotesAtivos.map((lote) => ({
        lote,
        indicators: calcLote(db, lote.id),
      })),
    [db, lotesAtivos]
  );

  const totalCabecasAtivas = useMemo(
    () => lotesStats.reduce((sum, item) => sum + item.indicators.totalAnimais, 0),
    [lotesStats]
  );

  const arrobaMedia = useMemo(
    () =>
      totalCabecasAtivas
        ? lotesStats.reduce(
            (sum, item) => sum + item.indicators.pesoAtualMedio * item.indicators.totalAnimais,
            0
          ) /
            totalCabecasAtivas /
            15
        : 0,
    [lotesStats, totalCabecasAtivas]
  );

  const receitaMes = useMemo(
    () => lotesStats.reduce((sum, item) => sum + item.indicators.receitaTotal, 0),
    [lotesStats]
  );
  const custoMes = useMemo(
    () => (db.custos || []).reduce((sum, item) => sum + Number(item.val || 0), 0),
    [db.custos]
  );
  const resultadoMes = useMemo(() => receitaMes - custoMes, [receitaMes, custoMes]);

  const gmdMedio = useMemo(
    () =>
      lotesStats.length
        ? lotesStats.reduce((sum, item) => sum + item.indicators.gmdMedio, 0) / lotesStats.length
        : 0,
    [lotesStats]
  );

  const estoqueCritico = useMemo(
    () =>
      (db.estoque || [])
        .map((item) => {
          const atual = Number(item.quantidade_atual || 0);
          const min = Number(item.quantidade_minima || 0);
          const ratio = min ? Math.min((atual / min) * 100, 100) : 100;
          return { ...item, ratio, critico: atual <= min };
        })
        .filter((item) => item.critico)
        .sort((a, b) => a.ratio - b.ratio),
    [db.estoque]
  );

  const itensCriticos = useMemo(() => estoqueCritico.length, [estoqueCritico]);

  const valorTotalEstoque = useMemo(
    () =>
      (db.estoque || []).reduce(
        (acc, item) =>
          acc + Number(item.preco_unitario || 0) * Number(item.quantidade_atual || 0),
        0
      ),
    [db.estoque]
  );

  const eventosCalendario = useMemo(
    () =>
      (db.sanitario || [])
        .map((item) => {
          const lote = lotesMap.get(item.lote_id);
          const dias = daysUntil(item.proxima);
          return { ...item, loteNome: lote?.nome || 'Sem lote', dias };
        })
        .filter((item) => Number.isFinite(item.dias))
        .sort((a, b) => a.dias - b.dias)
        .slice(0, 8),
    [db.sanitario, lotesMap]
  );

  const alertasPendentesCalendario = useMemo(
    () => eventosCalendario.filter((item) => item.dias <= 3).length,
    [eventosCalendario]
  );

  const kpisMain = useMemo(
    () => [
      {
        title: 'Cabecas ativas',
        value: formatNumber(totalCabecasAtivas, 0),
        variation: getVariation(totalCabecasAtivas, totalCabecasAtivas * 0.92),
        icon: Users,
        variant: KPI_VARIANTS.info,
      },
      {
        title: 'Lotes em operacao',
        value: formatNumber(lotesAtivos.length, 0),
        variation: getVariation(lotesAtivos.length, Math.max(1, lotesAtivos.length - 1)),
        icon: Tractor,
        variant: KPI_VARIANTS.neutral,
      },
      {
        title: 'Arroba media do rebanho',
        value: `${formatNumber(arrobaMedia, 2)} @`,
        variation: getVariation(arrobaMedia, arrobaMedia * 0.95),
        icon: Weight,
        variant: KPI_VARIANTS.success,
      },
      {
        title: 'Resultado do mes',
        value: formatCurrency(resultadoMes),
        variation: getVariation(resultadoMes, resultadoMes * 0.85),
        icon: DollarSign,
        variant: resultadoMes >= 0 ? KPI_VARIANTS.success : KPI_VARIANTS.danger,
      },
    ],
    [totalCabecasAtivas, lotesAtivos.length, arrobaMedia, resultadoMes]
  );

  const kpisSecondary = useMemo(
    () => [
      {
        title: 'GMD medio',
        value: `${formatNumber(gmdMedio, 3)} kg/dia`,
        variation: getVariation(gmdMedio, gmdMedio * 0.96),
        icon: Scale,
        variant: KPI_VARIANTS.info,
      },
      {
        title: 'Estoque critico',
        value: formatNumber(estoqueCritico.length, 0),
        variation: getVariation(estoqueCritico.length, Math.max(0, estoqueCritico.length - 1)),
        icon: Package,
        variant: estoqueCritico.length ? KPI_VARIANTS.warning : KPI_VARIANTS.success,
      },
      {
        title: 'Alertas de calendario',
        value: formatNumber(alertasPendentesCalendario, 0),
        variation: getVariation(
          alertasPendentesCalendario,
          Math.max(0, alertasPendentesCalendario - 1)
        ),
        icon: BellRing,
        variant: alertasPendentesCalendario ? KPI_VARIANTS.warning : KPI_VARIANTS.success,
      },
    ],
    [gmdMedio, estoqueCritico.length, alertasPendentesCalendario]
  );

  const chartRows = useMemo(() => {
    const pesagens = db.pesagens || [];
    const activeIds = new Set(lotesAtivos.map((lote) => lote.id));
    const timelineMap = new Map();

    pesagens
      .filter((item) => activeIds.has(item.lote_id))
      .sort((a, b) => new Date(a.data) - new Date(b.data))
      .forEach((item) => {
        if (!timelineMap.has(item.data)) {
          timelineMap.set(item.data, { data: item.data, label: formatDate(item.data) });
        }

        const loteNome = lotesMap.get(item.lote_id)?.nome;
        if (loteNome) {
          timelineMap.get(item.data)[loteNome] = Number(item.peso_medio || 0);
        }
      });

    return Array.from(timelineMap.values());
  }, [db.pesagens, lotesAtivos, lotesMap]);

  const lotesColorMap = useMemo(
    () =>
      lotesAtivos.reduce((acc, lote, index) => {
        acc[lote.nome] = ['#22c55e', '#3b82f6', '#eab308', '#ef4444', '#a855f7'][index % 5];
        return acc;
      }, {}),
    [lotesAtivos]
  );

  const movimentacoesRecentes = useMemo(
    () =>
      (db.movimentacoes_animais || [])
        .slice()
        .sort((a, b) => new Date(b.data || b.created_at) - new Date(a.data || a.created_at))
        .slice(0, 6),
    [db.movimentacoes_animais]
  );

  const tarefasUrgentes = useMemo(
    () =>
      (db.tarefas || [])
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
        .slice(0, 5),
    [db.tarefas]
  );

  const tarefasResumo = useMemo(
    () =>
      (db.tarefas || []).reduce(
        (acc, item) => {
          if (item.status === 'pendente') acc.pendente += 1;
          if (item.status === 'em_andamento') acc.em_andamento += 1;
          if (item.status === 'concluida') acc.concluida += 1;
          return acc;
        },
        { pendente: 0, em_andamento: 0, concluida: 0 }
      ),
    [db.tarefas]
  );

  const alertasFormatados = useMemo(
    () =>
      (alerts || []).map((alert, index) => ({
        ...alert,
        id: alert.id || alert.ackKey || `alert-${index}`,
        titulo: alert.titulo || alert.title || 'Alerta do sistema',
        descricao: alert.descricao || alert.description || 'Sem descricao',
        prioridade:
          alert.prioridade ||
          (urgencyVariant(alert) === 'danger'
            ? 'alta'
            : urgencyVariant(alert) === 'warning'
              ? 'media'
              : 'baixa'),
        acao: alert.acao || { label: 'Abrir', rota: alert.route || 'dashboard' },
      })),
    [alerts]
  );

  const totalAlertasCriticos = useMemo(
    () => alertasFormatados.filter((alert) => urgencyVariant(alert) === 'danger').length,
    [alertasFormatados]
  );

  const proximoEvento = eventosCalendario[0] || null;
  const loteCampeao = lotesStats
    .slice()
    .sort((a, b) => b.indicators.margem - a.indicators.margem)[0];

  return (
    <div className="dashboard-page">
      <header className="dashboard-title">
        <div>
          <span className="dashboard-kicker">Centro executivo HERDON</span>
          <h1>Painel premium da operacao pecuaria</h1>
          <p>
            Mais leitura estrategica para rebanho, manejo, estoque e resultado financeiro em uma
            experiencia escura, clara e orientada a decisao.
          </p>
        </div>

        <div className="dashboard-title-actions">
          <Button variant="outline" onClick={() => onNavigate?.('resultados')}>
            Abrir relatorios
          </Button>
          <Button variant="primary" onClick={() => onNavigate?.('calendarioOperacional')}>
            Ver calendario
          </Button>
        </div>
      </header>

      {tabAtiva === 'geral' && (
        <>
          <section className="dashboard-hero">
            <div className="dashboard-hero-main">
              <span className="dashboard-hero-eyebrow">Operacao de alta clareza</span>
              <h2>
                Mais controle da rotina, mais leitura executiva dos indicadores e mais velocidade
                para agir.
              </h2>
              <p>
                O dashboard foi reorganizado para destacar risco, performance e proximos passos sem
                perder o contexto das paginas operacionais ja existentes.
              </p>

              <div className="dashboard-hero-pills">
                <span>{formatNumber(totalCabecasAtivas, 0)} cabecas monitoradas</span>
                <span>{formatNumber(lotesAtivos.length, 0)} lotes em operacao</span>
                <span>{formatNumber(alerts.length, 0)} alertas ativos</span>
              </div>
            </div>

            <div className="dashboard-hero-side">
              <div className="hero-stat-card hero-stat-card--highlight">
                <small>Resultado do ciclo atual</small>
                <strong>{formatCurrency(resultadoMes)}</strong>
                <span>{receitaMes >= custoMes ? 'Receita acima do custo mensal' : 'Custo acima da receita mensal'}</span>
              </div>

              <div className="hero-stat-grid">
                <div className="hero-stat-card">
                  <small>Estoque protegido</small>
                  <strong>{formatarMoeda(valorTotalEstoque)}</strong>
                  <span>base financeira dos insumos</span>
                </div>
                <div className="hero-stat-card">
                  <small>Alertas criticos</small>
                  <strong>{formatNumber(totalAlertasCriticos, 0)}</strong>
                  <span>pontos que exigem resposta</span>
                </div>
              </div>
            </div>
          </section>

          <section className="dashboard-grid dashboard-grid--kpi-main">
            {kpisMain.map((item) => (
              <KpiPanel key={item.title} {...item} />
            ))}
          </section>

          <section className="dashboard-strip">
            {kpisSecondary.map((item) => (
              <KpiPanel key={item.title} {...item} compact />
            ))}
          </section>

          <section className="dashboard-grid dashboard-grid--feature">
            <Card
              title="Evolucao de peso por lote"
              subtitle="Peso medio por data para leitura rapida de tendencia"
              className="dashboard-chart-card"
            >
              <div className="chart-legend">
                {Object.entries(lotesColorMap).map(([nome, cor]) => (
                  <button
                    key={nome}
                    type="button"
                    className={hiddenLines[nome] ? '' : 'active'}
                    onClick={() =>
                      setHiddenLines((prev) => ({
                        ...prev,
                        [nome]: !prev[nome],
                      }))
                    }
                  >
                    <span style={{ background: cor, opacity: hiddenLines[nome] ? 0.32 : 1 }} />
                    {nome}
                  </button>
                ))}
              </div>

              <div className="chart-shell">
                <ResponsiveContainer width="100%" height={340}>
                  <LineChart data={chartRows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="label" stroke="rgba(214,223,219,0.56)" />
                    <YAxis unit="kg" stroke="rgba(214,223,219,0.56)" />
                    <Tooltip content={<PesoTooltip />} />
                    {Object.entries(lotesColorMap).map(([nome, cor]) => (
                      <Line
                        key={nome}
                        dataKey={nome}
                        stroke={cor}
                        strokeWidth={2.5}
                        hide={!!hiddenLines[nome]}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card
              title="Sala executiva"
              subtitle="Leitura sintetica do que merece atencao agora"
              className="dashboard-spotlight-card"
            >
              <div className="dashboard-spotlight-block">
                <div className="dashboard-spotlight-head">
                  <span>Lote com melhor margem</span>
                  <Badge variant="success">Performance</Badge>
                </div>
                <strong>{loteCampeao?.lote?.nome || 'Sem dados suficientes'}</strong>
                <p>
                  {loteCampeao
                    ? `${formatCurrency(loteCampeao.indicators.margem)} de margem e ${formatNumber(
                        loteCampeao.indicators.gmdMedio,
                        3
                      )} kg/dia.`
                    : 'Cadastre movimentacoes e pesagens para liberar esta leitura.'}
                </p>
              </div>

              <div className="dashboard-spotlight-grid">
                <div className="dashboard-spotlight-mini">
                  <small>Tarefas em aberto</small>
                  <strong>{formatNumber(tarefasResumo.pendente + tarefasResumo.em_andamento, 0)}</strong>
                  <span>{formatNumber(tarefasResumo.concluida, 0)} concluidas no fluxo atual</span>
                </div>
                <div className="dashboard-spotlight-mini">
                  <small>Proximo evento</small>
                  <strong>{proximoEvento ? formatDate(proximoEvento.proxima) : '-'}</strong>
                  <span>{proximoEvento ? proximoEvento.loteNome : 'Nenhum evento proximo'}</span>
                </div>
              </div>

              <div className="dashboard-spotlight-actions">
                <Button variant="outline" onClick={() => onNavigate?.('tarefas')}>
                  Abrir tarefas
                </Button>
                <Button variant="ghost" onClick={() => setTabAtiva?.('alertas')}>
                  Ver alertas
                </Button>
              </div>
            </Card>
          </section>

          <section className="dashboard-grid dashboard-grid--dual">
            <Card title="Lotes ativos" subtitle="Resumo produtivo com acesso rapido ao modulo">
              <div className="table-responsive">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Cabecas</th>
                      <th>Peso medio</th>
                      <th>@ viva</th>
                      <th>GMD</th>
                      <th>Dias</th>
                      <th>Custo/cab</th>
                      <th>Resultado</th>
                      <th>Status</th>
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
                        <td className={indicators.margem >= 0 ? 'positive' : 'negative'}>
                          {formatCurrency(indicators.margem)}
                        </td>
                        <td>
                          <Badge variant={lote.status === 'ativo' ? 'success' : 'neutral'}>
                            {lote.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="Janela de calendario" subtitle="Eventos ordenados por urgencia operativa">
              <div className="alerts-list">
                {eventosCalendario.length === 0 ? (
                  <p>Sem eventos proximos.</p>
                ) : (
                  eventosCalendario.map((item) => {
                    const variant =
                      item.dias < 0 ? 'danger' : item.dias <= 3 ? 'warning' : 'success';

                    return (
                      <div key={item.id} className="alert-item">
                        <Badge variant={variant}>
                          {item.dias < 0 ? 'Atrasado' : item.dias <= 3 ? 'Urgente' : 'Programado'}
                        </Badge>
                        <div>
                          <strong>{item.desc}</strong>
                          <p>
                            {item.loteNome} · {formatDate(item.proxima)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          icon={<CalendarClock size={14} />}
                          onClick={() => onResolveAlert?.({ id: item.id, ackKey: `sanitario-${item.id}` })}
                        >
                          Resolver
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </section>

          <section className="dashboard-grid dashboard-grid--dual">
            <Card title="Tarefas prioritarias" subtitle="Leitura rapida dos proximos vencimentos">
              <div className="alerts-list">
                {tarefasUrgentes.length === 0 ? (
                  <p>Nenhuma tarefa urgente.</p>
                ) : (
                  tarefasUrgentes.map((item) => (
                    <div key={item.id} className="alert-item">
                      <Badge variant={item.dias < 0 ? 'danger' : item.dias === 0 ? 'warning' : 'info'}>
                        {item.dias < 0 ? 'Vencida' : item.dias === 0 ? 'Hoje' : 'Futura'}
                      </Badge>
                      <div>
                        <strong>{item.titulo}</strong>
                        <p>
                          {formatDate(item.data_vencimento)} · {item.prioridade}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<CheckSquare size={14} />}
                        onClick={() => onResolveAlert?.({ id: item.id, ackKey: `tarefa-${item.id}` })}
                      >
                        Concluir
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card title="Movimentacoes recentes" subtitle="Ultimas movimentacoes registradas no rebanho">
              <div className="alerts-list">
                {movimentacoesRecentes.length === 0 ? (
                  <p>Nenhuma movimentacao recente.</p>
                ) : (
                  movimentacoesRecentes.map((mov) => (
                    <div key={mov.id} className="alert-item">
                      <Badge variant={mov.tipo === 'saida' ? 'danger' : 'info'}>
                        {mov.tipo || 'mov'}
                      </Badge>
                      <div>
                        <strong>{mov.qtd || 0} cabecas</strong>
                        <p>
                          {formatDate(mov.data)} · {mov.observacao || 'Movimentacao registrada'}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </section>

          <section className="dashboard-grid dashboard-grid--dual">
            <Card title="Estoque critico" subtitle="Progresso em relacao ao minimo recomendado">
              <div className="stock-list">
                {estoqueCritico.length === 0 ? (
                  <p>Sem itens criticos no momento.</p>
                ) : (
                  estoqueCritico.map((item) => (
                    <div key={item.id} className="stock-item">
                      <div className="stock-head">
                        <span>{item.produto || item.nome}</span>
                        <span>{formatNumber(item.ratio, 0)}%</span>
                      </div>
                      <div className="stock-bar">
                        <span style={{ width: `${Math.max(item.ratio, 4)}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card title="Alertas pendentes" subtitle="Itens ordenados por urgencia">
              {alertasFormatados.length === 0 ? (
                <p>Nenhum alerta pendente.</p>
              ) : (
                alertasFormatados
                  .slice()
                  .sort((a, b) => urgencyRank(a) - urgencyRank(b))
                  .map((alert) => {
                    const variant = urgencyVariant(alert);
                    return (
                      <div className="alert-item" key={alert.id}>
                        <AlertTriangle size={16} />
                        <div>
                          <strong>{alert.titulo}</strong>
                          <p>{alert.descricao}</p>
                        </div>
                        <Badge variant={variant}>{variant}</Badge>
                        <Button size="sm" variant="ghost" onClick={() => onResolveAlert?.(alert)}>
                          Resolver
                        </Button>
                      </div>
                    );
                  })
              )}
            </Card>
          </section>
        </>
      )}

      {tabAtiva === 'estoque' && (
        <div className="dashboard-tab-content">
          <div className="kpi-grid dashboard-kpi-stock-summary">
            <div className="kpi-card">
              <div className="kpi-icon-wrapper">
                <Package size={22} />
              </div>
              <div>
                <p className="kpi-label">Total de itens</p>
                <p className="kpi-value">{db.estoque?.length || 0}</p>
                <p className="kpi-sub">itens no estoque</p>
              </div>
            </div>

            <div className={`kpi-card ${itensCriticos > 0 ? 'kpi-card--danger' : ''}`}>
              <div className={`kpi-icon-wrapper ${itensCriticos > 0 ? 'kpi-icon-wrapper--danger' : ''}`}>
                <AlertTriangle size={22} className={itensCriticos > 0 ? 'text-danger' : ''} />
              </div>
              <div>
                <p className="kpi-label">Estoque critico</p>
                <p className={`kpi-value ${itensCriticos > 0 ? 'text-danger' : ''}`}>{itensCriticos}</p>
                <p className="kpi-sub">itens abaixo do minimo</p>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon-wrapper">
                <DollarSign size={22} />
              </div>
              <div>
                <p className="kpi-label">Valor em estoque</p>
                <p className="kpi-value">{formatarMoeda(valorTotalEstoque)}</p>
                <p className="kpi-sub">estimativa financeira</p>
              </div>
            </div>
          </div>

          <div className="card dashboard-stock-card">
            <div className="card-header dashboard-tab-header">
              <h3>Itens em estoque</h3>
              <button className="btn-primary btn-sm" onClick={() => onNavigate?.('estoque')} type="button">
                Ver tudo
              </button>
            </div>
            <table className="history-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Categoria</th>
                  <th>Quantidade</th>
                  <th>Minimo</th>
                  <th>Status</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {(db.estoque || []).map((item) => {
                  const critico =
                    Number(item.quantidade_atual) <= Number(item.quantidade_minima || 0);
                  return (
                    <tr key={item.id}>
                      <td>{item.nome || item.produto}</td>
                      <td>
                        <span className="badge-categoria">{item.categoria}</span>
                      </td>
                      <td>
                        {item.quantidade_atual} {item.unidade}
                      </td>
                      <td>
                        {item.quantidade_minima || '-'} {item.unidade}
                      </td>
                      <td>
                        <span className={critico ? 'text-danger' : 'text-success'}>
                          {critico ? 'Critico' : 'Normal'}
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
          <div className="kpi-grid dashboard-kpi-alerts-summary">
            <div className="kpi-card kpi-card--danger">
              <div className="kpi-icon-wrapper kpi-icon-wrapper--danger">
                <AlertTriangle size={22} className="text-danger" />
              </div>
              <div>
                <p className="kpi-label">Alta prioridade</p>
                <p className="kpi-value text-danger">
                  {alertasFormatados.filter((alert) => alert.prioridade === 'alta').length}
                </p>
                <p className="kpi-sub">requer acao imediata</p>
              </div>
            </div>

            <div className="kpi-card kpi-card--warning">
              <div className="kpi-icon-wrapper kpi-icon-wrapper--warning">
                <Bell size={22} className="text-warning" />
              </div>
              <div>
                <p className="kpi-label">Media prioridade</p>
                <p className="kpi-value text-warning">
                  {alertasFormatados.filter((alert) => alert.prioridade === 'media').length}
                </p>
                <p className="kpi-sub">atencao recomendada</p>
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
              <h3>Todos os alertas</h3>
              <button className="btn-primary btn-sm" onClick={() => setTabAtiva?.('geral')} type="button">
                Voltar ao geral
              </button>
            </div>

            {alertasFormatados.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <CheckCircle2 size={28} />
                </div>
                <p className="empty-state-title">Nenhum alerta pendente</p>
                <p className="empty-state-desc">Sua operacao esta em dia.</p>
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

function KpiPanel({ title, value, variation, icon, variant = 'neutral', compact = false }) {
  const IconComp = icon;

  return (
    <Card className={`kpi-panel kpi-panel--${variant} ${compact ? 'kpi-panel--compact' : ''}`}>
      <div className="kpi-panel-header">
        <span className="kpi-panel-label">{title}</span>
        <span className="kpi-panel-icon">
          <IconComp size={compact ? 16 : 18} />
        </span>
      </div>

      <strong>{value}</strong>

      <div className={`kpi-variation ${variation >= 0 ? 'up' : 'down'}`}>
        {variation >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
        {formatNumber(Math.abs(variation), 1)}% vs. base recente
      </div>
    </Card>
  );
}

function getVariation(current, previous) {
  if (!previous) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function prioridadeRank(valor) {
  if (valor === 'critica') return 4;
  if (valor === 'alta') return 3;
  if (valor === 'media') return 2;
  return 1;
}

function daysUntil(dateStr) {
  if (!dateStr) return Number.POSITIVE_INFINITY;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - now) / 86400000);
}

function urgencyVariant(alert) {
  const text = `${alert.title || ''} ${alert.description || ''}`.toLowerCase();
  if (text.includes('atrasad') || text.includes('venc')) return 'danger';
  if (text.includes('3 dia') || text.includes('urg')) return 'warning';
  return 'success';
}

function urgencyRank(alert) {
  const variant = urgencyVariant(alert);
  if (variant === 'danger') return 0;
  if (variant === 'warning') return 1;
  return 2;
}

function PesoTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="peso-tooltip">
      <strong>{label}</strong>
      {payload
        .filter((item) => item.value != null)
        .map((item) => (
          <div key={item.dataKey}>
            {item.dataKey}: {formatNumber(item.value, 1)} kg ({formatNumber(item.value / 15, 2)} @)
          </div>
        ))}
    </div>
  );
}
