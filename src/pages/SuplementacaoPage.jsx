import { useMemo, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import { formatCurrency, formatDate, formatNumber } from '../utils/calculations';
import { gerarNovoId } from '../utils/id';

export default function SuplementacaoPage({ db, setDb }) {
  const [openDieta, setOpenDieta] = useState(false);
  const [openConsumo, setOpenConsumo] = useState(false);

  const dietas = db.dietas || [];
  const lotesAtivos = (db.lotes || []).filter((l) => l.status === 'ativo');

  const consumoRows = useMemo(() => {
    return lotesAtivos.map((lote) => {
      const dieta = dietas.find((d) => Number(d.lote_id) === Number(lote.id));
      const cabecas = (db.animais || []).filter((a) => a.lote_id === lote.id).reduce((s, a) => s + Number(a.qtd || 0), 0);
      const previstoDia = dieta ? dieta.itens.reduce((s, i) => s + Number(i.qtd_cab_dia || 0) * cabecas, 0) : 0;
      const reais = (db.consumo_suplementacao || []).filter((c) => Number(c.lote_id) === Number(lote.id));
      const realDia = reais.length ? reais.reduce((s, r) => s + Number(r.qtd_total || 0), 0) / reais.length : 0;
      return { lote, dieta, cabecas, previstoDia, realDia, diff: realDia - previstoDia };
    });
  }, [db, dietas, lotesAtivos]);

  const projecao = useMemo(() => {
    const itemMap = {};
    consumoRows.forEach((r) => {
      if (!r.dieta) return;
      r.dieta.itens.forEach((it) => {
        itemMap[it.item_estoque_id] = (itemMap[it.item_estoque_id] || 0) + Number(it.qtd_cab_dia || 0) * r.cabecas;
      });
    });
    return Object.entries(itemMap).map(([itemId, consumoDia]) => {
      const item = (db.estoque || []).find((e) => Number(e.id) === Number(itemId));
      const saldo = Number(item?.quantidade_atual || 0);
      const dias = consumoDia > 0 ? saldo / consumoDia : 999;
      return { item, consumoDia, dias };
    });
  }, [consumoRows, db.estoque]);

  return (
    <div className="page rebanho-page">
      <div className="rebanho-header">
        <h1>Suplementação</h1>
        <div className="lote-actions">
          <Button onClick={() => setOpenDieta(true)}>Cadastrar dieta</Button>
          <Button variant="outline" onClick={() => setOpenConsumo(true)}>Registrar consumo diário</Button>
        </div>
      </div>

      <Card title="Dietas vinculadas por lote">
        <table className="dashboard-table"><thead><tr><th>Lote</th><th>Dieta</th><th>Itens</th></tr></thead><tbody>
          {lotesAtivos.map((l) => {
            const d = dietas.find((x) => Number(x.lote_id) === Number(l.id));
            return <tr key={l.id}><td>{l.nome}</td><td>{d?.nome || 'Sem dieta'}</td><td>{d ? d.itens.map((i) => `${i.item_nome}: ${i.qtd_cab_dia}/cab/dia`).join(' | ') : '—'}</td></tr>;
          })}
        </tbody></table>
      </Card>

      <Card title="Consumo previsto x real">
        <table className="dashboard-table"><thead><tr><th>Lote</th><th>Dieta</th><th>Previsto/dia</th><th>Real/dia</th><th>Diferença</th></tr></thead><tbody>
          {consumoRows.map((r) => <tr key={r.lote.id}><td>{r.lote.nome}</td><td>{r.dieta?.nome || '—'}</td><td>{formatNumber(r.previstoDia, 2)}</td><td>{formatNumber(r.realDia, 2)}</td><td className={r.diff <= 0 ? 'positive' : 'negative'}>{formatNumber(r.diff, 2)}</td></tr>)}
        </tbody></table>
      </Card>

      <Card title="Projeção de estoque por consumo médio">
        <div className="alerts-list">
          {projecao.map((p) => <div key={p.item?.id} className="alert-item"><Badge variant={p.dias < 7 ? 'danger' : 'info'}>{p.dias < 7 ? 'Alerta < 7 dias' : 'OK'}</Badge><div><strong>{p.item?.produto}</strong><p>Consumo/dia: {formatNumber(p.consumoDia, 2)} · Dias restantes: {formatNumber(p.dias, 1)}</p></div></div>)}
        </div>
      </Card>

      {openDieta && <DietaModal db={db} setDb={setDb} onClose={() => setOpenDieta(false)} />}
      {openConsumo && <ConsumoModal db={db} setDb={setDb} onClose={() => setOpenConsumo(false)} />}
    </div>
  );
}

function DietaModal({ db, setDb, onClose }) {
  const [form, setForm] = useState({ nome: '', lote_id: '', itens: [{ item_estoque_id: '', qtd_cab_dia: '' }] });
  function updateItem(idx, key, val) { setForm((p) => ({ ...p, itens: p.itens.map((i, j) => j === idx ? { ...i, [key]: val } : i) })); }
  function addItem() { setForm((p) => ({ ...p, itens: [...p.itens, { item_estoque_id: '', qtd_cab_dia: '' }] })); }
  function submit() {
    const itens = form.itens.filter((i) => i.item_estoque_id && i.qtd_cab_dia).map((i) => ({ ...i, item_nome: (db.estoque || []).find((e) => Number(e.id) === Number(i.item_estoque_id))?.produto }));
    if (!form.nome || !form.lote_id || !itens.length) return;
    setDb((prev) => ({ ...prev, dietas: [...(prev.dietas || []), { id: gerarNovoId(prev.dietas || []), nome: form.nome, lote_id: Number(form.lote_id), itens }] }));
    onClose();
  }
  return <Modal open onClose={onClose} title="Cadastro de dieta" size="lg" footer={<Button onClick={submit}>Salvar dieta</Button>}><div className="form-grid two"><Input label="Nome da dieta" value={form.nome} onChange={(e)=>setForm((p)=>({...p,nome:e.target.value}))} /><label>Lote<select value={form.lote_id} onChange={(e)=>setForm((p)=>({...p,lote_id:e.target.value}))}><option value="">Selecione</option>{(db.lotes||[]).filter((l)=>l.status==='ativo').map((l)=><option key={l.id} value={l.id}>{l.nome}</option>)}</select></label>{form.itens.map((it,idx)=><div key={idx} className="form-grid two full"><label>Item<select value={it.item_estoque_id} onChange={(e)=>updateItem(idx,'item_estoque_id',e.target.value)}><option value="">Selecione</option>{(db.estoque||[]).map((e)=><option key={e.id} value={e.id}>{e.produto}</option>)}</select></label><Input label="Qtd/cab/dia" type="number" value={it.qtd_cab_dia} onChange={(e)=>updateItem(idx,'qtd_cab_dia',e.target.value)} /></div>)}<Button variant="ghost" onClick={addItem}>+ adicionar item</Button></div></Modal>;
}

function ConsumoModal({ db, setDb, onClose }) {
  const [form, setForm] = useState({ lote_id: '', data: '', qtd_total: '' });
  const dieta = (db.dietas || []).find((d) => Number(d.lote_id) === Number(form.lote_id));
  const cabecas = (db.animais || []).filter((a) => Number(a.lote_id) === Number(form.lote_id)).reduce((s, a) => s + Number(a.qtd || 0), 0);
  const previsto = dieta ? dieta.itens.reduce((s, i) => s + Number(i.qtd_cab_dia || 0) * cabecas, 0) : 0;

  function submit() {
    if (!form.lote_id || !form.data) return;
    const qtdTotal = Number(form.qtd_total || previsto);
    if (!dieta) return;

    setDb((prev) => {
      let estoque = prev.estoque.slice();
      const movEst = [...(prev.movimentacoes_estoque || [])];
      const movFin = [...(prev.movimentacoes_financeiras || [])];
      dieta.itens.forEach((it) => {
        const qtdItem = Number(it.qtd_cab_dia || 0) * cabecas;
        estoque = estoque.map((e) => e.id === Number(it.item_estoque_id) ? { ...e, quantidade_atual: Math.max(0, Number(e.quantidade_atual || 0) - qtdItem) } : e);
        const item = prev.estoque.find((e) => e.id === Number(it.item_estoque_id));
        const valor = qtdItem * Number(item?.valor_unitario || 0);
        movEst.push({ id: gerarNovoId(movEst), item_estoque_id: Number(it.item_estoque_id), tipo: 'consumo', lote_id: Number(form.lote_id), quantidade: qtdItem, data: form.data, valor_total: valor, obs: 'Consumo suplementação' });
        movFin.push({ id: gerarNovoId(movFin), tipo: 'despesa', categoria: 'Alimentação', valor, data: form.data, lote_id: Number(form.lote_id), descricao: `Consumo dieta ${dieta.nome}` });
      });
      return { ...prev, estoque, movimentacoes_estoque: movEst, movimentacoes_financeiras: movFin, consumo_suplementacao: [...(prev.consumo_suplementacao || []), { id: gerarNovoId(prev.consumo_suplementacao || []), lote_id: Number(form.lote_id), data: form.data, qtd_total: qtdTotal }] };
    });
    onClose();
  }

  return <Modal open onClose={onClose} title="Registrar consumo diário" footer={<Button onClick={submit}>Confirmar consumo</Button>}><div className="form-grid two"><label>Lote<select value={form.lote_id} onChange={(e)=>setForm((p)=>({...p,lote_id:e.target.value}))}><option value="">Selecione</option>{(db.lotes||[]).filter((l)=>l.status==='ativo').map((l)=><option key={l.id} value={l.id}>{l.nome}</option>)}</select></label><Input label="Data" type="date" value={form.data} onChange={(e)=>setForm((p)=>({...p,data:e.target.value}))} /><Input label="Consumo previsto" value={formatNumber(previsto,2)} readOnly /><Input label="Consumo real (ajuste)" type="number" value={form.qtd_total} onChange={(e)=>setForm((p)=>({...p,qtd_total:e.target.value}))} /><p className="full">Dieta: {dieta?.nome || '—'}</p></div></Modal>;
}
