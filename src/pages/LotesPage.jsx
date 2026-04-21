import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, MoreHorizontal, Plus, Scale, Truck } from 'lucide-react';
import { Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { calcLote, formatCurrency, formatDate, formatNumber } from '../utils/calculations';
import { gerarNovoId } from '../utils/id';
import {
  calcularArrobasProduzidas,
  calcularCustoPorCabecaDia,
  calcularCustoporArroba,
  calcularDesvioPorcentual,
  calcularGMD,
  calcularGMDMeta,
  calcularTaxaMortalidade,
} from '../domain/indicadores';
import '../styles/rebanho.css';

const tabs = ['visao', 'mov', 'pesagens', 'financeiro', 'sanitario', 'historico'];
const movTypes = ['compra', 'nascimento', 'transferencia_entrada', 'venda', 'morte', 'descarte', 'transferencia_saida', 'abate'];

export default function LotesPage({ db, setDb }) {
  const [filters, setFilters] = useState({ status: 'todos', fazenda: 'todas', periodo: 'todos' });
  const [activeLoteId, setActiveLoteId] = useState(null);
  const [activeTab, setActiveTab] = useState('visao');
  const [openLoteModal, setOpenLoteModal] = useState(false);
  const [openMovModal, setOpenMovModal] = useState(null);
  const [openPesagemModal, setOpenPesagemModal] = useState(null);
  const [openFechamentoModal, setOpenFechamentoModal] = useState(null);

  const lotesEnriquecidos = useMemo(() => (db.lotes || []).map((lote) => {
    const indicators = calcLote(db, lote.id);
    const latestPesagem = (db.pesagens || []).filter((p) => p.lote_id === lote.id).sort((a, b) => new Date(b.data) - new Date(a.data))[0];
    const gmd30 = calcGmd30(db.pesagens || [], lote.id);
    const pesoAlvo = lote.peso_alvo || indicators.pesoInicialMedio;
    const progressoPeso = indicators.pesoInicialMedio ? ((indicators.pesoAtualMedio - indicators.pesoInicialMedio) / Math.max(pesoAlvo - indicators.pesoInicialMedio, 1)) * 100 : 0;
    return { ...lote, indicators, heads: indicators.totalAnimais, pesoAtual: latestPesagem?.peso_medio || indicators.pesoAtualMedio, arrobaViva: (latestPesagem?.peso_medio || indicators.pesoAtualMedio) / 15, gmd30, progressoPeso };
  }), [db]);

  const lotesFiltrados = useMemo(() => lotesEnriquecidos.filter((lote) => {
    if (filters.status !== 'todos' && lote.status !== filters.status) return false;
    if (filters.fazenda !== 'todas' && Number(lote.faz_id) !== Number(filters.fazenda)) return false;
    if (filters.periodo === '30d') return daysFrom(lote.entrada) <= 30;
    if (filters.periodo === '90d') return daysFrom(lote.entrada) <= 90;
    return true;
  }), [filters, lotesEnriquecidos]);

  const activeLote = lotesEnriquecidos.find((item) => item.id === activeLoteId);

  if (activeLote) {
    return (
      <LoteDetailView
        lote={activeLote}
        db={db}
        setDb={setDb}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onBack={() => setActiveLoteId(null)}
        onOpenMov={() => setOpenMovModal(activeLote)}
        onOpenPesagem={() => setOpenPesagemModal(activeLote)}
        onOpenFechamento={() => setOpenFechamentoModal(activeLote)}
      />
    );
  }

  return (
    <div className="page rebanho-page">
      <div className="rebanho-header">
        <div><h1>Rebanho</h1><p>Gestão completa de lotes, movimentações e indicadores zootécnicos.</p></div>
        <Button icon={<Plus size={16} />} onClick={() => setOpenLoteModal(true)}>Novo Lote</Button>
      </div>
      <Card><div className="rebanho-filters">
        <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}><option value="todos">Todos</option><option value="ativo">Ativo</option><option value="encerrado">Encerrado</option><option value="vendido">Vendido</option></select>
        <select value={filters.fazenda} onChange={(e) => setFilters((p) => ({ ...p, fazenda: e.target.value }))}><option value="todas">Todas Fazendas</option>{(db.fazendas || []).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select>
        <select value={filters.periodo} onChange={(e) => setFilters((p) => ({ ...p, periodo: e.target.value }))}><option value="todos">Período</option><option value="30d">Últimos 30 dias</option><option value="90d">Últimos 90 dias</option></select>
      </div></Card>

      <div className="lote-cards-grid">
        {lotesFiltrados.map((lote) => <Card key={lote.id} className="lote-card-modern"><div className="lote-card-title"><h3>{lote.nome}</h3><Badge variant={lote.status === 'ativo' ? 'success' : lote.status === 'vendido' ? 'info' : 'neutral'}>{lote.status}</Badge></div><div className="lote-metrics"><p><strong>{lote.heads}</strong> cabeças</p><p>{formatNumber(lote.pesoAtual, 1)} kg · {formatNumber(lote.arrobaViva, 2)} @</p><p>GMD 30d: {formatNumber(lote.gmd30, 3)} kg/dia</p><p>Dias em trato: {daysFrom(lote.entrada)}</p><p>Custo/cab/dia: {formatCurrency(lote.indicators.custoTotalLote / Math.max(lote.indicators.totalAnimais,1) / Math.max(daysFrom(lote.entrada),1))}</p></div><div className="progress-line"><span style={{ width: `${Math.max(5, Math.min(lote.progressoPeso, 100))}%` }} /></div><p className={lote.indicators.margem >= 0 ? 'positive' : 'negative'}>Resultado parcial: {formatCurrency(lote.indicators.margem)}</p><div className="lote-actions"><Button size="sm" variant="outline" icon={<ChevronRight size={14} />} onClick={() => setActiveLoteId(lote.id)}>Ver Detalhes</Button><Button size="sm" variant="ghost" icon={<Truck size={14} />} onClick={() => setOpenMovModal(lote)}>Registrar Movimentação</Button><Button size="sm" variant="ghost" icon={<Scale size={14} />} onClick={() => setOpenPesagemModal(lote)}>Pesagem</Button><Button size="sm" variant="ghost" icon={<MoreHorizontal size={14} />}>Mais</Button></div></Card>)}
      </div>

      {openLoteModal && <NovoLoteModal db={db} setDb={setDb} onClose={() => setOpenLoteModal(false)} />}
      {openMovModal && <MovimentacaoModal lote={openMovModal} db={db} setDb={setDb} onClose={() => setOpenMovModal(null)} />}
      {openPesagemModal && <PesagemModal lote={openPesagemModal} db={db} setDb={setDb} onClose={() => setOpenPesagemModal(null)} />}
      {openFechamentoModal && <FechamentoLoteModal lote={openFechamentoModal} db={db} setDb={setDb} onClose={() => setOpenFechamentoModal(null)} />}
    </div>
  );
}

function LoteDetailView({ lote, db, setDb, activeTab, setActiveTab, onBack, onOpenMov, onOpenPesagem, onOpenFechamento }) {
  const pesagens = (db.pesagens || []).filter((p) => p.lote_id === lote.id).sort((a, b) => new Date(a.data) - new Date(b.data));
  const movimentacoes = (db.movimentacoes_animais || []).filter((m) => Number(m.loteId || m.lote_id) === lote.id);
  const custos = (db.custos || []).filter((c) => c.lote_id === lote.id);
  const san = (db.sanitario || []).filter((s) => s.lote_id === lote.id);

  useEffect(() => {
    if (lote.indicators.totalAnimais <= 0 && lote.status === 'ativo') onOpenFechamento();
  }, [lote.indicators.totalAnimais, lote.status, onOpenFechamento]);

  const metaGmd = calcularGMDMeta(lote.indicators.pesoInicialMedio, lote.peso_alvo || lote.indicators.pesoAtualMedio, Math.max(daysFrom(lote.entrada), 1));
  const indicadoresPainel = [
    { nome: 'GMD', realizado: lote.indicators.gmdMedio, meta: lote.gmd_meta || metaGmd, unit: 'kg/dia' },
    { nome: '@ produzida', realizado: lote.indicators.arrobasProduzidas, meta: (lote.peso_alvo ? ((lote.peso_alvo - lote.indicators.pesoInicialMedio) * Math.max(lote.indicators.totalAnimais,1))/15 : lote.indicators.arrobasProduzidas), unit: '@' },
    { nome: 'Margem', realizado: lote.indicators.margemPct, meta: 15, unit: '%' },
  ];

  return (
    <div className="page rebanho-page">
      <div className="rebanho-header"><div><Button variant="ghost" onClick={onBack}>← Voltar para lotes</Button><h1>{lote.nome}</h1></div><div className="page-topbar-actions"><Button icon={<Plus size={14} />} onClick={onOpenMov}>Registrar Movimentação</Button><Button variant="outline" icon={<Scale size={14} />} onClick={onOpenPesagem}>Nova Pesagem</Button><Button variant="danger" onClick={onOpenFechamento}>Encerrar Lote</Button></div></div>
      <div className="tabs-row">{tabs.map((tab) => <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab.toUpperCase()}</button>)}</div>

      {activeTab === 'visao' && <><div className="dashboard-grid dashboard-grid--kpi-secondary"><Card title="Cabeças">{lote.indicators.totalAnimais}</Card><Card title="Peso Médio">{formatNumber(lote.indicators.pesoAtualMedio, 1)} kg</Card><Card title="Resultado">{formatCurrency(lote.indicators.margem)}</Card></div>
        <Card title="Painel de Indicadores (meta x realizado)"><div className="indicadores-painel">{indicadoresPainel.map((item) => { const pct = item.meta ? (item.realizado / item.meta) * 100 : 100; const color = pct >= 100 ? 'var(--color-success)' : pct >= 80 ? 'var(--color-warning)' : 'var(--color-danger)'; const tendencia = calcularDesvioPorcentual(item.realizado, item.meta); return <div key={item.nome} className="indicador-card"><strong>{item.nome}</strong><div>{formatNumber(item.realizado, 2)} {item.unit}</div><small>Meta {formatNumber(item.meta, 2)} {item.unit}</small><div className="progress-line"><span style={{ width: `${Math.min(Math.max(pct, 4), 100)}%`, background: color }} /></div><small style={{ color }}>{tendencia >= 0 ? '↑' : '↓'} {formatNumber(Math.abs(tendencia), 1)}%</small></div>; })}</div></Card>
        <Card title="Evolução de peso do lote"><div style={{ height: 260 }}><ResponsiveContainer width="100%" height={240}><LineChart data={pesagens.map((p) => ({ ...p, label: formatDate(p.data) }))}><XAxis dataKey="label" /><YAxis unit="kg" /><Tooltip /><Line dataKey="peso_medio" stroke="#1b4332" /></LineChart></ResponsiveContainer></div></Card>
      </>}
      {activeTab === 'mov' && <Card title="Timeline de movimentações" action={<Button size="sm" onClick={onOpenMov}>+ Registrar Movimentação</Button>}><div className="timeline">{movimentacoes.map((m) => <div className="timeline-item" key={m.id}><Badge variant={m.tipo?.includes('saida') || m.tipo === 'venda' ? 'danger' : 'info'}>{m.tipo}</Badge><span>{formatDate(m.data)} · {m.qtd} cabeças</span></div>)}</div></Card>}
      {activeTab === 'pesagens' && <Card title="Pesagens" action={<Button size="sm" onClick={onOpenPesagem}>+ Nova Pesagem</Button>}><table className="dashboard-table"><thead><tr><th>Data</th><th>Peso médio</th><th>GMD período</th></tr></thead><tbody>{pesagens.map((p, i) => <tr key={p.id}><td>{formatDate(p.data)}</td><td>{formatNumber(p.peso_medio, 1)} kg</td><td>{i ? formatNumber((p.peso_medio - pesagens[i - 1].peso_medio) / Math.max(daysBetween(pesagens[i - 1].data, p.data), 1), 3) : '—'}</td></tr>)}</tbody></table></Card>}
      {activeTab === 'financeiro' && <div className="dashboard-grid dashboard-grid--dual"><Card title="Custo por categoria"><div style={{ height: 240 }}><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={groupCustos(custos)} dataKey="valor" nameKey="cat" outerRadius={80} /><Tooltip /></PieChart></ResponsiveContainer></div></Card><Card title="Lançamentos e resultado">{custos.map((c) => <p key={c.id}>{formatDate(c.data)} · {c.cat} · {formatCurrency(c.val)}</p>)}<p className={lote.indicators.margem >= 0 ? 'positive' : 'negative'}>Resultado parcial: {formatCurrency(lote.indicators.margem)}</p></Card></div>}
      {activeTab === 'sanitario' && <Card title="Histórico sanitário e próximos manejos">{san.map((s) => <p key={s.id}>{s.desc} · próxima: {formatDate(s.proxima)}</p>)}</Card>}
      {activeTab === 'historico' && <Card title="Histórico completo (imutável)">{[...movimentacoes, ...pesagens].map((item, idx) => <p key={idx}>{item.data ? formatDate(item.data) : '—'} · {item.tipo || item.observacao || 'evento'}</p>)}</Card>}
    </div>
  );
}

