import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/EmptyState';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/PageHeader';
import ExportActions from '../components/ExportActions';
import { getResumoLote } from '../domain/resumoLote';
import { isModoConsolidado, construirMapaFazendas } from '../domain/escopoFazenda';
import { listarContasFinanceiras } from '../domain/hojeNaFazenda';
import { isMovimentacaoPaga, isMovimentacaoCancelada, getDataVencimento } from '../domain/financeiroStatus';
import { formatCurrency, formatDate, formatNumber } from '../utils/calculations';
import { gerarNovoId } from '../utils/id';
import { useAuth } from '../auth/useAuth';
import { useToast } from '../hooks/useToast';
import { createOperationalRecord, updateOperationalRecord } from '../services/operationalPersistence';
import { formatarMoedaExportacao, montarNomeArquivo } from '../domain/exportacaoRelatorios';
import { baixarCsv, abrirRelatorioParaImpressao } from '../utils/exportacaoArquivos';
import '../styles/pagamentos.css';

const tabs = ['dre', 'lote', 'lanc', 'pag'];
const despCats = ['Compra Animal', 'Racao', 'Suplemento', 'Medicamento', 'Vacina', 'Frete', 'Funcionario', 'Arrendamento', 'Manutencao', 'Outro'];
const recCats = ['Venda Animal', 'Venda Produto', 'Outro'];
const metodosPagamento = ['Dinheiro', 'Pix', 'Cartão', 'Boleto', 'Transferência', 'Cheque', 'Outro'];
const getTodayIso = () => new Date().toISOString().slice(0, 10);
const TAB_LABELS = {
  dre: 'DRE',
  lote: 'Por Lote',
  lanc: 'Lançamentos',
  pag: 'Pagamentos',
};
const PAGAMENTOS_PROXIMOS_DIAS = 7;

/**
 * Visão geral de contas a pagar em 5 grupos, reaproveitando `listarContasFinanceiras`
 * (vencidas/próximas) e os helpers de `financeiroStatus.js` (pago/cancelado/vencimento) —
 * não recalcula nada que esses já resolvem, só agrupa em mais faixas para a tela.
 */
function buildPagamentosVisaoGeral(db, hoje) {
  const despesas = (Array.isArray(db?.movimentacoes_financeiras) ? db.movimentacoes_financeiras : [])
    .filter((mov) => mov?.tipo === 'despesa' && !isMovimentacaoCancelada(mov));

  const { vencidas, proximas } = listarContasFinanceiras(db, PAGAMENTOS_PROXIMOS_DIAS);
  const vencendoHoje = proximas.filter((mov) => getDataVencimento(mov) === hoje);
  const proximosSeteDias = proximas.filter((mov) => getDataVencimento(mov) !== hoje);
  const pagas = despesas.filter((mov) => isMovimentacaoPaga(mov));

  const jaClassificadasIds = new Set([...vencidas, ...proximas, ...pagas].map((mov) => mov.id));
  const previstas = despesas.filter((mov) => !isMovimentacaoPaga(mov) && !jaClassificadasIds.has(mov.id));

  return { vencidas, vencendoHoje, proximosSeteDias, previstas, pagas };
}

