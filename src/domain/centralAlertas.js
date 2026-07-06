// Central de Alertas Inteligente (Sprint 11, qualificada no Sprint 12) —
// módulo puro que enriquece, filtra, ordena e resume a lista já produzida
// por `gerarAlertasUnificados()` (Sprint 5/9/10/12). Não recalcula nenhum
// alerta: só lê os campos que o motor único já expõe
// (`{ id, tipo, prioridade, origem, titulo, descricao, acaoSugerida, pageId, dataReferencia, loteId, loteNome }`)
// e deriva campos de apresentação/decisão sobre eles.
//
// Sprint 12 — o motor único passou a preencher `dataReferencia`/`loteId`/
// `loteNome` diretamente nos alertas que têm uma data ou lote real e
// inequívoco (ver `alertasUnificados.js`). Esses campos, quando presentes,
// são sempre preferidos aqui. Nem todo alerta tem essa informação — grupos
// com mais de um lote ou sem data real continuam com `loteId`/`loteNome`/
// `dataReferencia` em `null` (honesto, não inventado); para esses,
// `normalizarAlertaCentral` ainda cai para a heurística de texto por
// `opcoes.lotes` (Sprint 11) e `classificarPrazo` cai para o mapa por
// `tipo` (`PRAZO_POR_TIPO`).
import { toDateKey, daysBetween } from './calcHelpers.js';

export const PRAZO = {
  VENCIDO: 'vencido',
  HOJE: 'hoje',
  PROXIMOS_7_DIAS: 'proximos_7_dias',
  PROXIMOS_30_DIAS: 'proximos_30_dias',
  SEM_PRAZO: 'sem_prazo',
};

// Classificação de prazo por `tipo`, para os alertas que não carregam uma
// `dataReferencia` estruturada mas cuja janela já é conhecida pela regra que
// os gerou (mesmas janelas usadas em `alertasUnificados.js`: 7 dias para
// saída de lote/contas próximas, 3 dias para carência vencendo). Tipos fora
// deste mapa são estados (não datados) e caem no fallback por prioridade.
const PRAZO_POR_TIPO = {
  'financeiro-vencido': PRAZO.VENCIDO,
  'lote-saida-vencida': PRAZO.VENCIDO,
  'estoque-vencido': PRAZO.VENCIDO,
  tarefa: PRAZO.VENCIDO, // `alertasInteligentes.js` só reporta tarefa já atrasada
  'financeiro-vence-hoje': PRAZO.HOJE,
  'tarefa-hoje': PRAZO.HOJE,
  'financeiro-vence-7-dias': PRAZO.PROXIMOS_7_DIAS,
  'lote-saida-proxima': PRAZO.PROXIMOS_7_DIAS,
  'carencia-vencendo': PRAZO.PROXIMOS_7_DIAS,
  'estoque-validade-proxima': PRAZO.PROXIMOS_30_DIAS,
  'carencia-ativa': PRAZO.PROXIMOS_30_DIAS,
};

const ORDEM_PRAZO = {
  [PRAZO.VENCIDO]: 0,
  [PRAZO.HOJE]: 1,
  [PRAZO.PROXIMOS_7_DIAS]: 2,
  [PRAZO.PROXIMOS_30_DIAS]: 3,
  [PRAZO.SEM_PRAZO]: 4,
};

const ORDEM_PRIORIDADE = {
  critico: 0,
  atencao: 1,
  decisao: 2,
  informativo: 3,
};

const PESO_PRIORIDADE = {
  critico: 100,
  atencao: 50,
  decisao: 40,
  informativo: 10,
};

const PESO_PRAZO = {
  [PRAZO.VENCIDO]: 30,
  [PRAZO.HOJE]: 20,
  [PRAZO.PROXIMOS_7_DIAS]: 10,
  [PRAZO.PROXIMOS_30_DIAS]: 5,
  [PRAZO.SEM_PRAZO]: 0,
};

/**
 * Classifica o prazo de um alerta em uma das 5 categorias de `PRAZO`.
 * Usa `alerta.dataReferencia` quando presente (hoje sempre `null` no motor
 * único atual — ver nota no topo do arquivo); senão usa `PRAZO_POR_TIPO`;
 * senão cai para `vencido` (prioridade crítica) ou `sem_prazo`.
 */