function FechamentoLoteModal({ lote, db, setDb, onClose }) {
  const [step, setStep] = useState(1);
  const [pesoFinal, setPesoFinal] = useState(lote.indicators.pesoAtualMedio || 0);
  const [dataFechamento, setDataFechamento] = useState(new Date().toISOString().slice(0, 10));

  const dias = Math.max(daysBetween(lote.entrada, dataFechamento), 1);
  const mortes = (db.movimentacoes_animais || []).filter((m) => (m.tipo === 'morte' || m.tipo === 'descarte') && Number(m.loteId || m.lote_id) === lote.id).reduce((s, m) => s + Number(m.qtd || 0), 0);
  const qtdEntrada = lote.indicators.totalAnimais + mortes;
  const gmd = calcularGMD(lote.indicators.pesoInicialMedio, pesoFinal, dias);
  const arrobas = calcularArrobasProduzidas(lote.indicators.pesoInicialMedio, pesoFinal, Math.max(qtdEntrada - mortes, 1));
  const mortPct = calcularTaxaMortalidade(qtdEntrada, mortes);
  const custoArroba = calcularCustoporArroba(lote.indicators.custoTotalLote, arrobas);
  const custoCabDia = calcularCustoPorCabecaDia(lote.indicators.custoTotalLote, Math.max(qtdEntrada - mortes, 1), dias);
  const lucroBruto = lote.indicators.receitaTotal - lote.indicators.custoTotalLote;

  function confirmarEncerramento() {
    setDb((prev) => ({
      ...prev,
      lotes: prev.lotes.map((l) => l.id === lote.id ? { ...l, status: 'encerrado', data_encerramento: dataFechamento, peso_final: Number(pesoFinal), fechamento: { gmd_real: gmd, arrobas_por_cab: arrobas / Math.max(qtdEntrada - mortes, 1), mortalidade: mortPct, custo_por_arroba: custoArroba, custo_cab_dia: custoCabDia, lucro_bruto: lucroBruto, margem: lote.indicators.margemPct } } : l),
    }));
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Fechamento de lote" subtitle={`Etapa ${step} de 4`} size="lg" footer={<div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>{step > 1 ? <Button variant="outline" onClick={() => setStep((s) => s - 1)}>Voltar</Button> : <span />}{step < 4 ? <Button onClick={() => setStep((s) => s + 1)}>Próximo</Button> : <Button variant="danger" onClick={confirmarEncerramento}>Confirmar encerramento</Button>}</div>}>
      {step === 1 && <div className="form-grid two"><p>Entrada: {formatDate(lote.entrada)}</p><Input label="Peso médio final" type="number" value={pesoFinal} onChange={(e) => setPesoFinal(e.target.value)} /><Input label="Data de encerramento" type="date" value={dataFechamento} onChange={(e) => setDataFechamento(e.target.value)} /><p>Período: {dias} dias</p></div>}
      {step === 2 && <div className="metrics-2col"><p>Peso inicial: <strong>{formatNumber(lote.indicators.pesoInicialMedio,1)} kg</strong></p><p>Peso final: <strong>{formatNumber(pesoFinal,1)} kg</strong></p><p>Ganho/cab: <strong>{formatNumber(Number(pesoFinal)-lote.indicators.pesoInicialMedio,1)} kg</strong></p><p>GMD real: <strong>{formatNumber(gmd,0)} g/dia</strong></p><p>Dias em trato: <strong>{dias}</strong></p><p>Arrobas/cab: <strong>{formatNumber(arrobas/Math.max(qtdEntrada-mortes,1),2)} @</strong></p><p>Taxa mortalidade: <strong>{formatNumber(mortPct,2)}%</strong></p><p>Rendimento carcaça: <strong>{formatNumber(lote.rendimento_carcaca || 52,1)}%</strong></p></div>}
      {step === 3 && <div className="metrics-2col"><p>Custo total: <strong>{formatCurrency(lote.indicators.custoTotalLote)}</strong></p><p>Custo/cab: <strong>{formatCurrency(lote.indicators.custoPorCabeca)}</strong></p><p>Custo/@: <strong>{formatCurrency(custoArroba)}</strong></p><p>Receita total: <strong>{formatCurrency(lote.indicators.receitaTotal)}</strong></p><p>Lucro bruto: <strong>{formatCurrency(lucroBruto)}</strong></p><p>Lucro/cab: <strong>{formatCurrency(lucroBruto/Math.max(qtdEntrada-mortes,1))}</strong></p><p>Lucro/@: <strong>{formatCurrency(lucroBruto/Math.max(arrobas,1))}</strong></p><p>Margem: <strong>{formatNumber(lote.indicators.margemPct,2)}%</strong></p></div>}
      {step === 4 && <Card title="Resumo final"><p>Lote {lote.nome} encerrado em {formatDate(dataFechamento)}</p><p>Resultado: {formatCurrency(lucroBruto)} · Margem {formatNumber(lote.indicators.margemPct,2)}%</p><p>Revise e confirme o encerramento.</p></Card>}
    </Modal>
  );
}