export default function FinanceiroPage({ db, setDb, navigationIntent = null, fazendaSelecionada = null }) {
  const { hasPermission, session } = useAuth();
  const { showToast } = useToast();
  const abrirLancamentoPorIntent = navigationIntent?.page === 'financeiro' && navigationIntent?.action === 'novo';
  const [tab, setTab] = useState('dre');
  const [detailLoteId, setDetailLoteId] = useState(null);
  const [openLanc, setOpenLanc] = useState(abrirLancamentoPorIntent);
  const [filters, setFilters] = useState({ tipo: 'todos', cat: 'todas', lote: 'todos' });
  const [novoPagamento, setNovoPagamento] = useState({ descricao: '', valor: '', data_vencimento: getTodayIso(), metodo: 'Pix', pago: false, observacao: '' });

  const lotes = useMemo(() => (Array.isArray(db?.lotes) ? db.lotes : []), [db]);
  const movimentacoes = useMemo(
    () => (Array.isArray(db?.movimentacoes_financeiras) ? db.movimentacoes_financeiras : []),
    [db]
  );
  const consolidado = isModoConsolidado(fazendaSelecionada);
  const fazendasMap = useMemo(() => construirMapaFazendas(db), [db]);
  const podeEditarFinanceiroUi = hasPermission('financeiro:editar');

  function podeEditarFinanceiro() {
    if (hasPermission('financeiro:editar')) return true;
    showToast({ type: 'error', message: 'Você não tem permissão para executar esta ação.' });
    return false;
  }

  const movFinMapByLote = useMemo(() => {
    const map = new Map();
    movimentacoes.forEach((item) => {
      if (!item?.lote_id) {
        return;
      }
      if (!map.has(item.lote_id)) {
        map.set(item.lote_id, []);
      }
      map.get(item.lote_id).push(item);
    });
    return map;
  }, [movimentacoes]);

  const lotesRows = useMemo(() => (
    lotes.map((lote) => {
      const resumo = getResumoLote(db, lote.id);
      const movs = movFinMapByLote.get(lote.id) || [];
      const deducoes = movs
        .filter((mov) => mov.tipo === 'despesa' && ['Frete', 'Comissao'].includes(mov.categoria))
        .reduce((sum, mov) => sum + Number(mov.valor || 0), 0);
      const receitaLiquida = resumo.receitaTotal - deducoes;
      const custoTotal = resumo.custoTotal;
      const lucroTotal = receitaLiquida - custoTotal;

      return {
        lote,
        status: lote.status,
        fazendaNome: fazendasMap.get(Number(lote.faz_id ?? lote.fazenda_id)) || 'Sem fazenda',
        custoTotal,
        receitaTotal: resumo.receitaTotal,
        lucroTotal,
        margemPct: receitaLiquida ? (lucroTotal / receitaLiquida) * 100 : 0,
        lucroPorCabeca: resumo.totalAnimais ? lucroTotal / resumo.totalAnimais : 0,
        lucroPorArroba: resumo.arrobasCarcaca ? lucroTotal / resumo.arrobasCarcaca : 0,
        custoPorCabecaDia: custoTotal / Math.max(resumo.totalAnimais, 1) / Math.max(resumo.dias, 1),
        deducoes,
      };
    })
  ), [db, lotes, movFinMapByLote, fazendasMap]);

  const detalhe = useMemo(
    () => lotesRows.find((row) => Number(row.lote.id) === Number(detailLoteId)) || null,
    [detailLoteId, lotesRows]
  );

  const detalheCustosCat = useMemo(() => {
    if (!detalhe?.lote?.id) {
      return [];
    }

    const grouped = (movFinMapByLote.get(detalhe.lote.id) || [])
      .filter((mov) => mov.tipo === 'despesa')
      .reduce((acc, mov) => {
      const categoria = mov?.categoria || 'outros';
      acc[categoria] = (acc[categoria] || 0) + Number(mov?.valor || 0);
      return acc;
    }, {});

    return Object.entries(grouped).map(([name, value]) => ({ name, value }));
  }, [detalhe, movFinMapByLote]);

  const detalheTimeline = useMemo(
    () => (detalhe?.lote?.id ? buildFinanceTimeline(db, detalhe.lote.id) : []),
    [db, detalhe]
  );

  const lancamentos = useMemo(() => (
    movimentacoes
      .filter((item) => {
        if (filters.tipo !== 'todos' && item.tipo !== filters.tipo) return false;
        if (filters.cat !== 'todas' && item.categoria !== filters.cat) return false;
        if (filters.lote !== 'todos' && Number(item.lote_id) !== Number(filters.lote)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.data) - new Date(a.data))
  ), [filters, movimentacoes]);

  const dre = useMemo(() => computeDRE(db, lotesRows), [db, lotesRows]);

  // Exportação do DRE (Sprint 19) — mesmos números já calculados por
  // `computeDRE` acima, sem recalcular nem alterar regra de caixa/competência.
  const linhasExportacaoDre = useMemo(() => {
    const linhas = [
      { tipo: 'Resumo geral', label: 'Total', receita: dre.receita, despesa: dre.despesa, saldo: dre.resultado },
      ...dre.mensal.map((item) => ({
        tipo: 'Mensal',
        label: item.mes,
        receita: item.receita,
        despesa: item.despesa,
        saldo: item.receita - item.despesa,
      })),
      ...Object.entries(dre.despesaPorCategoria).map(([categoria, valor]) => ({
        tipo: 'Despesa por categoria',
        label: categoria,
        receita: null,
        despesa: valor,
        saldo: null,
      })),
    ];
    return linhas;
  }, [dre]);

  const colunasExportacaoDre = [
    { key: 'tipo', label: 'Tipo' },
    { key: 'label', label: 'Referência' },
    { key: 'receita', label: 'Receita', accessor: (l) => (l.receita == null ? '' : formatarMoedaExportacao(l.receita)) },
    { key: 'despesa', label: 'Despesa', accessor: (l) => (l.despesa == null ? '' : formatarMoedaExportacao(l.despesa)) },
    { key: 'saldo', label: 'Saldo/Lucro-Prejuízo', accessor: (l) => (l.saldo == null ? '' : formatarMoedaExportacao(l.saldo)) },
  ];

  function exportarDreCsv() {
    baixarCsv({
      colunas: colunasExportacaoDre,
      linhas: linhasExportacaoDre,
      nomeArquivo: montarNomeArquivo({ prefixo: 'dre' }),
    });
  }

  function imprimirDre() {
    abrirRelatorioParaImpressao({
      titulo: 'DRE — Demonstrativo de Resultado',
      subtitulo: 'Resumo geral, evolução mensal e despesas por categoria (todos os lançamentos).',
      colunas: colunasExportacaoDre,
      linhas: linhasExportacaoDre,
      metadados: {
        'Receita total': formatarMoedaExportacao(dre.receita),
        'Despesa total': formatarMoedaExportacao(dre.despesa),
        Resultado: formatarMoedaExportacao(dre.resultado),
      },
    });
  }

  const margemBars = useMemo(() => {
    const ordered = lotesRows.slice().sort((a, b) => b.margemPct - a.margemPct);
    return ordered.map((row, index) => ({
      nome: row.lote.nome,
      margemPct: row.margemPct,
      benchmark: index === 0 ? 100 : (row.margemPct / Math.max(ordered[0]?.margemPct || 1, 1)) * 100,
    }));
  }, [lotesRows]);


  const pagamentos = useMemo(() => (
    movimentacoes
      .filter((item) => item?.tipo === 'despesa' && (item?.categoria === 'Pagamento Diário' || item?.categoria === 'Pagamento Diario'))
      .sort((a, b) => new Date(a.data_vencimento || a.data || 0) - new Date(b.data_vencimento || b.data || 0))
  ), [movimentacoes]);

  const loteNomeById = useMemo(() => {
    const map = new Map();
    lotes.forEach((lote) => map.set(Number(lote.id), lote.nome));
    return map;
  }, [lotes]);

  const pagamentosVisaoGeral = useMemo(
    () => buildPagamentosVisaoGeral(db, getTodayIso()),
    [db]
  );

  async function salvarPagamentoDiario() {
    if (!podeEditarFinanceiro()) return;
    if (!novoPagamento.descricao.trim() || Number(novoPagamento.valor || 0) <= 0) {
      showToast({ type: 'warning', message: 'Informe descrição e valor válidos para o pagamento.' });
      return;
    }

    const pagoFlag = Boolean(novoPagamento.pago);
    const payload = {
      tipo: 'despesa',
      categoria: 'Pagamento Diário',
      descricao: novoPagamento.descricao.trim(),
      valor: Number(novoPagamento.valor || 0),
      data: novoPagamento.data_vencimento || getTodayIso(),
      data_competencia: novoPagamento.data_vencimento || getTodayIso(),
      data_vencimento: novoPagamento.data_vencimento || getTodayIso(),
      status: pagoFlag ? 'pago' : 'realizado',
      metodo_pagamento: novoPagamento.metodo,
      pago: pagoFlag,
      observacao: novoPagamento.observacao || null,
    };

    const persisted = await createOperationalRecord('movimentacoes_financeiras', payload, session);
    if (!persisted.persisted) {
      showToast({ type: 'warning', message: persisted.error || 'Não foi possível confirmar o lançamento agora.' });
      return;
    }
    setDb((prev) => ({
      ...prev,
      movimentacoes_financeiras: [...(prev.movimentacoes_financeiras || []), persisted.data || { id: gerarNovoId(prev.movimentacoes_financeiras || []), ...payload }],
    }));
    setNovoPagamento({ descricao: '', valor: '', data_vencimento: getTodayIso(), metodo: 'Pix', pago: false, observacao: '' });
    showToast({ type: 'success', message: 'Pagamento diário registrado.' });
  }

  async function alternarPagamentoPago(item) {
    if (!podeEditarFinanceiro()) return;
    const patch = { pago: !item?.pago };
    const persisted = await updateOperationalRecord('movimentacoes_financeiras', item.id, patch, session);
    if (!persisted.persisted) {
      showToast({ type: 'warning', message: persisted.error || 'Não foi possível confirmar a alteração agora.' });
      return;
    }
    setDb((prev) => ({
      ...prev,
      movimentacoes_financeiras: (prev.movimentacoes_financeiras || []).map((row) => row.id === item.id ? { ...row, ...(persisted.data || patch) } : row),
    }));
  }

  // Marca qualquer conta da Visão Geral de Pagamentos como paga, registrando a
  // data de pagamento — mesmo padrão de `alternarPagamentoPago`, só que
  // disponível para qualquer despesa (não só as da categoria "Pagamento Diário").
  async function marcarComoPago(item) {
    if (!podeEditarFinanceiro()) return;
    const patch = { status: 'pago', pago: true, data_pagamento: getTodayIso() };
    const persisted = await updateOperationalRecord('movimentacoes_financeiras', item.id, patch, session);
    if (!persisted.persisted) {
      showToast({ type: 'warning', message: persisted.error || 'Não foi possível confirmar o pagamento agora.' });
      return;
    }
    setDb((prev) => ({
      ...prev,
      movimentacoes_financeiras: (prev.movimentacoes_financeiras || []).map((row) => row.id === item.id ? { ...row, ...(persisted.data || patch) } : row),
    }));
    showToast({ type: 'success', message: 'Pagamento confirmado.' });
  }

  if (detalhe) {
    return (
      <div className="page rebanho-page">
        <Button variant="ghost" onClick={() => setDetailLoteId(null)}>← Voltar</Button>
        <PageHeader
          title={`Financeiro — ${detalhe.lote.nome}`}
          subtitle="Resultado detalhado do lote selecionado."
        />

        <Card title="Resultado detalhado">
          <div className="metrics-2col">
            <p>Custo de aquisição: <strong>{formatCurrency(detalhe.lote.investimento || 0)}</strong></p>
            <p>Custo de alimentação: <strong>{formatCurrency(findCategoryValue(detalheCustosCat, ['alimentacao', 'alimentaçao', 'alimentação']))}</strong></p>
            <p>Custo sanitário: <strong>{formatCurrency(findCategoryValue(detalheCustosCat, ['sanitario', 'sanitário']))}</strong></p>
            <p>Outros custos: <strong>{formatCurrency(sumOtherCategories(detalheCustosCat, ['alimentacao', 'alimentaçao', 'alimentação', 'sanitario', 'sanitário']))}</strong></p>
            <p><strong>Custo total: {formatCurrency(detalhe.custoTotal)}</strong></p>
            <p>Receita bruta: <strong>{formatCurrency(detalhe.receitaTotal)}</strong></p>
            <p>Deduções: <strong>{formatCurrency(detalhe.deducoes)}</strong></p>
            <p><strong>Receita líquida: {formatCurrency(detalhe.receitaTotal - detalhe.deducoes)}</strong></p>
            <p className={detalhe.lucroTotal >= 0 ? 'text-success' : 'text-danger'}><strong>Lucro/prejuízo: {formatCurrency(detalhe.lucroTotal)}</strong></p>
            <p>Margem: <strong>{formatNumber(detalhe.margemPct, 2)}%</strong></p>
            <p>Lucro por cabeça: <strong>{formatCurrency(detalhe.lucroPorCabeca)}</strong></p>
            <p>Lucro/@ carcaça: <strong>{formatCurrency(detalhe.lucroPorArroba)}</strong></p>
            <p>Custo por cabeca/dia: <strong>{formatCurrency(detalhe.custoPorCabecaDia)}</strong></p>
          </div>
        </Card>

        <div className="dashboard-grid dashboard-grid--dual">
          <Card title="Distribuição de custos">
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={detalheCustosCat} dataKey="value" nameKey="name" outerRadius={80} fill="#8884d8" />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Custo acumulado x receita">
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={detalheTimeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis formatter={(value) => formatCurrency(value)} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Line type="monotone" dataKey="custo" stroke="#c53030" />
                  <Line type="monotone" dataKey="receita" stroke="#1b4332" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="page rebanho-page financeiro-page">
      <div className="rebanho-header financeiro-header">
        <div>
          <h1>Movimentações Financeiras</h1>
          <p className="financeiro-subtitle">Lance custos e receitas para entender o resultado dos lotes.</p>
        </div>
        <div className="lote-actions">
          <Button variant="outline" onClick={() => { if (!podeEditarFinanceiro()) return; setOpenLanc(true); }}>Nova receita</Button>
          <Button variant="outline" onClick={() => { if (!podeEditarFinanceiro()) return; setOpenLanc(true); }}>Nova despesa</Button>
          <Button onClick={() => {
            if (!podeEditarFinanceiro()) return;
            setOpenLanc(true);
          }}
          >
            Registrar movimentação
          </Button>
        </div>
      </div>

      <div className="tab-buttons financeiro-tabs">
        {tabs.map((item) => (
          <Button key={item} className={`financeiro-tab-btn ${tab === item ? 'is-active' : ''}`} variant={tab === item ? 'primary' : 'ghost'} onClick={() => setTab(item)}>
            {TAB_LABELS[item]}
          </Button>
        ))}
      </div>

      {tab === 'dre' ? (
        <>
          <ExportActions
            disabled={linhasExportacaoDre.length === 0}
            onExportCsv={exportarDreCsv}
            onPrint={imprimirDre}
          />

          <div className="dashboard-grid dashboard-grid--kpi-main">
            <Card title="Receita total" className="kpi-panel kpi-panel--success">
              <strong>{formatCurrency(dre.receita)}</strong>
            </Card>
            <Card title="Despesa total" className="kpi-panel kpi-panel--danger">
              <strong>{formatCurrency(dre.despesa)}</strong>
            </Card>
            <Card title="Resultado" className={`kpi-panel ${dre.resultado >= 0 ? 'kpi-panel--success' : 'kpi-panel--danger'}`}>
              <strong>{formatCurrency(dre.resultado)}</strong>
            </Card>
          </div>

          <div className="dashboard-grid dashboard-grid--dual">
            <Card title="DRE mensal">
              {dre.mensal.length === 0 ? (
                <EmptyState
                  compact
                  title="Sem dados suficientes para gerar o gráfico."
                  subtitle="Cadastre receitas e despesas para visualizar a análise."
                />
              ) : (
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={dre.mensal}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mes" />
                      <YAxis formatter={(value) => formatCurrency(value)} />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Bar dataKey="receita" fill="#1b4332" name="Receita" />
                      <Bar dataKey="despesa" fill="#c53030" name="Despesa" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card title="Distribuição de despesas">
              {Object.keys(dre.despesaPorCategoria).length === 0 ? (
                <EmptyState
                  compact
                  title="Sem dados suficientes para gerar o gráfico."
                  subtitle="Cadastre receitas e despesas para visualizar a análise."
                />
              ) : (
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={Object.entries(dre.despesaPorCategoria).map(([name, value]) => ({ name, value }))}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={80}
                        fill="#8884d8"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>
        </>
      ) : null}

      {tab === 'lote' ? (
        <>
          <Card title="Resultado por lote">
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Lote</th>
                    {consolidado ? <th>Fazenda</th> : null}
                    <th>Status</th>
                    <th>Custo total</th>
                    <th>Receita</th>
                    <th>Lucro</th>
                    <th>Margem (%)</th>
                    <th>Lucro/cab</th>
                    <th>Lucro/@ carcaça</th>
                    <th>Custo/cab/dia</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {lotesRows.length === 0 ? (
                    <tr>
                      <td colSpan={consolidado ? 11 : 10} className="empty-state-td">Nenhum lote disponível para análise financeira.</td>
                    </tr>
                  ) : (
                    lotesRows.map((row) => (
                      <tr key={row.lote.id}>
                        <td>{row.lote.nome}</td>
                        {consolidado ? <td>{row.fazendaNome}</td> : null}
                        <td><Badge variant={row.status === 'ativo' ? 'info' : 'neutral'}>{row.status}</Badge></td>
                        <td>{formatCurrency(row.custoTotal)}</td>
                        <td>{formatCurrency(row.receitaTotal)}</td>
                        <td className={row.lucroTotal >= 0 ? 'text-success' : 'text-danger'}>{formatCurrency(row.lucroTotal)}</td>
                        <td>{formatNumber(row.margemPct, 2)}%</td>
                        <td>{formatCurrency(row.lucroPorCabeca)}</td>
                        <td>{formatCurrency(row.lucroPorArroba)}</td>
                        <td>{formatCurrency(row.custoPorCabecaDia)}</td>
                        <td><Button size="sm" onClick={() => setDetailLoteId(row.lote.id)}>Detalhes</Button></td>
                      </tr>
                    ))
                  )}
                </tbody>
                {lotesRows.length ? (
                  <tfoot>
                    <tr>
                      <td>Total</td>
                      {consolidado ? <td>-</td> : null}
                      <td>-</td>
                      <td>{formatCurrency(lotesRows.reduce((sum, row) => sum + row.custoTotal, 0))}</td>
                      <td>{formatCurrency(lotesRows.reduce((sum, row) => sum + row.receitaTotal, 0))}</td>
                      <td>{formatCurrency(lotesRows.reduce((sum, row) => sum + row.lucroTotal, 0))}</td>
                      <td>-</td>
                      <td>-</td>
                      <td>-</td>
                      <td>-</td>
                      <td>-</td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          </Card>

          <Card title="Margem por lote">
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={margemBars}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome" />
                  <YAxis formatter={(value) => `${value}%`} />
                  <Tooltip formatter={(value) => `${formatNumber(value, 2)}%`} />
                  <Bar dataKey="margemPct" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      ) : null}


      {tab === 'pag' ? (
        <>
          <PagamentosAlerta visaoGeral={pagamentosVisaoGeral} />

          <PagamentosBucket
            titulo="Contas vencidas"
            statusLabel="Vencida"
            variant="danger"
            itens={pagamentosVisaoGeral.vencidas}
            loteNomeById={loteNomeById}
            vazio="Nenhuma conta vencida."
            vazioSubtitle="Tudo em dia por aqui."
            onMarcarPago={marcarComoPago}
            podeEditar={podeEditarFinanceiroUi}
          />
          <PagamentosBucket
            titulo="Vencendo hoje"
            statusLabel="Hoje"
            variant="warning"
            itens={pagamentosVisaoGeral.vencendoHoje}
            loteNomeById={loteNomeById}
            vazio="Nenhuma conta vence hoje."
            onMarcarPago={marcarComoPago}
            podeEditar={podeEditarFinanceiroUi}
          />
          <PagamentosBucket
            titulo="Vencendo nos próximos 7 dias"
            statusLabel="Em breve"
            variant="info"
            itens={pagamentosVisaoGeral.proximosSeteDias}
            loteNomeById={loteNomeById}
            vazio="Nenhuma conta vencendo nos próximos 7 dias."
            onMarcarPago={marcarComoPago}
            podeEditar={podeEditarFinanceiroUi}
          />
          <PagamentosBucket
            titulo="Previstas / pendentes"
            statusLabel="Prevista"
            variant="neutral"
            itens={pagamentosVisaoGeral.previstas}
            loteNomeById={loteNomeById}
            vazio="Nenhuma conta prevista sem data próxima."
            onMarcarPago={marcarComoPago}
            podeEditar={podeEditarFinanceiroUi}
          />
          <PagamentosBucket
            titulo="Pagas"
            statusLabel="Paga"
            variant="success"
            itens={pagamentosVisaoGeral.pagas}
            loteNomeById={loteNomeById}
            vazio="Nenhuma conta paga registrada ainda."
          />

          <Card title="Pagamentos Diários" subtitle="Registre e acompanhe pagamentos do dia a dia da fazenda.">
            <div className="form-grid two">
              <Input label="Descrição do pagamento" value={novoPagamento.descricao} onChange={(e) => setNovoPagamento((p) => ({ ...p, descricao: e.target.value }))} />
              <Input label="Valor" type="number" value={novoPagamento.valor} onChange={(e) => setNovoPagamento((p) => ({ ...p, valor: e.target.value }))} />
              <Input label="Data de vencimento" type="date" value={novoPagamento.data_vencimento} onChange={(e) => setNovoPagamento((p) => ({ ...p, data_vencimento: e.target.value }))} />
              <label className="ui-input-wrap"><span className="ui-input-label">Modalidade de pagamento</span><select className="ui-input" value={novoPagamento.metodo} onChange={(e) => setNovoPagamento((p) => ({ ...p, metodo: e.target.value }))}>{metodosPagamento.map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
              <label className="ui-input-wrap"><span className="ui-input-label">Status</span><select className="ui-input" value={novoPagamento.pago ? 'pago' : 'nao_pago'} onChange={(e) => setNovoPagamento((p) => ({ ...p, pago: e.target.value === 'pago' }))}><option value="nao_pago">Não pago</option><option value="pago">Pago</option></select></label>
              <Input label="Observação (opcional)" value={novoPagamento.observacao} onChange={(e) => setNovoPagamento((p) => ({ ...p, observacao: e.target.value }))} />
            </div>
            <div style={{ marginTop: 12 }}>
              <Button onClick={salvarPagamentoDiario} disabled={!podeEditarFinanceiroUi}>Salvar pagamento diário</Button>
              {!podeEditarFinanceiroUi ? <small style={{ display: 'block', marginTop: 6 }}>Acesso restrito ao perfil autorizado.</small> : null}
            </div>
          </Card>

          <Card title="Lista de pagamentos" subtitle="Marque rapidamente os pagamentos já realizados.">
            <div className="table-responsive">
              <table className="data-table">
                <thead><tr><th>Pago</th><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Método</th><th>Status</th><th>Obs</th></tr></thead>
                <tbody>
                  {pagamentos.length === 0 ? <tr><td colSpan="7" className="empty-state-td">Nenhum pagamento pendente</td></tr> : pagamentos.map((item) => (
                    <tr key={item.id}>
                      <td><input type="checkbox" disabled={!podeEditarFinanceiroUi} checked={Boolean(item.pago)} onChange={() => alternarPagamentoPago(item)} /></td>
                      <td>{item.descricao || '-'}</td>
                      <td>{formatCurrency(item.valor || 0)}</td>
                      <td>{formatDate(item.data_vencimento || item.data)}</td>
                      <td>{item.metodo_pagamento || 'Outro'}</td>
                      <td><Badge variant={item.pago ? 'success' : 'warning'}>{item.pago ? 'Pago' : 'Não pago'}</Badge></td>
                      <td>{item.observacao || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}

      {tab === 'lanc' ? (
        <>
          <Card>
            <div className="rebanho-filters">
              <label className="ui-input-wrap">
                <span className="ui-input-label">Tipo</span>
                <select className="ui-input" value={filters.tipo} onChange={(event) => setFilters((prev) => ({ ...prev, tipo: event.target.value, cat: 'todas' }))}>
                  <option value="todos">Todos</option>
                  <option value="receita">Receita</option>
                  <option value="despesa">Despesa</option>
                </select>
              </label>

              <label className="ui-input-wrap">
                <span className="ui-input-label">Categoria</span>
                <select className="ui-input" value={filters.cat} onChange={(event) => setFilters((prev) => ({ ...prev, cat: event.target.value }))}>
                  <option value="todas">Todas</option>
                  {(filters.tipo === 'receita' ? recCats : despCats).map((categoria) => (
                    <option key={categoria} value={categoria}>{categoria}</option>
                  ))}
                </select>
              </label>

              <label className="ui-input-wrap">
                <span className="ui-input-label">Lote</span>
                <select className="ui-input" value={filters.lote} onChange={(event) => setFilters((prev) => ({ ...prev, lote: event.target.value }))}>
                  <option value="todos">Todos</option>
                  {lotes.map((lote) => (
                    <option key={lote.id} value={lote.id}>{lote.nome}</option>
                  ))}
                </select>
              </label>
            </div>
          </Card>

          <Card title="Lançamentos">
            <div className="alerts-list">
              {lancamentos.length === 0 ? (
                <EmptyState
                  title="Você ainda não lançou nenhuma movimentação financeira."
                  subtitle="Registre receitas e despesas para acompanhar o resultado da operação."
                  action={
                    <Button
                      size="sm"
                      onClick={() => {
                        if (!podeEditarFinanceiro()) return;
                        setOpenLanc(true);
                      }}
                    >
                      Registrar movimentação
                    </Button>
                  }
                />
              ) : (
                lancamentos.map((item) => (
                  <div key={item.id} className="alert-item">
                    <Badge variant={item.tipo === 'receita' ? 'success' : 'danger'}>{item.tipo}</Badge>
                    <div>
                      <strong>{item.categoria}</strong>
                      <p>{formatDate(item.data)} · {formatCurrency(item.valor)} · {item.fornecedor || item.comprador || '-'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </>
      ) : null}

      {openLanc ? <NovoLancamentoModal db={db} setDb={setDb} onClose={() => setOpenLanc(false)} hasPermission={hasPermission} showToast={showToast} session={session} /> : null}
    </div>
  );
}

function NovoLancamentoModal({ db, setDb, onClose, hasPermission, showToast, session }) {
  const [form, setForm] = useState({
    tipo: 'despesa',
    categoria: despCats[0],
    valor: '',
    data: getTodayIso(),
    lote_id: '',
    pessoa: '',
    nf: '',
    obs: '',
    parcelado: false,
    parcelas: 1,
  });

  const categorias = form.tipo === 'despesa' ? despCats : recCats;

  async function submit() {
    if (!hasPermission('financeiro:editar')) {
      showToast({ type: 'error', message: 'Você não tem permissão para executar esta ação.' });
      return;
    }
    if (!form.valor || !form.data) {
      alert('Valor e data são obrigatórios.');
      return;
    }

    const totalParcelas = Math.max(Number(form.parcelas || 1), 1);
    const valorParcela = Number(form.valor) / totalParcelas;
    const baseId = gerarNovoId(db.movimentacoes_financeiras || []);
    const novos = Array.from({ length: totalParcelas }, (_, index) => {
      const dataBase = new Date(form.data);
      dataBase.setMonth(dataBase.getMonth() + index);

      return {
        id: baseId + index,
        tipo: form.tipo,
        categoria: form.categoria,
        valor: valorParcela,
        data: dataBase.toISOString().slice(0, 10),
        lote_id: form.lote_id ? Number(form.lote_id) : null,
        fornecedor: form.tipo === 'despesa' ? form.pessoa : '',
        comprador: form.tipo === 'receita' ? form.pessoa : '',
        // `movimentacoes_financeiras` não tem coluna `nota_fiscal` — guardamos
        // o número informado dentro de `observacao` para não perder o dado
        // (enviar `nota_fiscal` direto quebrava o salvamento com 400/PGRST204).
        observacao: [form.obs, form.nf ? `NF: ${form.nf}` : null].filter(Boolean).join(' · '),
      };
    });

    const persistedRows = await Promise.all(
      novos.map((item) => createOperationalRecord('movimentacoes_financeiras', item, session))
    );

    if (persistedRows.some((item) => !item.persisted)) {
      showToast({ type: 'warning', message: 'Não foi possível confirmar o lançamento agora.' });
      return;
    }

    setDb((prev) => ({
      ...prev,
      movimentacoes_financeiras: [
        ...(prev.movimentacoes_financeiras || []),
        ...persistedRows.map((item, index) => item.data || novos[index]),
      ],
    }));
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Novo lançamento financeiro" size="lg" footer={<Button onClick={submit}>Salvar lançamento</Button>}>
      <div className="form-grid two">
        <label className="ui-input-wrap">
          <span className="ui-input-label">Tipo</span>
          <select
            className="ui-input"
            value={form.tipo}
            onChange={(event) => setForm((prev) => ({
              ...prev,
              tipo: event.target.value,
              categoria: event.target.value === 'despesa' ? despCats[0] : recCats[0],
            }))}
          >
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
          </select>
        </label>

        <label className="ui-input-wrap">
          <span className="ui-input-label">Categoria</span>
          <select className="ui-input" value={form.categoria} onChange={(event) => setForm((prev) => ({ ...prev, categoria: event.target.value }))}>
            {categorias.map((categoria) => (
              <option key={categoria} value={categoria}>{categoria}</option>
            ))}
          </select>
        </label>

        <Input label="Valor" type="number" value={form.valor} onChange={(event) => setForm((prev) => ({ ...prev, valor: event.target.value }))} />
        <Input label="Data" type="date" value={form.data} onChange={(event) => setForm((prev) => ({ ...prev, data: event.target.value }))} />

        <label className="ui-input-wrap">
          <span className="ui-input-label">Lote</span>
          <select className="ui-input" value={form.lote_id} onChange={(event) => setForm((prev) => ({ ...prev, lote_id: event.target.value }))}>
            <option value="">Opcional</option>
            {(db.lotes || []).map((lote) => (
              <option key={lote.id} value={lote.id}>{lote.nome}</option>
            ))}
          </select>
        </label>

        <Input label={form.tipo === 'despesa' ? 'Fornecedor' : 'Comprador'} value={form.pessoa} onChange={(event) => setForm((prev) => ({ ...prev, pessoa: event.target.value }))} />
        <Input label="Nota fiscal" value={form.nf} onChange={(event) => setForm((prev) => ({ ...prev, nf: event.target.value }))} />
        <Input label="Observações" value={form.obs} onChange={(event) => setForm((prev) => ({ ...prev, obs: event.target.value }))} />

        <label className="ui-input-wrap">
          <span className="ui-input-label">Parcelado?</span>
          <select className="ui-input" value={form.parcelado ? 'sim' : 'nao'} onChange={(event) => setForm((prev) => ({ ...prev, parcelado: event.target.value === 'sim' }))}>
            <option value="nao">Não</option>
            <option value="sim">Sim</option>
          </select>
        </label>

        {form.parcelado ? (
          <Input label="Número de parcelas" type="number" value={form.parcelas} onChange={(event) => setForm((prev) => ({ ...prev, parcelas: event.target.value }))} />
        ) : null}
      </div>
    </Modal>
  );
}

function computeDRE(db, lotesRows) {
  const movimentacoes = Array.isArray(db?.movimentacoes_financeiras) ? db.movimentacoes_financeiras : [];
  const receitaLotes = lotesRows.reduce((sum, row) => sum + row.receitaTotal, 0);
  const despesaLotes = lotesRows.reduce((sum, row) => sum + row.custoTotal, 0);
  const despesasGerais = movimentacoes.filter((item) => item.tipo === 'despesa' && !item.lote_id).reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const receitasGerais = movimentacoes.filter((item) => item.tipo === 'receita' && !item.lote_id).reduce((sum, item) => sum + Number(item.valor || 0), 0);

  const mensalMap = {};
  movimentacoes.forEach((item) => {
    const mes = String(item.data || '').slice(0, 7);
    if (!mes) {
      return;
    }
    if (!mensalMap[mes]) {
      mensalMap[mes] = { mes, receita: 0, despesa: 0 };
    }
    mensalMap[mes][item.tipo === 'receita' ? 'receita' : 'despesa'] += Number(item.valor || 0);
  });

  const despesaPorCategoria = {};
  movimentacoes
    .filter((item) => item.tipo === 'despesa')
    .forEach((item) => {
      const categoria = item.categoria || 'Outro';
      despesaPorCategoria[categoria] = (despesaPorCategoria[categoria] || 0) + Number(item.valor || 0);
    });

  return {
    receita: receitaLotes + receitasGerais,
    despesa: despesaLotes + despesasGerais,
    resultado: receitaLotes + receitasGerais - despesaLotes - despesasGerais,
    mensal: Object.values(mensalMap).sort((a, b) => a.mes.localeCompare(b.mes)),
    despesaPorCategoria,
  };
}

function buildFinanceTimeline(db, loteId) {
  const timeline = (db.movimentacoes_financeiras || [])
    .filter((item) => Number(item.lote_id) === Number(loteId))
    .map((item) => ({
      data: item.data,
      tipo: item.tipo === 'despesa' ? 'custo' : 'receita',
      valor: Number(item.valor || 0),
    }))
    .sort((a, b) => new Date(a.data) - new Date(b.data));
  let acumuladoCusto = 0;
  let acumuladoReceita = 0;

  return timeline.map((item) => {
    if (item.tipo === 'custo') {
      acumuladoCusto += item.valor;
    } else {
      acumuladoReceita += item.valor;
    }

    return {
      label: formatDate(item.data),
      custo: acumuladoCusto,
      receita: acumuladoReceita,
    };
  });
}

function PagamentosBucket({
  titulo,
  statusLabel,
  variant,
  itens,
  loteNomeById,
  vazio,
  vazioSubtitle,
  onMarcarPago,
  podeEditar = false,
}) {
  return (
    <div className={`pagamentos-bucket pagamentos-bucket--${variant}`}>
      <Card title={`${titulo} (${itens.length})`}>
        {itens.length === 0 ? (
          <EmptyState compact title={vazio} subtitle={vazioSubtitle} />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Fornecedor</th>
                  <th>Lote</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Situação</th>
                  {onMarcarPago ? <th>Ação</th> : null}
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => (
                  <tr key={item.id}>
                    <td>{item.descricao || item.categoria || 'Despesa'}</td>
                    <td>{item.fornecedor || '-'}</td>
                    <td>{item.lote_id ? (loteNomeById.get(Number(item.lote_id)) || `Lote ${item.lote_id}`) : '-'}</td>
                    <td>{formatDate(item.data_vencimento || item.data)}</td>
                    <td>{formatCurrency(item.valor || 0)}</td>
                    <td><Badge variant={variant}>{statusLabel}</Badge></td>
                    {onMarcarPago ? (
                      <td>
                        <Button size="sm" disabled={!podeEditar} onClick={() => onMarcarPago(item)}>Marcar como pago</Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/**
 * Alerta financeiro interno — só resume, dentro da própria área financeira, as
 * contagens já calculadas em `pagamentosVisaoGeral` (mesmos dados dos blocos
 * abaixo). Não é um sistema de alerta novo nem paralelo: nenhuma severidade,
 * id ou persistência própria — reaproveita as mesmas listas exibidas na tela.
 */
function PagamentosAlerta({ visaoGeral }) {
  const totalVencidas = visaoGeral.vencidas.length;
  const totalHoje = visaoGeral.vencendoHoje.length;
  const totalProximos = visaoGeral.proximosSeteDias.length;
  const semUrgencia = totalVencidas === 0 && totalHoje === 0 && totalProximos === 0;

  if (semUrgencia) {
    return (
      <div className="pagamentos-alerta pagamentos-alerta--ok">
        ✓ Nenhuma conta vencida ou vencendo nos próximos 7 dias.
      </div>
    );
  }

  return (
    <div className="pagamentos-alerta">
      {totalVencidas > 0 ? (
        <Badge variant="danger">{totalVencidas} conta{totalVencidas > 1 ? 's' : ''} vencida{totalVencidas > 1 ? 's' : ''}</Badge>
      ) : null}
      {totalHoje > 0 ? (
        <Badge variant="warning">{totalHoje} vencendo hoje</Badge>
      ) : null}
      {totalProximos > 0 ? (
        <Badge variant="info">{totalProximos} vencendo em até 7 dias</Badge>
      ) : null}
    </div>
  );
}

function findCategoryValue(items, aliases) {
  const aliasSet = new Set(aliases.map((alias) => alias.toLowerCase()));
  const found = items.find((item) => aliasSet.has(String(item.name || '').toLowerCase()));
  return found?.value || 0;
}

function sumOtherCategories(items, excludedAliases) {
  const aliasSet = new Set(excludedAliases.map((alias) => alias.toLowerCase()));
  return items
    .filter((item) => !aliasSet.has(String(item.name || '').toLowerCase()))
    .reduce((sum, item) => sum + Number(item.value || 0), 0);
}
