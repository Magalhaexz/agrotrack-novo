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

  const pesoMedioAtual = useMemo(
    () =>
      totalCabecasAtivas
        ? lotesStats.reduce(
            (sum, item) => sum + item.indicators.pesoAtualMedio * item.indicators.totalAnimais,
            0
          ) / totalCabecasAtivas
        : 0,
    [lotesStats, totalCabecasAtivas]
  );

  const arrobaMedia = useMemo(() => pesoMedioAtual / 15, [pesoMedioAtual]);

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
        .slice(0, 6),
    [db.sanitario, lotesMap]
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

  const alertasOperacionais = useMemo(
    () =>
      alertasFormatados
        .slice()
        .sort((a, b) => urgencyRank(a) - urgencyRank(b))
        .slice(0, 5),
    [alertasFormatados]
  );

  const lotesEmAtencao = useMemo(
    () =>
      lotesStats
        .map((item) => {
          const metaGmd = Number(item.lote.gmd_meta || 0);
          const deltaPesoPct = item.indicators.pesoInicialMedio
            ? ((item.indicators.pesoAtualMedio - item.indicators.pesoInicialMedio) /
                item.indicators.pesoInicialMedio) *
              100
            : 0;

          const motivos = [];
          if (metaGmd > 0 && item.indicators.gmdMedio < metaGmd * 0.9) motivos.push('GMD abaixo da meta');
          if (item.indicators.margem < 0) motivos.push('Margem negativa');
          if (item.indicators.diasEstoque < 7) motivos.push('Suplemento curto');
          if (deltaPesoPct < 0) motivos.push('Perda de peso');

          return {
            ...item,
            deltaPesoPct,
            motivos,
          };
        })
        .filter((item) => item.motivos.length > 0)
        .sort((a, b) => {
          if (b.motivos.length !== a.motivos.length) return b.motivos.length - a.motivos.length;
          return a.deltaPesoPct - b.deltaPesoPct;
        })
        .slice(0, 5),
    [lotesStats]
  );

  const animaisEmRisco = useMemo(
    () => lotesEmAtencao.reduce((sum, item) => sum + item.indicators.totalAnimais, 0),
    [lotesEmAtencao]
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

  const melhorLote = useMemo(
    () => lotesStats.slice().sort((a, b) => b.indicators.margem - a.indicators.margem)[0],
    [lotesStats]
  );

  const piorLote = useMemo(
    () => lotesStats.slice().sort((a, b) => a.indicators.margem - b.indicators.margem)[0],
    [lotesStats]
  );

  const kpisMain = [
    {
      title: 'Cabecas ativas',
      value: formatNumber(totalCabecasAtivas, 0),
      variation: getVariation(totalCabecasAtivas, totalCabecasAtivas * 0.92),
      icon: Users,
      variant: KPI_VARIANTS.info,
    },
    {
      title: 'Lotes ativos',
      value: formatNumber(lotesAtivos.length, 0),
      variation: getVariation(lotesAtivos.length, Math.max(1, lotesAtivos.length - 1)),
      icon: Tractor,
      variant: KPI_VARIANTS.neutral,
    },
    {
      title: 'GMD medio',
      value: `${formatNumber(gmdMedio, 3)} kg/dia`,
      variation: getVariation(gmdMedio, gmdMedio * 0.96),
      icon: Scale,
      variant: KPI_VARIANTS.success,
    },
    {
      title: 'Peso medio atual',
      value: `${formatNumber(pesoMedioAtual, 1)} kg`,
      variation: getVariation(pesoMedioAtual, pesoMedioAtual * 0.95),
      icon: Weight,
      variant: KPI_VARIANTS.info,
    },
    {
      title: 'Resultado financeiro',
      value: formatCurrency(resultadoMes),
      variation: getVariation(resultadoMes, resultadoMes * 0.85),
      icon: DollarSign,
      variant: resultadoMes >= 0 ? KPI_VARIANTS.success : KPI_VARIANTS.danger,
    },
    {
      title: 'Estoque critico',
      value: formatNumber(estoqueCritico.length, 0),
      variation: getVariation(estoqueCritico.length, Math.max(0, estoqueCritico.length - 1)),
      icon: Package,
      variant: estoqueCritico.length ? KPI_VARIANTS.warning : KPI_VARIANTS.success,
    },
  ];

  const executiveSignals = [
    {
      label: 'Alertas prioritarios',
      value: formatNumber(totalAlertasCriticos || alertasFormatados.length, 0),
      helper: totalAlertasCriticos ? 'criticos aguardando acao' : 'alertas operacionais em leitura',
    },
    {
      label: 'Arroba media',
      value: `${formatNumber(arrobaMedia, 2)} @`,
      helper: 'media consolidada do rebanho ativo',
    },
    {
      label: 'Valor em estoque',
      value: formatarMoeda(valorTotalEstoque),
      helper: 'base disponivel para operacao',
    },
  ];

  const alertasPrioritarios = useMemo(() => {
    const operacionais = alertasOperacionais.map((alert) => ({
      id: `alerta-${alert.id}`,
      titulo: alert.titulo,
      descricao: alert.descricao,
      badge: urgencyVariant(alert) === 'danger' ? 'Critico' : urgencyVariant(alert) === 'warning' ? 'Atencao' : 'Monitorar',
      variant: urgencyVariant(alert),
      action: () => onNavigate?.(alert.acao?.rota || 'dashboard'),
    }));

    const lotesCriticos = lotesEmAtencao.map((item) => ({
      id: `lote-${item.lote.id}`,
      titulo: item.lote.nome,
      descricao: item.motivos.join(' · '),
      badge: item.indicators.margem >= 0 ? 'Monitorar' : 'Critico',
      variant: item.indicators.margem >= 0 ? 'warning' : 'danger',
      action: () => onNavigate?.('lotes'),
    }));

    return [...operacionais, ...lotesCriticos].slice(0, 6);
  }, [alertasOperacionais, lotesEmAtencao, onNavigate]);

  const proximosPassos = useMemo(() => {
    const tarefas = tarefasUrgentes.map((item) => ({
      id: `tarefa-${item.id}`,
      titulo: item.titulo,
      descricao: `${formatDate(item.data_vencimento)} · ${item.prioridade}`,
      badge: item.dias < 0 ? 'Vencida' : item.dias === 0 ? 'Hoje' : `${item.dias}d`,
      variant: item.dias < 0 ? 'danger' : item.dias <= 1 ? 'warning' : 'info',
      action: () => onNavigate?.('tarefas'),
      sortScore: item.dias,
    }));

    const agenda = eventosCalendario.map((item) => ({
      id: `agenda-${item.id}`,
      titulo: item.desc,
      descricao: `${item.loteNome} · ${formatDate(item.proxima)}`,
      badge: item.dias < 0 ? 'Atrasado' : item.dias <= 3 ? 'Urgente' : 'Programado',
      variant: item.dias < 0 ? 'danger' : item.dias <= 3 ? 'warning' : 'success',
      action: () => onNavigate?.('calendarioOperacional'),
      sortScore: item.dias,
    }));

    return [...tarefas, ...agenda]
      .sort((a, b) => a.sortScore - b.sortScore)
      .slice(0, 6);
  }, [eventosCalendario, tarefasUrgentes, onNavigate]);

  return (
    <div className="dashboard-page">
      <header className="dashboard-toolbar">
        <div className="dashboard-toolbar-copy">
          <h1>Dashboard</h1>
          <p>Monitoramento executivo da operacao, com foco em risco, desempenho e proximos passos.</p>
        </div>

        <div className="dashboard-toolbar-actions">
          <Button variant="outline" onClick={() => onNavigate?.('lotes')}>
            Novo lote
          </Button>
          <Button variant="outline" onClick={() => onNavigate?.('pesagens')}>
            Nova pesagem
          </Button>
          <Button variant="outline" onClick={() => onNavigate?.('sanitario')}>
            Registrar manejo
          </Button>
          <Button variant="primary" onClick={() => onNavigate?.('suplementacao')}>
            Registrar consumo
          </Button>
        </div>
      </header>

      {tabAtiva === 'geral' && (
        <>
          <section className="dashboard-grid dashboard-grid--kpi-main">
            {kpisMain.map((item) => (
              <KpiPanel key={item.title} {...item} />
            ))}
          </section>

          <section className="dashboard-executive-strip">
            {executiveSignals.map((item) => (
              <div key={item.label} className="dashboard-executive-chip">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.helper}</small>
              </div>
            ))}
          </section>

          <section className="dashboard-grid dashboard-grid--operations">
            <Card
              title="Alertas prioritarios"
              subtitle="O que mais pesa na demonstracao comercial e na rotina operacional."
              action={
                <Button size="sm" variant="ghost" onClick={() => setTabAtiva?.('alertas')}>
                  Ver todos
                </Button>
              }
            >
              <div className="dashboard-list">
                {alertasPrioritarios.length === 0 ? (
                  <p className="dashboard-empty-copy">Nenhum alerta prioritario no momento.</p>
                ) : (
                  alertasPrioritarios.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="dashboard-list-item dashboard-list-item--button"
                      onClick={item.action}
                    >
                      <div className="dashboard-list-copy">
                        <strong>{item.titulo}</strong>
                        <p>{item.descricao}</p>
                      </div>
                      <Badge variant={item.variant}>{item.badge}</Badge>
                    </button>
                  ))
                )}
              </div>
            </Card>

            <Card
              title="Tarefas e proximos passos"
              subtitle="Pendencias, agenda sanitaria e follow-ups para manter a operacao fluindo."
              action={
                <Button size="sm" variant="ghost" onClick={() => onNavigate?.('tarefas')}>
                  Abrir rotina
                </Button>
              }
            >
              <div className="dashboard-list">
                {proximosPassos.length === 0 ? (
                  <p className="dashboard-empty-copy">Nenhuma pendencia imediata registrada.</p>
                ) : (
                  proximosPassos.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="dashboard-list-item dashboard-list-item--button"
                      onClick={item.action}
                    >
                      <div className="dashboard-list-copy">
                        <strong>{item.titulo}</strong>
                        <p>
                          {item.descricao}
                        </p>
                      </div>
                      <Badge variant={item.variant}>
                        {item.badge}
                      </Badge>
                    </button>
                  ))
                )}
              </div>
            </Card>

            <Card
              title="Acoes rapidas uteis"
              subtitle="Atalhos diretos para os fluxos que mais importam em uma demo."
            >
              <div className="dashboard-action-grid">
                <Button fullWidth onClick={() => onNavigate?.('pesagens')}>
                  Nova pesagem
                </Button>
                <Button fullWidth variant="outline" onClick={() => onNavigate?.('lotes')}>
                  Novo lote
                </Button>
                <Button fullWidth variant="outline" onClick={() => onNavigate?.('sanitario')}>
                  Registrar manejo
                </Button>
                <Button fullWidth variant="ghost" onClick={() => onNavigate?.('suplementacao')}>
                  Registrar consumo
                </Button>
              </div>
            </Card>
          </section>

          <section className="dashboard-grid dashboard-grid--dual">
            <Card
              title="Estoque critico"
              subtitle="Cobertura baixa, reposicao e itens que merecem atencao comercial."
              action={
                <Button size="sm" variant="ghost" onClick={() => onNavigate?.('estoque')}>
                  Abrir estoque
                </Button>
              }
            >
              <div className="stock-list">
                {estoqueCritico.length === 0 ? (
                  <p className="dashboard-empty-copy">Sem itens criticos no momento.</p>
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

            <Card
              title="Resultado financeiro"
              subtitle="Receita, custo e leitura executiva para a conversa comercial."
              className="dashboard-summary-card"
            >
              <div className="dashboard-summary-grid">
                <div className="dashboard-summary-metric">
                  <small>Receita estimada</small>
                  <strong>{formatCurrency(receitaMes)}</strong>
                </div>
                <div className="dashboard-summary-metric">
                  <small>Custo operacional</small>
                  <strong>{formatCurrency(custoMes)}</strong>
                </div>
                <div className="dashboard-summary-metric">
                  <small>Resultado do mes</small>
                  <strong className={resultadoMes >= 0 ? 'positive' : 'negative'}>
                    {formatCurrency(resultadoMes)}
                  </strong>
                </div>
                <div className="dashboard-summary-metric">
                  <small>Valor em estoque</small>
                  <strong>{formatarMoeda(valorTotalEstoque)}</strong>
                </div>
              </div>

              <div className="dashboard-summary-divider" />

              <div className="dashboard-summary-list">
                <div className="dashboard-summary-line">
                  <span>Melhor margem</span>
                  <strong>{melhorLote?.lote?.nome || '-'}</strong>
                  <small>{melhorLote ? formatCurrency(melhorLote.indicators.margem) : '-'}</small>
                </div>
                <div className="dashboard-summary-line">
                  <span>Maior atencao financeira</span>
                  <strong>{piorLote?.lote?.nome || '-'}</strong>
                  <small>{piorLote ? formatCurrency(piorLote.indicators.margem) : '-'}</small>
                </div>
                <div className="dashboard-summary-line">
                  <span>Arroba media atual</span>
                  <strong>{formatNumber(arrobaMedia, 2)} @</strong>
                  <small>media consolidada do rebanho ativo</small>
                </div>
              </div>
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

            <div className={`kpi-card ${estoqueCritico.length > 0 ? 'kpi-card--danger' : ''}`}>
              <div className={`kpi-icon-wrapper ${estoqueCritico.length > 0 ? 'kpi-icon-wrapper--danger' : ''}`}>
                <AlertTriangle size={22} className={estoqueCritico.length > 0 ? 'text-danger' : ''} />
              </div>
              <div>
                <p className="kpi-label">Estoque critico</p>
                <p className={`kpi-value ${estoqueCritico.length > 0 ? 'text-danger' : ''}`}>{estoqueCritico.length}</p>
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
                  const critico = Number(item.quantidade_atual) <= Number(item.quantidade_minima || 0);
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
  const text = `${alert.title || alert.titulo || ''} ${alert.description || alert.descricao || ''}`.toLowerCase();
  if (text.includes('atrasad') || text.includes('venc') || text.includes('crit')) return 'danger';
  if (text.includes('3 dia') || text.includes('urg') || text.includes('alerta')) return 'warning';
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
