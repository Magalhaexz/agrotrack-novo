// Tratativa operacional de alertas (Sprint 16) — puro, sem I/O. A tratativa é
// uma camada SOBRE o alerta já gerado por `gerarAlertasUnificados`
// (alertasUnificados.js) — nunca substitui a regra de origem, nunca apaga o
// alerta: só muda como/se ele aparece para o usuário.
//
// Persistência real fica em `services/tratativasAlertas.js` (tabela
// `alertas_tratativas`, Sprint 16). Este módulo não sabe nada sobre Supabase.
export const STATUS_TRATATIVA = {
  EM_ANALISE: 'em_analise',
  RESOLVIDO: 'resolvido',
  ADIADO: 'adiado',
  IGNORADO: 'ignorado',
};

const STATUS_VALIDOS = new Set(Object.values(STATUS_TRATATIVA));

export function validarStatusTratativa(status) {
  return STATUS_VALIDOS.has(status);
}

function hojeISO(hoje) {
  if (hoje instanceof Date) return hoje.toISOString().slice(0, 10);
  if (typeof hoje === 'string' && hoje) return hoje.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

/**
 * Decide se um alerta deve aparecer na lista ATIVA (Central, Dashboard,
 * Telegram) dada sua tratativa. Nunca some — resolvido/ignorado/adiado
 * continuam existindo, só não contam como prioridade ativa.
 */
export function deveExibirAlerta(alerta, tratativa, hoje) {
  if (!tratativa) return true;
  if (tratativa.status === STATUS_TRATATIVA.EM_ANALISE) return true;
  if (tratativa.status === STATUS_TRATATIVA.RESOLVIDO) return false;
  if (tratativa.status === STATUS_TRATATIVA.IGNORADO) return false;
  if (tratativa.status === STATUS_TRATATIVA.ADIADO) {
    const ate = String(tratativa.adiado_ate || tratativa.adiadoAte || '').slice(0, 10);
    if (!ate) return true; // adiado sem data válida — não bloqueia, evita esconder por engano
    return ate < hojeISO(hoje); // vencido volta a aparecer; futuro fica oculto
  }
  return true;
}

/**
 * Anota cada alerta com sua tratativa (se houver) e se deve aparecer como
 * ativo (`visivel`). Nunca remove alertas da lista — quem quiser só os
 * ativos usa `.filter((a) => a.visivel)`; quem quiser histórico usa a lista
 * inteira. `alertas` pode vir de `gerarAlertasUnificados` (bruto) ou já
 * normalizado por `centralAlertas.js` — só precisa ter um campo `id`.
 */
export function aplicarTratativasAosAlertas(alertas = [], tratativas = [], hoje) {
  const lista = Array.isArray(alertas) ? alertas : [];
  const porAlertaId = new Map();
  (Array.isArray(tratativas) ? tratativas : []).forEach((tratativa) => {
    const alertaId = String(tratativa?.alerta_id ?? tratativa?.alertaId ?? '');
    if (alertaId) porAlertaId.set(alertaId, tratativa);
  });

  return lista.map((alerta) => {
    const tratativa = porAlertaId.get(String(alerta?.id ?? '')) || null;
    return {
      ...alerta,
      tratativa,
      statusTratativa: tratativa?.status || null,
      visivel: deveExibirAlerta(alerta, tratativa, hoje),
    };
  });
}

/**
 * Monta o objeto seguro para persistência de uma tratativa (criação ou
 * atualização). Retorna `null` quando os dados são inválidos (sem
 * `alertaId`, ou `status` fora do enum) — nunca gera NaN/undefined nos
 * campos importantes.
 */
export function criarTratativaAlerta({
  alertaId,
  alertaTipo,
  origem,
  status,
  observacao,
  adiadoAte,
  ownerUserId,
  fazendaId,
} = {}) {
  const alertaIdSeguro = String(alertaId ?? '').trim();
  if (!alertaIdSeguro) return null;
  if (!validarStatusTratativa(status)) return null;

  const adiadoAteSeguro = status === STATUS_TRATATIVA.ADIADO
    ? (String(adiadoAte || '').slice(0, 10) || null)
    : null;

  return {
    alerta_id: alertaIdSeguro,
    alerta_tipo: alertaTipo ? String(alertaTipo) : null,
    origem: origem ? String(origem) : null,
    status,
    observacao: observacao ? String(observacao).trim() : null,
    adiado_ate: adiadoAteSeguro,
    resolvido_em: status === STATUS_TRATATIVA.RESOLVIDO ? new Date().toISOString() : null,
    owner_user_id: ownerUserId ?? null,
    fazenda_id: fazendaId ?? null,
  };
}

/**
 * Conta alertas por status de tratativa. `ativos` = tudo que ainda aparece
 * como prioridade (sem tratativa, em análise, ou adiado já vencido).
 */
export function resumirTratativas(alertasComTratativas = []) {
  const lista = Array.isArray(alertasComTratativas) ? alertasComTratativas : [];
  return lista.reduce((acc, alerta) => {
    if (alerta.visivel) acc.ativos += 1;
    if (alerta.statusTratativa === STATUS_TRATATIVA.EM_ANALISE) acc.emAnalise += 1;
    else if (alerta.statusTratativa === STATUS_TRATATIVA.ADIADO && !alerta.visivel) acc.adiados += 1;
    else if (alerta.statusTratativa === STATUS_TRATATIVA.RESOLVIDO) acc.resolvidos += 1;
    else if (alerta.statusTratativa === STATUS_TRATATIVA.IGNORADO) acc.ignorados += 1;
    return acc;
  }, { ativos: 0, emAnalise: 0, adiados: 0, resolvidos: 0, ignorados: 0 });
}
