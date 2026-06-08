import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bell,
  BellRing,
  CheckCircle2,
  DollarSign,
  Package,
  Plus,
  Tractor,
  Users,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { getResumoLote } from '../domain/resumoLote';
import { formatCurrency, formatDate, formatNumber } from '../utils/calculations';
import { formatarMoeda } from '../utils/formatters';
import { gerarNovoId } from '../utils/id';
import { createOperationalRecord, updateOperationalRecord } from '../services/operationalPersistence';
import { useAuth } from '../auth/useAuth';
import { useToast } from '../hooks/useToast';
import '../styles/dashboard.css';

const getTodayIso = () => new Date().toISOString().slice(0, 10);

const KPI_VARIANTS = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
  neutral: 'neutral',
};

export default function DashboardPage({
  db,
  setDb,
  session = null,
  alerts = [],
  onNavigate = null,
  onResolveAlert = null,
  onSnoozeAlert = null,
  onAlertNavigate = null,
  tabAtiva = 'geral',
  setTabAtiva,
}) {
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const mensagemSemPermissao = 'Você não tem permissão para executar esta ação.';
  const [novaTarefa, setNovaTarefa] = useState({ titulo: '', funcionario_id: '', data_vencimento: '', descricao: '' });

  const pagamentosDiarios = useMemo(
    () => (db.movimentacoes_financeiras || []).filter((item) => item?.tipo === 'despesa' && (item?.categoria === 'Pagamento Diário' || item?.categoria === 'Pagamento Diario')),
    [db.movimentacoes_financeiras]
  );

  const pagamentosResumo = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    let vencidos = 0; let hojeCount = 0; let proximos = 0; let totalPendente = 0; let totalPago = 0;
    pagamentosDiarios.forEach((item) => {
      const valor = Number(item.valor || 0);
      const pago = Boolean(item.pago);
      const dataBase = new Date(`${(item.data_vencimento || item.data || getTodayIso())}T00:00:00`);
      if (pago) { totalPago += valor; return; }
      totalPendente += valor;
      if (dataBase < hoje) vencidos += 1;
      else if (dataBase.getTime() === hoje.getTime()) hojeCount += 1;
      else proximos += 1;
    });
    return { vencidos, hoje: hojeCount, proximos, totalPendente, totalPago };
  }, [pagamentosDiarios]);

  const lotesAtivos = useMemo(() => (db.lotes || []).filter((lote) => lote.status === 'ativo'), [db.lotes]);

  const lotesStats = useMemo(
    () =>
      lotesAtivos.map((lote) => ({
        lote,
        indicators: getResumoLote(db, lote.id),
      })),
    [db, lotesAtivos]
  );

  const lotesAggregates = useMemo(
    () =>
      lotesStats.reduce(
        (acc, item) => {
          acc.totalCabecasAtivas += item.indicators.totalAnimais;
          acc.pesoPonderado += item.indicators.pesoAtualMedio * item.indicators.totalAnimais;
          acc.receitaMes += item.indicators.receitaTotal;
          acc.custoMes += item.indicators.custoTotal;
          acc.gmdTotal += item.indicators.gmdMedio;
          return acc;
        },
        {
          totalCabecasAtivas: 0,
          pesoPonderado: 0,
          receitaMes: 0,
          custoMes: 0,
          gmdTotal: 0,
        }
      ),
    [lotesStats]
  );

  const totalCabecasAtivas = lotesAggregates.totalCabecasAtivas;

  const pesoMedioAtual = useMemo(
    () => (totalCabecasAtivas ? lotesAggregates.pesoPonderado / totalCabecasAtivas : 0),
    [lotesAggregates.pesoPonderado, totalCabecasAtivas]
  );

  const receitaMes = lotesAggregates.receitaMes;
  const custoMes = lotesAggregates.custoMes;

  const resultadoMes = useMemo(() => receitaMes - custoMes, [receitaMes, custoMes]);

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

  const alertasFormatados = useMemo(
    () =>
      (alerts || []).map((alert, index) => ({
        ...alert,
        id: alert.id || alert.ackKey || `alert-${index}`,
        titulo: alert.titulo || alert.title || 'Alerta do sistema',
        descricao: alert.descricao || alert.description || 'Sem descricao',
        prioridade: alert.prioridade || 'media',
        acao: alert.acao || { label: 'Abrir', rota: alert.route || 'dashboard' },
      })),
    [alerts]
  );
  const alertasCriticos = useMemo(
    () => alertasFormatados.filter((alerta) => String(alerta.prioridade || '').toLowerCase() === 'alta'),
    [alertasFormatados]
  );
  const tarefasDoDia = useMemo(() => {
    const hoje = getTodayIso();
    return (db.tarefas || []).filter((tarefa) => (
      String(tarefa?.status || '').toLowerCase() !== 'concluida'
      && String(tarefa?.status || '').toLowerCase() !== 'feita'
      && String(tarefa?.data_vencimento || '') === hoje
    ));
  }, [db.tarefas]);
  const pesagensPendentes = useMemo(() => {
    const hoje = new Date();
    const limiteDias = 30;
    return (lotesAtivos || []).filter((lote) => {
      if (!lote?.ultima_pesagem) return true;
      const diferencaDias = (hoje - new Date(lote.ultima_pesagem)) / (1000 * 60 * 60 * 24);
      return diferencaDias > limiteDias;
    });
  }, [lotesAtivos]);

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
      title: 'Resultado financeiro',
      value: formatCurrency(resultadoMes),
      variation: getVariation(resultadoMes, resultadoMes * 0.85),
      icon: DollarSign,
      variant: resultadoMes >= 0 ? KPI_VARIANTS.success : KPI_VARIANTS.danger,
    },
    {
      title: 'Pagamentos pendentes',
      value: formatNumber(pagamentosResumo.vencidos + pagamentosResumo.hoje + pagamentosResumo.proximos, 0),
      variation: { direction: 'neutral', value: pagamentosResumo.totalPendente > 0 ? `Total pendente: ${formatCurrency(pagamentosResumo.totalPendente)}` : 'Nenhum pagamento pendente' },
      icon: BellRing,
      variant: pagamentosResumo.totalPendente > 0 ? KPI_VARIANTS.warning : KPI_VARIANTS.success,
    },
  ];

  const funcionariosMap = useMemo(() => new Map((db.funcionarios || []).map((item) => [Number(item.id), item])), [db.funcionarios]);

  const boardTarefas = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return (db.tarefas || []).map((tarefa) => {
      const vencimento = tarefa?.data_vencimento ? new Date(`${tarefa.data_vencimento}T00:00:00`) : null;
      const concluida = tarefa.status === 'concluida' || tarefa.status === 'feita';
      const vencida = !concluida && vencimento && vencimento < hoje;
      return {
        ...tarefa,
        coluna: concluida ? 'feitas' : vencida ? 'vencidas' : 'pendentes',
        responsavelNome: funcionariosMap.get(Number(tarefa.funcionario_id))?.nome || tarefa.responsavel || 'Nao definido',
      };
    });
  }, [db.tarefas, funcionariosMap]);

  async function criarTarefaDashboard() {
    if (!hasPermission('tarefas:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    if (!novaTarefa.titulo.trim() || !novaTarefa.data_vencimento) return;
    const payload = {
      titulo: novaTarefa.titulo.trim(),
      descricao: novaTarefa.descricao.trim(),
      funcionario_id: novaTarefa.funcionario_id ? Number(novaTarefa.funcionario_id) : null,
      data_vencimento: novaTarefa.data_vencimento,
      status: 'pendente',
      prioridade: 'media',
    };
    const persisted = await createOperationalRecord('tarefas', payload, session);
    const registro = persisted.data || { id: gerarNovoId(db.tarefas || []), ...payload };
    setDb?.((prev) => ({ ...prev, tarefas: [...(prev.tarefas || []), registro] }));
    setNovaTarefa({ titulo: '', funcionario_id: '', data_vencimento: '', descricao: '' });
  }

  async function marcarComoFeita(tarefa) {
    if (!hasPermission('tarefas:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    await updateOperationalRecord('tarefas', tarefa.id, { status: 'concluida' }, session);
    setDb?.((prev) => ({
      ...prev,
      tarefas: (prev.tarefas || []).map((item) => (item.id === tarefa.id ? { ...item, status: 'concluida' } : item)),
    }));
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-toolbar page-header">
        <div className="dashboard-toolbar-copy">
          <h1>Dashboard</h1>
          <p>Cockpit executivo da operacao: riscos, desempenho e prioridades do dia.</p>
        </div>

        <div className="dashboard-toolbar-actions page-actions">
          <Button variant="outline" icon={<Plus size={14} />} onClick={() => onNavigate?.('lotes')}>
            Novo lote
          </Button>
          <Button variant="outline" onClick={() => onNavigate?.('pesagens', { action: 'novo' })}>
            Nova pesagem
          </Button>
          <Button variant="primary" onClick={() => onNavigate?.('suplementacao')}>
            Registrar consumo
          </Button>
        </div>
      </header>

      {tabAtiva === 'geral' && (
        <>
          <section className="section-card dashboard-hero-shell">
            <div className="section-header">
              <div>
                <h3 className="dashboard-section-title">Visao geral</h3>
                <p className="dashboard-section-subtitle">Resumo rapido para apoiar decisoes imediatas.</p>
              </div>
              <div className="action-row">
                <span className={`status-badge ${alertasCriticos.length > 0 ? 'status-badge--critico' : 'status-badge--sucesso'}`}>
                  {alertasCriticos.length > 0 ? `${alertasCriticos.length} criticos` : 'Sem criticos'}
                </span>
              </div>
            </div>

            <div className="dashboard-executive-strip dashboard-executive-strip--compact">
              <article className="dashboard-executive-chip">
                <span>Cabecas ativas</span>
                <strong>{formatNumber(totalCabecasAtivas, 0)}</strong>
                <small>Rebanho total em lotes ativos</small>
              </article>
              <article className="dashboard-executive-chip">
                <span>Estoque critico</span>
                <strong>{formatNumber(estoqueCritico.length, 0)}</strong>
                <small>Itens abaixo da minima</small>
              </article>
              <article className="dashboard-executive-chip">
                <span>Pendencias hoje</span>
                <strong>{formatNumber(tarefasDoDia.length + pagamentosResumo.hoje, 0)}</strong>
                <small>Tarefas e pagamentos com vencimento hoje</small>
              </article>
            </div>
          </section>

          <section className="dashboard-grid dashboard-grid--kpi-main">
            {kpisMain.map((item) => (
              <KpiPanel key={item.title} {...item} />
            ))}
          </section>

          <section className="dashboard-grid dashboard-grid--operations">
            <Card className="section-card" title="Alertas importantes" subtitle="Focos prioritarios para a equipe.">
              {alertasCriticos.length === 0 ? (
                <div className="empty-state">
                  <p>Nenhum alerta critico ativo.</p>
                </div>
              ) : (
                <div className="dashboard-list">
                  {alertasCriticos.slice(0, 4).map((alerta) => (
                    <article key={alerta.id} className="dashboard-list-item dashboard-list-item--button">
                      <div className="dashboard-list-copy">
                        <strong>{alerta.titulo}</strong>
                        <p>{alerta.descricao}</p>
                      </div>
                      <span className="status-badge status-badge--critico">Critico</span>
                    </article>
                  ))}
                </div>
              )}
            </Card>

            <Card className="section-card" title="Tarefas do dia" subtitle="Pendencias com vencimento em hoje.">
              {tarefasDoDia.length === 0 ? (
                <div className="empty-state">
                  <p>Sem tarefas pendentes para hoje.</p>
                </div>
              ) : (
                <div className="dashboard-list">
                  {tarefasDoDia.slice(0, 5).map((tarefa) => (
                    <article key={tarefa.id} className="dashboard-list-item">
                      <div className="dashboard-list-copy">
                        <strong>{tarefa.titulo}</strong>
                        <p>{tarefa.descricao || 'Sem descricao adicional.'}</p>
                      </div>
                      <span className="status-badge status-badge--pendente">Hoje</span>
                    </article>
                  ))}
                </div>
              )}
            </Card>

            <Card className="section-card" title="Pesagens pendentes" subtitle="Lotes sem pesagem recente.">
              {pesagensPendentes.length === 0 ? (
                <div className="empty-state">
                  <p>Todos os lotes estao com pesagem em dia.</p>
                </div>
              ) : (
                <div className="dashboard-list">
                  {pesagensPendentes.slice(0, 5).map((lote) => (
                    <article key={lote.id} className="dashboard-list-item">
                      <div className="dashboard-list-copy">
                        <strong>{lote.nome}</strong>
                        <p>{lote.ultima_pesagem ? `Ultima pesagem: ${formatDate(lote.ultima_pesagem)}` : 'Sem pesagem registrada'}</p>
                      </div>
                      <span className="status-badge status-badge--atencao">Atrasada</span>
                    </article>
                  ))}
                </div>
              )}
            </Card>
          </section>

          <section className="dashboard-task-board">
            <Card className="section-card" title="Quadro de tarefas" subtitle="Tarefas acionaveis do dia com status claro para a equipe.">
              <div className="dashboard-task-create">
                <input className="ui-input" placeholder="Titulo da tarefa" value={novaTarefa.titulo} onChange={(e) => setNovaTarefa((p) => ({ ...p, titulo: e.target.value }))} />
                <select className="ui-input" value={novaTarefa.funcionario_id} onChange={(e) => setNovaTarefa((p) => ({ ...p, funcionario_id: e.target.value }))}>
                  <option value="">Responsavel</option>
                  {(db.funcionarios || []).map((func) => <option key={func.id} value={func.id}>{func.nome}</option>)}
                </select>
                <input className="ui-input" type="date" value={novaTarefa.data_vencimento} onChange={(e) => setNovaTarefa((p) => ({ ...p, data_vencimento: e.target.value }))} />
                <input className="ui-input" placeholder="Descricao" value={novaTarefa.descricao} onChange={(e) => setNovaTarefa((p) => ({ ...p, descricao: e.target.value }))} />
                <Button onClick={criarTarefaDashboard} disabled={!hasPermission('tarefas:editar')}>Adicionar tarefa</Button>
              </div>

              <div className="dashboard-task-columns">
                {['pendentes', 'feitas', 'vencidas'].map((coluna) => (
                  <div key={coluna} className="dashboard-task-column">
                    <div className="dashboard-task-column-head">{coluna === 'pendentes' ? 'Pendentes' : coluna === 'feitas' ? 'Feitas' : 'Vencidas'}</div>
                    <div className="dashboard-task-list">
                      {boardTarefas.filter((item) => item.coluna === coluna).map((tarefa) => (
                        <article key={tarefa.id} className="dashboard-task-card">
                          <strong>{tarefa.titulo}</strong>
                          <span>{tarefa.responsavelNome}</span>
                          <small>{formatDate(tarefa.data_vencimento)}</small>
                          {tarefa.descricao ? <p>{tarefa.descricao}</p> : null}
                          {coluna !== 'feitas' ? <Button size="sm" variant="ghost" onClick={() => marcarComoFeita(tarefa)}>Marcar feita</Button> : null}
                        </article>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          <section className="dashboard-grid dashboard-grid--dual">
            <Card
              className="section-card"
              title="Resumo financeiro"
              subtitle="Situacao diaria de pagamentos pendentes e liquidados."
              action={
                <Button size="sm" variant="ghost" onClick={() => onNavigate?.('financeiro')}>
                  Abrir financeiro
                </Button>
              }
            >
              <div className="dashboard-list">
                <div className="dashboard-list-item"><div className="dashboard-list-copy"><strong>Pagamentos vencidos</strong><p>{formatNumber(pagamentosResumo.vencidos, 0)}</p></div></div>
                <div className="dashboard-list-item"><div className="dashboard-list-copy"><strong>Vencem hoje</strong><p>{formatNumber(pagamentosResumo.hoje, 0)}</p></div></div>
                <div className="dashboard-list-item"><div className="dashboard-list-copy"><strong>Proximos pagamentos</strong><p>{formatNumber(pagamentosResumo.proximos, 0)}</p></div></div>
                <div className="dashboard-list-item"><div className="dashboard-list-copy"><strong>Total pendente</strong><p>{pagamentosResumo.totalPendente > 0 ? formatCurrency(pagamentosResumo.totalPendente) : 'Nenhum pagamento pendente'}</p></div></div>
                <div className="dashboard-list-item"><div className="dashboard-list-copy"><strong>Total pago</strong><p>{formatCurrency(pagamentosResumo.totalPago)}</p></div></div>
              </div>
            </Card>

            <Card className="section-card" title="Resumo do rebanho" subtitle="Visao objetiva para decisao diaria da operacao.">
              <div className="dashboard-list">
                <div className="dashboard-list-item"><div className="dashboard-list-copy"><strong>Cabecas ativas</strong><p>{formatNumber(totalCabecasAtivas, 0)}</p></div></div>
                <div className="dashboard-list-item"><div className="dashboard-list-copy"><strong>Lotes ativos</strong><p>{formatNumber(lotesAtivos.length, 0)}</p></div></div>
                <div className="dashboard-list-item"><div className="dashboard-list-copy"><strong>Peso medio atual</strong><p>{formatNumber(pesoMedioAtual, 1)} kg</p></div></div>
                <div className="dashboard-list-item"><div className="dashboard-list-copy"><strong>Resultado do mes</strong><p className={resultadoMes >= 0 ? 'positive' : 'negative'}>{formatCurrency(resultadoMes)}</p></div></div>
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
                  <div className="dashboard-alert-actions">
                    <button className="alert-action-btn" onClick={() => onResolveAlert?.(alerta)} type="button">Resolver</button>
                    <button className="alert-action-btn" onClick={() => onSnoozeAlert?.(alerta, '1')} type="button">Adiar</button>
                    <button
                      className="alert-action-btn"
                      onClick={() => {
                        if (onAlertNavigate) {
                          onAlertNavigate(alerta);
                          return;
                        }
                        if (alerta?.acao?.rota) {
                          onNavigate?.(alerta.acao.rota);
                          return;
                        }
                        onNavigate?.('dashboard');
                      }}
                      type="button"
                    >
                      Abrir
                    </button>
                  </div>
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
  const variationValue = typeof variation === 'number'
    ? variation
    : Number(variation?.value || 0);
  const variationDirection = typeof variation === 'object' ? String(variation?.direction || '') : '';
  const variationLabel = typeof variation === 'object' && variation?.value
    ? String(variation.value)
    : `${formatNumber(Math.abs(variationValue), 1)}% vs. base recente`;
  const directionUp = variationDirection
    ? variationDirection !== 'down'
    : variationValue >= 0;

  return (
    <Card className={`kpi-panel kpi-panel--${variant} kpi-card ${compact ? 'kpi-panel--compact' : ''}`}>
      <div className="kpi-panel-header">
        <span className="kpi-panel-label">{title}</span>
        <span className="kpi-panel-icon">
          <IconComp size={compact ? 16 : 18} />
        </span>
      </div>

      <strong>{value}</strong>

      <div className={`kpi-variation ${directionUp ? 'up' : 'down'}`}>
        {directionUp ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
        {variationLabel}
      </div>
    </Card>
  );
}

function getVariation(current, previous) {
  if (!previous) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

