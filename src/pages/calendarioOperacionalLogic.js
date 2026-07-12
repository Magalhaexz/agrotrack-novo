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
