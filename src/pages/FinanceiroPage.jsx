import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { calcLote, formatCurrency, formatDate, formatNumber } from '../utils/calculations';
import { gerarNovoId } from '../utils/id';

const tabs = ['dre', 'lote', 'lanc'];
const despCats = ['Compra Animal', 'Racao', 'Suplemento', 'Medicamento', 'Vacina', 'Frete', 'Funcionario', 'Arrendamento', 'Manutencao', 'Outro'];
const recCats = ['Venda Animal', 'Venda Produto', 'Outro'];
const getTodayIso = () => new Date().toISOString().slice(0, 10);

export default function FinanceiroPage({ db, setDb }) {
  const [tab, setTab] = useState('dre');
  const [detailLoteId, setDetailLoteId] = useState(null);
  const [openLanc, setOpenLanc] = useState(false);
  const [filters, setFilters] = useState({ tipo: 'todos', cat: 'todas', lote: 'todos' });

  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const custos = Array.isArray(db?.custos) ? db.custos : [];
  const movimentacoes = Array.isArray(db?.movimentacoes_financeiras) ? db.movimentacoes_financeiras : [];

  const custosMapByLote = useMemo(() => {
    const map = new Map();
    custos.forEach((custo) => {
      if (!custo?.lote_id) {
        return;
      }
      if (!map.has(custo.lote_id)) {
        map.set(custo.lote_id, []);
      }
      map.get(custo.lote_id).push(custo);
    });
    return map;
  }, [custos]);

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
      const indicadores = calcLote(db, lote.id);
      const movs = movFinMapByLote.get(lote.id) || [];
      const deducoes = movs
        .filter((mov) => mov.tipo === 'despesa' && ['Frete', 'Comissao'].includes(mov.categoria))
        .reduce((sum, mov) => sum + Number(mov.valor || 0), 0);
      const receitaLiquida = indicadores.receitaTotal - deducoes;
      const custoTotal = indicadores.custoTotalLote;
      const lucro = receitaLiquida - custoTotal;

      return {
        lote,
        status: lote.status,
        custoTotal,
        receita: indicadores.receitaTotal,
        lucro,
        margem: receitaLiquida ? (lucro / receitaLiquida) * 100 : 0,
        lucroCab: lucro / Math.max(indicadores.totalAnimais, 1),
        lucroArroba: lucro / Math.max(indicadores.arrobasProduzidas, 1),
        custoCabDia: custoTotal / Math.max(indicadores.totalAnimais, 1) / Math.max(indicadores.dias, 1),
        deducoes,
      };
    })
  ), [db, lotes, movFinMapByLote]);

  const detalhe = useMemo(
    () => lotesRows.find((row) => Number(row.lote.id) === Number(detailLoteId)) || null,
    [detailLoteId, lotesRows]
  );

  const detalheCustosCat = useMemo(() => {
    if (!detalhe?.lote?.id) {
      return [];
    }

    const grouped = (custosMapByLote.get(detalhe.lote.id) || []).reduce((acc, custo) => {
      const categoria = custo?.cat || 'outros';
      acc[categoria] = (acc[categoria] || 0) + Number(custo?.val || 0);
      return acc;
    }, {});

    return Object.entries(grouped).map(([name, value]) => ({ name, value }));
  }, [custosMapByLote, detalhe]);

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

  const margemBars = useMemo(() => {
    const ordered = lotesRows.slice().sort((a, b) => b.margem - a.margem);
    return ordered.map((row, index) => ({
      nome: row.lote.nome,
      margem: row.margem,
      benchmark: index === 0 ? 100 : (row.margem / Math.max(ordered[0]?.margem || 1, 1)) * 100,
    }));
  }, [lotesRows]);

  if (detalhe) {
    return (
      <div className="page rebanho-page">
        <Button variant="ghost" onClick={() => setDetailLoteId(null)}>Voltar</Button>
        <h1>Financeiro do lote - {detalhe.lote.nome}</h1>

        <Card title="Resultado detalhado">
          <div className="metrics-2col">
            <p>Custo de aquisicao: <strong>{formatCurrency(detalhe.lote.investimento || 0)}</strong></p>
            <p>Custo de alimentacao: <strong>{formatCurrency(findCategoryValue(detalheCustosCat, ['alimentacao', 'alimentaçao', 'alimentaÃ§Ã£o']))}</strong></p>
            <p>Custo sanitario: <strong>{formatCurrency(findCategoryValue(detalheCustosCat, ['sanitario', 'sanitÃ¡rio']))}</strong></p>
            <p>Outros custos: <strong>{formatCurrency(sumOtherCategories(detalheCustosCat, ['alimentacao', 'alimentaçao', 'alimentaÃ§Ã£o', 'sanitario', 'sanitÃ¡rio']))}</strong></p>
            <p><strong>Custo total: {formatCurrency(detalhe.custoTotal)}</strong></p>
            <p>Receita bruta: <strong>{formatCurrency(detalhe.receita)}</strong></p>
            <p>Deducoes: <strong>{formatCurrency(detalhe.deducoes)}</strong></p>
            <p><strong>Receita liquida: {formatCurrency(detalhe.receita - detalhe.deducoes)}</strong></p>
            <p className={detalhe.lucro >= 0 ? 'text-success' : 'text-danger'}><strong>Lucro/prejuizo: {formatCurrency(detalhe.lucro)}</strong></p>
            <p>Margem: <strong>{formatNumber(detalhe.margem, 2)}%</strong></p>
            <p>Lucro por cabeca: <strong>{formatCurrency(detalhe.lucroCab)}</strong></p>
            <p>Lucro por arroba: <strong>{formatCurrency(detalhe.lucroArroba)}</strong></p>
            <p>Custo por cabeca/dia: <strong>{formatCurrency(detalhe.custoCabDia)}</strong></p>
          </div>
        </Card>

        <div className="dashboard-grid dashboard-grid--dual">
          <Card title="Distribuicao de custos">
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
    <div className="page rebanho-page">
      <div className="rebanho-header">
        <h1>Financeiro</h1>
        <div className="lote-actions">
          <Button onClick={() => setOpenLanc(true)}>+ Novo lancamento</Button>
        </div>
      </div>

      <div className="tab-buttons">
        {tabs.map((item) => (
          <Button key={item} variant={tab === item ? 'primary' : 'ghost'} onClick={() => setTab(item)}>
            {item === 'dre' ? 'DRE' : item === 'lote' ? 'Por Lote' : 'Lancamentos'}
          </Button>
        ))}
      </div>

      {tab === 'dre' ? (
        <>
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

            <Card title="Distribuicao de despesas">
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
                    <th>Status</th>
                    <th>Custo total</th>
                    <th>Receita</th>
                    <th>Lucro</th>
                    <th>Margem (%)</th>
                    <th>Lucro/cab</th>
                    <th>Lucro/@</th>
                    <th>Custo/cab/dia</th>
                    <th>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {lotesRows.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="empty-state-td">Nenhum lote disponivel para analise financeira.</td>
                    </tr>
                  ) : (
                    lotesRows.map((row) => (
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
                    ))
                  )}
                </tbody>
                {lotesRows.length ? (
                  <tfoot>
                    <tr>
                      <td>Total</td>
                      <td>-</td>
                      <td>{formatCurrency(lotesRows.reduce((sum, row) => sum + row.custoTotal, 0))}</td>
                      <td>{formatCurrency(lotesRows.reduce((sum, row) => sum + row.receita, 0))}</td>
                      <td>{formatCurrency(lotesRows.reduce((sum, row) => sum + row.lucro, 0))}</td>
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
                  <Bar dataKey="margem" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
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

          <Card title="Lancamentos">
            <div className="alerts-list">
              {lancamentos.length === 0 ? (
                <div className="empty-state">
                  <strong>Nenhum lancamento encontrado.</strong>
                  <span>Ajuste os filtros ou adicione um novo lancamento.</span>
                </div>
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

      {openLanc ? <NovoLancamentoModal db={db} setDb={setDb} onClose={() => setOpenLanc(false)} /> : null}
    </div>
  );
}

function NovoLancamentoModal({ db, setDb, onClose }) {
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

  function submit() {
    if (!form.valor || !form.data) {
      alert('Valor e data sao obrigatorios.');
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
        nota_fiscal: form.nf,
        observacao: form.obs,
      };
    });

    setDb((prev) => ({
      ...prev,
      movimentacoes_financeiras: [...(prev.movimentacoes_financeiras || []), ...novos],
    }));

    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Novo lancamento financeiro" size="lg" footer={<Button onClick={submit}>Salvar lancamento</Button>}>
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
        <Input label="Observacoes" value={form.obs} onChange={(event) => setForm((prev) => ({ ...prev, obs: event.target.value }))} />

        <label className="ui-input-wrap">
          <span className="ui-input-label">Parcelado?</span>
          <select className="ui-input" value={form.parcelado ? 'sim' : 'nao'} onChange={(event) => setForm((prev) => ({ ...prev, parcelado: event.target.value === 'sim' }))}>
            <option value="nao">Nao</option>
            <option value="sim">Sim</option>
          </select>
        </label>

        {form.parcelado ? (
          <Input label="Numero de parcelas" type="number" value={form.parcelas} onChange={(event) => setForm((prev) => ({ ...prev, parcelas: event.target.value }))} />
        ) : null}
      </div>
    </Modal>
  );
}

function computeDRE(db, lotesRows) {
  const movimentacoes = Array.isArray(db?.movimentacoes_financeiras) ? db.movimentacoes_financeiras : [];
  const receitaLotes = lotesRows.reduce((sum, row) => sum + row.receita, 0);
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
  const custos = (db.custos || [])
    .filter((item) => Number(item.lote_id) === Number(loteId))
    .map((item) => ({ data: item.data, tipo: 'custo', valor: Number(item.val || 0) }));
  const receitas = (db.movimentacoes_financeiras || [])
    .filter((item) => Number(item.lote_id) === Number(loteId) && item.tipo === 'receita')
    .map((item) => ({ data: item.data, tipo: 'receita', valor: Number(item.valor || 0) }));

  const timeline = [...custos, ...receitas].sort((a, b) => new Date(a.data) - new Date(b.data));
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
