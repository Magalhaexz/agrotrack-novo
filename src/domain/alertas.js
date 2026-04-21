import { formatDate } from '../utils/calculations';

function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  const now = new Date(); now.setHours(0,0,0,0);
  const dt = new Date(dateStr); dt.setHours(0,0,0,0);
  return Math.round((dt - now) / 86400000);
}

function urgenciaFromDays(days) {
  if (days < 0) return 'vencido';
  if (days === 0) return 'hoje';
  return 'proximo';
}

export function gerarAlertasEstoque(db) {
  const movs = db.movimentacoes_estoque || [];
  return (db.estoque || []).flatMap((item) => {
    const historico = movs.filter((m) => Number(m.item_estoque_id) === Number(item.id));
    const pico = Math.max(Number(item.quantidade_atual || 0), ...historico.map((m) => Number(m.quantidade || 0)));
    const atual = Number(item.quantidade_atual || 0);
    if (!pico || atual >= pico * 0.2) return [];
    return [{
      id: `estoque-${item.id}`,
      ackKey: `estoque-${item.id}`,
      origem: 'estoque',
      urgencia: 'vencido',
      title: `Estoque crítico: ${item.produto}`,
      description: `Saldo atual ${atual} ${item.unidade || ''} (${formatDate(new Date().toISOString().slice(0,10))})`,
      action: 'Ver estoque',
      route: 'estoque',
    }];
  });
}

export function gerarAlertasCalendario(db) {
  return (db.eventos_operacionais || db.sanitario || []).map((ev) => {
    const data = ev.data || ev.proxima;
    const days = daysUntil(data);
    return {
      id: `cal-${ev.id}`,
      ackKey: `cal-${ev.id}`,
      origem: 'calendario',
      urgencia: urgenciaFromDays(days),
      title: ev.titulo || ev.desc || 'Evento operacional',
      description: `${formatDate(data)} · ${ev.responsavel || 'Sem responsável'}`,
      action: 'Abrir evento',
      route: 'calendarioOperacional',
      days,
    };
  }).filter((a) => Number.isFinite(a.days) && a.days <= 7);
}

export function gerarAlertasPesagem(db) {
  const pesagens = db.pesagens || [];
  return (db.lotes || []).filter((l) => l.status === 'ativo').flatMap((l) => {
    const ultima = pesagens.filter((p) => p.lote_id === l.id).sort((a,b)=>new Date(b.data)-new Date(a.data))[0];
    if (!ultima) return [{ id:`pes-${l.id}`, ackKey:`pes-${l.id}`, origem:'pesagem', urgencia:'vencido', title:`Lote ${l.nome} sem pesagem`, description:'Registrar primeira pesagem', action:'Registrar pesagem', route:'pesagens'}];
    const days = daysUntil(ultima.data) * -1;
    if (days <= 30) return [];
    return [{ id:`pes-${l.id}`, ackKey:`pes-${l.id}`, origem:'pesagem', urgencia: days > 45 ? 'vencido' : 'proximo', title:`Pesagem atrasada: ${l.nome}`, description:`Última pesagem há ${days} dias`, action:'Registrar pesagem', route:'pesagens' }];
  });
}

export function gerarAlertasLote(db) {
  return (db.lotes || []).filter((l) => l.status === 'ativo' && l.saida).flatMap((l) => {
    const days = daysUntil(l.saida);
    if (days > 7) return [];
    return [{ id:`lote-${l.id}`, ackKey:`lote-${l.id}`, origem:'lote', urgencia:urgenciaFromDays(days), title:`Saída prevista: ${l.nome}`, description:`Prevista para ${formatDate(l.saida)}`, action:'Ver lote', route:'lotes', days }];
  });
}

export function ordenarAlertas(alerts = []) {
  const rank = { vencido: 0, hoje: 1, proximo: 2 };
  return alerts.slice().sort((a,b)=> (rank[a.urgencia] ?? 9) - (rank[b.urgencia] ?? 9));
}
