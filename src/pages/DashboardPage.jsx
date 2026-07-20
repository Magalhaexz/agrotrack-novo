import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Beef,
  Bell,
  BellRing,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  DollarSign,
  FileUp,
  Lock,
  MapPin,
  MapPinned,
  Package,
  Receipt,
  Repeat,
  Scale,
  Syringe,
  Tractor,
  TrendingUp,
  Truck,
  Users,
} from 'lucide-react';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import EmptyState from '../components/EmptyState';
import AssistenteHerdon from '../components/assistente/AssistenteHerdon';
import { getResumoLote } from '../domain/resumoLote';
import { construirHojeNaFazenda } from '../domain/hojeNaFazenda';
import { gerarAlertasUnificados, PRIORIDADE } from '../domain/alertasUnificados';
import { aplicarTratativasAosAlertas } from '../domain/tratativasAlertas';
import { construirChecklistPrimeirosPassos } from '../domain/guiaCriador';
import { getNavLabel } from '../navigation/navConfig';
import { formatCurrency, formatDate, formatNumber } from '../utils/calculations';
import { formatarMoeda } from '../utils/formatters';
import { gerarNovoId } from '../utils/id';
import { createOperationalRecord, updateOperationalRecord } from '../services/operationalPersistence';
import { useAuth } from '../auth/useAuth';
import { useToast } from '../hooks/useToast';
import '../styles/dashboard.css';

import { hojeLocalISO } from '../domain/dataCivil.js';
const getTodayIso = () => hojeLocalISO();

const NIVEL_PARA_PRIORIDADE = { critical: 'alta', warning: 'media', info: 'baixa' };

// Central de Alertas Internos (Sprint 4, dados unificados no Sprint 5): 3
// grupos visuais sobre a lista já padronizada por `gerarAlertasUnificados`.
const GRUPOS_PRIORIDADE = [
  { chave: 'critico', titulo: 'Crítico', variant: 'danger' },
  { chave: 'atencao', titulo: 'Atenção', variant: 'warning' },
  { chave: 'decisao', titulo: 'Decisão', variant: 'info' },
];

