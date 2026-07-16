// Dicionário central de sinônimos do vocabulário do produtor (seção 8 do
// spec do bot operacional). Puro, sem I/O. `normalizarComSinonimos` produz
// um texto SÓ PARA CLASSIFICAÇÃO — troca qualquer frase reconhecida pela
// palavra canônica correspondente — nunca é usado para extrair entidades
// (valor, quantidade, data continuam vindo do texto ORIGINAL via
// `extrairEntidades.js`). Isso existe porque o classificador de intenção
// (`interpretarComandoTelegram.js`) já reconhece boa parte do vocabulário
// via alternância de regex, mas frases fora dessa alternância (ex.: "me
// lembra de", "dei uma perda no lote") ficariam cegas sem esta camada.
//
// Extensível de propósito: adicionar uma linha nova aqui nunca quebra nada
// já reconhecido (o dicionário só ENRIQUECE o texto de comparação).
export const SINONIMOS = {
  cadastrar: ['cadastrar', 'cadastre', 'criar', 'crie', 'adicionar', 'adicione', 'registrar', 'registre', 'lancar', 'lance', 'anotar', 'anote'],
  consultar: ['consultar', 'ver', 'mostrar', 'mostre', 'quanto', 'quantos', 'quantas', 'qual', 'quais', 'listar'],
  estoque_saida: ['dar baixa', 'de baixa', 'retirar', 'retire', 'usar', 'usei', 'consumir', 'consumi', 'saiu', 'sairam', 'tirei'],
  estoque_entrada: ['dar entrada', 'de entrada', 'entrou', 'entraram', 'comprei', 'recebi', 'chegou'],
  trocar_pasto: ['mover para o pasto', 'mova para o pasto', 'trocar de pasto', 'troque de pasto', 'mandar para o pasto', 'mande para o pasto', 'levar para o pasto'],
  morte: ['morte', 'morreu', 'morreram', 'perda', 'baixa por morte'],
  tarefa: ['tarefa', 'lembrete', 'me lembra', 'me lembre', 'lembra de', 'lembre de', 'agendar', 'agende'],
  pesagem: ['pesagem', 'pesar', 'pese', 'peso medio', 'pesei', 'pesou'],
  suplemento: ['suplemento', 'racao', 'sal', 'alimentacao', 'trato'],
};

/** Acento-insensível, minúsculas, espaços colapsados — mesmo critério de resolvedores.js. */
function normalizarChaveComparacao(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// Lista de [regex de frase, canônico], ordenada da frase MAIS LONGA para a
// mais curta dentro de cada grupo — evita que "de entrada" case antes de
// "dar entrada" e corte a substituição pela metade.
const SUBSTITUICOES = Object.entries(SINONIMOS).flatMap(([canonico, frases]) => (
  [...frases].sort((a, b) => b.length - a.length).map((frase) => ({
    regex: new RegExp(`\\b${normalizarChaveComparacao(frase).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'),
    canonico,
  }))
));

/**
 * Texto normalizado para CLASSIFICAÇÃO (nunca para extrair valor/data/nome).
 * Cada frase reconhecida do dicionário vira a palavra canônica do grupo.
 */
export function normalizarComSinonimos(texto) {
  let t = normalizarChaveComparacao(texto);
  for (const { regex, canonico } of SUBSTITUICOES) {
    t = t.replace(regex, canonico);
  }
  return t.replace(/\s+/g, ' ').trim();
}

/** Todas as palavras/frases do dicionário — usado pela tolerância a erro de digitação. */
export function palavrasConhecidas() {
  return Object.values(SINONIMOS).flat();
}
