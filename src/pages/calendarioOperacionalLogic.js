// Lógica pura de CalendarioOperacionalPage.jsx extraída para arquivo .js
// (mesmo padrão de lotesLogic.js) para ser testável pelo runner de testes do
// projeto, que não transforma JSX.

export function matchesRotinaRecurrence(rotina, date) {
  const freq = String(rotina?.recorrencia_tipo || '').toLowerCase();
  const weekday = date.getDay();

  // RotinaForm.jsx só oferece 'diaria' e 'semanal' ao usuário — sem este
  // ramo, toda rotina recorrente diária ficava invisível no Calendário
  // Operacional (caía no `return false` final), embora aparecesse
  // corretamente em "Tarefas para hoje" da RotinaPage.
  if (freq === 'diaria') {
    const inicio = rotina?.data_inicio ? new Date(`${rotina.data_inicio}T00:00:00`) : date;
    return date >= inicio;
  }

  if (freq === 'semanal') {
    const dias = Array.isArray(rotina?.dias_semana) ? rotina.dias_semana : [weekday];
    return dias.includes(weekday);
  }

  if (freq === 'quinzenal') {
    const inicio = rotina?.data_inicio ? new Date(`${rotina.data_inicio}T00:00:00`) : date;
    const diff = Math.floor((date - inicio) / 86400000);
    return diff >= 0 && diff % 14 === 0;
  }

  if (freq === 'mensal') {
    const inicio = rotina?.data_inicio ? new Date(`${rotina.data_inicio}T00:00:00`) : date;
    return date.getDate() === inicio.getDate();
  }

  if (freq === 'anual') {
    const inicio = rotina?.data_inicio ? new Date(`${rotina.data_inicio}T00:00:00`) : date;
    return date.getDate() === inicio.getDate() && date.getMonth() === inicio.getMonth();
  }

  return false;
}

// Recorrência de `eventos_operacionais` (campo "Novo evento" do Calendário).
// Entidade separada de `rotinas` — sem `dias_semana` (semanal repete no
// mesmo dia da semana de `data_inicio`) e sem `data_fim` (a janela de
// expansão é limitada externamente, igual a `expandRecurringRotinas`).
export function matchesEventoRecurrence(evento, date) {
  const freq = String(evento?.metadata?.recorrencia || 'nenhuma').toLowerCase();
  if (freq === 'nenhuma' || !freq) return false;

  const dataInicioStr = String(evento?.data_inicio || evento?.data || '').slice(0, 10);
  if (!dataInicioStr) return false;
  const inicio = new Date(`${dataInicioStr}T00:00:00`);
  if (date < inicio) return false;

  if (freq === 'semanal') {
    return date.getDay() === inicio.getDay();
  }

  if (freq === 'quinzenal') {
    const diff = Math.floor((date - inicio) / 86400000);
    return diff % 14 === 0;
  }

  if (freq === 'mensal') {
    return date.getDate() === inicio.getDate();
  }

  if (freq === 'anual') {
    return date.getDate() === inicio.getDate() && date.getMonth() === inicio.getMonth();
  }

  return false;
}
