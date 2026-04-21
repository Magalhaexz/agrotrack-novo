import { useMemo, useState } from 'react';
import { CheckSquare, Package, Pill, Scale, Syringe, Truck, Leaf } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { gerarNovoId } from '../utils/id';
import { formatDate } from '../utils/calculations';

const typeMap = {
  vacina: { icon: Syringe, color: '#2b6cb0' },
  vermifugo: { icon: Pill, color: '#7e22ce' },
  pesagem: { icon: Scale, color: '#2d6a4f' },
  dieta: { icon: Leaf, color: '#dd6b20' },
  estoque: { icon: Package, color: '#c53030' },
  saida: { icon: Truck, color: '#6b7280' },
  livre: { icon: CheckSquare, color: '#6b7280' },
};

export default function CalendarioOperacionalPage({ db, setDb }) {
  const [selected, setSelected] = useState(new Date().toISOString().slice(0,10));
  const [open, setOpen] = useState(false);

  const events = useMemo(() => (db.eventos_operacionais || []).slice().sort((a,b)=> new Date(a.data)-new Date(b.data)), [db.eventos_operacionais]);
  const byDate = useMemo(() => events.filter((e) => e.data === selected), [events, selected]);

  return (
    <div className="page rebanho-page">
      <div className="rebanho-header"><h1>Calendário Operacional</h1><Button onClick={() => setOpen(true)}>Novo Evento</Button></div>
      <div className="dashboard-grid dashboard-grid--dual" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <Card title="Calendário mensal">
          <SimpleCalendar selected={selected} onSelect={setSelected} events={events} />
        </Card>
        <Card title={`Eventos em ${formatDate(selected)}`}>
          <div className="alerts-list">
            {byDate.length === 0 ? <p>Sem eventos no dia.</p> : byDate.map((ev) => {
              const cfg = typeMap[ev.tipo] || typeMap.livre;
              const Icon = cfg.icon;
              return <div key={ev.id} className="alert-item"><Icon size={14} style={{ color: cfg.color }} /><div><strong>{ev.titulo}</strong><p>{ev.status} · {ev.responsavel || 'Sem responsável'} · {ev.loteNome || 'Geral'}</p></div></div>;
            })}
          </div>
        </Card>
      </div>
      {open && <NovoEventoModal db={db} setDb={setDb} onClose={() => setOpen(false)} />}
    </div>
  );
}

function SimpleCalendar({ selected, onSelect, events }) {
  const d = new Date(selected);
  const y = d.getFullYear();
  const m = d.getMonth();
  const first = new Date(y,m,1);
  const start = first.getDay();
  const days = new Date(y,m+1,0).getDate();
  const arr = Array.from({ length: start + days }, (_,i)=> i<start ? null : `${y}-${String(m+1).padStart(2,'0')}-${String(i-start+1).padStart(2,'0')}`);

  return <div className="calendar-grid">{arr.map((day,idx)=>{
    const dayEvents = day ? events.filter((e)=>e.data===day) : [];
    const color = getDotColor(dayEvents);
    return <button key={idx} type="button" className={`cal-day ${day===selected?'active':''}`} onClick={()=>day&&onSelect(day)}>{day?Number(day.slice(8)):''}{color && <span className="cal-dot" style={{ background: color }} />}</button>;
  })}</div>;
}

function getDotColor(events) {
  if (!events.length) return '';
  if (events.some((e) => e.status === 'atrasado')) return '#c53030';
  if (events.some((e) => e.status === 'hoje')) return '#dd6b20';
  if (events.some((e) => e.status === 'programado')) return '#2b6cb0';
  return '#2d6a4f';
}

function NovoEventoModal({ db, setDb, onClose }) {
  const [form, setForm] = useState({ tipo:'vacina', titulo:'', data:'', lote_id:'', responsavel:'', recorrencia:'nenhuma', alerta_antes:1, status:'programado' });
  function submit() {
    if (!form.data || !form.titulo) return;
    const lote = (db.lotes || []).find((l)=>Number(l.id)===Number(form.lote_id));
    setDb((prev)=>({ ...prev, eventos_operacionais:[...(prev.eventos_operacionais||[]), { id: gerarNovoId(prev.eventos_operacionais||[]), ...form, loteNome: lote?.nome || null }] }));
    onClose();
  }
  return <Modal open onClose={onClose} title="Novo evento operacional" footer={<Button onClick={submit}>Salvar evento</Button>}>
    <div className="form-grid two">
      <label>Tipo<select value={form.tipo} onChange={(e)=>setForm((p)=>({...p,tipo:e.target.value}))}>{Object.keys(typeMap).map((t)=><option key={t} value={t}>{t}</option>)}</select></label>
      <Input label="Título/descrição" value={form.titulo} onChange={(e)=>setForm((p)=>({...p,titulo:e.target.value}))} />
      <Input label="Data" type="date" value={form.data} onChange={(e)=>setForm((p)=>({...p,data:e.target.value}))} />
      <label>Lote<select value={form.lote_id} onChange={(e)=>setForm((p)=>({...p,lote_id:e.target.value}))}><option value="">Opcional</option>{(db.lotes||[]).map((l)=><option key={l.id} value={l.id}>{l.nome}</option>)}</select></label>
      <Input label="Responsável" value={form.responsavel} onChange={(e)=>setForm((p)=>({...p,responsavel:e.target.value}))} />
      <label>Recorrência<select value={form.recorrencia} onChange={(e)=>setForm((p)=>({...p,recorrencia:e.target.value}))}><option value="nenhuma">Nenhuma</option><option value="semanal">Semanal</option><option value="quinzenal">Quinzenal</option><option value="mensal">Mensal</option><option value="anual">Anual</option></select></label>
      <label>Notificação antecipada<select value={form.alerta_antes} onChange={(e)=>setForm((p)=>({...p,alerta_antes:Number(e.target.value)}))}><option value={0}>0 dia</option><option value={1}>1 dia</option><option value={3}>3 dias</option><option value={7}>7 dias</option></select></label>
    </div>
  </Modal>;
}
