// Tratativas de alerta via linguagem natural (bot operacional
// determinístico, Sprint Paridade 1 bloco 5). Puro, sem I/O. Usa
// EXCLUSIVAMENTE `alertas_tratativas` (fonte canônica desde a unificação do
// motor de alertas) — nunca as tabelas legadas (`alertas_resolvidos`/
// `alertas_adiados`). Mesma tabela, mesma fórmula (`gerarAlertasUnificados`
// + `aplicarTratativasAosAlertas`) que o Dashboard/Central já usam: uma
// tratativa registrada pelo bot aparece igual nos três lugares.
import { gerarAlertasUnificados } from '../alertasUnificados.js';
import { aplicarTratativasAosAlertas, criarTratativaAlerta, STATUS_TRATATIVA } from '../tratativasAlertas.js';
import { enriquecerAlertasComFazenda } from '../telegramFazenda.js';
import { normalizarChave } from './resolvedores.js';

const erro = (codigo, extra = {}) => ({ ok: false, erro: codigo, ...extra });

// Mesmo limite de exibição de `respostaAlertas` (_telegramBot.js) — um
// alerta fora da lista numerada não é endereçável por número, só por texto.
const LIMITE_LISTA = 8;

/** Alertas ativos (com tratativa aplicada), na mesma ordem/corte que VER_ALERTAS mostra. */
export function listarAlertasAtivosNumerados(db, identificarFazenda, hoje = new Date()) {
  const brutos = gerarAlertasUnificados(db);
  const visiveis = aplicarTratativasAosAlertas(brutos, db?.alertas_tratativas, hoje).filter((a) => a.visivel);
  const alertas = enriquecerAlertasComFazenda(visiveis, db, identificarFazenda).filter((a) => a?.prioridade !== 'informativo');
  return alertas.slice(0, LIMITE_LISTA);
}

/** Alertas que JÁ têm uma tratativa registrada (candidatos a reabrir), numerados. */
function listarAlertasComTratativa(db, identificarFazenda, hoje = new Date()) {
  const brutos = gerarAlertasUnificados(db);
  const comTratativa = aplicarTratativasAosAlertas(brutos, db?.alertas_tratativas, hoje).filter((a) => a.tratativa);
  return enriquecerAlertasComFazenda(comTratativa, db, identificarFazenda).filter((a) => a?.prioridade !== 'informativo');
}

/** Resolve "3" (posição na lista) ou um trecho do título contra uma lista já numerada. */
function resolverAlertaPorReferencia(alertasNumerados, referencia) {
  const ref = String(referencia || '').trim();
  if (!ref) return { status: 'nao_encontrado' };
  if (/^\d+$/.test(ref)) {
    const idx = Number(ref) - 1;
    if (idx >= 0 && idx < alertasNumerados.length) return { status: 'ok', alerta: alertasNumerados[idx] };
    return { status: 'nao_encontrado' };
  }
  const alvo = normalizarChave(ref);
  const exatos = alertasNumerados.filter((a) => normalizarChave(a.titulo) === alvo);
  if (exatos.length === 1) return { status: 'ok', alerta: exatos[0] };
  if (exatos.length > 1) return { status: 'ambiguo', candidatos: exatos };
  const parciais = alertasNumerados.filter((a) => normalizarChave(a.titulo).includes(alvo));
  if (parciais.length === 1) return { status: 'ok', alerta: parciais[0] };
  if (parciais.length > 1) return { status: 'ambiguo', candidatos: parciais };
  return { status: 'nao_encontrado' };
}

function buscarTratativaExistente(db, alertaId) {
  return (Array.isArray(db?.alertas_tratativas) ? db.alertas_tratativas : [])
    .find((t) => String(t?.alerta_id) === String(alertaId)) || null;
}

const STATUS_LABEL = {
  [STATUS_TRATATIVA.EM_ANALISE]: 'em análise',
  [STATUS_TRATATIVA.RESOLVIDO]: 'resolvido',
  [STATUS_TRATATIVA.IGNORADO]: 'ignorado',
  [STATUS_TRATATIVA.ADIADO]: 'adiado',
};

/**
 * Prepara marcar em análise / resolver / ignorar / adiar um alerta.
 * @param {object} db — já recortado pela fazenda ativa da conexão.
 * @param {{ referencia: string, status: string, observacao?: string, responsavel?: string, adiadoAte?: string }} args
 * @param {{ identificarFazenda?: boolean }} ctx
 */
