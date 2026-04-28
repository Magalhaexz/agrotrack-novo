import { useEffect, useMemo, useState, useCallback } from 'react';
import { AlertTriangle, ChevronRight, MoreHorizontal, Plus, Scale, Truck } from 'lucide-react';
import { CartesianGrid, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { calcLote, formatCurrency, formatDate, formatNumber } from '../utils/calculations';
import { gerarNovoId } from '../utils/id';
import { getResumoLote } from '../domain/resumoLote';
import {
  calcularDesvioPorcentual,
  calcularGMDMeta,
} from '../domain/indicadores';
import { useToast } from '../hooks/useToast'; // Importar useToast
import { useAuth } from '../auth/useAuth';
import '../styles/rebanho.css';

const tabs = ['visao', 'mov', 'pesagens', 'financeiro', 'sanitario', 'historico'];
const movTypes = ['compra', 'nascimento', 'transferencia_entrada', 'venda', 'morte', 'descarte', 'transferencia_saida', 'abate'];
const getTodayIso = () => new Date().toISOString().slice(0, 10);

export default function LotesPage({
  db,
  setDb,
  onRegistrarEntradaAnimal,
  onRegistrarSaidaAnimal,
}) {
  const { hasPermission } = useAuth();
  const { showToast } = useToast(); // Usar o hook de toast
  const mensagemSemPermissao = 'Você não tem permissão para executar esta ação.';

  const [filters, setFilters] = useState({ status: 'todos', fazenda: 'todas', periodo: 'todos' });
  const [activeLoteId, setActiveLoteId] = useState(null);
  const [activeTab, setActiveTab] = useState('visao');
  const [openLoteModal, setOpenLoteModal] = useState(false);
  const [openMovModal, setOpenMovModal] = useState(null);
  const [openPesagemModal, setOpenPesagemModal] = useState(null);
  const [openFechamentoModal, setOpenFechamentoModal] = useState(null);

  // Pré-indexar pesagens e lotes para otimização
  const pesagensByLoteId = useMemo(() => {
    const map = new Map();
    (db.pesagens || []).forEach(p => {
      if (!map.has(p.lote_id)) map.set(p.lote_id, []);
      map.get(p.lote_id).push(p);
    });
    return map;
  }, [db.pesagens]);

  // Pré-calcular calcLote para todos os lotes
  const allLoteIndicators = useMemo(() => {
    const indicatorsMap = new Map();
    (db.lotes || []).forEach(lote => {
      indicatorsMap.set(lote.id, calcLote(db, lote.id));
    });
    return indicatorsMap;
  }, [db]);

  const allLoteResumo = useMemo(() => {
    const resumoMap = new Map();
    (db.lotes || []).forEach((lote) => {
      resumoMap.set(lote.id, getResumoLote(db, lote.id));
    });
    return resumoMap;
  }, [db]);

  const lotesEnriquecidos = useMemo(() => (db.lotes || []).map((lote) => {
    const indicators = allLoteIndicators.get(lote.id) || {};
    const resumo = allLoteResumo.get(lote.id) || {};
    const lotePesagens = pesagensByLoteId.get(lote.id) || [];
    const latestPesagem = [...lotePesagens].sort((a, b) => new Date(b.data) - new Date(a.data))[0];
    const gmd30 = calcGmd30(lotePesagens, lote.id);
    const pesoAlvo = lote.peso_alvo || indicators.pesoInicialMedio;
    const progressoPeso = indicators.pesoInicialMedio ? ((indicators.pesoAtualMedio - indicators.pesoInicialMedio) / Math.max(pesoAlvo - indicators.pesoInicialMedio, 1)) * 100 : 0;
    const pesoAtual = Number(lote.p_at || latestPesagem?.peso_medio || indicators.pesoAtualMedio || 0);
    const ultimaPesagem = lote.ultima_pesagem || latestPesagem?.data || null;
    const diasSemPesar = ultimaPesagem
      ? Math.floor((new Date() - new Date(ultimaPesagem)) / 86400000)
      : 999;
    return { ...lote, indicators, resumo, heads: indicators.totalAnimais, pesoAtual, ultimaPesagem, diasSemPesar, arrobaViva: pesoAtual / 15, gmd30, progressoPeso };
  }), [db.lotes, allLoteIndicators, allLoteResumo, pesagensByLoteId]);

  const lotesFiltrados = useMemo(() => lotesEnriquecidos.filter((lote) => {
    if (filters.status !== 'todos' && lote.status !== filters.status) return false;
    if (filters.fazenda !== 'todas' && Number(lote.faz_id) !== Number(filters.fazenda)) return false;
    if (filters.periodo === '30d') return daysFrom(lote.entrada) <= 30;
    if (filters.periodo === '90d') return daysFrom(lote.entrada) <= 90;
    return true;
  }), [filters, lotesEnriquecidos]);

  const activeLote = useMemo(() => lotesEnriquecidos.find((item) => item.id === activeLoteId), [lotesEnriquecidos, activeLoteId]);

  const abrirMovimentacao = useCallback((lote) => {
    if (!hasPermission('animais:movimentar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    if (!lote) return;
    if (lote.status === 'encerrado' || lote.status === 'vendido') {
      showToast({ type: 'error', message: 'Este lote está encerrado e não aceita novas movimentações.' });
      return;
    }
    setOpenMovModal(lote);
  }, [hasPermission, showToast]);

  if (activeLote) {
    return (
      <LoteDetailView
        lote={activeLote}
        db={db}
        setDb={setDb}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onBack={() => setActiveLoteId(null)}
        onOpenMov={() => abrirMovimentacao(activeLote)}
        onOpenPesagem={() => {
          if (!hasPermission('pesagens:editar')) {
            showToast({ type: 'error', message: mensagemSemPermissao });
            return;
          }
          setOpenPesagemModal(activeLote);
        }}
        onOpenFechamento={() => {
          if (!hasPermission('lotes:editar')) {
            showToast({ type: 'error', message: mensagemSemPermissao });
            return;
          }
          setOpenFechamentoModal(activeLote);
        }}
        pesagensByLoteId={pesagensByLoteId}
      />
    );
  }

  return (
    <div className="page rebanho-page">
      <div className="rebanho-header">
        <div><h1>Rebanho</h1><p>Gestão completa de lotes, movimentações e indicadores zootécnicos.</p></div>
        <Button icon={<Plus size={16} />} onClick={() => {
          if (!hasPermission('lotes:editar')) {
            showToast({ type: 'error', message: mensagemSemPermissao });
            return;
          }
          setOpenLoteModal(true);
        }}
        >
          Novo Lote
        </Button>
      </div>
      <Card>
        <div className="rebanho-filters">
          <select className="ui-input" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
            <option value="todos">Todos</option>
            <option value="ativo">Ativo</option>
            <option value="encerrado">Encerrado</option>
            <option value="vendido">Vendido</option>
          </select>
          <select className="ui-input" value={filters.fazenda} onChange={(e) => setFilters((p) => ({ ...p, fazenda: e.target.value }))}>
            <option value="todas">Todas Fazendas</option>
            {(db.fazendas || []).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <select className="ui-input" value={filters.periodo} onChange={(e) => setFilters((p) => ({ ...p, periodo: e.target.value }))}>
            <option value="todos">Período</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="90d">Últimos 90 dias</option>
          </select>
        </div>
      </Card>

      <div className="lote-cards-grid">
        {lotesFiltrados.map((lote) => (
          <Card key={lote.id} className="lote-card-modern">
            <div className="lote-card-title">
              <h3>{lote.nome}</h3>
              <Badge variant={lote.status === 'ativo' ? 'success' : lote.status === 'vendido' ? 'info' : 'neutral'}>{lote.status}</Badge>
            </div>
            <div className="lote-metrics">
              <p><strong>{lote.heads}</strong> cabeças</p>
              <p className="lote-metric-peso">{formatNumber(lote.pesoAtual, 1)} kg · {formatNumber(lote.arrobaViva, 2)} @ {lote.diasSemPesar > 30 ? <AlertTriangle size={14} color="#dd6b20" /> : null}</p>
              <p className="lote-metric-ultima-pesagem">{lote.ultimaPesagem ? `Última pesagem: ${formatDate(lote.ultimaPesagem)}` : 'Sem pesagens registradas'}</p>
              <p>GMD 30d: {formatNumber(lote.gmd30, 3)} kg/dia</p>
              <p>Dias em trato: {daysFrom(lote.entrada)}</p>
              <p>Custo/cab/dia: {formatCurrency((lote.resumo.custoTotal || 0) / Math.max(lote.resumo.totalAnimais || 0,1) / Math.max(daysFrom(lote.entrada),1))}</p>
            </div>
            <div className="progress-line">
              <span style={{ width: `${Math.max(5, Math.min(lote.progressoPeso, 100))}%` }} />
            </div>
            <p className={lote.resumo.lucroTotal >= 0 ? 'text-success' : 'text-danger'}>Resultado parcial: {formatCurrency(lote.resumo.lucroTotal || 0)}</p>
            <div className="lote-actions">
              <Button size="sm" variant="outline" icon={<ChevronRight size={14} />} onClick={() => { setActiveTab('visao'); setActiveLoteId(lote.id); }}>Ver Detalhes</Button>
              <Button size="sm" variant="ghost" icon={<Truck size={14} />} onClick={() => abrirMovimentacao(lote)}>Registrar Movimentação</Button>
              <Button size="sm" variant="ghost" icon={<Scale size={14} />} onClick={() => {
                if (!hasPermission('pesagens:editar')) {
                  showToast({ type: 'error', message: mensagemSemPermissao });
                  return;
                }
                setOpenPesagemModal(lote);
              }}
              >
                Pesagem
              </Button>
              <Button size="sm" variant="ghost" icon={<MoreHorizontal size={14} />} onClick={() => { setActiveTab('historico'); setActiveLoteId(lote.id); }}>Historico</Button>
            </div>
          </Card>
        ))}
      </div>

      {openLoteModal && <NovoLoteModal db={db} setDb={setDb} onClose={() => setOpenLoteModal(false)} showToast={showToast} hasPermission={hasPermission} />}
      {openMovModal && (
        <MovimentacaoModal
          lote={openMovModal}
          db={db}
          setDb={setDb}
          onClose={() => setOpenMovModal(null)}
          onRegistrarEntradaAnimal={onRegistrarEntradaAnimal}
          onRegistrarSaidaAnimal={onRegistrarSaidaAnimal}
          showToast={showToast}
          hasPermission={hasPermission}
        />
      )}
      {openPesagemModal && <PesagemModal lote={openPesagemModal} db={db} setDb={setDb} onClose={() => setOpenPesagemModal(null)} showToast={showToast} hasPermission={hasPermission} />}
      {openFechamentoModal && <FechamentoLoteModal lote={openFechamentoModal} setDb={setDb} onClose={() => setOpenFechamentoModal(null)} showToast={showToast} hasPermission={hasPermission} />}
    </div>
  );
}

/**
 * Componente para exibir a visão detalhada de um lote.
 * @param {object} props - As propriedades do componente.
 * @param {object} props.lote - O objeto do lote ativo.
 * @param {function} props.setDb - Função para atualizar o banco de dados.
 * @param {string} props.activeTab - A aba ativa.
 * @param {function} props.setActiveTab - Função para definir a aba ativa.
 * @param {function} props.onBack - Callback para voltar à lista de lotes.
 * @param {function} props.onOpenMov - Callback para abrir o modal de movimentação.
 * @param {function} props.onOpenPesagem - Callback para abrir o modal de pesagem.
 * @param {function} props.onOpenFechamento - Callback para abrir o modal de fechamento de lote.
 * @param {Map<number, Array<object>>} props.pesagensByLoteId - Mapa de pesagens por ID de lote.
 * @param {Map<number, object>} props.allLoteIndicators - Mapa de indicadores pré-calculados para todos os lotes.
 */
function LoteDetailView({ lote, db, activeTab, setActiveTab, onBack, onOpenMov, onOpenPesagem, onOpenFechamento, pesagensByLoteId }) {
  const resumoLote = useMemo(() => getResumoLote(db, lote.id), [db, lote.id]);
  const lotePesagens = useMemo(() => (pesagensByLoteId.get(lote.id) || []).slice().sort((a, b) => new Date(a.data) - new Date(b.data)), [lote.id, pesagensByLoteId]);
  const movimentacoes = useMemo(() => (db.movimentacoes_animais || []).filter((m) => Number(m.loteId || m.lote_id) === lote.id).sort((a, b) => new Date(b.data) - new Date(a.data)), [lote.id, db.movimentacoes_animais]);
  const custos = useMemo(() => (db.custos || []).filter((c) => c.lote_id === lote.id).sort((a, b) => new Date(b.data) - new Date(a.data)), [lote.id, db.custos]);
  const san = useMemo(() => (db.sanitario || []).filter((s) => s.lote_id === lote.id).sort((a, b) => new Date(b.data) - new Date(a.data)), [lote.id, db.sanitario]);
  const financeiro = useMemo(() => (db.movimentacoes_financeiras || []).filter((f) => Number(f.lote_id) === lote.id).sort((a, b) => new Date(b.data) - new Date(a.data)), [lote.id, db.movimentacoes_financeiras]);

  // Use a versão memoizada de onOpenFechamento para evitar re-render desnecessário do useEffect
  const memoizedOnOpenFechamento = useCallback(() => {
    if (lote.indicators.totalAnimais <= 0 && lote.status === 'ativo') {
      onOpenFechamento();
    }
  }, [lote.indicators.totalAnimais, lote.status, onOpenFechamento]);

  useEffect(() => {
    memoizedOnOpenFechamento();
  }, [memoizedOnOpenFechamento]);

  const metaGmd = useMemo(() => calcularGMDMeta(lote.indicators.pesoInicialMedio, lote.peso_alvo || lote.indicators.pesoAtualMedio, Math.max(daysFrom(lote.entrada), 1)), [lote.indicators.pesoInicialMedio, lote.peso_alvo, lote.indicators.pesoAtualMedio, lote.entrada]);

  const indicadoresPainel = useMemo(() => [
    { nome: 'GMD', realizado: lote.indicators.gmdMedio, meta: lote.gmd_meta || metaGmd, unit: 'kg/dia' },
    { nome: '@ produzida', realizado: lote.indicators.arrobasProduzidas, meta: (lote.peso_alvo ? ((lote.peso_alvo - lote.indicators.pesoInicialMedio) * Math.max(lote.indicators.totalAnimais,1))/15 : lote.indicators.arrobasProduzidas), unit: '@' },
    { nome: 'Margem', realizado: resumoLote.margemPct, meta: 15, unit: '%' },
  ], [lote.indicators.gmdMedio, lote.gmd_meta, metaGmd, lote.indicators.arrobasProduzidas, lote.peso_alvo, lote.indicators.pesoInicialMedio, lote.indicators.totalAnimais, resumoLote.margemPct]);

  const chartData = useMemo(() => lotePesagens.map((p) => ({
    data: formatDate(p.data),
    peso: Number(p.peso_medio),
    gmd: calcularGmdEntrePesagens(lotePesagens, p.id),
  })), [lotePesagens]);

  const custosPorCategoria = useMemo(() => {
    const grouped = groupCustos(custos);
    return Object.entries(grouped).map(([cat, valor]) => ({ name: cat, value: valor }));
  }, [custos]);

  const timelineFinanceira = useMemo(() => buildFinanceTimeline(db, lote.id), [db, lote.id]);

  const historicoLote = useMemo(() => {
    const eventos = [
      lote.entrada
        ? {
            id: `lote-entrada-${lote.id}`,
            data: lote.entrada,
            titulo: 'Inicio do lote',
            descricao: `${lote.nome} entrou na operacao.`,
            meta: `${daysFrom(lote.entrada)} dias em trato`,
          }
        : null,
      lote.data_encerramento
        ? {
            id: `lote-encerramento-${lote.id}`,
            data: lote.data_encerramento,
            titulo: 'Encerramento do lote',
            descricao: lote.motivo_saida || 'Lote encerrado na operacao.',
            meta: lote.status || 'encerrado',
          }
        : null,
      ...lotePesagens.map((pesagem) => ({
        id: `pesagem-${pesagem.id}`,
        data: pesagem.data,
        titulo: 'Pesagem registrada',
        descricao: `${formatNumber(pesagem.peso_medio, 1)} kg de peso medio`,
        meta: `${pesagem.quantidade || lote.indicators.totalAnimais || 0} cabecas`,
      })),
      ...movimentacoes.map((movimento) => ({
        id: `mov-${movimento.id}`,
        data: movimento.data,
        titulo: 'Movimentacao animal',
        descricao: `${movimento.tipo || 'movimentacao'}${movimento.quantidade ? ` · ${movimento.quantidade} cabecas` : ''}`,
        meta: movimento.observacao || movimento.loteDestinoNome || movimento.lote_destino_nome || 'registro operacional',
      })),
      ...san.map((evento) => ({
        id: `san-${evento.id}`,
        data: evento.data || evento.proxima,
        titulo: 'Manejo sanitario',
        descricao: `${evento.tipo || 'manejo'}${evento.produto ? ` · ${evento.produto}` : ''}`,
        meta: evento.observacao || evento.dose || 'protocolo sanitario',
      })),
      ...custos.map((custo) => ({
        id: `custo-${custo.id}`,
        data: custo.data,
        titulo: 'Lancamento de custo',
        descricao: `${custo.categoria || 'custo'} · ${formatCurrency(custo.valor || 0)}`,
        meta: custo.descricao || custo.observacao || 'financeiro do lote',
      })),
      ...financeiro.map((item) => ({
        id: `financeiro-${item.id}`,
        data: item.data,
        titulo: 'Movimentacao financeira',
        descricao: `${item.tipo || 'movimentacao'} · ${formatCurrency(item.valor || 0)}`,
        meta: item.descricao || item.categoria || 'fluxo financeiro',
      })),
    ];

    return eventos
      .filter((evento) => Boolean(evento?.data))
      .sort((a, b) => new Date(b.data) - new Date(a.data));
  }, [custos, financeiro, lote, lotePesagens, movimentacoes, san]);

  return (
    <div className="page rebanho-page">
      <div className="rebanho-header">
        <div>
          <Button variant="ghost" onClick={onBack}>← Voltar para lotes</Button>
          <h1>{lote.nome}</h1>
        </div>
        <div className="page-topbar-actions">
          <Button icon={<Plus size={14} />} onClick={onOpenMov}>Registrar Movimentação</Button>
          <Button variant="outline" icon={<Scale size={14} />} onClick={onOpenPesagem}>Nova Pesagem</Button>
          {lote.status === 'ativo' && <Button variant="danger" onClick={onOpenFechamento}>Encerrar Lote</Button>}
        </div>
      </div>
      <div className="tabs-row">
        {tabs.map((tab) => (
          <button key={tab} className={`tab-button ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {activeTab === 'visao' && (
        <>
          <Card title="Resumo executivo do lote">
            <div className="dashboard-grid dashboard-grid--kpi-secondary">
              <Card title="Receita total">{formatCurrency(resumoLote.receitaTotal)}</Card>
              <Card title="Custo total">{formatCurrency(resumoLote.custoTotal)}</Card>
              <Card title="Lucro total">{formatCurrency(resumoLote.lucroTotal)}</Card>
              <Card title="Margem %">{formatNumber(resumoLote.margemPct, 2)}%</Card>
              <Card title="Lucro por cabeça">{formatCurrency(resumoLote.lucroPorCabeca)}</Card>
              <Card title="Lucro por arroba">{formatCurrency(resumoLote.lucroPorArroba)}</Card>
              <Card title="GMD médio">{formatNumber(resumoLote.gmdMedio, 3)} kg/dia</Card>
              <Card title="Arrobas produzidas">{formatNumber(resumoLote.arrobasProduzidas, 2)} @</Card>
              <Card title="Classificação">
                <Badge
                  variant={
                    resumoLote.classificacao === 'lucro'
                      ? 'success'
                      : resumoLote.classificacao === 'prejuizo'
                        ? 'danger'
                        : 'warning'
                  }
                >
                  {resumoLote.classificacao === 'lucro'
                    ? 'Lucro'
                    : resumoLote.classificacao === 'prejuizo'
                      ? 'Prejuízo'
                      : 'Empate'}
                </Badge>
              </Card>
            </div>
            <p className="text-secondary">
              Resumo calculado com base nos lançamentos financeiros, animais, custos e pesagens disponíveis.
            </p>
            <div style={{ marginTop: 12 }}>
              <h4>Insights do lote</h4>
              {(resumoLote.insights || []).length > 0 ? (
                <ul>
                  {resumoLote.insights.map((insight, index) => (
                    <li key={`${insight}-${index}`}>{insight}</li>
                  ))}
                </ul>
              ) : (
                <p>Nenhum alerta relevante para este lote.</p>
              )}
            </div>
          </Card>
          <div className="dashboard-grid dashboard-grid--kpi-secondary">
            <Card title="Cabeças">{lote.indicators.totalAnimais}</Card>
            <Card title="Peso Médio">{formatNumber(lote.indicators.pesoAtualMedio, 1)} kg</Card>
            <Card title="Resultado">{formatCurrency(lote.indicators.margem)}</Card>
          </div>
          <Card title="Painel de Indicadores (meta x realizado)">
            <div className="indicadores-painel">
              {indicadoresPainel.map((item) => {
                const pct = item.meta ? (item.realizado / item.meta) * 100 : 100;
                const color = pct >= 100 ? 'var(--color-success)' : pct >= 80 ? 'var(--color-warning)' : 'var(--color-danger)';
                const tendencia = calcularDesvioPorcentual(item.realizado, item.meta);
                return (
                  <div key={item.nome} className="indicador-item">
                    <div className="indicador-header">
                      <span>{item.nome}</span>
                      <Badge variant={tendencia >= 0 ? 'success' : 'danger'}>{formatNumber(tendencia, 1)}%</Badge>
                    </div>
                    <div className="indicador-values">
                      <span className="realizado" style={{ color }}>{formatNumber(item.realizado, item.unit === '%' ? 1 : 2)} {item.unit}</span>
                      <span className="meta">Meta: {formatNumber(item.meta, item.unit === '%' ? 1 : 2)} {item.unit}</span>
                    </div>
                    <div className="indicador-progress">
                      <div className="progress-bar" style={{ width: `${Math.min(100, pct)}%`, background: color }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <section className="comparativo-grid-2">
            <Card title="Evolução de Peso e GMD">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="data" />
                  <YAxis yAxisId="left" label={{ value: 'Peso (kg)', angle: -90, position: 'insideLeft' }} />
                  <YAxis yAxisId="right" orientation="right" label={{ value: 'GMD (kg/dia)', angle: 90, position: 'insideRight' }} />
                  <Tooltip formatter={(value, name) => [`${formatNumber(value, name === 'peso' ? 1 : 3)} ${name === 'peso' ? 'kg' : 'kg/dia'}`, name === 'peso' ? 'Peso Médio' : 'GMD']} />
                  <Line yAxisId="left" type="monotone" dataKey="peso" stroke="#8884d8" name="Peso Médio" />
                  <Line yAxisId="right" type="monotone" dataKey="gmd" stroke="#82ca9d" name="GMD" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Custos por Categoria">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={custosPorCategoria} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </section>

          <Card title="Linha do Tempo Financeira (Acumulado)">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timelineFinanceira}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis label={{ value: 'Valor (R$)', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Line type="monotone" dataKey="custo" stroke="#ef4444" name="Custo Acumulado" />
                <Line type="monotone" dataKey="receita" stroke="#22c55e" name="Receita Acumulada" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}

      {activeTab === 'mov' && (
        <Card title="Histórico de Movimentações">
          {movimentacoes.length === 0 ? (
            <div className="empty-state">
              <strong>Nenhuma movimentação registrada.</strong>
              <span>Use o botão "Registrar Movimentação" para adicionar.</span>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Qtd</th>
                  <th>Peso Médio</th>
                  <th>Valor</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {movimentacoes.map((mov) => (
                  <tr key={mov.id}>
                    <td>{formatDate(mov.data)}</td>
                    <td>{mov.tipo}</td>
                    <td>{mov.qtd}</td>
                    <td>{formatNumber(mov.peso_medio, 1)} kg</td>
                    <td>{mov.valor_total ? formatCurrency(mov.valor_total) : '—'}</td>
                    <td>{mov.obs || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {activeTab === 'pesagens' && (
        <Card title="Histórico de Pesagens">
          {lotePesagens.length === 0 ? (
            <div className="empty-state">
              <strong>Nenhuma pesagem registrada.</strong>
              <span>Use o botão "Nova Pesagem" para adicionar.</span>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Peso Médio</th>
                  <th>Qtd Pesada</th>
                  <th>GMD (desde última)</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {lotePesagens.map((p, index) => {
                  const prevPesagem = index > 0 ? lotePesagens[index - 1] : null;
                  const gmd = prevPesagem ? calcularGmdEntrePesagens([prevPesagem, p], p.id) : 0;
                  return (
                    <tr key={p.id}>
                      <td>{formatDate(p.data)}</td>
                      <td>{formatNumber(p.peso_medio, 1)} kg</td>
                      <td>{p.qtd}</td>
                      <td>{formatNumber(gmd, 3)} kg/dia</td>
                      <td>{p.observacao || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {activeTab === 'financeiro' && (
        <Card title="Histórico Financeiro do Lote">
          {financeiro.length === 0 ? (
            <div className="empty-state">
              <strong>Nenhum lançamento financeiro registrado.</strong>
              <span>Lançamentos de custos e receitas vinculados a este lote aparecerão aqui.</span>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Categoria</th>
                  <th>Valor</th>
                  <th>Descrição</th>
                </tr>
              </thead>
              <tbody>
                {financeiro.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.data)}</td>
                    <td>{item.tipo}</td>
                    <td>{item.categoria}</td>
                    <td>{formatCurrency(item.valor)}</td>
                    <td>{item.descricao || item.observacao || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {activeTab === 'sanitario' && (
        <Card title="Histórico Sanitário do Lote">
          {san.length === 0 ? (
            <div className="empty-state">
              <strong>Nenhum evento sanitário registrado.</strong>
              <span>Eventos de vacinação, vermifugação, etc., aparecerão aqui.</span>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Produto</th>
                  <th>Dose</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {san.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.data)}</td>
                    <td>{item.tipo}</td>
                    <td>{item.produto}</td>
                    <td>{item.dose}</td>
                    <td>{item.observacao || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {activeTab === 'historico' && (
        <Card title="Histórico do Lote">
          {historicoLote.length === 0 ? (
            <div className="empty-state">
              <strong>Nenhum evento registrado.</strong>
              <span>Pesagens, movimentacoes, custos e manejos do lote aparecerao aqui.</span>
            </div>
          ) : (
            <div className="lote-history-list">
              {historicoLote.map((evento) => (
                <div key={evento.id} className="lote-history-item">
                  <div className="lote-history-date">{formatDate(evento.data)}</div>
                  <div className="lote-history-content">
                    <strong>{evento.titulo}</strong>
                    <p>{evento.descricao}</p>
                    <span>{evento.meta}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

/**
 * Modal para registrar o fechamento de um lote.
 * @param {object} props - As propriedades do componente.
 * @param {object} props.lote - O objeto do lote a ser fechado.
 * @param {function} props.setDb - Função para atualizar o banco de dados.
 * @param {function} props.onClose - Callback para fechar o modal.
 * @param {function} props.showToast - Função para exibir toasts.
 */
function FechamentoLoteModal({ lote, setDb, onClose, showToast, hasPermission }) {
  const [form, setForm] = useState({
    data_saida: getTodayIso(),
    status: 'encerrado',
    mortalidade: 0,
    motivo_saida: '',
  });

  function submit() {
    if (!hasPermission('lotes:editar')) {
      showToast({ type: 'error', message: 'Você não tem permissão para executar esta ação.' });
      return;
    }
    if (!form.data_saida) {
      showToast({ type: 'error', message: 'A data de saída é obrigatória.' });
      return;
    }
    if (Number(form.mortalidade) < 0 || Number(form.mortalidade) > 100) {
      showToast({ type: 'error', message: 'A mortalidade deve ser entre 0 e 100%.' });
      return;
    }

    setDb((prev) => ({
      ...prev,
      lotes: prev.lotes.map((l) =>
        l.id === lote.id
          ? {
              ...l,
              status: form.status,
              data_saida: form.data_saida,
              fechamento: {
                mortalidade: Number(form.mortalidade),
                motivo_saida: form.motivo_saida,
              },
            }
          : l
      ),
    }));
    showToast({ type: 'success', message: `Lote ${lote.nome} encerrado com sucesso!` });
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={`Encerrar Lote: ${lote.nome}`} footer={<Button onClick={submit}>Confirmar Fechamento</Button>}>
      <div className="form-grid two">
        <Input label="Data de Saída" type="date" value={form.data_saida} onChange={(e) => setForm((p) => ({ ...p, data_saida: e.target.value }))} />
        <label className="ui-input-wrap">
          <span className="ui-input-label">Status Final</span>
          <select className="ui-input" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
            <option value="encerrado">Encerrado (interno)</option>
            <option value="vendido">Vendido</option>
          </select>
        </label>
        <Input label="Mortalidade (%)" type="number" value={form.mortalidade} onChange={(e) => setForm((p) => ({ ...p, mortalidade: e.target.value }))} />
        <Input label="Motivo da Saída" value={form.motivo_saida} onChange={(e) => setForm((p) => ({ ...p, motivo_saida: e.target.value }))} />
      </div>
    </Modal>
  );
}

/**
 * Modal para registrar movimentações de animais (compra, venda, morte, etc.).
 * @param {object} props - As propriedades do componente.
 * @param {object} props.lote - O objeto do lote.
 * @param {object} props.db - O objeto do banco de dados.
 * @param {function} props.setDb - Função para atualizar o banco de dados.
 * @param {function} props.onClose - Callback para fechar o modal.
 * @param {function} [props.onRegistrarEntradaAnimal] - Callback opcional para registrar entrada de animal.
 * @param {function} [props.onRegistrarSaidaAnimal] - Callback opcional para registrar saída de animal.
 * @param {function} props.showToast - Função para exibir toasts.
 */
function MovimentacaoModal({ lote, db, setDb, onClose, onRegistrarEntradaAnimal, onRegistrarSaidaAnimal, showToast, hasPermission }) {
  const [form, setForm] = useState({
    tipo: 'compra',
    data: getTodayIso(),
    qtd: '',
    peso_medio: '',
    // Compra
    fornecedor: '',
    custo_total: '',
    frete: '',
    origem: '',
    // Venda
    comprador: '',
    preco_arroba: db.configuracoes?.geral?.preco_arroba_padrao || 290,
    rendimento: db.configuracoes?.geral?.rendimento_carcaca_padrao || 52,
    comissao: '',
    // Morte/Descarte
    motivo: '',
    // Transferência
    lote_destino: '',
    obs: '',
  });

  const qtd = Number(form.qtd || 0);
  const peso = Number(form.peso_medio || 0);
  const custoTotalCompra = Number(form.custo_total || 0);
  const freteCompra = Number(form.frete || 0);
  const precoArrobaVenda = Number(form.preco_arroba || 0);
  const rendimentoVenda = Number(form.rendimento || 0);
  const freteVenda = Number(form.frete || 0);
  const comissaoVenda = Number(form.comissao || 0);

  const custoCab = qtd > 0 ? (custoTotalCompra + freteCompra) / qtd : 0;
  const arrobaViva = peso / 15;
  const arrobaCarc = (peso * rendimentoVenda) / 100 / 15;
  const valorTotal = arrobaCarc * precoArrobaVenda * qtd;
  const liquido = valorTotal - freteVenda - comissaoVenda;

  function submit() {
    if (!hasPermission('animais:movimentar')) {
      showToast({ type: 'error', message: 'Você não tem permissão para executar esta ação.' });
      return;
    }
    if (!form.data || qtd <= 0 || peso <= 0) {
      showToast({ type: 'error', message: 'Data, quantidade e peso médio são obrigatórios.' });
      return;
    }

    const mov = {
      id: gerarNovoId(db.movimentacoes_animais),
      lote_id: lote.id,
      tipo: form.tipo,
      data: form.data,
      qtd: qtd,
      peso_medio: peso,
      obs: form.obs,
      // Campos específicos
      fornecedor: form.fornecedor,
      custo_total: custoTotalCompra,
      frete: freteCompra,
      origem: form.origem,
      comprador: form.comprador,
      preco_arroba: precoArrobaVenda,
      rendimento: rendimentoVenda,
      comissao: comissaoVenda,
      motivo: form.motivo,
      lote_destino: form.lote_destino ? Number(form.lote_destino) : null,
      valor_total: liquido, // Para venda
    };

    // Usar callbacks customizados se fornecidos
    if (onRegistrarEntradaAnimal && ['compra', 'nascimento', 'transferencia_entrada'].includes(form.tipo)) {
      try {
        onRegistrarEntradaAnimal(mov);
        showToast({ type: 'success', message: 'Entrada de animais registrada com sucesso!' });
        onClose();
      } catch (error) {
        showToast({ type: 'error', message: error?.message || 'Não foi possível registrar a entrada de animais.' });
      }
      return;
    }
    if (onRegistrarSaidaAnimal && ['venda', 'morte', 'descarte', 'transferencia_saida', 'abate'].includes(form.tipo)) {
      try {
        onRegistrarSaidaAnimal(mov);
        showToast({ type: 'success', message: 'Saída de animais registrada com sucesso!' });
        onClose();
      } catch (error) {
        showToast({ type: 'error', message: error?.message || 'Não foi possível registrar a saída de animais.' });
      }
      return;
    }

    // Lógica padrão de atualização do DB
    setDb((prev) => {
      let newLotes = prev.lotes;
      let newAnimais = prev.animais;
      let newCustos = prev.custos;
      let newMovFinanceiras = prev.movimentacoes_financeiras;

      // Atualizar lote atual
      newLotes = newLotes.map((l) => {
        if (l.id === lote.id) {
          let totalAnimais = lote.indicators.totalAnimais;
          let pesoAtualMedio = lote.indicators.pesoAtualMedio;

          if (['compra', 'nascimento', 'transferencia_entrada'].includes(form.tipo)) {
            totalAnimais += qtd;
            pesoAtualMedio = ((pesoAtualMedio * lote.indicators.totalAnimais) + (peso * qtd)) / totalAnimais;
          } else if (['venda', 'morte', 'descarte', 'transferencia_saida', 'abate'].includes(form.tipo)) {
            totalAnimais -= qtd;
            // Recalcular peso médio de forma mais robusta, ou assumir que o peso médio do lote não muda drasticamente
            // Por simplicidade, vamos apenas ajustar a quantidade. O peso médio será recalculado por calcLote.
          }
          return { ...l, totalAnimais, p_at: pesoAtualMedio }; // p_at é o peso atual do lote
        }
        return l;
      });

      // Atualizar lote de destino (para transferências)
      if ((form.tipo === 'transferencia_saida' || form.tipo === 'transferencia_entrada') && form.lote_destino) {
        newLotes = newLotes.map((l) => {
          if (l.id === Number(form.lote_destino)) {
            const destinoIndicators = calcLote(prev, Number(form.lote_destino));
            const totalAnimais = (destinoIndicators?.totalAnimais || 0) + qtd;
            const pesoAtualMedio = totalAnimais
              ? (((destinoIndicators?.pesoAtualMedio || 0) * (destinoIndicators?.totalAnimais || 0)) + (peso * qtd)) / totalAnimais
              : peso;
            return { ...l, totalAnimais, p_at: pesoAtualMedio };
          }
          return l;
        });
      }


      // Adicionar custo de aquisição
      if (form.tipo === 'compra') {
        newCustos = [...(prev.custos || []), {
          id: gerarNovoId(prev.custos),
          lote_id: lote.id,
          cat: 'aquisição',
          desc: `Compra de ${qtd} animais para o lote ${lote.nome}`,
          data: form.data,
          val: custoTotalCompra + freteCompra,
        }];
      }

      // Adicionar receita de venda
      if (form.tipo === 'venda') {
        newMovFinanceiras = [...(prev.movimentacoes_financeiras || []), {
          id: gerarNovoId(prev.movimentacoes_financeiras),
          lote_id: lote.id,
          tipo: 'receita',
          data: form.data,
          valor: liquido,
          descricao: `Venda de ${qtd} animais do lote ${lote.nome}`,
          comprador: form.comprador,
          nota_fiscal: '', // Adicionar campo se houver
        }];
      }

      return {
        ...prev,
        lotes: newLotes,
        animais: newAnimais, // Animais individuais não são atualizados aqui, apenas o resumo do lote
        movimentacoes_animais: [...(prev.movimentacoes_animais || []), mov],
        custos: newCustos,
        movimentacoes_financeiras: newMovFinanceiras,
      };
    });
    showToast({ type: 'success', message: 'Movimentação registrada com sucesso!' });
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Nova movimentação" size="lg" footer={<Button onClick={submit}>Salvar Movimentação</Button>}>
      <div className="form-grid two"> {/* Alterado para grid de 2 colunas */}
        <label className="ui-input-wrap">
          <span className="ui-input-label">Tipo</span>
          <select className="ui-input" value={form.tipo} onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}>
            {movTypes.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
          </select>
        </label>
        <Input label="Data" type="date" value={form.data} onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))} />
        <Input label="Quantidade de cabeças" type="number" value={form.qtd} onChange={(e) => setForm((p) => ({ ...p, qtd: e.target.value }))} />
        <Input label="Peso médio" type="number" value={form.peso_medio} onChange={(e) => setForm((p) => ({ ...p, peso_medio: e.target.value }))} />

        {form.tipo === 'compra' && (
          <>
            <Input label="Fornecedor" value={form.fornecedor} onChange={(e) => setForm((p) => ({ ...p, fornecedor: e.target.value }))} />
            <Input label="Custo total" type="number" value={form.custo_total} onChange={(e) => setForm((p) => ({ ...p, custo_total: e.target.value }))} />
            <Input label="Frete" type="number" value={form.frete} onChange={(e) => setForm((p) => ({ ...p, frete: e.target.value }))} />
            <Input label="Origem" value={form.origem} onChange={(e) => setForm((p) => ({ ...p, origem: e.target.value }))} />
            <p className="form-info full">R$/cabeça: {formatCurrency(custoCab)} · @ viva: {formatNumber(arrobaViva, 2)}</p>
          </>
        )}

        {form.tipo === 'venda' && (
          <>
            <Input label="Comprador" value={form.comprador} onChange={(e) => setForm((p) => ({ ...p, comprador: e.target.value }))} />
            <Input label="Preço/@" type="number" value={form.preco_arroba} onChange={(e) => setForm((p) => ({ ...p, preco_arroba: e.target.value }))} />
            <Input label="Rendimento (%)" type="number" value={form.rendimento} onChange={(e) => setForm((p) => ({ ...p, rendimento: e.target.value }))} />
            <Input label="Frete" type="number" value={form.frete} onChange={(e) => setForm((p) => ({ ...p, frete: e.target.value }))} />
            <Input label="Comissão" type="number" value={form.comissao} onChange={(e) => setForm((p) => ({ ...p, comissao: e.target.value }))} />
            <p className="form-info full">@ viva: {formatNumber(arrobaViva, 2)} · @ carcaça: {formatNumber(arrobaCarc, 2)} · Total: {formatCurrency(valorTotal)} · Líquido: {formatCurrency(liquido)}</p>
          </>
        )}

        {(form.tipo === 'morte' || form.tipo === 'descarte') && (
          <>
            <Input label="Motivo" value={form.motivo} onChange={(e) => setForm((p) => ({ ...p, motivo: e.target.value }))} />
            <p className="form-info full">Impacto estimado no peso médio: -{formatNumber((qtd * peso) / Math.max(lote.indicators.totalAnimais, 1), 1)} kg</p>
          </>
        )}

        {(form.tipo.includes('transferencia')) && (
          <label className="ui-input-wrap">
            <span className="ui-input-label">Lote destino</span>
            <select className="ui-input" value={form.lote_destino} onChange={(e) => setForm((p) => ({ ...p, lote_destino: e.target.value }))}>
              <option value="">Selecione</option>
              {db.lotes.filter((l) => l.status === 'ativo' && l.id !== lote.id).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </label>
        )}
        <label className="ui-input-wrap full">
          <span className="ui-input-label">Observações</span>
          <textarea className="ui-input" value={form.obs} onChange={(e) => setForm((p) => ({ ...p, obs: e.target.value }))} />
        </label>
      </div>
    </Modal>
  );
}

/**
 * Modal para registrar uma nova pesagem para um lote.
 * @param {object} props - As propriedades do componente.
 * @param {object} props.lote - O objeto do lote.
 * @param {object} props.db - O objeto do banco de dados.
 * @param {function} props.setDb - Função para atualizar o banco de dados.
 * @param {function} props.onClose - Callback para fechar o modal.
 * @param {function} props.showToast - Função para exibir toasts.
 */
function PesagemModal({ lote, db, setDb, onClose, showToast, hasPermission }) {
  const ultima = useMemo(() => (db.pesagens || []).filter((p) => p.lote_id === lote.id).sort((a, b) => new Date(b.data) - new Date(a.data))[0], [db.pesagens, lote.id]);
  const [form, setForm] = useState({ data: getTodayIso(), peso_medio: '', qtd: lote.indicators.totalAnimais, obs: '' });

  const diasDesdeUltima = ultima ? daysBetween(ultima.data, form.data) : 0;
  const gmd = ultima && form.peso_medio && diasDesdeUltima > 0 ? (Number(form.peso_medio) - Number(ultima.peso_medio)) / diasDesdeUltima : 0;
  const arroba = Number(form.peso_medio || 0) / 15;
  const precoArrobaPadrao = db.configuracoes?.geral?.preco_arroba_padrao || 290;
  const valorEst = Number(form.qtd || 0) * arroba * precoArrobaPadrao;

  function submit() {
    if (!hasPermission('pesagens:editar')) {
      showToast({ type: 'error', message: 'Você não tem permissão para executar esta ação.' });
      return;
    }
    if (!form.data || Number(form.peso_medio) <= 0) {
      showToast({ type: 'error', message: 'Data e peso médio são obrigatórios.' });
      return;
    }
    if (Number(form.qtd) <= 0) {
      showToast({ type: 'error', message: 'A quantidade pesada deve ser maior que zero.' });
      return;
    }

    setDb((prev) => ({
      ...prev,
      pesagens: [...(prev.pesagens || []), {
        id: gerarNovoId(prev.pesagens),
        lote_id: lote.id,
        data: form.data,
        peso_medio: Number(form.peso_medio),
        observacao: form.obs,
        qtd: Number(form.qtd || 0),
      }],
      lotes: (prev.lotes || []).map((item) =>
        Number(item.id) === Number(lote.id)
          ? { ...item, p_at: Number(form.peso_medio || 0), ultima_pesagem: form.data }
          : item
      ),
    }));
    showToast({ type: 'success', message: 'Pesagem registrada com sucesso!' });
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Nova Pesagem" size="md" footer={<Button onClick={submit}>Salvar Pesagem</Button>}>
      <div className="form-grid two">
        <Input label="Data" type="date" value={form.data} onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))} />
        <Input label="Peso médio" type="number" value={form.peso_medio} onChange={(e) => setForm((p) => ({ ...p, peso_medio: e.target.value }))} />
        <Input label="Quantidade pesada" type="number" value={form.qtd} onChange={(e) => setForm((p) => ({ ...p, qtd: e.target.value }))} />
        <Input label="Observações" value={form.obs} onChange={(e) => setForm((p) => ({ ...p, obs: e.target.value }))} />
        <p className="form-info full">GMD desde última: {formatNumber(gmd, 3)} kg/dia · @ viva: {formatNumber(arroba, 2)} · Valor estimado: {formatCurrency(valorEst)}</p>
      </div>
    </Modal>
  );
}

/**
 * Modal para criar um novo lote.
 * @param {object} props - As propriedades do componente.
 * @param {object} props.db - O objeto do banco de dados.
 * @param {function} props.setDb - Função para atualizar o banco de dados.
 * @param {function} props.onClose - Callback para fechar o modal.
 * @param {function} props.showToast - Função para exibir toasts.
 */
function NovoLoteModal({ db, setDb, onClose, showToast, hasPermission }) {
  const configGeral = db.configuracoes?.geral || {};
  const [form, setForm] = useState({
    nome: '',
    faz_id: db.fazendas?.[0]?.id ? String(db.fazendas[0].id) : '',
    raca: '',
    sexo: 'Macho',
    categoria: 'Novilho',
    entrada: getTodayIso(),
    fornecedor: '',
    peso_inicial: '',
    qtd_inicial: '',
    custo_aquisicao: '',
    peso_alvo: '',
    saida_meta: '',
    obs: '',
  });
  const [errors, setErrors] = useState({});

  function validate() {
    const e = {};
    if (!form.nome.trim()) e.nome = 'Nome é obrigatório';
    if (!form.faz_id) e.faz_id = 'Fazenda é obrigatória';
    if (!form.entrada) e.entrada = 'Data de entrada é obrigatória';
    if (Number(form.qtd_inicial || 0) <= 0) e.qtd_inicial = 'Quantidade inicial deve ser maior que zero';
    if (Number(form.peso_inicial || 0) <= 0) e.peso_inicial = 'Peso inicial deve ser maior que zero';
    setErrors(e);
    return !Object.keys(e).length;
  }

  function submit() {
    if (!hasPermission('lotes:editar')) {
      showToast({ type: 'error', message: 'Você não tem permissão para executar esta ação.' });
      return;
    }
    if (!validate()) {
      showToast({ type: 'error', message: 'Por favor, corrija os erros no formulário.' });
      return;
    }

    const novoLoteId = gerarNovoId(db.lotes);
    const custoAquisicao = Number(form.custo_aquisicao || 0);

    setDb((prev) => ({
      ...prev,
      lotes: [
        ...(Array.isArray(prev?.lotes) ? prev.lotes : []),
        {
          id: novoLoteId,
          nome: form.nome,
          faz_id: Number(form.faz_id),
          entrada: form.entrada,
          saida: form.saida_meta,
          investimento: custoAquisicao,
          status: 'ativo',
          tipo: 'engorda', // Default
          sistema: 'confinamento', // Default
          gmd_meta: configGeral.gmd_meta_padrao || 1, // From config
          preco_arroba: configGeral.preco_arroba_padrao || 290, // From config
          rendimento_carcaca: configGeral.rendimento_carcaca_padrao || 52, // From config
          peso_alvo: Number(form.peso_alvo || 0),
          raca: form.raca,
          sexo: form.sexo,
          categoria: form.categoria,
          obs: form.obs,
          p_ini: Number(form.peso_inicial), // Peso inicial do lote
          p_at: Number(form.peso_inicial), // Peso atual do lote (inicialmente igual ao inicial)
          ultima_pesagem: form.entrada, // Primeira pesagem é a entrada
        },
      ],
      animais: [
        ...(Array.isArray(prev?.animais) ? prev.animais : []),
        {
          id: gerarNovoId(prev.animais || []),
          lote_id: novoLoteId,
          sexo: form.sexo.toLowerCase(),
          gen: form.raca || 'Misto',
          qtd: Number(form.qtd_inicial),
          p_ini: Number(form.peso_inicial),
          p_at: Number(form.peso_inicial),
          dias: 0,
          consumo: 0,
        },
      ],
      // Adicionar custo de aquisição como um custo financeiro
      custos: custoAquisicao > 0 ? [
        ...(Array.isArray(prev?.custos) ? prev.custos : []),
        {
          id: gerarNovoId(prev.custos || []),
          lote_id: novoLoteId,
          cat: 'aquisição',
          desc: `Custo de aquisição do lote ${form.nome}`,
          data: form.entrada,
          val: custoAquisicao,
        }
      ] : prev.custos,
    }));
    showToast({ type: 'success', message: `Lote ${form.nome} criado com sucesso!` });
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Novo Lote" subtitle="Cadastro completo de entrada no rebanho" size="lg" footer={<Button onClick={submit}>Salvar Lote</Button>}>
      <div className="form-grid two">
        <Input label="Nome do lote" value={form.nome} error={errors.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} />
        <label className="ui-input-wrap">
          <span className="ui-input-label">Fazenda</span>
          <select className="ui-input" value={form.faz_id} onChange={(e) => setForm((p) => ({ ...p, faz_id: e.target.value }))}>
            <option value="">Selecione</option>
            {(db.fazendas || []).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          {errors.faz_id && <small className="input-error">{errors.faz_id}</small>}
        </label>
        <Input label="Raça / grupo genético" value={form.raca} onChange={(e) => setForm((p) => ({ ...p, raca: e.target.value }))} />
        <label className="ui-input-wrap">
          <span className="ui-input-label">Sexo</span>
          <select className="ui-input" value={form.sexo} onChange={(e) => setForm((p) => ({ ...p, sexo: e.target.value }))}>
            <option>Macho</option>
            <option>Fêmea</option>
            <option>Misto</option>
          </select>
        </label>
        <label className="ui-input-wrap">
          <span className="ui-input-label">Categoria</span>
          <select className="ui-input" value={form.categoria} onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))}>
            <option>Bezerro</option>
            <option>Garrote</option>
            <option>Novilho</option>
            <option>Boi</option>
            <option>Vaca</option>
            <option>Touro</option>
          </select>
        </label>
        <Input label="Data de entrada" type="date" error={errors.entrada} value={form.entrada} onChange={(e) => setForm((p) => ({ ...p, entrada: e.target.value }))} />
        <Input label="Fornecedor" value={form.fornecedor} onChange={(e) => setForm((p) => ({ ...p, fornecedor: e.target.value }))} />
        <Input label="Peso médio inicial" type="number" error={errors.peso_inicial} value={form.peso_inicial} onChange={(e) => setForm((p) => ({ ...p, peso_inicial: e.target.value }))} />
        <Input label="Quantidade inicial" type="number" error={errors.qtd_inicial} value={form.qtd_inicial} onChange={(e) => setForm((p) => ({ ...p, qtd_inicial: e.target.value }))} />
        <Input label="Custo de aquisição" prefix="R$" type="number" value={form.custo_aquisicao} onChange={(e) => setForm((p) => ({ ...p, custo_aquisicao: e.target.value }))} />
        <Input label="Peso alvo" suffix="kg" type="number" value={form.peso_alvo} onChange={(e) => setForm((p) => ({ ...p, peso_alvo: e.target.value }))} />
        <Input label="Data alvo de saída" type="date" value={form.saida_meta} onChange={(e) => setForm((p) => ({ ...p, saida_meta: e.target.value }))} />
        <label className="ui-input-wrap full">
          <span className="ui-input-label">Observações</span>
          <textarea className="ui-input" value={form.obs} onChange={(e) => setForm((p) => ({ ...p, obs: e.target.value }))} />
        </label>
      </div>
    </Modal>
  );
}

/**
 * Calcula o número de dias de uma data até hoje.
 * @param {string} dateStr - A string da data.
 * @returns {number} O número de dias.
 */
function daysFrom(dateStr) {
  if (!dateStr) return 0;
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today - start) / 86400000));
}

/**
 * Calcula o número de dias entre duas datas.
 * @param {string} a - Primeira data.
 * @param {string} b - Segunda data.
 * @returns {number} O número de dias.
 */
function daysBetween(a, b) {
  if (!a || !b) return 0;
  const dateA = new Date(a);
  dateA.setHours(0, 0, 0, 0);
  const dateB = new Date(b);
  dateB.setHours(0, 0, 0, 0);
  return Math.round((dateB - dateA) / 86400000);
}

/**
 * Calcula o GMD dos últimos 30 dias (ou entre as duas últimas pesagens se o período for menor).
 * @param {Array<object>} pesagens - Array de objetos de pesagem.
 * @param {number} loteId - ID do lote.
 * @returns {number} O GMD calculado.
 */
function calcGmd30(pesagens, loteId) {
  const data = pesagens.filter((p) => p.lote_id === loteId).sort((a, b) => new Date(a.data) - new Date(b.data));
  if (data.length < 2) return 0;

  const last = data[data.length - 1];
  let prev = null;

  // Encontrar a pesagem mais antiga que está dentro dos últimos 30 dias
  for (let i = data.length - 2; i >= 0; i--) {
    const currentPesagem = data[i];
    const daysDiff = daysBetween(currentPesagem.data, last.data);
    if (daysDiff <= 30 && daysDiff > 0) { // Considerar apenas pesagens dentro do período e com diferença de dias
      prev = currentPesagem;
      break;
    }
  }

  // Se não encontrou uma pesagem nos últimos 30 dias, usa a penúltima pesagem disponível
  if (!prev && data.length >= 2) {
    prev = data[data.length - 2];
  }

  if (!prev) return 0; // Não há pesagem anterior válida

  const daysDiff = daysBetween(prev.data, last.data);
  if (daysDiff <= 0) return 0; // Evitar divisão por zero ou GMD inválido

  return (Number(last.peso_medio) - Number(prev.peso_medio)) / daysDiff;
}

function calcularGmdEntrePesagens(pesagens, pesagemId) {
  const ordenadas = [...pesagens].sort((a, b) => new Date(a.data) - new Date(b.data));
  const indice = ordenadas.findIndex((item) => Number(item.id) === Number(pesagemId));

  if (indice <= 0) {
    return 0;
  }

  const atual = ordenadas[indice];
  const anterior = ordenadas[indice - 1];
  const dias = daysBetween(anterior?.data, atual?.data);

  if (dias <= 0) {
    return 0;
  }

  return (Number(atual?.peso_medio || 0) - Number(anterior?.peso_medio || 0)) / dias;
}

/**
 * Agrupa custos por categoria.
 * @param {Array<object>} custos - Array de objetos de custo.
 * @returns {object} Objeto com categorias e seus valores totais.
 */
function groupCustos(custos) {
  const map = {};
  custos.forEach((c) => {
    map[c.cat] = (map[c.cat] || 0) + Number(c.val || 0);
  });
  return map; // Retorna o mapa diretamente
}

/**
 * Constrói a linha do tempo financeira acumulada para um lote específico.
 * @param {object} db - O objeto do banco de dados.
 * @param {number} loteId - O ID do lote.
 * @returns {Array<object>} A linha do tempo financeira.
 */
function buildFinanceTimeline(db, loteId) {
  const all = (db.movimentacoes_financeiras || [])
    .filter((m) => Number(m.lote_id) === Number(loteId))
    .map((m) => ({
      data: m.data,
      tipo: m.tipo === 'despesa' ? 'custo' : 'receita',
      valor: Number(m.valor || 0),
    }))
    .sort((a, b) => new Date(a.data) - new Date(b.data));

  let acC = 0, acR = 0;
  const timelineData = [];
  all.forEach((e) => {
    if (e.tipo === 'custo') acC += e.valor;
    else acR += e.valor;
    timelineData.push({ label: formatDate(e.data), custo: acC, receita: acR });
  });
  return timelineData;
}