const ORIGEM_LABEL = {
  financeiro: 'Financeiro',
  estoque: 'Estoque',
  rebanho: 'Rebanho',
  sanidade: 'Sanidade',
  tarefas: 'Tarefas',
  decisao: 'Decisão',
};

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
  fazendaSelecionada = null,
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

  const totalFazendas = Array.isArray(db.fazendas) ? db.fazendas.length : 0;

  const pastagensFazendaAtiva = useMemo(() => {
    const pastagens = Array.isArray(db.pastagens) ? db.pastagens : [];
    if (!fazendaSelecionada?.id) return pastagens;
    return pastagens.filter((item) => Number(item?.faz_id) === Number(fazendaSelecionada.id));
  }, [db.pastagens, fazendaSelecionada]);

  const hojeNaFazenda = useMemo(
    () => construirHojeNaFazenda({ ...db, pastagens: pastagensFazendaAtiva }, { alerts }),
    [db, pastagensFazendaAtiva, alerts]
  );

  const checklist = useMemo(() => construirChecklistPrimeirosPassos(db), [db]);

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
        descricao: alert.mensagem || alert.descricao || alert.description || 'Sem descrição',
        prioridade: alert.prioridade || NIVEL_PARA_PRIORIDADE[alert.nivel] || 'media',
        acao: alert.acao || { label: 'Abrir', rota: alert.route || alert.pagina || 'dashboard' },
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
  const pesagensPendentes = hojeNaFazenda.detalhes.lotesSemPesagem;
  const totalAlertasCriticos = hojeNaFazenda.detalhes.alertasCriticosTotal.length;

  const pastagensMap = useMemo(() => new Map((db.pastagens || []).map((item) => [String(item.id), item.nome])), [db.pastagens]);
  const lotesSemPesagemIds = useMemo(() => new Set(pesagensPendentes.map((lote) => lote.id)), [pesagensPendentes]);

  // "Lotes em Destaque": maiores lotes ativos por cabeças, mesma fonte de dados
  // já calculada acima (lotesStats) — sem recálculo, só reordenação/slice.
  const lotesDestaque = useMemo(
    () =>
      [...lotesStats]
        .sort((a, b) => b.indicators.totalAnimais - a.indicators.totalAnimais)
        .slice(0, 5)
        .map(({ lote, indicators }) => ({
          id: lote.id,
          nome: lote.nome || `Lote ${lote.id}`,
          pastoNome: pastagensMap.get(String(lote.pastagem_id)) || 'Sem pasto',
          cabecas: indicators.totalAnimais,
          pesoMedio: indicators.pesoAtualMedio,
          gmd: indicators.gmdMedio,
          // GMD calculado exige dias decorridos + peso atual registrado —
          // sem isso, gmdMedio é só um 0 de "sem dados" (não um GMD real).
          temGmd: indicators.dias > 0 && indicators.pesoAtualMedio > 0,
          emDia: !lotesSemPesagemIds.has(lote.id),
        })),
    [lotesStats, pastagensMap, lotesSemPesagemIds]
  );

  const nomeFazendaContexto = fazendaSelecionada?.todas ? 'Todas as Fazendas' : (fazendaSelecionada?.nome || 'Fazenda');
  const isConsolidado = Boolean(fazendaSelecionada?.todas);
  // Visualizador é o único perfil sem lotes:editar (auth/perfis.js) — sinal
  // real de permissão, não um estado inventado só para a UI.
  const isSomenteLeitura = !hasPermission('lotes:editar');

  const kpisMain = [
    {
      title: 'Fazendas',
      value: formatNumber(totalFazendas, 0),
      variation: { direction: 'neutral', value: 'Cadastradas na conta' },
      icon: MapPin,
      variant: KPI_VARIANTS.neutral,
    },
    {
      title: 'Pastos',
      value: formatNumber(hojeNaFazenda.pastos.totalPastos, 0),
      variation: { direction: 'neutral', value: fazendaSelecionada ? 'Na fazenda ativa' : 'Em todas as fazendas' },
      icon: Tractor,
      variant: KPI_VARIANTS.neutral,
    },
    {
      title: 'Lotes ativos',
      value: formatNumber(lotesAtivos.length, 0),
      variation: { direction: 'neutral', value: 'Em produção agora' },
      icon: Beef,
      variant: KPI_VARIANTS.neutral,
    },
    {
      title: 'Cabeças ativas',
      value: formatNumber(totalCabecasAtivas, 0),
      variation: { direction: 'neutral', value: 'Rebanho em lotes ativos' },
      icon: Users,
      variant: KPI_VARIANTS.info,
    },
    {
      title: 'Peso médio',
      value: `${formatNumber(pesoMedioAtual, 1)} kg`,
      variation: { direction: 'neutral', value: 'Média do rebanho ativo' },
      icon: Scale,
      variant: KPI_VARIANTS.neutral,
    },
    {
      title: 'Alertas críticos',
      value: formatNumber(totalAlertasCriticos, 0),
      variation: { direction: 'neutral', value: totalAlertasCriticos > 0 ? 'Exigem atenção agora' : 'Nenhum alerta crítico' },
      icon: AlertTriangle,
      variant: totalAlertasCriticos > 0 ? KPI_VARIANTS.danger : KPI_VARIANTS.success,
    },
    {
      title: 'Resultado financeiro',
      value: formatCurrency(resultadoMes),
      variation: { direction: 'neutral', value: 'Lotes ativos no período' },
      icon: DollarSign,
      variant: resultadoMes >= 0 ? KPI_VARIANTS.success : KPI_VARIANTS.danger,
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
        responsavelNome: funcionariosMap.get(Number(tarefa.funcionario_id))?.nome || tarefa.responsavel || 'Não definido',
      };
    });
  }, [db.tarefas, funcionariosMap]);

  // Motor Único de Alertas Internos (Sprint 5) — fonte canônica, reaproveita
  // `alertasInteligentes.js` + `hojeNaFazenda.js` internamente e já devolve
  // {prioridade, origem, titulo, pageId} padronizados. Substitui a composição
  // ad-hoc que vivia aqui desde o Sprint 4.
  //
  // Sprint Paridade 1 (bloco 2 — unificação do motor de alertas): aplica a
  // mesma tratativa (`alertas_tratativas`) que a Central e o Telegram já
  // respeitam, para que "Prioridades de hoje" nunca mostre um alerta já
  // resolvido/ignorado/adiado em outro canal. Só leitura aqui — resolver/
  // ignorar/adiar continuam existindo apenas na Central (`AlertasPage.jsx`).
  const alertasUnificadosBrutos = useMemo(
    () => gerarAlertasUnificados({ ...db, pastagens: pastagensFazendaAtiva }),
    [db, pastagensFazendaAtiva]
  );
  const alertasTratativas = useMemo(
    () => (Array.isArray(db?.alertas_tratativas) ? db.alertas_tratativas : []),
    [db]
  );
  const alertasUnificados = useMemo(
    () => aplicarTratativasAosAlertas(alertasUnificadosBrutos, alertasTratativas, new Date()).filter((a) => a.visivel),
    [alertasUnificadosBrutos, alertasTratativas]
  );

  const gruposPrioridades = useMemo(() => {
    const grupos = { critico: [], atencao: [], decisao: [] };
    alertasUnificados.forEach((alerta) => {
      if (alerta.prioridade === PRIORIDADE.DECISAO) grupos.decisao.push(alerta);
      else if (alerta.prioridade === PRIORIDADE.CRITICO) grupos.critico.push(alerta);
      else if (alerta.prioridade === PRIORIDADE.ATENCAO) grupos.atencao.push(alerta);
      // itens 'informativo' não aparecem nesta central — mesma densidade visual do Sprint 4.
    });
    return grupos;
  }, [alertasUnificados]);

  const totalPrioridadesExibidas = gruposPrioridades.critico.length + gruposPrioridades.atencao.length + gruposPrioridades.decisao.length;

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
          <h1>Painel Geral</h1>
          <p>Hoje na fazenda: o que precisa de atenção, e o que fazer a seguir.</p>
        </div>
        <div className="dashboard-toolbar-actions">
          <AssistenteHerdon db={db} onNavigate={onNavigate} />
        </div>
      </header>

      {totalFazendas > 0 ? (
        <section className="dashboard-farm-context">
          <div className="dashboard-farm-context-item">
            <MapPin size={16} />
            <strong>{nomeFazendaContexto}</strong>
          </div>
          <span>{formatNumber(totalCabecasAtivas, 0)} cabeças · {formatNumber(hojeNaFazenda.pastos.totalPastos, 0)} pastos</span>
          {isSomenteLeitura ? (
            <span className="dashboard-farm-context-badge">
              <Lock size={12} /> Somente leitura
            </span>
          ) : isConsolidado ? (
            <span className="dashboard-farm-context-badge">
              <Lock size={12} /> Selecione uma fazenda para registrar ações
            </span>
          ) : null}
        </section>
      ) : null}

      {totalFazendas === 0 ? (
        <section className="dashboard-onboarding-banner">
          <div className="dashboard-onboarding-content">
            <strong>Comece cadastrando sua fazenda ou importando seus dados.</strong>
            <span>Com a fazenda cadastrada, o HERDON já mostra prioridades, alertas e resultado financeiro automaticamente.</span>
          </div>
          <div className="dashboard-onboarding-actions">
            <Button variant="primary" size="sm" onClick={() => onNavigate?.('fazendas')}>
              Cadastrar fazenda
            </Button>
            <Button variant="outline" size="sm" onClick={() => onNavigate?.('importacao')}>
              Importar dados
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onNavigate?.('guiaCriador')}>
              Ver guia do criador
            </Button>
          </div>
        </section>
      ) : lotesAtivos.length === 0 ? (
        <section className="dashboard-onboarding-banner">
          <div className="dashboard-onboarding-content">
            <strong>Você ainda não tem lotes ativos.</strong>
            <span>Cadastre seu primeiro lote para acompanhar GMD, custo e resultado financeiro da operação.</span>
          </div>
          <div className="dashboard-onboarding-actions">
            <Button variant="primary" size="sm" onClick={() => onNavigate?.('lotes')}>
              Criar primeiro lote
            </Button>
            <Button variant="outline" size="sm" onClick={() => onNavigate?.('importacao')}>
              Importar dados
            </Button>
          </div>
        </section>
      ) : null}

      {!checklist.concluido ? (
        <Card className="section-card" title="Primeiros passos no HERDON" subtitle={`${checklist.totalConcluido} de ${checklist.totalItens} concluídos`}>
          <p style={{ margin: '0 0 12px' }}>
            {checklist.proximoPasso ? `Próximo passo: ${checklist.proximoPasso.texto.toLowerCase()}.` : 'Continue explorando o HERDON.'}
          </p>
          <div className="action-row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Button size="sm" onClick={() => onNavigate?.('guiaCriador')}>Ver guia</Button>
            <Button size="sm" variant="outline" onClick={() => onNavigate?.('importacao')}>Importar dados</Button>
            {totalFazendas === 0 ? (
              <Button size="sm" variant="outline" onClick={() => onNavigate?.('fazendas')}>Cadastrar fazenda</Button>
            ) : null}
            {lotesAtivos.length === 0 ? (
              <Button size="sm" variant="outline" onClick={() => onNavigate?.('lotes')}>Cadastrar lote</Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      {tabAtiva === 'geral' && (
        <>
          <section className="section-card dashboard-quick-actions-top">
            <div className="section-header">
              <div>
                <h3 className="dashboard-section-title">Ações rápidas</h3>
                <p className="dashboard-section-subtitle">Registre direto do campo, sem procurar no menu.</p>
              </div>
            </div>
            <div className="dashboard-action-grid dashboard-action-grid--quick">
              <Button variant="primary" icon={<Scale size={14} />} onClick={() => onNavigate?.('pesagens', { action: 'novo' })}>Nova pesagem</Button>
              <Button variant="primary" icon={<Beef size={14} />} onClick={() => onNavigate?.('lotes', { action: 'novo' })}>Novo lote</Button>
              <Button variant="outline" icon={<MapPin size={14} />} onClick={() => onNavigate?.('pastagens', { action: 'novo' })}>Novo pasto</Button>
              <Button variant="outline" icon={<MapPinned size={14} />} onClick={() => onNavigate?.('lotes', { action: 'trocar-pasto' })}>Trocar lote de pasto</Button>
              <Button variant="outline" icon={<DollarSign size={14} />} onClick={() => onNavigate?.('lotes', { action: 'venda' })}>Registrar venda</Button>
              <Button variant="outline" icon={<AlertTriangle size={14} />} onClick={() => onNavigate?.('lotes', { action: 'morte' })}>Registrar morte/perda</Button>
              <Button variant="outline" icon={<Truck size={14} />} onClick={() => onNavigate?.('lotes', { action: 'transferir' })}>Transferir entre lotes</Button>
              <Button variant="outline" icon={<ClipboardList size={14} />} onClick={() => onNavigate?.('lotes', { action: 'ajustar-lotacao' })}>Ajustar lotação</Button>
              <Button variant="outline" icon={<Receipt size={14} />} onClick={() => onNavigate?.('financeiro', { action: 'novo' })}>Novo lançamento financeiro</Button>
              <Button variant="outline" icon={<Package size={14} />} onClick={() => onNavigate?.('estoque', { action: 'novo' })}>Novo produto/estoque</Button>
              <Button variant="outline" icon={<ArrowDown size={14} />} onClick={() => onNavigate?.('estoque')}>Saída de estoque</Button>
              <Button variant="outline" icon={<Syringe size={14} />} onClick={() => onNavigate?.('sanitario', { action: 'novo' })}>Novo manejo/sanidade</Button>
              <Button variant="outline" icon={<CheckSquare size={14} />} onClick={() => onNavigate?.('tarefas', { action: 'novo' })}>Nova tarefa</Button>
              <Button variant="outline" icon={<TrendingUp size={14} />} onClick={() => onNavigate?.('resultados')}>Resultado por lote</Button>
              <Button variant="outline" icon={<Bell size={14} />} onClick={() => onNavigate?.('alertas')}>Central de Alertas</Button>
            </div>
          </section>

          <section className="section-card dashboard-hero-shell">
            <div className="section-header">
              <div>
                <h3 className="dashboard-section-title">Prioridades de hoje</h3>
                <p className="dashboard-section-subtitle">O que precisa da sua atenção agora, por prioridade.</p>
              </div>
              <div className="action-row">
                <Badge variant={hojeNaFazenda.detalhes.alertasCriticosTotal.length > 0 ? 'danger' : 'success'}>
                  {hojeNaFazenda.detalhes.alertasCriticosTotal.length > 0 ? `${hojeNaFazenda.detalhes.alertasCriticosTotal.length} críticos` : 'Sem críticos'}
                </Badge>
                <button className="btn-secondary btn-sm" onClick={() => onNavigate?.('alertas')} type="button">
                  Ver Central de Alertas
                </button>
              </div>
            </div>

            {totalPrioridadesExibidas === 0 ? (
              <div className="empty-state">
                <p>Tudo certo por aqui — nenhuma prioridade pendente hoje.</p>
              </div>
            ) : (
              <div className="dashboard-priority-groups">
                {GRUPOS_PRIORIDADE.map(({ chave, titulo, variant }) => (
                  gruposPrioridades[chave].length > 0 ? (
                    <div key={chave} className="dashboard-priority-group">
                      <h4 className="dashboard-priority-group-title">{titulo} ({gruposPrioridades[chave].length})</h4>
                      <div className="dashboard-list">
                        {gruposPrioridades[chave].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="dashboard-list-item dashboard-list-item--button"
                            onClick={() => onNavigate?.(item.pageId)}
                          >
                            <div className="dashboard-list-copy">
                              <strong>{item.titulo}</strong>
                              <p>{ORIGEM_LABEL[item.origem] || 'Geral'} · Ver em {getNavLabel(item.pageId)}</p>
                            </div>
                            <Badge variant={variant}>{titulo}</Badge>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null
                ))}
              </div>
            )}
          </section>

          {lotesDestaque.length > 0 ? (
            <Card
              className="section-card"
              title="Lotes em destaque"
              subtitle="Desempenho dos maiores lotes ativos."
              action={
                <Button size="sm" variant="ghost" onClick={() => onNavigate?.('lotes')}>
                  Ver todos os lotes →
                </Button>
              }
            >
              <div className="table-responsive">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Lote</th>
                      <th>Pasto</th>
                      <th>Cabeças</th>
                      <th>Peso médio</th>
                      <th>GMD</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotesDestaque.map((item) => (
                      <tr
                        key={item.id}
                        tabIndex={0}
                        role="button"
                        aria-label={`Abrir lote ${item.nome}`}
                        onClick={() => onNavigate?.('lotes', { loteId: item.id })}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onNavigate?.('lotes', { loteId: item.id });
                          }
                        }}
                      >
                        <td>{item.nome}</td>
                        <td>{item.pastoNome}</td>
                        <td>{formatNumber(item.cabecas, 0)}</td>
                        <td>{item.pesoMedio > 0 ? `${formatNumber(item.pesoMedio, 1)} kg` : '—'}</td>
                        <td>{item.temGmd ? `${formatNumber(item.gmd, 2)} kg/dia` : '—'}</td>
                        <td><Badge variant={item.emDia ? 'success' : 'warning'}>{item.emDia ? 'Em dia' : 'Atenção'}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          <section className="dashboard-grid dashboard-grid--kpi-main">
            {kpisMain.map((item) => (
              <KpiPanel key={item.title} {...item} />
            ))}
          </section>

          <section className="dashboard-grid dashboard-grid--operations">
            <Card className="section-card" title="Alertas importantes" subtitle="Focos prioritários para a equipe.">
              {alertasCriticos.length === 0 ? (
                <div className="empty-state">
                  <p>Nenhum alerta crítico ativo.</p>
                </div>
              ) : (
                <div className="dashboard-list">
                  {alertasCriticos.slice(0, 4).map((alerta) => (
                    <article key={alerta.id} className="dashboard-list-item dashboard-list-item--button">
                      <div className="dashboard-list-copy">
                        <strong>{alerta.titulo}</strong>
                        <p>{alerta.descricao}</p>
                      </div>
                      <Badge variant="danger">Crítico</Badge>
                    </article>
                  ))}
                </div>
              )}
            </Card>

            <Card className="section-card" title="Tarefas do dia" subtitle="Pendências com vencimento para hoje.">
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
                        <p>{tarefa.descricao || 'Sem descrição adicional.'}</p>
                      </div>
                      <Badge variant="warning">Hoje</Badge>
                    </article>
                  ))}
                </div>
              )}
            </Card>

            <Card className="section-card" title="Pesagens pendentes" subtitle="Lotes sem pesagem recente.">
              {pesagensPendentes.length === 0 ? (
                <EmptyState compact title="Todos os lotes estão com pesagem em dia." />
              ) : (
                <div className="dashboard-list">
                  {pesagensPendentes.slice(0, 5).map((lote) => (
                    <article key={lote.id} className="dashboard-list-item">
                      <div className="dashboard-list-copy">
                        <strong>{lote.nome}</strong>
                        <p>{lote.ultima_pesagem ? `Última pesagem: ${formatDate(lote.ultima_pesagem)}` : 'Sem pesagem registrada'}</p>
                      </div>
                      <Badge variant="warning">Atrasada</Badge>
                    </article>
                  ))}
                </div>
              )}
            </Card>
          </section>

          <Card className="section-card" title="Pastos em uso" subtitle="Ocupação simples dos pastos cadastrados, sem cálculo de UA por animal.">
            <div className="dashboard-list">
              <div className="dashboard-list-item">
                <div className="dashboard-list-copy"><strong>Pastos cadastrados</strong><p>{formatNumber(hojeNaFazenda.pastos.totalPastos, 0)}</p></div>
              </div>
              <div className="dashboard-list-item">
                <div className="dashboard-list-copy"><strong>Pastos com lote ativo</strong><p>{formatNumber(hojeNaFazenda.pastos.pastosComLote, 0)}</p></div>
              </div>
              <div className="dashboard-list-item">
                <div className="dashboard-list-copy"><strong>Pastos sem lote</strong><p>{formatNumber(hojeNaFazenda.pastos.pastosSemLote, 0)}</p></div>
              </div>
              <div className="dashboard-list-item">
                <div className="dashboard-list-copy"><strong>Lotes sem pasto definido</strong><p>{formatNumber(hojeNaFazenda.pastos.lotesSemPasto, 0)}</p></div>
              </div>
            </div>
            {hojeNaFazenda.pastos.pastosAcimaCapacidade.length > 0 ? (
              <div className="empty-state" style={{ marginTop: 12 }}>
                <p>
                  Lotação acima da capacidade informada n{hojeNaFazenda.pastos.pastosAcimaCapacidade.length === 1 ? 'o pasto' : 'os pastos'}:{' '}
                  {hojeNaFazenda.pastos.pastosAcimaCapacidade.map((pasto) => pasto.nome).join(', ')}.
                </p>
              </div>
            ) : null}
            {hojeNaFazenda.pastos.pastosEmAtencao.length > 0 ? (
              <div className="empty-state" style={{ marginTop: 12 }}>
                <p>
                  Em atenção n{hojeNaFazenda.pastos.pastosEmAtencao.length === 1 ? 'o pasto' : 'os pastos'}:{' '}
                  {hojeNaFazenda.pastos.pastosEmAtencao.map((pasto) => pasto.nome).join(', ')}.
                </p>
              </div>
            ) : null}
          </Card>

          <section className="dashboard-task-board">
            <Card className="section-card" title="Quadro de tarefas" subtitle="Tarefas acionaveis do dia com status claro para a equipe.">
              <div className="dashboard-task-create">
                <input className="ui-input" placeholder="Titulo da tarefa" value={novaTarefa.titulo} onChange={(e) => setNovaTarefa((p) => ({ ...p, titulo: e.target.value }))} />
                <select className="ui-input" value={novaTarefa.funcionario_id} onChange={(e) => setNovaTarefa((p) => ({ ...p, funcionario_id: e.target.value }))}>
                  <option value="">Responsável</option>
                  {(db.funcionarios || []).map((func) => <option key={func.id} value={func.id}>{func.nome}</option>)}
                </select>
                <input className="ui-input" type="date" value={novaTarefa.data_vencimento} onChange={(e) => setNovaTarefa((p) => ({ ...p, data_vencimento: e.target.value }))} />
                <input className="ui-input" placeholder="Descrição" value={novaTarefa.descricao} onChange={(e) => setNovaTarefa((p) => ({ ...p, descricao: e.target.value }))} />
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
              subtitle="Situação diária de pagamentos pendentes e liquidados."
              action={
                <Button size="sm" variant="ghost" onClick={() => onNavigate?.('financeiro')}>
                  Abrir financeiro
                </Button>
              }
            >
              <div className="dashboard-list">
                <div className="dashboard-list-item"><div className="dashboard-list-copy"><strong>Pagamentos vencidos</strong><p>{formatNumber(pagamentosResumo.vencidos, 0)}</p></div></div>
                <div className="dashboard-list-item"><div className="dashboard-list-copy"><strong>Vencem hoje</strong><p>{formatNumber(pagamentosResumo.hoje, 0)}</p></div></div>
                <div className="dashboard-list-item"><div className="dashboard-list-copy"><strong>Próximos pagamentos</strong><p>{formatNumber(pagamentosResumo.proximos, 0)}</p></div></div>
                <div className="dashboard-list-item"><div className="dashboard-list-copy"><strong>Total pendente</strong><p>{pagamentosResumo.totalPendente > 0 ? formatCurrency(pagamentosResumo.totalPendente) : 'Nenhum pagamento pendente'}</p></div></div>
                <div className="dashboard-list-item"><div className="dashboard-list-copy"><strong>Total pago</strong><p>{formatCurrency(pagamentosResumo.totalPago)}</p></div></div>
              </div>
            </Card>

            <Card className="section-card" title="Resumo do rebanho" subtitle="Visão objetiva para decisão diária da operação.">
              <div className="dashboard-list">
                <div className="dashboard-list-item"><div className="dashboard-list-copy"><strong>Cabeças ativas</strong><p>{formatNumber(totalCabecasAtivas, 0)}</p></div></div>
                <div className="dashboard-list-item"><div className="dashboard-list-copy"><strong>Lotes ativos</strong><p>{formatNumber(lotesAtivos.length, 0)}</p></div></div>
                <div className="dashboard-list-item"><div className="dashboard-list-copy"><strong>Peso médio atual</strong><p>{formatNumber(pesoMedioAtual, 1)} kg</p></div></div>
                <div className="dashboard-list-item"><div className="dashboard-list-copy"><strong>Resultado do mês</strong><p className={resultadoMes >= 0 ? 'positive' : 'negative'}>{formatCurrency(resultadoMes)}</p></div></div>
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
                <p className="kpi-label">Estoque crítico</p>
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
                          {critico ? 'Crítico' : 'Normal'}
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
                <p>Nenhum item de estoque cadastrado.</p>
                <span>Cadastre insumos para controlar consumo, validade e reposição.</span>
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
                <p className="kpi-sub">requer ação imediata</p>
              </div>
            </div>

            <div className="kpi-card kpi-card--warning">
              <div className="kpi-icon-wrapper kpi-icon-wrapper--warning">
                <Bell size={22} className="text-warning" />
              </div>
              <div>
                <p className="kpi-label">Média prioridade</p>
                <p className="kpi-value text-warning">
                  {alertasFormatados.filter((alert) => alert.prioridade === 'media').length}
                </p>
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
              <h3>Todos os alertas</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {/* Sprint Paridade 1 (bloco 2): este painel já usa a mesma fonte
                    canônica da Central (alertasUnificados.js + tratativasAlertas.js,
                    via App.jsx::adaptarAlertaParaPainelLegado) — resolver/adiar aqui
                    grava na mesma tabela alertas_tratativas. A Central continua
                    tendo também "em análise"/"ignorar" e histórico consultável,
                    que não foram duplicados aqui — atalho abaixo em vez disso. */}
                <button className="btn-secondary btn-sm" onClick={() => onNavigate?.('alertas')} type="button">
                  Ver Central de Alertas
                </button>
                <button className="btn-primary btn-sm" onClick={() => setTabAtiva?.('geral')} type="button">
                  Voltar ao geral
                </button>
              </div>
            </div>

            {alertasFormatados.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <CheckCircle2 size={28} />
                </div>
                <p className="empty-state-title">Nenhum alerta pendente</p>
                <p className="empty-state-desc">Sua operação está em dia.</p>
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
  const variationDirection = typeof variation === 'object' ? String(variation?.direction || '') : '';
  const isNeutral = variationDirection === 'neutral' || !variationDirection;
  const variationLabel = typeof variation === 'object' && variation?.value ? String(variation.value) : '';
  const directionUp = variationDirection === 'up';

  return (
    <Card className={`kpi-panel kpi-panel--${variant} kpi-card ${compact ? 'kpi-panel--compact' : ''}`}>
      <div className="kpi-panel-header">
        <span className="kpi-panel-label">{title}</span>
        <span className="kpi-panel-icon">
          <IconComp size={compact ? 16 : 18} />
        </span>
      </div>

      <strong>{value}</strong>

      {variationLabel ? (
        <div className={`kpi-variation ${isNeutral ? 'neutral' : directionUp ? 'up' : 'down'}`}>
          {!isNeutral ? (directionUp ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : null}
          {variationLabel}
        </div>
      ) : null}
    </Card>
  );
}