export function classificarPrazo(alerta, hoje = new Date()) {
  const dataRef = toDateKey(alerta?.dataReferencia);
  if (dataRef) {
    const hojeKey = toDateKey(hoje);
    const dias = daysBetween(hojeKey, dataRef);
    if (dias < 0) return PRAZO.VENCIDO;
    if (dias === 0) return PRAZO.HOJE;
    if (dias <= 7) return PRAZO.PROXIMOS_7_DIAS;
    if (dias <= 30) return PRAZO.PROXIMOS_30_DIAS;
    return PRAZO.SEM_PRAZO;
  }

  const doTipo = PRAZO_POR_TIPO[String(alerta?.tipo || '')];
  if (doTipo) return doTipo;

  return alerta?.prioridade === 'critico' ? PRAZO.VENCIDO : PRAZO.SEM_PRAZO;
}

const ACAO_POR_ORIGEM = {
  financeiro: 'Conferir pagamento e regularizar lançamento.',
  estoque: 'Avaliar compra ou reposição do insumo.',
  tarefas: 'Concluir ou reagendar a tarefa pendente.',
  decisao: 'Analisar a decisão de venda/manejo do lote.',
};

/**
 * Sugere uma ação recomendada curta. Prefere `alerta.acaoSugerida` (o motor
 * único já calcula uma por categoria) — só sintetiza um texto genérico por
 * `origem`/`tipo` quando o alerta não trouxer nenhuma (alerta incompleto,
 * legado, ou de teste). Não duplica a regra do motor, só cobre a ausência.
 */
export function sugerirAcao(alerta) {
  const existente = String(alerta?.acaoSugerida || '').trim();
  if (existente) return existente;

  const origem = String(alerta?.origem || '');
  const tipo = String(alerta?.tipo || '');

  if (origem === 'sanidade') {
    return tipo.startsWith('carencia')
      ? 'Verificar carência antes de movimentar ou vender animais.'
      : 'Reprogramar manejo e registrar execução.';
  }
  if (tipo === 'gmd') {
    return 'Revisar desempenho do lote e investigar manejo/nutrição.';
  }

  return ACAO_POR_ORIGEM[origem] || 'Analisar ocorrência e definir responsável pela tratativa.';
}

function encontrarLoteReferenciado(alerta, lotes) {
  if (!Array.isArray(lotes) || lotes.length === 0) return null;
  const texto = `${alerta?.titulo || ''} ${alerta?.descricao || ''}`;
  if (!texto.trim()) return null;

  const encontrados = lotes.filter((lote) => lote?.nome && texto.includes(lote.nome));
  // Ambíguo (nenhum ou mais de um lote citado) — não inventa um vínculo.
  return encontrados.length === 1 ? encontrados[0] : null;
}

/**
 * Enriquece um alerta do motor único para a Central de Alertas — devolve um
 * objeto seguro para UI, sem remover nada do original (`alertaOriginal`
 * preserva o objeto tal como veio de `gerarAlertasUnificados`).
 *
 * Sprint 12: prioriza `alerta.loteId`/`alerta.loteNome`/`alerta.dataReferencia`
 * quando o motor único já os preenche (vínculo real, não ambíguo) — só cai
 * para a heurística de texto por `opcoes.lotes` (Sprint 11) quando o
 * alerta não trouxer um lote estruturado. `dataReferencia` inválida
 * (`toDateKey` não reconhece) nunca quebra: vira `null` e `classificarPrazo`
 * cai para o fallback por `tipo`/prioridade normalmente.
 */
export function normalizarAlertaCentral(alerta, opcoes = {}) {
  const hoje = opcoes.hoje || new Date();
  const prazoCategoria = classificarPrazo(alerta, hoje);
  const prioridade = alerta?.prioridade || 'informativo';

  const loteEstruturado = alerta?.loteId != null || alerta?.loteNome;
  const loteHeuristico = loteEstruturado ? null : encontrarLoteReferenciado(alerta, opcoes.lotes);

  const dataReferenciaValida = toDateKey(alerta?.dataReferencia) || null;

  return {
    id: alerta?.id || null,
    titulo: alerta?.titulo || 'Alerta do sistema',
    descricao: alerta?.descricao || '',
    origem: alerta?.origem || 'geral',
    prioridade,
    loteId: loteEstruturado ? (alerta.loteId ?? null) : (loteHeuristico?.id ?? null),
    loteNome: loteEstruturado ? (alerta.loteNome ?? null) : (loteHeuristico?.nome ?? null),
    dataReferencia: dataReferenciaValida,
    prazoCategoria,
    acaoRecomendada: sugerirAcao(alerta),
    pesoDecisao: (PESO_PRIORIDADE[prioridade] ?? 0) + (PESO_PRAZO[prazoCategoria] ?? 0),
    pageId: alerta?.pageId ?? null,
    alertaOriginal: alerta ?? null,
  };
}

