import { useMemo, useState } from 'react';
import { Bar, BarChart, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { calcLote, formatCurrency, formatDate, formatNumber } from '../utils/calculations';
import { gerarNovoId } from '../utils/id';
// import { useToast } from '../hooks/useToast'; // Assuming useToast is available

const tabs = ['dre', 'lote', 'lanc'];
const despCats = ['Compra Animal', 'Ração', 'Suplemento', 'Medicamento', 'Vacina', 'Frete', 'Funcionário', 'Arrendamento', 'Manutenção', 'Outro'];
const recCats = ['Venda Animal', 'Venda Produto', 'Outro'];

/**
 * Página Financeira, para visualização de DRE, análise por lote e gestão de lançamentos.
 *
 * @param {object} props - As propriedades do componente.
 * @param {object} props.db - O objeto do banco de dados.
 * @param {function} props.setDb - Função para atualizar o banco de dados.
 */
export default function FinanceiroPage({ db, setDb }) {
  // const { showToast } = useToast(); // Se usar useToast

  const [tab, setTab] = useState('dre');
  const [detailLoteId, setDetailLoteId] = useState(null);
  const [openLanc, setOpenLanc] = useState(false);
  const [filters, setFilters] = useState({ tipo: 'todos', cat: 'todas', lote: 'todos', periodo: 'todos' });

  // Pré-indexar lotes, custos e movimentações financeiras para buscas eficientes
  const lotesMap = useMemo(() => new Map((db.lotes || []).map(l => [l.id, l])), [db.lotes]);
  const custosMapByLote = useMemo(() => {
    const map = new Map();
    (db.custos || []).forEach(c => {
      if (c.lote_id) {
        if (!map.has(c.lote_id)) map.set(c.lote_id, []);
        map.get(c.lote_id).push(c);
      }
    });
    return map;
  }, [db.custos]);
  const movFinMapByLote = useMemo(() => {
    const map = new Map();
    (db.movimentacoes_financeiras || []).forEach(m => {
      if (m.lote_id) {
        if (!map.has(m.lote_id)) map.set(m.lote_id, []);
        map.get(m.lote_id).push(m);
      }
    });
    return map;
  }, [db.movimentacoes_financeiras]);

  // Pré-calcular métricas para todos os lotes (MEMOIZADO)
  const allLoteMetrics = useMemo(() => {
    return (db.lotes || []).map((lote) => {
      const ind = calcLote(db, lote.id); // calcLote deve ser otimizado ou memoizado internamente
      const movs = movFinMapByLote.get(lote.id) || [];
      const deducoes = movs.filter((m) => m.tipo === 'despesa' && ['Frete', 'Comissão'].includes(m.categoria)).reduce((s, m) => s + Number(m.valor || 0), 0);
      const receitaLiquida = ind.receitaTotal - deducoes;
      const custoTotal = ind.custoTotalLote;
      const lucro = receitaLiquida - custoTotal;
      return {
        lote,
        status: lote.status,
        custoTotal,
        receita: ind.receitaTotal,
        lucro,
        margem: receitaLiquida ? (lucro / receitaLiquida) * 100 : 0,
        lucroCab: lucro / Math.max(ind.totalAnimais, 1),
        lucroArroba: lucro / Math.max(ind.arrobasProduzidas, 1),
        custoCabDia: custoTotal / Math.max(ind.totalAnimais, 1) / Math.max(ind.dias, 1),
        deducoes,
        ind,
      };
    });
  }, [db, movFinMapByLote]); // Depende de db e do mapa de movimentações financeiras

  // Linhas da tabela de lotes (MEMOIZADO)
  const lotesRows = useMemo(() => allLoteMetrics, [allLoteMetrics]);

  // Detalhe do lote selecionado (MEMOIZADO)
  const detalhe = useMemo(() => lotesRows.find((r) => r.lote.id === detailLoteId), [lotesRows, detailLoteId]);

  // Lançamentos financeiros filtrados (MEMOIZADO)
  const lancamentos = useMemo(() => (db.movimentacoes_financeiras || []).filter((l) => {
    if (filters.tipo !== 'todos' && l.tipo !== filters.tipo) return false;
    if (filters.cat !== 'todas' && l.categoria !== filters.cat) return false;
    if (filters.lote !== 'todos' && Number(l.lote_id) !== Number(filters.lote)) return false;
    return true;
  }).sort((a, b) => new Date(b.data) - new Date(a.data)), [db.movimentacoes_financeiras, filters]);

  // DRE (Demonstrativo de Resultado do Exercício) (MEMOIZADO)
  const dre = useMemo(() => computeDRE(db, allLoteMetrics), [db, allLoteMetrics]);

  // Barras de margem para o gráfico (MEMOIZADO)
  const margemBars = useMemo(() => {
    return lotesRows.slice().sort((a, b) => b.margem - a.margem).map((r, i) => ({
      nome: r.lote.nome,
      margem: r.margem,
      benchmark: i === 0 ? 100 : (r.margem / Math.max(lotesRows[0]?.margem || 1, 1)) * 100
    }));
  }, [lotesRows]);

  // Renderização detalhada do lote
  if (detailLoteId && detalhe) {
    // Custos por categoria para o lote detalhado (MEMOIZADO)
    const custosCat = useMemo(() => {
      return Object.entries((custosMapByLote.get(detalhe.lote.id) || []).reduce((acc, c) => ({ ...acc, [c.cat]: (acc[c.cat] || 0) + Number(c.val || 0) }), {}))
        .map(([name, value]) => ({ name, value }));
    }, [detalhe, custosMapByLote]);

    // Linha do tempo financeira para o lote detalhado (MEMOIZADO)
    const timeline = useMemo(() => buildFinanceTimeline(db, detalhe.lote.id), [db, detalhe]);

    return (
      <div className="page rebanho-page">
        <Button variant="ghost" onClick={() => setDetailLoteId(null)}>← Voltar</Button>
        <h1>Financeiro do lote — {detalhe.lote.nome}</h1>
        <Card title="Resultado detalhado">
          <div className="metrics-2col">
            <p>Custo de aquisição: <strong>{formatCurrency((detalhe.lote.investimento || 0))}</strong></p>
            <p>Custo de alimentação: <strong>{formatCurrency(custosCat.find((c) => c.name === 'alimentação')?.value || 0)}</strong></p>
            <p>Custo sanitário: <strong>{formatCurrency(custosCat.find((c) => c.name === 'sanitário')?.value || 0)}</strong></p>
            <p>Outros custos: <strong>{formatCurrency(custosCat.filter((c) => !['alimentação', 'sanitário'].includes(c.name)).reduce((s, c) => s + c.value, 0))}</strong></p>
            <p><strong>CUSTO TOTAL: {formatCurrency(detalhe.custoTotal)}</strong></p>
            <p>Receita bruta: <strong>{formatCurrency(detalhe.receita)}</strong></p>
            <p>Deduções: <strong>{formatCurrency(detalhe.deducoes)}</strong></p>
            <p><strong>RECEITA LÍQUIDA: {formatCurrency(detalhe.receita - detalhe.deducoes)}</strong></p>
            <p className={detalhe.lucro >= 0 ? 'positive' : 'negative'}><strong>LUCRO/PREJUÍZO: {formatCurrency(detalhe.lucro)}</strong></p>
            <p>Margem: <strong>{formatNumber(detalhe.margem, 2)}%</strong></p>
            <p>Lucro por cabeça: <strong>{formatCurrency(detalhe.lucroCab)}</strong></p>
            <p>Lucro por @: <strong>{formatCurrency(detalhe.lucroArroba)}</strong></p>
            <p>Custo por cabeça/dia: <strong>{formatCurrency(detalhe.custoCabDia)}</strong></p>
          </div>
        </Card>
        <div className="dashboard-grid dashboard-grid--dual">
          <Card title="Distribuição de custos">
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={custosCat} dataKey="value" nameKey="name" outerRadius={80} fill="#8884d8" /> {/* Adicionado fill */}
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Custo acumulado x receita">
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" /> {/* Adicionado */}
                  <XAxis dataKey="label" />
                  <YAxis formatter={(value) => formatCurrency(value)} /> {/* Adicionado formatter */}
                  <Tooltip formatter={(value) => formatCurrency(value)} /> {/* Adicionado formatter */}
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
    <div className="page rebanho-page">
      <div className="rebanho-header">
        <h1>Financeiro</h1>
        <div className="lote-actions">
          <Button onClick={() => setOpenLanc(true)}>+ Novo lançamento</Button>
        </div>
      </div>

      <div className="tab-buttons">
        {tabs.map((t) => (
          <Button key={t} variant={tab === t ? 'primary' : 'ghost'} onClick={() => setTab(t)}>
            {t === 'dre' ? 'DRE' : t === 'lote' ? 'Por Lote' : 'Lançamentos'}
          </Button>
        ))}
      </div>

      {tab === 'dre' && <>
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
          <Card title="DRE Mensal">
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
          </Card>
          <Card title="Distribuição de Despesas">
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
          </Card>
        </div>
      </>}

      {tab === 'lote' && <>
        <Card title="Resultado por Lote">
          <table className="data-table">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Status</th>
                <th>Custo Total</th>
                <th>Receita</th>
                <th>Lucro</th>
                <th>Margem (%)</th>
                <th>Lucro/Cab</th>
                <th>Lucro/@</th>
                <th>Custo/Cab/Dia</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lotesRows.map((row) => (
                <tr key={row.lote.id}>
                  <td>{row.lote.nome}</td>
                  <td><Badge variant={row.status === 'ativo' ? 'info' : 'neutral'}>{row.status}</Badge></td>
                  <td>{formatCurrency(row.custoTotal)}</td>
                  <td>{formatCurrency(row.receita)}</td>
                  <td className={row.lucro >= 0 ? 'text-success' : 'text-danger'}>{formatCurrency(row.lucro)}</td>
                  <td>{formatNumber(row.margem, 2)}%</td>
                  <td>{formatCurrency(row.lucroCab)}</td>
                  <td>{formatCurrency(row.lucroArroba)}</td>
                  <td>{formatCurrency(row.custoCabDia)}</td>
                  <td><Button size="sm" onClick={() => setDetailLoteId(row.lote.id)}>Detalhes</Button></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td>—</td>
                <td>{formatCurrency(lotesRows.reduce((s, r) => s + r.custoTotal, 0))}</td>
                <td>{formatCurrency(lotesRows.reduce((s, r) => s + r.receita, 0))}</td>
                <td>{formatCurrency(lotesRows.reduce((s, r) => s + r.lucro, 0))}</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
              </tr>
            </tfoot>
          </table>
        </Card>
        <Card title="Margem por Lote">
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={margemBars}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" />
                <YAxis formatter={(value) => `${value}%`} />
                <Tooltip formatter={(value) => `${formatNumber(value, 2)}%`} />
                <Bar dataKey="margem" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </>}

      {tab === 'lanc' && <>
        <Card>
          <div className="rebanho-filters">
            <label className="ui-input-wrap">
              <span className="ui-input-label">Tipo</span>
              <select className="ui-input" value={filters.tipo} onChange={(e) => setFilters((p) => ({ ...p, tipo: e.target.value }))}>
                <option value="todos">Todos</option>
                <option value="receita">Receita</option>
                <option value="despesa">Despesa</option>
              </select>
            </label>
            <label className="ui-input-wrap">
              <span className="ui-input-label">Categoria</span>
              <select className="ui-input" value={filters.cat} onChange={(e) => setFilters((p) => ({ ...p, cat: e.target.value }))}>
                <option value="todas">Todas</option>
                {filters.tipo === 'receita' ? recCats.map(c => <option key={c} value={c}>{c}</option>) : despCats.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="ui-input-wrap">
              <span className="ui-input-label">Lote</span>
              <select className="ui-input" value={filters.lote} onChange={(e) => setFilters((p) => ({ ...p, lote: e.target.value }))}>
                <option value="todos">Todos</option>
                {(db.lotes || []).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </label>
          </div>
        </Card>
        <Card title="Lançamentos">
          <div className="alerts-list">
            {lancamentos.length === 0 ? (
              <div className="empty-state">
                <strong>Nenhum lançamento encontrado.</strong>
                <span>Ajuste os filtros ou adicione um novo lançamento.</span>
              </div>
            ) : (
              lancamentos.map((l) => (
                <div key={l.id} className="alert-item">
                  <Badge variant={l.tipo === 'receita' ? 'success' : 'danger'}>{l.tipo}</Badge>
                  <div>
                    <strong>{l.categoria}</strong>
                    <p>{formatDate(l.data)} · {formatCurrency(l.valor)} · {l.fornecedor || l.comprador || '—'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </>}

      {openLanc && <NovoLancamentoModal db={db} setDb={setDb} lotesMap={lotesMap} onClose={() => setOpenLanc(false)} />}
    </div>
  );
}

/**
 * Modal para adicionar um novo lançamento financeiro (receita ou despesa).
 * @param {object} props - As propriedades do componente.
 * @param {object} props.db - O objeto do banco de dados.
 * @param {function} props.setDb - Função para atualizar o banco de dados.
 * @param {Map<number, object>} props.lotesMap - Mapa de lotes por ID.
 * @param {function} props.onClose - Callback para fechar o modal.
 */
function NovoLancamentoModal({ db, setDb, lotesMap, onClose }) {
  // const { showToast } = useToast(); // Se usar useToast

  const [form, setForm] = useState({ tipo: 'despesa', categoria: 'Ração', valor: '', data: '', lote_id: '', pessoa: '', nf: '', obs: '', parcelado: false, parcelas: 1 });
  const categorias = form.tipo === 'despesa' ? despCats : recCats;

  function submit() {
    if (!form.valor || !form.data) {
      // showToast({ type: 'error', message: 'Valor e Data são obrigatórios.' });
      alert('Valor e Data são obrigatórios.');
      return;
    }

    const totalParc = Number(form.parcelas || 1);
    const valorParc = Number(form.valor) / totalParc;
    let currentMaxId = gerarNovoId(db.movimentacoes_financeiras || []); // Get initial max ID

    const novos = Array.from({ length: totalParc }, (_, i) => {
      const dt = new Date(form.data);
      dt.setMonth(dt.getMonth() + i); // Increment month for each parcel
      const newId = currentMaxId + i; // Generate sequential IDs
      return {
        id: newId,
        tipo: form.tipo,
        categoria: form.categoria,
        valor: valorParc,
        data: dt.toISOString().slice(0, 10),
        lote_id: form.lote_id ? Number(form.lote_id) : null,
        fornecedor: form.tipo === 'despesa' ? form.pessoa : '',
        comprador: form.tipo === 'receita' ? form.pessoa : '',
        nota_fiscal: form.nf,
        observacao: form.obs,
      };
    });

    setDb((prev) => ({ ...prev, movimentacoes_financeiras: [...(prev.movimentacoes_financeiras || []), ...novos] }));
    // showToast({ type: 'success', message: 'Lançamento(s) financeiro(s) salvo(s) com sucesso.' });
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Novo lançamento financeiro" size="lg" footer={<Button onClick={submit}>Salvar lançamento</Button>}>
      <div className="form-grid two">
        <label className="ui-input-wrap">
          <span className="ui-input-label">Tipo</span>
          <select className="ui-input" value={form.tipo} onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value, categoria: e.target.value === 'despesa' ? despCats[0] : recCats[0] }))}>
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
          </select>
        </label>
        <label className="ui-input-wrap">
          <span className="ui-input-label">Categoria</span>
          <select className="ui-input" value={form.categoria} onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))}>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <Input label="Valor" type="number" value={form.valor} onChange={(e) => setForm((p) => ({ ...p, valor: e.target.value }))} />
        <Input label="Data" type="date" value={form.data} onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))} />
        <label className="ui-input-wrap">
          <span className="ui-input-label">Lote</span>
          <select className="ui-input" value={form.lote_id} onChange={(e) => setForm((p) => ({ ...p, lote_id: e.target.value }))}>
            <option value="">Opcional</option>
            {(db.lotes || []).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </label>
        <Input label={form.tipo === 'despesa' ? 'Fornecedor' : 'Comprador'} value={form.pessoa} onChange={(e) => setForm((p) => ({ ...p, pessoa: e.target.value }))} />
        <Input label="Nota fiscal" value={form.nf} onChange={(e) => setForm((p) => ({ ...p, nf: e.target.value }))} />
        <Input label="Observações" value={form.obs} onChange={(e) => setForm((p) => ({ ...p, obs: e.target.value }))} />
        <label className="ui-input-wrap">
          <span className="ui-input-label">Parcelado?</span>
          <select className="ui-input" value={form.parcelado ? 'sim' : 'nao'} onChange={(e) => setForm((p) => ({ ...p, parcelado: e.target.value === 'sim' }))}>
            <option value="nao">Não</option>
            <option value="sim">Sim</option>
          </select>
        </label>
        {form.parcelado && <Input label="Número de parcelas" type="number" value={form.parcelas} onChange={(e) => setForm((p) => ({ ...p, parcelas: e.target.value }))} />}
      </div>
    </Modal>
  );
}

/**
 * Calcula o Demonstrativo de Resultado do Exercício (DRE).
 * @param {object} db - O objeto do banco de dados.
 * @param {Array<object>} allLoteMetrics - Métricas pré-calculadas para todos os lotes.
 * @returns {object} O DRE consolidado.
 */
function computeDRE(db, allLoteMetrics) {
  const lanc = db.movimentacoes_financeiras || [];
  const custos = db.custos || [];

  const receitaLotes = allLoteMetrics.reduce((s, l) => s + l.receita, 0);
  const despesaLotes = allLoteMetrics.reduce((s, l) => s + l.custoTotal, 0); // Já inclui custos de aquisição e outros custos do lote

  const despesasGerais = lanc.filter((l) => l.tipo === 'despesa' && !l.lote_id).reduce((s, l) => s + Number(l.valor || 0), 0);
  const receitasGerais = lanc.filter((l) => l.tipo === 'receita' && !l.lote_id).reduce((s, l) => s + Number(l.valor || 0), 0);

  const totalDespesa = despesaLotes + despesasGerais;
  const totalReceita = receitaLotes + receitasGerais;

  const mensalMap = {};
  // Incluir movimentações financeiras gerais
  lanc.forEach((l) => {
    const m = (l.data || '').slice(0, 7);
    if (!m) return;
    if (!mensalMap[m]) mensalMap[m] = { mes: m, receita: 0, despesa: 0 };
    mensalMap[m][l.tipo === 'receita' ? 'receita' : 'despesa'] += Number(l.valor || 0);
  });

  // Incluir custos por lote (se não já contabilizados em movimentacoes_financeiras)
  // Para evitar dupla contagem, vamos considerar que calcLote já agrega os custos
  // e que os custos diretos em db.custos são parte do custoTotalLote.
  // Se houver custos que não são vinculados a lote, eles deveriam ser lançados como despesa geral.

  // Para o gráfico de distribuição de despesas, vamos usar as categorias de todas as despesas
  const despesaPorCategoria = {};
  lanc.filter(l => l.tipo === 'despesa').forEach(l => {
    const cat = l.categoria || 'Outro';
    despesaPorCategoria[cat] = (despesaPorCategoria[cat] || 0) + Number(l.valor || 0);
  });
  // Adicionar custos de db.custos que não são movimentações financeiras diretas (se houver)
  // Assumindo que db.custos já está refletido em calcLote e, portanto, em despesaLotes.
  // Se houver custos em db.custos que não são despesas financeiras, eles precisariam ser tratados aqui.
  // Por simplicidade, vamos considerar que todas as despesas já estão em lanc ou agregadas via calcLote.

  return {
    receita: totalReceita,
    despesa: totalDespesa,
    resultado: totalReceita - totalDespesa,
    mensal: Object.values(mensalMap).sort((a, b) => a.mes.localeCompare(b.mes)),
    despesaPorCategoria,
  };
}

/**
 * Constrói a linha do tempo financeira acumulada para um lote específico.
 * @param {object} db - O objeto do banco de dados.
 * @param {number} loteId - O ID do lote.
 * @returns {Array<object>} A linha do tempo financeira.
 */
function buildFinanceTimeline(db, loteId) {
  const custos = (db.custos || []).filter((c) => c.lote_id === loteId).map((c) => ({ data: c.data, tipo: 'custo', valor: Number(c.val || 0) }));
  const receitas = (db.movimentacoes_financeiras || []).filter((m) => Number(m.lote_id) === loteId && m.tipo === 'receita').map((m) => ({ data: m.data, tipo: 'receita', valor: Number(m.valor || 0) }));

  const all = [...custos, ...receitas].sort((a, b) => new Date(a.data) - new Date(b.data));

  let acC = 0, acR = 0;
  const timelineData = [];
  all.forEach((e) => {
    if (e.tipo === 'custo') acC += e.valor;
    else acR += e.valor;
    timelineData.push({ label: formatDate(e.data), custo: acC, receita: acR });
  });
  return timelineData;
}
