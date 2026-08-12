import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, FileText, Plus } from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import EmptyState from '../components/EmptyState';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import ExportActions from '../components/ExportActions';
import { formatCurrency, formatDate, formatNumber } from '../utils/calculations';
import { exportarCsvCompatExcel, exportarExcelXmlCompat } from '../utils/exportadores';
import { gerarNovoId } from '../utils/id';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../auth/useAuth';
import { createOperationalRecord, updateOperationalRecord } from '../services/operationalPersistence';
import { formatarDataExportacao, montarNomeArquivo } from '../domain/exportacaoRelatorios';
import { baixarCsv, abrirRelatorioParaImpressao } from '../utils/exportacaoArquivos';
import { calcularConsumoDiarioTotalPorProduto, calcularDiasRestantesEstoque } from '../domain/previsaoConsumoEstoque';
import { isModoConsolidado, construirMapaFazendas } from '../domain/escopoFazenda';
import { useSubmitOnce } from '../hooks/useSubmitOnce.js';
import { itemEhNutricao } from './estoqueLogic.js';
import '../styles/estoque.css';

const CATEGORIAS_ESTOQUE_GERAL = [
  'Medicamento',
  'Vacina',
  'Material',
  'Produto veterinário',
  'Insumo geral',
  'Outro',
];

// Sprint Visual 6: diferenciação visual por tipo de movimentação (mesmos
// tipos já gravados/filtrados, só ganham cor/badge consistente com o resto
// do sistema visual — nenhum tipo novo, nenhuma regra de saldo alterada).
const MOVIMENTACAO_TIPO_VARIANT = {
  entrada: 'success',
  saida: 'warning',
  ajuste: 'info',
  consumo: 'neutral',
  perda: 'danger',
  tratamento: 'info',
};

const FORM_CADASTRO_ITEM_VAZIO = {
  produto: '',
  categoria: CATEGORIAS_ESTOQUE_GERAL[0],
  unidade: 'kg',
  quantidade_inicial: '',
  quantidade_minima: '',
  custo_unitario: '',
  validade: '',
  fornecedor: '',
  obs: '',
};

function parseSafeNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  if (!normalized) return null;

  const commaCount = (normalized.match(/,/g) || []).length;
  const dotCount = (normalized.match(/\./g) || []).length;

  let numericText = normalized.replace(/\s+/g, '');

  if (commaCount > 0 && dotCount > 0) {
    numericText = numericText.replace(/\./g, '').replace(',', '.');
  } else if (commaCount > 0) {
    numericText = numericText.replace(',', '.');
  }

  const parsed = Number(numericText);
  return Number.isFinite(parsed) ? parsed : null;
}

function getCurrentItemStockBalance(item) {
  if (!item || typeof item !== 'object') return 0;

  const candidateKeys = [
    'saldo',
    'saldoAtual',
    'saldo_atual',
    'quantidade_atual',
    'quantidadeAtual',
    'estoque_atual',
    'estoqueAtual',
    'quantidade',
  ];

  for (const key of candidateKeys) {
    const parsed = parseSafeNumber(item[key]);
    if (parsed != null) return parsed;
  }

  return 0;
}

function getCadastroItemInicial(data) {
  if (!data) return FORM_CADASTRO_ITEM_VAZIO;

  const quantidadeAtual = getCurrentItemStockBalance(data);

  return {
    produto: data.produto || data.nome || '',
    categoria: data.categoria || CATEGORIAS_ESTOQUE_GERAL[0],
    unidade: data.unidade || 'kg',
    quantidade_inicial: quantidadeAtual || '',
    quantidade_minima: data.quantidade_minima ?? '',
    custo_unitario: data.valor_unitario ?? data.custo_unitario ?? data.preco_unitario ?? '',
    validade: data.data_validade || data.validade || '',
    fornecedor: data.fornecedor || '',
    obs: data.obs || data.observacoes || '',
  };
}