function normalizarTexto(valor) {
  return String(valor || '').trim().toLowerCase();
}

/**
 * Filtra uma lista já normalizada (`normalizarAlertaCentral`). Todos os
 * filtros são opcionais e combináveis (AND). `filtros.busca` casa contra
 * título e descrição, sem diferenciar caixa/acento simples.
 */
export function filtrarAlertasCentral(alertasNormalizados = [], filtros = {}) {
  const lista = Array.isArray(alertasNormalizados) ? alertasNormalizados : [];
  const busca = normalizarTexto(filtros.busca);

  return lista.filter((alerta) => {
    if (filtros.origem && alerta.origem !== filtros.origem) return false;
    if (filtros.prioridade && alerta.prioridade !== filtros.prioridade) return false;
    if (filtros.prazoCategoria && alerta.prazoCategoria !== filtros.prazoCategoria) return false;
    if (filtros.loteId != null && String(alerta.loteId) !== String(filtros.loteId)) return false;
    if (filtros.loteNome && alerta.loteNome !== filtros.loteNome) return false;
    if (filtros.somenteCriticos && alerta.prioridade !== 'critico') return false;
    if (busca) {
      const alvo = `${normalizarTexto(alerta.titulo)} ${normalizarTexto(alerta.descricao)}`;
      if (!alvo.includes(busca)) return false;
    }
    return true;
  });
}

/**
 * Ordena por urgência: maior prioridade primeiro, depois vencidos → hoje →
 * 7 dias → 30 dias → sem prazo. Dentro da mesma faixa de prazo, alertas com
 * `dataReferencia` real são desempatados pela data mais antiga primeiro
 * (o mais vencido/mais urgente sobe) antes de cair no `pesoDecisao`.
 */
export function ordenarAlertasCentral(alertasNormalizados = []) {
  return (Array.isArray(alertasNormalizados) ? alertasNormalizados : [])
    .slice()
    .sort((a, b) => {
      const prioridadeA = ORDEM_PRIORIDADE[a.prioridade] ?? 99;
      const prioridadeB = ORDEM_PRIORIDADE[b.prioridade] ?? 99;
      if (prioridadeA !== prioridadeB) return prioridadeA - prioridadeB;

      const prazoA = ORDEM_PRAZO[a.prazoCategoria] ?? 99;
      const prazoB = ORDEM_PRAZO[b.prazoCategoria] ?? 99;
      if (prazoA !== prazoB) return prazoA - prazoB;

      if (a.dataReferencia && b.dataReferencia && a.dataReferencia !== b.dataReferencia) {
        return a.dataReferencia < b.dataReferencia ? -1 : 1;
      }

      if (b.pesoDecisao !== a.pesoDecisao) return b.pesoDecisao - a.pesoDecisao;
      return String(a.id).localeCompare(String(b.id));
    });
}

/**
 * Contadores para os cards de resumo da Central de Alertas. Recebe a lista
 * normalizada completa (antes de qualquer filtro de UI), para os cards
 * sempre refletirem o total real da operação.
 */
export function resumirCentralAlertas(alertasNormalizados = []) {
  const lista = Array.isArray(alertasNormalizados) ? alertasNormalizados : [];

  const porOrigem = {};
  const porPrioridade = {};
  let criticos = 0;
  let vencidos = 0;
  let vencendoHoje = 0;
  let proximos7Dias = 0;

  lista.forEach((alerta) => {
    porOrigem[alerta.origem] = (porOrigem[alerta.origem] || 0) + 1;
    porPrioridade[alerta.prioridade] = (porPrioridade[alerta.prioridade] || 0) + 1;
    if (alerta.prioridade === 'critico') criticos += 1;
    if (alerta.prazoCategoria === PRAZO.VENCIDO) vencidos += 1;
    if (alerta.prazoCategoria === PRAZO.HOJE) vencendoHoje += 1;
    if (alerta.prazoCategoria === PRAZO.PROXIMOS_7_DIAS) proximos7Dias += 1;
  });

  return {
    total: lista.length,
    criticos,
    vencidos,
    vencendoHoje,
    proximos7Dias,
    porOrigem,
    porPrioridade,
  };
}