function MovimentacaoModal({ lote, db, setDb, onClose }) { const [form, setForm] = useState({ tipo: 'compra', data: '', qtd: '', obs: '', peso_medio: '', custo_total: '', fornecedor: '', origem: '', comprador: '', preco_arroba: '', rendimento: 52, frete: '', comissao: '', motivo: '', lote_destino: '' }); const qtd = Number(form.qtd || 0); const peso = Number(form.peso_medio || 0); const custoCab = qtd ? Number(form.custo_total || 0) / qtd : 0; const arrobaViva = peso / 15; const arrobaCarc = arrobaViva * (Number(form.rendimento || 52) / 100); const valorTotal = qtd * arrobaCarc * Number(form.preco_arroba || 0); const liquido = valorTotal - Number(form.frete || 0) - Number(form.comissao || 0); function submit() { if (!form.data || qtd <= 0) return; const mov = { id: gerarNovoId(db.movimentacoes_animais || []), loteId: lote.id, ...form, qtd, peso_medio: peso }; setDb((prev) => ({ ...prev, movimentacoes_animais: [...(prev.movimentacoes_animais || []), mov], custos: form.tipo === 'compra' ? [...prev.custos, { id: gerarNovoId(prev.custos), lote_id: lote.id, cat: 'aquisição', desc: `Compra ${lote.nome}`, data: form.data, val: Number(form.custo_total || 0) + Number(form.frete || 0) }] : prev.custos, movimentacoes_financeiras: form.tipo === 'venda' ? [...(prev.movimentacoes_financeiras || []), { id: Date.now(), lote_id: lote.id, tipo: 'receita', data: form.data, valor: liquido, descricao: `Venda ${lote.nome}` }] : (prev.movimentacoes_financeiras || []), })); onClose(); } return <Modal open onClose={onClose} title="Nova movimentação" size="lg" footer={<div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button onClick={submit}>Salvar Movimentação</Button></div>}><div className="form-grid"><label>Tipo<select value={form.tipo} onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}>{movTypes.map((t) => <option key={t} value={t}>{t}</option>)}</select></label><Input label="Data" type="date" value={form.data} onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))} /><Input label="Quantidade de cabeças" type="number" value={form.qtd} onChange={(e) => setForm((p) => ({ ...p, qtd: e.target.value }))} /><Input label="Peso médio" type="number" value={form.peso_medio} onChange={(e) => setForm((p) => ({ ...p, peso_medio: e.target.value }))} />{form.tipo === 'compra' && <><Input label="Fornecedor" value={form.fornecedor} onChange={(e) => setForm((p) => ({ ...p, fornecedor: e.target.value }))} /><Input label="Custo total" type="number" value={form.custo_total} onChange={(e) => setForm((p) => ({ ...p, custo_total: e.target.value }))} /><Input label="Frete" type="number" value={form.frete} onChange={(e) => setForm((p) => ({ ...p, frete: e.target.value }))} /><Input label="Origem" value={form.origem} onChange={(e) => setForm((p) => ({ ...p, origem: e.target.value }))} /><p>R$/cabeça: {formatCurrency(custoCab)} · @ viva: {formatNumber(arrobaViva, 2)}</p></>}{form.tipo === 'venda' && <><Input label="Comprador" value={form.comprador} onChange={(e) => setForm((p) => ({ ...p, comprador: e.target.value }))} /><Input label="Preço/@" type="number" value={form.preco_arroba} onChange={(e) => setForm((p) => ({ ...p, preco_arroba: e.target.value }))} /><Input label="Rendimento (%)" type="number" value={form.rendimento} onChange={(e) => setForm((p) => ({ ...p, rendimento: e.target.value }))} /><Input label="Frete" type="number" value={form.frete} onChange={(e) => setForm((p) => ({ ...p, frete: e.target.value }))} /><Input label="Comissão" type="number" value={form.comissao} onChange={(e) => setForm((p) => ({ ...p, comissao: e.target.value }))} /><p>@ viva: {formatNumber(arrobaViva, 2)} · @ carcaça: {formatNumber(arrobaCarc, 2)} · Total: {formatCurrency(valorTotal)} · Líquido: {formatCurrency(liquido)}</p></>}{(form.tipo === 'morte' || form.tipo === 'descarte') && <><Input label="Motivo" value={form.motivo} onChange={(e) => setForm((p) => ({ ...p, motivo: e.target.value }))} /><p>Impacto estimado no peso médio: -{formatNumber((qtd * peso) / Math.max(lote.indicators.totalAnimais, 1), 1)} kg</p></>}{(form.tipo.includes('transferencia')) && <label>Lote destino<select value={form.lote_destino} onChange={(e) => setForm((p) => ({ ...p, lote_destino: e.target.value }))}><option value="">Selecione</option>{db.lotes.filter((l) => l.status === 'ativo' && l.id !== lote.id).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}</select></label>}<label>Observações<textarea value={form.obs} onChange={(e) => setForm((p) => ({ ...p, obs: e.target.value }))} /></label></div></Modal>; }
function PesagemModal({ lote, db, setDb, onClose }) { const ultima = (db.pesagens || []).filter((p) => p.lote_id === lote.id).sort((a, b) => new Date(b.data) - new Date(a.data))[0]; const [form, setForm] = useState({ data: '', peso_medio: '', qtd: lote.indicators.totalAnimais, obs: '' }); const days = ultima ? daysBetween(ultima.data, form.data) : 0; const gmd = ultima && form.peso_medio ? (Number(form.peso_medio) - Number(ultima.peso_medio)) / Math.max(days, 1) : 0; const arroba = Number(form.peso_medio || 0) / 15; const valorEst = Number(form.qtd || 0) * arroba * ((lote.preco_arroba || 0)); function submit() { if (!form.data || Number(form.peso_medio) <= 0) return; setDb((prev) => ({ ...prev, pesagens: [...prev.pesagens, { id: gerarNovoId(prev.pesagens), lote_id: lote.id, data: form.data, peso_medio: Number(form.peso_medio), observacao: form.obs, qtd: Number(form.qtd || 0) }] })); onClose(); } return <Modal open onClose={onClose} title="Nova Pesagem" size="md" footer={<Button onClick={submit}>Salvar Pesagem</Button>}><div className="form-grid"><Input label="Data" type="date" value={form.data} onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))} /><Input label="Peso médio" type="number" value={form.peso_medio} onChange={(e) => setForm((p) => ({ ...p, peso_medio: e.target.value }))} /><Input label="Quantidade pesada" type="number" value={form.qtd} onChange={(e) => setForm((p) => ({ ...p, qtd: e.target.value }))} /><Input label="Observações" value={form.obs} onChange={(e) => setForm((p) => ({ ...p, obs: e.target.value }))} /><p>GMD desde última: {formatNumber(gmd, 3)} kg/dia · @ viva: {formatNumber(arroba, 2)} · Valor estimado: {formatCurrency(valorEst)}</p></div></Modal>; }
function NovoLoteModal({ db, setDb, onClose }) { const [form, setForm] = useState({ nome: '', faz_id: '', raca: '', sexo: 'Macho', categoria: 'Novilho', entrada: '', fornecedor: '', peso_inicial: '', qtd_inicial: '', custo_aquisicao: '', peso_alvo: '', saida_meta: '', obs: '' }); const [errors, setErrors] = useState({}); function validate() { const e = {}; if (!form.nome) e.nome = 'Nome obrigatório'; if (!form.faz_id) e.faz_id = 'Fazenda obrigatória'; if (!form.entrada) e.entrada = 'Data obrigatória'; if (Number(form.qtd_inicial || 0) <= 0) e.qtd_inicial = 'Quantidade inválida'; if (Number(form.peso_inicial || 0) <= 0) e.peso_inicial = 'Peso inicial inválido'; setErrors(e); return !Object.keys(e).length; } function submit() { if (!validate()) return; const novoId = gerarNovoId(db.lotes); setDb((prev) => ({ ...prev, lotes: [...prev.lotes, { id: novoId, nome: form.nome, faz_id: Number(form.faz_id), entrada: form.entrada, saida: form.saida_meta, investimento: Number(form.custo_aquisicao || 0), status: 'ativo', tipo: 'engorda', sistema: 'confinamento', gmd_meta: 1, preco_arroba: 290, rendimento_carcaca: 52, peso_alvo: Number(form.peso_alvo || 0), raca: form.raca, sexo: form.sexo, categoria: form.categoria, obs: form.obs }], animais: [...prev.animais, { id: gerarNovoId(prev.animais), lote_id: novoId, sexo: form.sexo.toLowerCase(), gen: form.raca || 'Misto', qtd: Number(form.qtd_inicial), p_ini: Number(form.peso_inicial), p_at: Number(form.peso_inicial), dias: 0, consumo: 0 }] })); onClose(); } return <Modal open onClose={onClose} title="Novo Lote" subtitle="Cadastro completo de entrada no rebanho" size="lg" footer={<Button onClick={submit}>Salvar Lote</Button>}><div className="form-grid two"><Input label="Nome do lote" value={form.nome} error={errors.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} /><label>Fazenda<select value={form.faz_id} onChange={(e) => setForm((p) => ({ ...p, faz_id: e.target.value }))}><option value="">Selecione</option>{db.fazendas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select>{errors.faz_id && <small className="err">{errors.faz_id}</small>}</label><Input label="Raça / grupo genético" value={form.raca} onChange={(e) => setForm((p) => ({ ...p, raca: e.target.value }))} /><label>Sexo<select value={form.sexo} onChange={(e) => setForm((p) => ({ ...p, sexo: e.target.value }))}><option>Macho</option><option>Fêmea</option><option>Misto</option></select></label><label>Categoria<select value={form.categoria} onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))}><option>Bezerro</option><option>Garrote</option><option>Novilho</option><option>Boi</option><option>Vaca</option><option>Touro</option></select></label><Input label="Data de entrada" type="date" error={errors.entrada} value={form.entrada} onChange={(e) => setForm((p) => ({ ...p, entrada: e.target.value }))} /><Input label="Fornecedor" value={form.fornecedor} onChange={(e) => setForm((p) => ({ ...p, fornecedor: e.target.value }))} /><Input label="Peso médio inicial" type="number" error={errors.peso_inicial} value={form.peso_inicial} onChange={(e) => setForm((p) => ({ ...p, peso_inicial: e.target.value }))} /><Input label="Quantidade inicial" type="number" error={errors.qtd_inicial} value={form.qtd_inicial} onChange={(e) => setForm((p) => ({ ...p, qtd_inicial: e.target.value }))} /><Input label="Custo de aquisição" prefix="R$" type="number" value={form.custo_aquisicao} onChange={(e) => setForm((p) => ({ ...p, custo_aquisicao: e.target.value }))} /><Input label="Peso alvo" suffix="kg" type="number" value={form.peso_alvo} onChange={(e) => setForm((p) => ({ ...p, peso_alvo: e.target.value }))} /><Input label="Data alvo de saída" type="date" value={form.saida_meta} onChange={(e) => setForm((p) => ({ ...p, saida_meta: e.target.value }))} /><label className="full">Observações<textarea value={form.obs} onChange={(e) => setForm((p) => ({ ...p, obs: e.target.value }))} /></label></div></Modal>; }

function daysFrom(dateStr) { if (!dateStr) return 0; return Math.max(0, Math.round((new Date() - new Date(dateStr)) / 86400000)); }
function daysBetween(a, b) { if (!a || !b) return 0; return Math.round((new Date(b) - new Date(a)) / 86400000); }
function calcGmd30(pesagens, loteId) { const data = pesagens.filter((p) => p.lote_id === loteId).sort((a, b) => new Date(a.data) - new Date(b.data)); if (data.length < 2) return 0; const last = data[data.length - 1]; const prev = [...data].reverse().find((p) => daysBetween(p.data, last.data) >= 15) || data[data.length - 2]; return (Number(last.peso_medio) - Number(prev.peso_medio)) / Math.max(daysBetween(prev.data, last.data), 1); }
function groupCustos(custos) { const map = {}; custos.forEach((c) => { map[c.cat] = (map[c.cat] || 0) + Number(c.val || 0); }); return Object.entries(map).map(([cat, valor]) => ({ cat, valor })); }