export function prepararTratativaAlerta(db, { referencia, status, observacao, responsavel, adiadoAte } = {}, ctx = {}) {
  if (!Object.values(STATUS_TRATATIVA).includes(status)) return erro('STATUS_INVALIDO');
  if (status === STATUS_TRATATIVA.ADIADO && !String(adiadoAte || '').trim()) return erro('DATA_ADIAMENTO_VAZIA');

  const alertas = listarAlertasAtivosNumerados(db, ctx.identificarFazenda);
  const r = resolverAlertaPorReferencia(alertas, referencia);
  if (r.status === 'ambiguo') return erro('ALERTA_AMBIGUO', { candidatos: r.candidatos.map((a) => ({ nome: a.titulo })) });
  if (r.status !== 'ok') return erro('ALERTA_NAO_ENCONTRADO');
  const alerta = r.alerta;

  // "Registrar responsável" (pedido do sprint) não tem coluna própria em
  // `alertas_tratativas` — dobra dentro de `observacao`, mesmo dado que o
  // app já grava lá, sem migration nova para um campo que a UI web também
  // não tem.
  const observacaoFinal = responsavel
    ? `Responsável: ${responsavel}${observacao ? ` — ${observacao}` : ''}`
    : (observacao || null);

  const tratativa = criarTratativaAlerta({
    alertaId: alerta.id,
    alertaTipo: alerta?.alertaOriginal?.tipo || alerta.origem,
    origem: alerta.origem,
    status,
    observacao: observacaoFinal,
    adiadoAte,
  });
  if (!tratativa) return erro('DADOS_INVALIDOS');
  // `criarTratativaAlerta` sempre inclui `owner_user_id` (aqui, sempre null —
  // não temos sessão de usuário neste módulo puro). Precisa ser removido: o
  // executor (`aplicarWrites`) injeta o owner_user_id real via
  // `{ owner_user_id: conexao.owner_user_id, ...registro }` — se `registro`
  // já tiver essa chave (mesmo null), o spread por cima apaga a injeção.
  delete tratativa.owner_user_id;

  const existente = buscarTratativaExistente(db, alerta.id);
  const writes = existente
    ? [{ tabela: 'alertas_tratativas', tipo: 'update', match: { id: existente.id }, patch: tratativa }]
    : [{ tabela: 'alertas_tratativas', tipo: 'insert', registro: tratativa }];

  return {
    ok: true,
    resumo: [
      `Vou marcar como ${STATUS_LABEL[status]}:`,
      '',
      `Alerta: ${alerta.titulo}`,
      alerta.fazendaNome ? `Fazenda: ${alerta.fazendaNome}` : null,
      alerta.loteNome ? `Lote: ${alerta.loteNome}` : null,
      status === STATUS_TRATATIVA.ADIADO ? `Adiado até: ${adiadoAte}` : null,
      responsavel ? `Responsável: ${responsavel}` : null,
      observacao ? `Observação: ${observacao}` : null,
    ].filter(Boolean),
    writes,
  };
}

/**
 * Prepara reabrir um alerta já tratado (remove a tratativa — sem tratativa,
 * `deveExibirAlerta` volta a mostrá-lo como ativo).
 * @param {object} db — já recortado pela fazenda ativa da conexão.
 * @param {{ referencia: string }} args
 */
export function prepararReabrirAlerta(db, { referencia } = {}, ctx = {}) {
  const candidatos = listarAlertasComTratativa(db, ctx.identificarFazenda);
  const r = resolverAlertaPorReferencia(candidatos, referencia);
  if (r.status === 'ambiguo') return erro('ALERTA_AMBIGUO', { candidatos: r.candidatos.map((a) => ({ nome: a.titulo })) });
  if (r.status !== 'ok') return erro('ALERTA_NAO_TRATADO');
  const alerta = r.alerta;

  const existente = buscarTratativaExistente(db, alerta.id);
  if (!existente) return erro('ALERTA_NAO_TRATADO');

  return {
    ok: true,
    resumo: [
      'Vou reabrir este alerta:',
      '',
      `Alerta: ${alerta.titulo}`,
      alerta.fazendaNome ? `Fazenda: ${alerta.fazendaNome}` : null,
      `Status atual: ${STATUS_LABEL[existente.status] || existente.status}`,
    ].filter(Boolean),
    writes: [{ tabela: 'alertas_tratativas', tipo: 'delete', match: { id: existente.id } }],
  };
}
