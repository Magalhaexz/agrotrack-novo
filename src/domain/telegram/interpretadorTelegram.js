// Interpretador central do bot operacional (seção 6 do spec — substitui a
// camada de linguagem natural que antes chamava a Claude API). Puro, sem
// I/O, e SEM qualquer chamada a provedor externo — determinístico do início
// ao fim: normalização → sinônimos → tolerância a erro de digitação →
// classificação por regex (`interpretarComandoTelegram.js`, intocado) →
// pontuação de confiança.
//
// Fluxo de 3 tentativas, na ordem (a primeira que classificar decide):
//   1. Texto ORIGINAL, sem qualquer correção — confiança alta (0.95).
//   2. Texto com SINÔNIMOS canonicalizados (frases fora da alternância de
//      regex, ex.: "me lembra de" → "tarefa") — confiança média-alta (0.80),
//      porque a frase foi reconhecida por equivalência, não literalmente.
//   3. Texto com TOLERÂNCIA A ERRO DE DIGITAÇÃO aplicada (Levenshtein contra
//      o vocabulário conhecido) — confiança média (0.65), e a lista de
//      correções feitas fica exposta em `correcoes` para quem chama decidir
//      se pergunta "Você quis dizer X?" antes de prosseguir (seção 9).
// Se nenhuma tentativa classificar, confiança 0 → DESCONHECIDO (nunca finge
// compreensão — seção 11).
import { interpretarComandoTelegram, INTENCOES } from './interpretarComandoTelegram.js';
import { normalizarComSinonimos, palavrasConhecidas } from './sinonimosTelegram.js';
import { aplicarToleranciaTelegram } from './toleranciaTelegram.js';

export const LIMIAR_EXECUTAR = 0.85;
export const LIMIAR_CONFIRMAR_INTENCAO = 0.60;

// Vocabulário-âncora: substantivos/verbos que os regex de
// `interpretarComandoTelegram.js` procuram literalmente (não são "sinônimos
// de algo", são a própria palavra-chave). Sem isto, `palavrasConhecidas()`
// sozinho não teria "estoque"/"fazenda"/"pesagem"/"transferir" — exatamente
// os 4 exemplos de erro de digitação citados na seção 9 do spec.
const VOCABULARIO_BASE = [
  'pesagem', 'estoque', 'fazenda', 'transferir', 'lote', 'financeiro',
  'resumo', 'alertas', 'manejos', 'despesa', 'receita', 'renomear',
  'confirmar', 'cancelar', 'ajuda', 'tarefa', 'produto', 'item', 'pasto',
  'fazendas', 'lotes',
  // Sprint de expansão do bot operacional — novos cadastros/ações:
  'venda', 'morte', 'finalizar', 'vacina', 'vermifugo', 'suplementacao',
  'planejar', 'consumo',
  // Sprint Paridade 1 — Fazendas/Lotes/Pesagens/Pastagens:
  'pastos', 'resultado',
];
const DICIONARIO_TOLERANCIA = [...new Set([...palavrasConhecidas(), ...VOCABULARIO_BASE])];

/**
 * @param {string} texto mensagem original do usuário (sem qualquer alteração prévia)
 * @returns {{
 *   intencao: string, parametros: object, requerConfirmacao: boolean,
 *   confidence: number, textoInterpretado: string, correcoes: Array<{original,corrigida}>,
 * }}
 */
export function interpretarMensagemTelegram(texto) {
  const bruto = String(texto || '');

  // 1. Texto original — caminho mais comum, mesma cobertura de sempre.
  const r1 = interpretarComandoTelegram(bruto);
  if (r1.intencao !== INTENCOES.DESCONHECIDO) {
    return { ...r1, confidence: 0.95, textoInterpretado: bruto, correcoes: [] };
  }

  // 2. Sinônimos: frases fora da alternância literal da regex.
  const comSinonimos = normalizarComSinonimos(bruto);
  if (comSinonimos !== bruto.toLowerCase().trim()) {
    const r2 = interpretarComandoTelegram(comSinonimos);
    if (r2.intencao !== INTENCOES.DESCONHECIDO) {
      return { ...r2, confidence: 0.80, textoInterpretado: comSinonimos, correcoes: [] };
    }
  }

  // 3. Tolerância a erro de digitação — roda sobre o texto ORIGINAL (com
  //    capitalização preservada, nunca sobre `comSinonimos` já normalizado)
  //    porque a proteção contra corrigir nome próprio depende de ver
  //    maiúscula no meio da frase (seção 9: nunca "corrigir" um nome de
  //    lote/fazenda só por estar perto de uma palavra-chave conhecida).
  const { texto: corrigido, correcoes } = aplicarToleranciaTelegram(bruto, DICIONARIO_TOLERANCIA);
  if (correcoes.length > 0) {
    const r3 = interpretarComandoTelegram(corrigido);
    if (r3.intencao !== INTENCOES.DESCONHECIDO) {
      return { ...r3, confidence: 0.65, textoInterpretado: corrigido, correcoes };
    }
  }

  return {
    intencao: INTENCOES.DESCONHECIDO, parametros: {}, requerConfirmacao: false,
    confidence: 0, textoInterpretado: bruto, correcoes: [],
  };
}

/** Texto de esclarecimento quando a confiança cai no intervalo médio (seção 11). */
export function perguntaConfirmarIntencao(resultado) {
  const correcao = resultado.correcoes?.[0];
  if (correcao) {
    return `Você quis dizer "${correcao.corrigida}"? Responda sim para confirmar ou reformule a mensagem.`;
  }
  return 'Não tenho certeza se entendi. Pode confirmar ou reformular?';
}

/** Texto de reformulação quando nada foi reconhecido (seção 11/29). */
export function mensagemReformular() {
  return [
    'Não entendi o pedido. Você pode tentar, por exemplo:',
    '',
    '• Quanto gado eu tenho?',
    '• Cadastre uma tarefa para amanhã.',
    '• Dê baixa em 20 kg de sal.',
    '• Mova o lote Recria para o Pasto Norte.',
    '',
    'Ou envie /ajuda para ver todos os comandos.',
  ].join('\n');
}
