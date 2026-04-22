import { formatDate } from '../utils/calculations'; // Assuming this function is robust

// Constants for clarity and easy modification
const MS_PER_DAY = 86400000;
const CRITICAL_STOCK_THRESHOLD_PERCENT = 0.2; // 20% of peak
const CALENDAR_ALERT_DAYS_THRESHOLD = 7; // Alert for events within 7 days (including overdue)
const PESAGEM_NO_ALERT_DAYS_THRESHOLD = 30; // No alert if last weighing was within 30 days
const PESAGEM_VENCIDO_DAYS_THRESHOLD = 45; // Weighing overdue if more than 45 days
const LOTE_SAIDA_ALERT_DAYS_THRESHOLD = 7; // Alert for lot exit within 7 days (including overdue)

function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const dt = new Date(dateStr); dt.setHours(0, 0, 0, 0);
  return Math.round((dt - now) / MS_PER_DAY);
}

function urgenciaFromDays(days) {
  if (days < 0) return 'vencido';
  if (days === 0) return 'hoje';
  return 'proximo';
}

export function gerarAlertasEstoque(db) {
  const movs = db.movimentacoes_estoque || [];
  // Pre-index movements for efficiency
  const movsByItemId = new Map();
  movs.forEach(m => {
    const itemId = Number(m.item_estoque_id);
    if (!movsByItemId.has(itemId)) {
      movsByItemId.set(itemId, []);
    }
    movsByItemId.get(itemId).push(m);
  });

  return (db.estoque || []).flatMap((item) => {
    const historico = movsByItemId.get(Number(item.id)) || [];
    const atual = Number(item.quantidade_atual || 0);

    // Calculate peak from current and historical movements
    const allQuantities = [atual, ...historico.map((m) => Number(m.quantidade || 0))];
    const pico = allQuantities.length > 0 ? Math.max(...allQuantities) : 0;

    // Alert if current quantity is less than CRITICAL_STOCK_THRESHOLD_PERCENT of the peak
    if (!pico || atual >= pico * CRITICAL_STOCK_THRESHOLD_PERCENT) return [];

    return [{
      id: `estoque-${item.id}`,
      ackKey: `estoque-${item.id}`,
      origem: 'estoque',
      urgencia: 'critico', // Changed urgency to 'critico' for better semantic meaning
      title: `Estoque crítico: ${item.produto}`,
      description: `Saldo atual ${atual} ${item.unidade || ''} (${formatDate(new Date().toISOString().slice(0, 10))})`,
      action: 'Ver estoque',
      route: 'estoque',
    }];
  });
}

export function gerarAlertasCalendario(db) {
  // Combine all potential event sources
  const allEvents = [
    ...(db.eventos_operacionais || []),
    ...(db.sanitario || [])
  ];

  // Pre-index employees to resolve responsible names
  const funcionariosMap = new Map((db.funcionarios || []).map(f => [f.id, f.nome]));

  return allEvents.map((ev) => {
    const data = ev.data || ev.proxima;
    const days = daysUntil(data);
    const responsibleName = ev.funcionario_responsavel_id ? funcionariosMap.get(ev.funcionario_responsavel_id) : (ev.responsavel || 'Sem responsável');

    return {
      id: `cal-${ev.id}`,
      ackKey: `cal-${ev.id}`,
      origem: 'calendario',
      urgencia: urgenciaFromDays(days),
      title: ev.titulo || ev.desc || 'Evento operacional',
      description: `${formatDate(data)} · ${responsibleName}`,
      action: 'Abrir evento',
      route: 'calendarioOperacional',
      days,
    };
  }).filter((a) => Number.isFinite(a.days) && a.days <= CALENDAR_ALERT_DAYS_THRESHOLD);
}

export function gerarAlertasPesagem(db) {
  const pesagens = db.pesagens || [];
  // Pre-process pesagens to find the latest for each lot
  const latestPesagensByLoteId = new Map();
  pesagens.sort((a, b) => new Date(b.data) - new Date(a.data)); // Sort once descending
  pesagens.forEach(p => {
    if (!latestPesagensByLoteId.has(p.lote_id)) {
      latestPesagensByLoteId.set(p.lote_id, p);
    }
  });

  return (db.lotes || []).filter((l) => l.status === 'ativo').flatMap((l) => {
    const ultima = latestPesagensByLoteId.get(l.id);

    if (!ultima) {
      return [{
        id: `pes-${l.id}`,
        ackKey: `pes-${l.id}`,
        origem: 'pesagem',
        urgencia: 'vencido',
        title: `Lote ${l.nome} sem pesagem`,
        description: 'Registrar primeira pesagem',
        action: 'Registrar pesagem',
        route: 'pesagens'
      }];
    }

    const daysSinceLastWeighing = daysUntil(ultima.data) * -1; // Days since last weighing
    if (daysSinceLastWeighing <= PESAGEM_NO_ALERT_DAYS_THRESHOLD) return []; // No alert if last weighing was within threshold

    return [{
      id: `pes-${l.id}`,
      ackKey: `pes-${l.id}`,
      origem: 'pesagem',
      urgencia: daysSinceLastWeighing > PESAGEM_VENCIDO_DAYS_THRESHOLD ? 'vencido' : 'proximo',
      title: `Pesagem atrasada: ${l.nome}`,
      description: `Última pesagem há ${daysSinceLastWeighing} dias`,
      action: 'Registrar pesagem',
      route: 'pesagens'
    }];
  });
}

export function gerarAlertasLote(db) {
  return (db.lotes || []).filter((l) => l.status === 'ativo' && l.saida).flatMap((l) => {
    const days = daysUntil(l.saida);
    if (days > LOTE_SAIDA_ALERT_DAYS_THRESHOLD) return []; // Only alert if exit is within threshold or overdue

    return [{
      id: `lote-${l.id}`,
      ackKey: `lote-${l.id}`,
      origem: 'lote',
      urgencia: urgenciaFromDays(days),
      title: `Saída prevista: ${l.nome}`,
      description: `Prevista para ${formatDate(l.saida)}`,
      action: 'Ver lote',
      route: 'lotes',
      days
    }];
  });
}

export function ordenarAlertas(alerts = []) {
  // Updated rank to include 'critico'
  const rank = { vencido: 0, hoje: 1, critico: 2, proximo: 3 };
  return alerts.slice().sort((a, b) => (rank[a.urgencia] ?? 9) - (rank[b.urgencia] ?? 9));
}
