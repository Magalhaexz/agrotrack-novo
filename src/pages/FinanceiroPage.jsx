import { useMemo, useState } from 'react';
import { Bar, BarChart, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { calcLote, formatCurrency, formatDate, formatNumber } from '../utils/calculations';
import { gerarNovoId } from '../utils/id';

const tabs = ['dre', 'lote', 'lanc'];
const despCats = ['Compra Animal','Ração','Suplemento','Medicamento','Vacina','Frete','Funcionário','Arrendamento','Manutenção','Outro'];
const recCats = ['Venda Animal','Venda Produto','Outro'];

export default function FinanceiroPage({ db, setDb }) {
  const [tab, setTab] = useState('dre');
  const [detailLoteId, setDetailLoteId] = useState(null);
  const [openLanc, setOpenLanc] = useState(false);
  const [filters, setFilters] = useState({ tipo: 'todos', cat: 'todas', lote: 'todos', periodo: 'todos' });

  const lotesRows = useMemo(() => (db.lotes || []).map((lote) => {
    const ind = calcLote(db, lote.id);
    const movs = (db.movimentacoes_financeiras || []).filter((m) => Number(m.lote_id) === lote.id);
    const deducoes = movs.filter((m) => m.tipo === 'despesa' && ['Frete', 'Comissão'].includes(m.categoria)).reduce((s,m)=>s+Number(m.valor||0),0);
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
  }), [db]);

  const detalhe = lotesRows.find((r) => r.lote.id === detailLoteId);

  const lancamentos = useMemo(() => (db.movimentacoes_financeiras || []).filter((l) => {
    if (filters.tipo !== 'todos' && l.tipo !== filters.tipo) return false;
    if (filters.cat !== 'todas' && l.categoria !== filters.cat) return false;
    if (filters.lote !== 'todos' && Number(l.lote_id) !== Number(filters.lote)) return false;
    return true;
  }).sort((a,b)=>new Date(b.data)-new Date(a.data)), [db.movimentacoes_financeiras, filters]);

  if (detailLoteId && detalhe) {
    const custosCat = Object.entries((db.custos || []).filter((c) => c.lote_id === detalhe.lote.id).reduce((acc, c) => ({ ...acc, [c.cat]: (acc[c.cat] || 0) + Number(c.val || 0) }), {})).map(([name, value]) => ({ name, value }));
    const timeline = buildFinanceTimeline(db, detalhe.lote.id);
    return (
      <div className="page rebanho-page">
        <Button variant="ghost" onClick={() => setDetailLoteId(null)}>← Voltar</Button>
        <h1>Financeiro do lote — {detalhe.lote.nome}</h1>
        <Card title="Resultado detalhado">
          <div className="metrics-2col">
            <p>Custo de aquisição: <strong>{formatCurrency((detalhe.lote.investimento || 0))}</strong></p>
            <p>Custo de alimentação: <strong>{formatCurrency(custosCat.find((c) => c.name === 'alimentação')?.value || 0)}</strong></p>
            <p>Custo sanitário: <strong>{formatCurrency(custosCat.find((c) => c.name === 'sanitário')?.value || 0)}</strong></p>
            <p>Outros custos: <strong>{formatCurrency(custosCat.filter((c) => !['alimentação', 'sanitário'].includes(c.name)).reduce((s,c)=>s+c.value,0))}</strong></p>
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
          <Card title="Distribuição de custos"><div style={{ height: 220 }}><ResponsiveContainer width="100%" height={200}><PieChart><Pie data={custosCat} dataKey="value" nameKey="name" outerRadius={80} /><Tooltip /></PieChart></ResponsiveContainer></div></Card>
          <Card title="Custo acumulado x receita"><div style={{ height: 220 }}><ResponsiveContainer width="100%" height={200}><LineChart data={timeline}><XAxis dataKey="label" /><YAxis /><Tooltip /><Line dataKey="custo" stroke="#c53030" /><Line dataKey="receita" stroke="#1b4332" /></LineChart></ResponsiveContainer></div></Card>
        </div>
      </div>
    );
  }

  const dre = computeDRE(db);
  const margemBars = lotesRows.slice().sort((a,b)=>b.margem-a.margem).map((r,i)=>({ nome:r.lote.nome, margem:r.margem, benchmark: i===0 ? 100 : (r.margem/Math.max(lotesRows[0]?.margem||1,1))*100 }));

  return (
    <div className="page rebanho-page">
      <div className="rebanho-header"><h1>Financeiro</h1><Button onClick={() => setOpenLanc(true)}>+ Novo Lançamento</Button></div>
      <div className="tabs-row">{tabs.map((t) => <button key={t} className={t === tab ? 'active' : ''} onClick={() => setTab(t)}>{t === 'dre' ? 'DRE Simplificado' : t === 'lote' ? 'Por Lote' : 'Lançamentos'}</button>)}</div>

      {tab === 'dre' && <>
        <div className="dashboard-grid dashboard-grid--kpi-secondary">
          <Card title="Receitas totais">{formatCurrency(dre.receita)}</Card>
          <Card title="Despesas totais">{formatCurrency(dre.despesa)}</Card>
          <Card title="Resultado bruto"><span className={dre.resultado >= 0 ? 'positive' : 'negative'}>{formatCurrency(dre.resultado)}</span></Card>
        </div>
        <Card title="Barras empilhadas por mês"><div style={{ height: 240 }}><ResponsiveContainer width="100%" height={220}><BarChart data={dre.mensal}><XAxis dataKey="mes" /><YAxis /><Tooltip /><Bar dataKey="receita" stackId="a" fill="#2d6a4f" /><Bar dataKey="despesa" stackId="a" fill="#c53030" /></BarChart></ResponsiveContainer></div></Card>
        <Card title="Comparativo de margem entre lotes"><div style={{ height: 240 }}><ResponsiveContainer width="100%" height={220}><BarChart data={margemBars}><XAxis dataKey="nome" /><YAxis /><Tooltip /><Bar dataKey="margem" fill="#2b6cb0" /><Bar dataKey="benchmark" fill="#d8f3dc" /></BarChart></ResponsiveContainer></div></Card>
      </>}

      {tab === 'lote' && <Card title="Resultado por lote"><table className="dashboard-table"><thead><tr><th>Lote</th><th>Status</th><th>Custo Total</th><th>Receita</th><th>Lucro</th><th>Margem</th><th>Lucro/Cab</th><th>Lucro/@</th><th>Custo/Cab/Dia</th></tr></thead><tbody>{lotesRows.map((r)=><tr key={r.lote.id} onClick={()=>setDetailLoteId(r.lote.id)}><td>{r.lote.nome}</td><td><Badge variant={r.status==='ativo'?'warning':'success'}>{r.status}</Badge></td><td>{formatCurrency(r.custoTotal)}</td><td>{formatCurrency(r.receita)}</td><td className={r.lucro>=0?'positive':'negative'}>{formatCurrency(r.lucro)}</td><td>{formatNumber(r.margem,2)}%</td><td>{formatCurrency(r.lucroCab)}</td><td>{formatCurrency(r.lucroArroba)}</td><td>{formatCurrency(r.custoCabDia)}</td></tr>)}</tbody><tfoot><tr><td>Total</td><td>—</td><td>{formatCurrency(lotesRows.reduce((s,r)=>s+r.custoTotal,0))}</td><td>{formatCurrency(lotesRows.reduce((s,r)=>s+r.receita,0))}</td><td>{formatCurrency(lotesRows.reduce((s,r)=>s+r.lucro,0))}</td><td>—</td><td>—</td><td>—</td><td>—</td></tr></tfoot></table></Card>}

      {tab === 'lanc' && <>
        <Card><div className="rebanho-filters"><select value={filters.tipo} onChange={(e)=>setFilters((p)=>({...p,tipo:e.target.value}))}><option value="todos">Tipo</option><option value="receita">Receita</option><option value="despesa">Despesa</option></select><input placeholder="Categoria" value={filters.cat === 'todas' ? '' : filters.cat} onChange={(e)=>setFilters((p)=>({...p,cat:e.target.value || 'todas'}))} /><select value={filters.lote} onChange={(e)=>setFilters((p)=>({...p,lote:e.target.value}))}><option value="todos">Lote</option>{(db.lotes||[]).map((l)=><option key={l.id} value={l.id}>{l.nome}</option>)}</select></div></Card>
        <Card title="Lançamentos"><div className="alerts-list">{lancamentos.map((l)=><div key={l.id} className="alert-item"><Badge variant={l.tipo==='receita'?'success':'danger'}>{l.tipo}</Badge><div><strong>{l.categoria}</strong><p>{formatDate(l.data)} · {formatCurrency(l.valor)} · {l.fornecedor || l.comprador || '—'}</p></div></div>)}</div></Card>
      </>}

      {openLanc && <NovoLancamentoModal db={db} setDb={setDb} onClose={() => setOpenLanc(false)} />}
    </div>
  );
}

function NovoLancamentoModal({ db, setDb, onClose }) {
  const [form, setForm] = useState({ tipo:'despesa', categoria:'Ração', valor:'', data:'', lote_id:'', pessoa:'', nf:'', obs:'', parcelado:false, parcelas:1 });
  const categorias = form.tipo === 'despesa' ? despCats : recCats;
  function submit() {
    if (!form.valor || !form.data) return;
    const totalParc = Number(form.parcelas || 1);
    const valorParc = Number(form.valor) / totalParc;
    const novos = Array.from({ length: totalParc }, (_, i) => {
      const dt = new Date(form.data); dt.setMonth(dt.getMonth() + i);
      return { id: gerarNovoId([...(db.movimentacoes_financeiras||[]), ...Array(i).fill({})]), tipo: form.tipo, categoria: form.categoria, valor: valorParc, data: dt.toISOString().slice(0,10), lote_id: form.lote_id ? Number(form.lote_id) : null, fornecedor: form.tipo === 'despesa' ? form.pessoa : '', comprador: form.tipo === 'receita' ? form.pessoa : '', nota_fiscal: form.nf, observacao: form.obs };
    });
    setDb((prev)=>({ ...prev, movimentacoes_financeiras:[...(prev.movimentacoes_financeiras||[]), ...novos] }));
    onClose();
  }
  return <Modal open onClose={onClose} title="Novo lançamento financeiro" size="lg" footer={<Button onClick={submit}>Salvar lançamento</Button>}><div className="form-grid two"><label>Tipo<select value={form.tipo} onChange={(e)=>setForm((p)=>({...p,tipo:e.target.value,categoria:e.target.value==='despesa'?despCats[0]:recCats[0]}))}><option value="receita">Receita</option><option value="despesa">Despesa</option></select></label><label>Categoria<select value={form.categoria} onChange={(e)=>setForm((p)=>({...p,categoria:e.target.value}))}>{categorias.map((c)=><option key={c} value={c}>{c}</option>)}</select></label><Input label="Valor" type="number" value={form.valor} onChange={(e)=>setForm((p)=>({...p,valor:e.target.value}))} /><Input label="Data" type="date" value={form.data} onChange={(e)=>setForm((p)=>({...p,data:e.target.value}))} /><label>Lote<select value={form.lote_id} onChange={(e)=>setForm((p)=>({...p,lote_id:e.target.value}))}><option value="">Opcional</option>{(db.lotes||[]).map((l)=><option key={l.id} value={l.id}>{l.nome}</option>)}</select></label><Input label={form.tipo==='despesa'?'Fornecedor':'Comprador'} value={form.pessoa} onChange={(e)=>setForm((p)=>({...p,pessoa:e.target.value}))} /><Input label="Nota fiscal" value={form.nf} onChange={(e)=>setForm((p)=>({...p,nf:e.target.value}))} /><Input label="Observações" value={form.obs} onChange={(e)=>setForm((p)=>({...p,obs:e.target.value}))} /><label>Parcelado?<select value={form.parcelado?'sim':'nao'} onChange={(e)=>setForm((p)=>({...p,parcelado:e.target.value==='sim'}))}><option value="nao">Não</option><option value="sim">Sim</option></select></label>{form.parcelado && <Input label="Número de parcelas" type="number" value={form.parcelas} onChange={(e)=>setForm((p)=>({...p,parcelas:e.target.value}))} />}</div></Modal>;
}

function computeDRE(db) {
  const lanc = db.movimentacoes_financeiras || [];
  const receitaLotes = (db.lotes || []).reduce((s,l)=>s+calcLote(db,l.id).receitaTotal,0);
  const desp = lanc.filter((l)=>l.tipo==='despesa').reduce((s,l)=>s+Number(l.valor||0),0) + (db.custos||[]).reduce((s,c)=>s+Number(c.val||0),0);
  const rec = lanc.filter((l)=>l.tipo==='receita').reduce((s,l)=>s+Number(l.valor||0),0) + receitaLotes;
  const mensalMap = {};
  lanc.forEach((l)=>{ const m=(l.data||'').slice(0,7); if(!m) return; if(!mensalMap[m]) mensalMap[m]={mes:m,receita:0,despesa:0}; mensalMap[m][l.tipo==='receita'?'receita':'despesa'] += Number(l.valor||0); });
  return { receita: rec, despesa: desp, resultado: rec-desp, mensal: Object.values(mensalMap) };
}

function buildFinanceTimeline(db, loteId) {
  const custos = (db.custos||[]).filter((c)=>c.lote_id===loteId).map((c)=>({data:c.data,tipo:'custo',valor:Number(c.val||0)}));
  const receitas = (db.movimentacoes_financeiras||[]).filter((m)=>Number(m.lote_id)===loteId && m.tipo==='receita').map((m)=>({data:m.data,tipo:'receita',valor:Number(m.valor||0)}));
  const all=[...custos,...receitas].sort((a,b)=>new Date(a.data)-new Date(b.data));
  let acC=0, acR=0;
  return all.map((e)=>{ if(e.tipo==='custo') acC+=e.valor; else acR+=e.valor; return { label: formatDate(e.data), custo: acC, receita: acR }; });
}