export default function EstoquePage({ db, setDb, onRegistrarSaidaEstoque, onRegistrarEntradaEstoque, navigationIntent = null, fazendaSelecionada = null }) {
  const { showToast } = useToast();
  const { hasPermission, session } = useAuth();
  const mensagemSemPermissao = 'Você não tem permissão para executar esta ação.';
  const abrirCadastroPorIntent = navigationIntent?.page === 'estoque' && navigationIntent?.action === 'novo';

  const [showOnlyCrit, setShowOnlyCrit] = useState(false);
  const [escopoEstoque, setEscopoEstoque] = useState('geral');
  const [openCadastroItem, setOpenCadastroItem] = useState(abrirCadastroPorIntent);
  const [openEntrada, setOpenEntrada] = useState(false);
  const [openSaida, setOpenSaida] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemEmEdicao, setItemEmEdicao] = useState(null);
  const [filters, setFilters] = useState({ item: 'todos', tipo: 'todos', lote: 'todos', periodo: 'todos' });

  const lotesMap = useMemo(() => new Map((db.lotes || []).map((l) => [l.id, l])), [db.lotes]);
  const estoqueMap = useMemo(() => new Map((db.estoque || []).map((i) => [i.id, i])), [db.estoque]);
  const consolidado = isModoConsolidado(fazendaSelecionada);
  const fazendasMap = useMemo(() => construirMapaFazendas(db), [db]);

  const itens = useMemo(() => {
    const base = (db.estoque || []).filter((item) => (
      escopoEstoque === 'todos'
        ? true
        : escopoEstoque === 'nutricao'
          ? itemEhNutricao(item)
          : !itemEhNutricao(item)
    ));

    return base.map((item) => {
      const hist = (db.movimentacoes_estoque || []).filter((m) => Number(m.item_estoque_id) === Number(item.id));
      const saldo = getCurrentItemStockBalance(item);
      const pico = Math.max(saldo, ...hist.map((h) => parseSafeNumber(h.quantidade) ?? 0));
      const ratio = pico ? (saldo / pico) * 100 : 0;
      const consumos = hist.filter((h) => ['consumo', 'saida'].includes(h.tipo));
      const mediaConsumo = consumos.length ? consumos.reduce((s, c) => s + (parseSafeNumber(c.quantidade) ?? 0), 0) / Math.max(consumos.length, 1) : 0;
      const diasRest = mediaConsumo > 0 ? saldo / mediaConsumo : 999;
      const status = ratio < 10 ? 'critico' : ratio < 20 ? 'baixo' : 'normal';

      // Sprint 25: cobertura pelo consumo diário PLANEJADO (nutrição por
      // lote, consumo_suplementacao) — sinal diferente do "Dias restantes"
      // acima (que usa a média histórica de saídas). Não substitui o
      // cálculo existente, só complementa quando há plano de consumo.
      const { consumoDiario } = calcularConsumoDiarioTotalPorProduto({
        produtoId: item.id,
        lotes: db.lotes || [],
        consumos: db.consumo_suplementacao || [],
      });
      const coberturaPlanejada = calcularDiasRestantesEstoque({ quantidadeAtual: saldo, consumoDiario });

      return {
        ...item,
        pico,
        saldo,
        ratio,
        mediaConsumo,
        diasRest,
        coberturaPlanejada,
        fazendaNome: fazendasMap.get(Number(item.fazenda_id)) || 'Sem fazenda',
        valorTotal: saldo * Number(item.valor_unitario || item.preco_unitario || 0),
        status,
      };
    });
  }, [db.estoque, db.movimentacoes_estoque, db.lotes, db.consumo_suplementacao, escopoEstoque, fazendasMap]);

  const itensView = useMemo(() => (showOnlyCrit ? itens.filter((i) => i.status !== 'normal') : itens), [itens, showOnlyCrit]);

  const resumo = useMemo(() => ({
    total: itens.length,
    criticos: itens.filter((i) => i.status !== 'normal').length,
    valorTotal: itens.reduce((s, i) => s + i.valorTotal, 0),
  }), [itens]);

  const movs = useMemo(() => (db.movimentacoes_estoque || []).filter((m) => {
    const itemMov = (db.estoque || []).find((item) => Number(item.id) === Number(m.item_estoque_id));
    if (escopoEstoque === 'nutricao' && !itemEhNutricao(itemMov)) return false;
    if (escopoEstoque === 'geral' && itemEhNutricao(itemMov)) return false;
    if (filters.item !== 'todos' && Number(m.item_estoque_id) !== Number(filters.item)) return false;
    if (filters.tipo !== 'todos' && m.tipo !== filters.tipo) return false;
    if (filters.lote !== 'todos' && Number(m.lote_id) !== Number(filters.lote)) return false;
    return true;
  }).sort((a, b) => new Date(b.data) - new Date(a.data)), [db.movimentacoes_estoque, db.estoque, escopoEstoque, filters]);

  function exportCsv() {
    const rows = movs.map((m) => ({
      data: m.data,
      item: estoqueMap.get(m.item_estoque_id)?.produto || '',
      tipo: m.tipo,
      quantidade: m.quantidade,
      lote: lotesMap.get(m.lote_id)?.nome || '',
      valor: m.valor_total || 0,
      observacao: m.obs || '',
    }));
    const columns = [
      { key: 'data', header: 'Data', type: 'date' },
      { key: 'item', header: 'Item' },
      { key: 'tipo', header: 'Tipo' },
      { key: 'quantidade', header: 'Quantidade', type: 'number' },
      { key: 'lote', header: 'Lote' },
      { key: 'valor', header: 'Valor', type: 'currency' },
      { key: 'observacao', header: 'Observação' },
    ];
    exportarCsvCompatExcel({ filename: 'movimentacoes-estoque', rows, columns });
    exportarExcelXmlCompat({ filename: 'movimentacoes-estoque', sheets: [{ name: 'Estoque', rows, columns }] });
  }

  // Exportação da lista de itens (Sprint 19) — separada da exportação de
  // movimentações acima; reflete `itensView` (já com o saldo atualizado pela
  // integração Sanidade→Estoque da Sprint 15, sem recalcular nada aqui).
  const STATUS_ESTOQUE_LABEL = { critico: 'Crítico', baixo: 'Baixo', normal: 'Normal' };
  const colunasExportacaoEstoque = [
    { key: 'item', label: 'Item', accessor: (item) => item.nome || item.produto || '' },
    { key: 'categoria', label: 'Categoria' },
    { key: 'unidade', label: 'Unidade', accessor: (item) => item.unidade || item.unidade_medida || '' },
    { key: 'saldo', label: 'Quantidade atual' },
    { key: 'quantidade_minima', label: 'Mínimo' },
    { key: 'validade', label: 'Validade', accessor: (item) => formatarDataExportacao(item.data_validade || item.validade) },
    { key: 'status', label: 'Status', accessor: (item) => STATUS_ESTOQUE_LABEL[item.status] || item.status },
  ];

  function exportarItensCsv() {
    baixarCsv({
      colunas: colunasExportacaoEstoque,
      linhas: itensView,
      nomeArquivo: montarNomeArquivo({ prefixo: 'estoque-itens' }),
    });
  }

  function imprimirItensEstoque() {
    abrirRelatorioParaImpressao({
      titulo: 'Estoque — itens',
      subtitulo: showOnlyCrit ? 'Somente itens críticos/baixos.' : 'Todos os itens do escopo selecionado.',
      colunas: colunasExportacaoEstoque,
      linhas: itensView,
      metadados: { 'Total de itens': itensView.length },
    });
  }

  return (
    <div className="page rebanho-page page--estoque">
      <div className="rebanho-header estoque-header">
        <div>
          <h1>Estoque</h1>
          <p className="estoque-header-context">
            {consolidado ? 'Todas as fazendas' : (fazendaSelecionada?.nome || 'Nenhuma fazenda selecionada')}
            <span className="estoque-header-context-dot" aria-hidden="true">·</span>
            {resumo.total} {resumo.total === 1 ? 'item' : 'itens'}
          </p>
        </div>
        <div className="page-actions action-row">
          <Button icon={<Plus size={14} />} disabled={!hasPermission('estoque:editar')} onClick={() => {
            if (!hasPermission('estoque:editar')) {
              showToast({ type: 'error', message: mensagemSemPermissao });
              return;
            }
            if (consolidado) {
              showToast({ type: 'warning', message: 'Selecione uma fazenda específica para cadastrar um item de estoque.' });
              return;
            }
            setItemEmEdicao(null);
            setOpenCadastroItem(true);
          }}>
            Novo item
          </Button>
        </div>
      </div>

      <div className="estoque-toolbar">
        <select className="ui-input" value={escopoEstoque} onChange={(e) => setEscopoEstoque(e.target.value)} style={{ minWidth: 210 }}>
          <option value="geral">Estoque geral</option>
          <option value="nutricao">Nutrição / suplementação</option>
          <option value="todos">Todos os itens</option>
        </select>
        {/* Sprint Visual 3 (hierarquia de CTAs): outline, como "Registrar
            saída" — "Novo item" é o cadastro (primário da página);
            entrada/saída são movimentação de item já existente. */}
        <Button variant="outline" icon={<ArrowUpCircle size={14} />} disabled={!hasPermission('estoque:editar')} onClick={() => {
          if (!hasPermission('estoque:editar')) {
            showToast({ type: 'error', message: mensagemSemPermissao });
            return;
          }
          setSelectedItem(null);
          setOpenEntrada(true);
        }}>
          Registrar entrada
        </Button>
        <Button variant="outline" icon={<ArrowDownCircle size={14} />} disabled={!hasPermission('estoque:editar')} onClick={() => {
          if (!hasPermission('estoque:editar')) {
            showToast({ type: 'error', message: mensagemSemPermissao });
            return;
          }
          setSelectedItem(null);
          setOpenSaida(true);
        }}>
          Registrar saída
        </Button>
        <Button variant={showOnlyCrit ? 'warning' : 'ghost'} onClick={() => setShowOnlyCrit((v) => !v)}>
          {showOnlyCrit ? 'Mostrar todos' : 'Mostrar apenas críticos'}
        </Button>
      </div>

      <ExportActions
        disabled={itensView.length === 0}
        onExportCsv={exportarItensCsv}
        onPrint={imprimirItensEstoque}
      />

      <div className="dashboard-grid dashboard-grid--kpi-main">
        <div className="kpi-card kpi-card--compact">
          <div className="kpi-content">
            <div className="kpi-label">Total de itens</div>
            <div className="kpi-value">{resumo.total}</div>
          </div>
        </div>
        <div className="kpi-card kpi-card--compact">
          <div className="kpi-content">
            <div className="kpi-label">Itens críticos</div>
            <div className={resumo.criticos > 0 ? 'kpi-val rd' : 'kpi-value'}>{resumo.criticos}</div>
          </div>
        </div>
        <div className="kpi-card kpi-card--compact">
          <div className="kpi-content">
            <div className="kpi-label">Valor total em estoque</div>
            <div className="kpi-value">{formatCurrency(resumo.valorTotal)}</div>
          </div>
        </div>
      </div>

      <div className="lote-cards-grid">
        {itensView.length === 0 ? (
          <EmptyState
            title={showOnlyCrit ? 'Nenhum item crítico.' : 'Você ainda não cadastrou nenhum item no estoque.'}
            subtitle={
              showOnlyCrit
                ? 'Todos os itens estão em nível normal.'
                : 'Cadastre o primeiro item para controlar entradas, saídas e custos.'
            }
            action={
              !showOnlyCrit ? (
                // Sprint Visual 3: secondary — "Novo item" do header já é o
                // CTA primário da página.
                <Button variant="secondary" icon={<Plus size={14} />} onClick={() => {
                  if (consolidado) {
                    showToast({ type: 'warning', message: 'Selecione uma fazenda específica para cadastrar um item de estoque.' });
                    return;
                  }
                  setItemEmEdicao(null);
                  setOpenCadastroItem(true);
                }}>
                  Novo item
                </Button>
              ) : null
            }
          />
        ) : (
          itensView.map((item) => {
            const border = item.status === 'critico' ? '#c53030' : item.status === 'baixo' ? '#b7791f' : 'var(--color-border)';
            const bar = item.status === 'critico' ? '#c53030' : item.status === 'baixo' ? '#b7791f' : '#2d6a4f';
            return (
              <Card key={item.id} className={`estoque-card estoque-card--${item.status}`} style={{ borderColor: border }}>
                <div className="estoque-card-header">
                  <div>
                    <h3 className="estoque-card-nome">{item.produto}</h3>
                    <span className={`badge-categoria ${String(item.categoria || '').toLowerCase().includes('san') ? 'badge-sanitario' : String(item.categoria || '').toLowerCase().includes('med') ? 'badge-medicamento' : 'badge-insumo'}`}>
                      <span className="dot" />
                      {item.categoria}
                    </span>
                  </div>
                  <Badge className="estoque-card-status" variant={item.status === 'critico' ? 'danger' : item.status === 'baixo' ? 'warning' : 'neutral'}>{item.status}</Badge>
                </div>
                {item.status === 'critico' ? <p className="negative estoque-card-alert"><AlertTriangle size={14} /> Crítico</p> : null}
                <div className="estoque-card-quantidade">{formatNumber(item.saldo, 2)} {item.unidade}</div>
                <div className="estoque-card-progress">
                  <div className="estoque-card-progress-head">
                    <span>Saldo atual</span>
                    <span className="progress-label">{formatNumber(item.ratio, 0)}%</span>
                  </div>
                  <div className="progress-bar-container"><div className={`progress-bar-fill ${item.status === 'critico' ? 'danger' : item.status === 'baixo' ? 'warning' : ''}`} style={{ width: `${Math.min(Math.max(item.ratio, 4), 100)}%`, background: bar }} /></div>
                </div>
                <div className="estoque-card-details">
                  {consolidado ? <div className="estoque-detail-row"><span>Fazenda</span><span>{item.fazendaNome}</span></div> : null}
                  <div className="estoque-detail-row"><span>Valor unitário</span><span>{formatCurrency(item.valor_unitario || item.preco_unitario || 0)}</span></div>
                  <div className="estoque-detail-row"><span>Valor total</span><span>{formatCurrency(item.valorTotal)}</span></div>
                  <div className="estoque-detail-row"><span>Consumo médio diário</span><span>{formatNumber(item.mediaConsumo, 2)} {item.unidade}</span></div>
                  <div className="estoque-detail-row"><span>Dias restantes</span><span>{item.diasRest > 900 ? '—' : `${formatNumber(item.diasRest, 0)} dias`}</span></div>
                  <div className="estoque-detail-row">
                    <span>Duração estimada (consumo planejado)</span>
                    <span>
                      {item.coberturaPlanejada.podeCalcular ? (
                        <Badge variant={
                          item.coberturaPlanejada.status === 'critico' || item.coberturaPlanejada.status === 'sem_estoque' ? 'danger'
                            : item.coberturaPlanejada.status === 'atencao' ? 'warning'
                            : 'success'
                        }>
                          {item.coberturaPlanejada.diasRestantes} dias
                        </Badge>
                      ) : (
                        <Badge variant="neutral">Sem consumo configurado</Badge>
                      )}
                    </span>
                  </div>
                </div>
                <div className="estoque-card-actions lote-actions">
                  <button type="button" className="btn-entrada" disabled={!hasPermission('estoque:editar')} onClick={() => { setSelectedItem(item); setOpenEntrada(true); }}>
                    Entrada
                  </button>
                  <button type="button" className="btn-saida" disabled={!hasPermission('estoque:editar')} onClick={() => { setSelectedItem(item); setOpenSaida(true); }}>
                    Saída
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!hasPermission('estoque:editar')}
                    onClick={() => {
                      setItemEmEdicao(item);
                      setOpenCadastroItem(true);
                    }}
                  >
                    Editar
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Card title="Histórico de Movimentações" action={<Button variant="outline" icon={<FileText size={14} />} onClick={exportCsv}>Exportar CSV</Button>}>
        <div className="filters-wrap">
          <label>Item
            <select className="ui-input" value={filters.item} onChange={(e) => setFilters((p) => ({ ...p, item: e.target.value }))}>
              <option value="todos">Todos</option>
              {itens.map((i) => <option key={i.id} value={i.id}>{i.produto}</option>)}
            </select>
          </label>
          <label>Tipo
            <select className="ui-input" value={filters.tipo} onChange={(e) => setFilters((p) => ({ ...p, tipo: e.target.value }))}>
              <option value="todos">Todos</option>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
              <option value="consumo">Consumo</option>
              <option value="ajuste">Ajuste</option>
              <option value="perda">Perda</option>
              <option value="tratamento">Tratamento</option>
            </select>
          </label>
          <label>Lote
            <select className="ui-input" value={filters.lote} onChange={(e) => setFilters((p) => ({ ...p, lote: e.target.value }))}>
              <option value="todos">Todos</option>
              {(db.lotes || []).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </label>
        </div>
        {movs.length > 0 ? (
          <div className="estoque-movs-table-wrap">
            <table className="dashboard-table">
              <thead><tr><th>Data</th><th>Item</th><th>Tipo</th><th>Qtd</th><th>Lote</th><th>Valor</th></tr></thead>
              <tbody>{movs.map((m) => {
                const item = estoqueMap.get(m.item_estoque_id);
                const lote = lotesMap.get(m.lote_id);
                return (
                  <tr key={m.id}>
                    <td>{formatDate(m.data)}</td>
                    <td>{item?.produto || '—'}</td>
                    <td><Badge variant={MOVIMENTACAO_TIPO_VARIANT[m.tipo] || 'neutral'}>{m.tipo}</Badge></td>
                    <td>{formatNumber(m.quantidade, 2)} {item?.unidade || ''}</td>
                    <td>{lote?.nome || '—'}</td>
                    <td>{formatCurrency(m.valor_total || 0)}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        ) : (
          <div className="table-empty"><AlertTriangle className="table-empty-icon" size={20} />Nenhuma movimentação encontrada para os filtros selecionados.</div>
        )}
      </Card>

      {openCadastroItem && (
        <CadastroItemModal
          setDb={setDb}
          initialData={itemEmEdicao}
          onClose={() => {
            setOpenCadastroItem(false);
            setItemEmEdicao(null);
          }}
          hasPermission={hasPermission}
          showToast={showToast}
          session={session}
          fazendaSelecionada={fazendaSelecionada}
        />
      )}
      {openEntrada && (
        <EntradaModal db={db} setDb={setDb} selectedItem={selectedItem} onRegistrarEntradaEstoque={onRegistrarEntradaEstoque} estoqueMap={estoqueMap} onOpenCadastroItem={() => {
          if (consolidado) {
            showToast({ type: 'warning', message: 'Selecione uma fazenda específica para cadastrar um item de estoque.' });
            return;
          }
          setItemEmEdicao(null);
          setOpenCadastroItem(true);
        }} onClose={() => { setSelectedItem(null); setOpenEntrada(false); }} hasPermission={hasPermission} showToast={showToast} session={session} />
      )}
      {openSaida && (
        <SaidaModal db={db} setDb={setDb} selectedItem={selectedItem} onRegistrarSaidaEstoque={onRegistrarSaidaEstoque} estoqueMap={estoqueMap} onClose={() => { setSelectedItem(null); setOpenSaida(false); }} hasPermission={hasPermission} showToast={showToast} session={session} />
      )}
    </div>
  );
}

function CadastroItemModal({ setDb, initialData = null, onClose, hasPermission, showToast, session, fazendaSelecionada = null }) {
  const [form, setForm] = useState(() => getCadastroItemInicial(initialData));
  const [erro, setErro] = useState('');
  const { executar, isSubmitting } = useSubmitOnce();

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setForm(getCadastroItemInicial(initialData));
    setErro('');
  }, [initialData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function submit() {
    if (!hasPermission('estoque:editar')) {
      showToast({ type: 'error', message: 'Você não tem permissão para executar esta ação.' });
      return;
    }
    if (!String(form.produto || '').trim()) {
      setErro('Informe o nome do item.');
      return;
    }
    if (Number(form.quantidade_inicial || 0) < 0) {
      setErro('Informe uma quantidade válida.');
      return;
    }
    if (Number(form.custo_unitario || 0) < 0) {
      setErro('Informe um custo unitário válido.');
      return;
    }

    const payload = {
      // Sprint 21: sem isto, o item ficava sem fazenda_id e sumia do
      // recorte por fazenda ativa (App.jsx dbFazendaAtiva). Edição preserva
      // a fazenda já salva; criação usa a fazenda ativa no momento.
      fazenda_id: initialData?.fazenda_id ?? (fazendaSelecionada?.id ? Number(fazendaSelecionada.id) : null),
      produto: String(form.produto || '').trim(),
      nome: String(form.produto || '').trim(),
      categoria: form.categoria || 'Outro',
      unidade: form.unidade || 'un',
      unidade_medida: form.unidade || 'un',
      quantidade_atual: Number(form.quantidade_inicial || 0),
      quantidade: Number(form.quantidade_inicial || 0),
      quantidade_minima: Number(form.quantidade_minima || 0),
      valor_unitario: Number(form.custo_unitario || 0),
      preco_unitario: Number(form.custo_unitario || 0),
      custo_unitario: Number(form.custo_unitario || 0),
      valor_total: Number(form.quantidade_inicial || 0) * Number(form.custo_unitario || 0),
      data_validade: form.validade || null,
      validade: form.validade || null,
      fornecedor: form.fornecedor || '',
      obs: form.obs || '',
      observacoes: form.obs || '',
    };

    const isEdit = Boolean(initialData?.id);
    await executar(async () => {
      const persisted = isEdit
        ? await updateOperationalRecord('estoque', Number(initialData.id), payload, session)
        : await createOperationalRecord('estoque', payload, session);
      if (!persisted?.persisted) {
        showToast({ type: 'warning', message: persisted?.error || 'Não foi possível confirmar o salvamento agora.' });
        return;
      }

      setDb((prev) => ({
        ...prev,
        estoque: isEdit
          ? (prev.estoque || []).map((item) => (
              Number(item.id) === Number(initialData.id)
                ? { ...item, ...(persisted.data || payload), id: item.id }
                : item
            ))
          : [
              ...(prev.estoque || []),
              persisted.data || { id: gerarNovoId(prev.estoque || []), ...payload },
            ],
      }));

      showToast({ type: 'success', message: isEdit ? 'Item atualizado com sucesso.' : 'Item cadastrado com sucesso.' });
      onClose();
    });
  }

  return (
    <Modal open onClose={onClose} title={initialData ? 'Editar item de estoque' : 'Cadastrar item de estoque'} footer={<Button onClick={submit} loading={isSubmitting} loadingLabel="Salvando...">{initialData ? 'Salvar alterações' : 'Salvar item'}</Button>}>
      <div className="form-grid two">
        <Input label="Nome do item" value={form.produto} onChange={(e) => setForm((p) => ({ ...p, produto: e.target.value }))} />
        <label className="ui-input-wrap">
          <span className="ui-input-label">Categoria</span>
          <select className="ui-input" value={form.categoria} onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))}>
            {CATEGORIAS_ESTOQUE_GERAL.map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}
          </select>
        </label>
        <Input label="Unidade de medida" value={form.unidade} onChange={(e) => setForm((p) => ({ ...p, unidade: e.target.value }))} />
        <Input label="Quantidade inicial" type="number" value={form.quantidade_inicial} onChange={(e) => setForm((p) => ({ ...p, quantidade_inicial: e.target.value }))} />
        <Input label="Quantidade mínima" type="number" value={form.quantidade_minima} onChange={(e) => setForm((p) => ({ ...p, quantidade_minima: e.target.value }))} />
        <Input label="Custo unitário" type="number" value={form.custo_unitario} onChange={(e) => setForm((p) => ({ ...p, custo_unitario: e.target.value }))} />
        <Input label="Validade" type="date" value={form.validade} onChange={(e) => setForm((p) => ({ ...p, validade: e.target.value }))} />
        <Input label="Fornecedor" value={form.fornecedor} onChange={(e) => setForm((p) => ({ ...p, fornecedor: e.target.value }))} />
        <Input label="Observações" value={form.obs} onChange={(e) => setForm((p) => ({ ...p, obs: e.target.value }))} />
        {erro ? <p className="err" style={{ gridColumn: '1 / -1' }}>{erro}</p> : null}
      </div>
    </Modal>
  );
}

function EntradaModal({ db, selectedItem, onRegistrarEntradaEstoque, estoqueMap, onOpenCadastroItem, onClose, hasPermission, showToast }) {
  const [form, setForm] = useState({
    item_id: selectedItem?.id || '',
    qtd: '',
    custo: selectedItem?.valor_unitario || selectedItem?.preco_unitario || '',
    validade: '',
    fornecedor: '',
    nf: '',
    data: '',
    obs: '',
  });
  const { executar, isSubmitting } = useSubmitOnce();

  const semItens = (db.estoque || []).length === 0;
  const item = estoqueMap.get(Number(form.item_id));
  const total = Number(form.qtd || 0) * Number(form.custo || 0);

  // Usa sempre `registrarEntradaEstoque` (services/movimentacoes.js) — nunca
  // um caminho de persistência próprio da tela. Antes essa duplicação nunca
  // gerava a despesa de "compra_estoque" (EST-02 da auditoria 360º), porque
  // a página tinha sua própria lógica de gravação que ignorava o serviço real.
  async function submit() {
    if (!hasPermission('estoque:editar')) {
      showToast({ type: 'error', message: 'Você não tem permissão para executar esta ação.' });
      return;
    }
    if (!form.data || !form.item_id || Number(form.qtd) <= 0) {
      showToast({ type: 'warning', message: 'Preencha todos os campos obrigatórios.' });
      return;
    }

    await executar(async () => {
      try {
        onRegistrarEntradaEstoque({
          itemId: Number(form.item_id),
          qtd: Number(form.qtd),
          // Sprint 5 (ajuste): repassa o valor CRU. `Number(form.custo || 0)`
          // transformava campo em branco em 0, e a entrada sem custo derrubava
          // a média móvel sem ninguém perceber. Em branco agora chega como ''
          // e o serviço rejeita; para entrada sem custo, digite 0.
          custo: form.custo,
          data: form.data,
          fornecedor: form.fornecedor.trim(),
          obs: [form.nf ? `NF ${form.nf.trim()}` : '', form.obs.trim()].filter(Boolean).join(' • '),
        });
      } catch (error) {
        showToast({ type: 'error', message: error?.message || 'Não foi possível registrar a entrada. Nenhuma alteração foi realizada.' });
        return;
      }
      showToast({ type: 'success', message: 'Entrada registrada.' });
      onClose();
    });
  }

  return (
    <Modal open onClose={onClose} title="Entrada de estoque" footer={!semItens ? <Button onClick={submit} loading={isSubmitting} loadingLabel="Salvando...">Confirmar entrada</Button> : null}>
      {semItens ? (
        <EmptyState
          compact
          title="Cadastre um item antes de registrar entrada."
          subtitle="Entrada de estoque adiciona quantidade em item já cadastrado."
          action={
            <Button type="button" icon={<Plus size={14} />} onClick={() => { onClose(); onOpenCadastroItem?.(); }}>
              Novo item
            </Button>
          }
        />
      ) : (
        <div className="form-grid two">
          <p className="financeiro-subtitle full">Este fluxo é para adicionar quantidade em item já cadastrado.</p>
          <label className="ui-input-wrap">
            <span className="ui-input-label">Item</span>
            <select className="ui-input" value={form.item_id} onChange={(e) => setForm((p) => ({ ...p, item_id: e.target.value }))}>
              <option value="">Selecione</option>
              {(db.estoque || []).map((i) => <option key={i.id} value={i.id}>{i.produto}</option>)}
            </select>
          </label>
          <Input label="Quantidade" type="number" value={form.qtd} onChange={(e) => setForm((p) => ({ ...p, qtd: e.target.value }))} />
          <Input label="Unidade" value={item?.unidade || ''} readOnly />
          <Input label="Custo unitário" type="number" value={form.custo} onChange={(e) => setForm((p) => ({ ...p, custo: e.target.value }))} />
          <Input label="Valor total" value={formatCurrency(total)} readOnly />
          <Input label="Validade" type="date" value={form.validade} onChange={(e) => setForm((p) => ({ ...p, validade: e.target.value }))} />
          <Input label="Fornecedor" value={form.fornecedor} onChange={(e) => setForm((p) => ({ ...p, fornecedor: e.target.value }))} />
          <Input label="Nota fiscal" value={form.nf} onChange={(e) => setForm((p) => ({ ...p, nf: e.target.value }))} />
          <Input label="Data" type="date" value={form.data} onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))} />
          <Input label="Observações" value={form.obs} onChange={(e) => setForm((p) => ({ ...p, obs: e.target.value }))} />
        </div>
      )}
    </Modal>
  );
}

function SaidaModal({ db, selectedItem, onRegistrarSaidaEstoque, estoqueMap, onClose, hasPermission, showToast }) {
  const [form, setForm] = useState({
    item_id: selectedItem?.id || '',
    tipo: 'consumo',
    lote_id: '',
    qtd: '',
    data: '',
    obs: '',
  });
  const { executar, isSubmitting } = useSubmitOnce();

  const item = estoqueMap.get(Number(form.item_id));
  const saldo = getCurrentItemStockBalance(item);
  const quantidadeInformada = parseSafeNumber(form.qtd);
  const erroQuantidade = !String(form.qtd || '').trim()
    ? ''
    : quantidadeInformada == null || quantidadeInformada <= 0
      ? 'Informe uma quantidade válida.'
      : quantidadeInformada > saldo
        ? `Máximo ${formatNumber(saldo, 2)}`
        : '';

  // Usa sempre `registrarSaidaEstoque` (services/movimentacoes.js) — é a
  // única fonte de verdade do enum canônico de tipos (EST-01 da auditoria
  // 360º). Nunca fecha o modal nem limpa o formulário em caso de erro: o
  // serviço agora lança (nunca falha silenciosamente), e aqui isso vira uma
  // mensagem clara, mantendo os dados digitados para o produtor tentar de novo.
  async function submit() {
    if (!hasPermission('estoque:editar')) {
      showToast({ type: 'error', message: 'Você não tem permissão para executar esta ação.' });
      return;
    }
    const qtd = quantidadeInformada ?? 0;
    if (!form.data || !form.item_id || qtd <= 0 || qtd > saldo) {
      showToast({ type: 'warning', message: 'Verifique os campos e a quantidade.' });
      return;
    }

    await executar(async () => {
      try {
        onRegistrarSaidaEstoque({
          itemId: Number(form.item_id),
          loteId: form.lote_id ? Number(form.lote_id) : '',
          quantidade: qtd,
          tipo: form.tipo,
          data: form.data,
          obs: form.obs.trim(),
        });
      } catch (error) {
        showToast({ type: 'error', message: error?.message || 'Não foi possível registrar a saída do estoque. Nenhuma alteração foi realizada.' });
        return;
      }
      showToast({ type: 'success', message: 'Saída registrada.' });
      onClose();
    });
  }

  return (
    <Modal open onClose={onClose} title="Saída / Consumo" footer={<Button variant="danger" onClick={submit} loading={isSubmitting} loadingLabel="Salvando...">Confirmar saída</Button>}>
      <div className="form-grid two">
        <label className="ui-input-wrap">
          <span className="ui-input-label">Item</span>
          <select className="ui-input" value={form.item_id} onChange={(e) => setForm((p) => ({ ...p, item_id: e.target.value }))}>
            <option value="">Selecione</option>
            {(db.estoque || []).map((i) => <option key={i.id} value={i.id}>{i.produto} (saldo {formatNumber(getCurrentItemStockBalance(i), 2)})</option>)}
          </select>
        </label>
        <label className="ui-input-wrap">
          <span className="ui-input-label">Tipo</span>
          <select className="ui-input" value={form.tipo} onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}>
            <option value="consumo">Consumo diário</option>
            <option value="tratamento">Tratamento</option>
            <option value="ajuste">Ajuste</option>
            <option value="perda">Perda</option>
          </select>
        </label>
        <label className="ui-input-wrap">
          <span className="ui-input-label">Lote</span>
          <select className="ui-input" value={form.lote_id} onChange={(e) => setForm((p) => ({ ...p, lote_id: e.target.value }))}>
            <option value="">Opcional</option>
            {(db.lotes || []).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </label>
        <Input label="Quantidade" type="number" error={erroQuantidade} value={form.qtd} onChange={(e) => setForm((p) => ({ ...p, qtd: e.target.value }))} />
        <Input label="Data" type="date" value={form.data} onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))} />
        <Input label="Observações" value={form.obs} onChange={(e) => setForm((p) => ({ ...p, obs: e.target.value }))} />
      </div>
    </Modal>
  );
}
