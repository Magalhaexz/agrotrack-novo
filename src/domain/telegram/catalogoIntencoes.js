// Catálogo central das intenções do Bot (Parte 2). Referência única do que o
// bot entende: tipo, exemplos e a permissão (delegada a permissoesTelegram —
// NÃO reimplementa a matriz de permissão). Os aliases/regex vivem no
// interpretador; os slots dos cadastros, em cadastros.js. Este catálogo amarra
// tudo para documentação, ajuda e testes de cobertura.
import { INTENCOES } from './interpretarComandoTelegram.js';

export const CATALOGO_INTENCOES = {
  [INTENCOES.AJUDA]: { tipo: 'sistema', exemplos: ['/ajuda', 'menu', 'comandos'] },
  [INTENCOES.LISTAR_FAZENDAS]: { tipo: 'consulta', exemplos: ['/fazendas', 'quais fazendas eu tenho'] },
  [INTENCOES.SELECIONAR_FAZENDA]: { tipo: 'acao', exemplos: ['usar fazenda Boa Vista'] },
  [INTENCOES.LISTAR_LOTES]: { tipo: 'consulta', exemplos: ['/lotes', 'quais são meus lotes'] },
  [INTENCOES.VER_LOTE]: { tipo: 'consulta', exemplos: ['/lote Engorda 02'] },
  [INTENCOES.CONSULTAR_ESTOQUE]: { tipo: 'consulta', exemplos: ['/estoque', 'quanto tenho de sal'] },
  [INTENCOES.CONSULTAR_FINANCEIRO]: { tipo: 'consulta', exemplos: ['/financeiro', 'quanto gastei este mês'] },
  [INTENCOES.VER_ALERTAS]: { tipo: 'consulta', exemplos: ['/alertas', 'tem vacina atrasada'] },
  [INTENCOES.VER_MANEJOS]: { tipo: 'consulta', exemplos: ['/manejos', 'manejos da semana'] },
  [INTENCOES.VER_PESAGENS]: { tipo: 'consulta', exemplos: ['/pesagens', 'qual lote precisa pesar'] },
  [INTENCOES.RESUMO]: { tipo: 'consulta', exemplos: ['/resumo', 'resumo da fazenda'] },
  [INTENCOES.TRANSFERIR_ANIMAIS_ENTRE_LOTES]: { tipo: 'acao', exemplos: ['transferir 10 animais do lote A para B'] },
  [INTENCOES.RENOMEAR_LOTE]: { tipo: 'acao', exemplos: ['renomear lote A para B'] },
  [INTENCOES.REGISTRAR_PESAGEM]: { tipo: 'cadastro', exemplos: ['registre pesagem de 425 kg no lote X'] },
  [INTENCOES.CADASTRAR_DESPESA]: { tipo: 'cadastro', exemplos: ['gastei 500 reais com sal'] },
  [INTENCOES.CADASTRAR_RECEITA]: { tipo: 'cadastro', exemplos: ['recebi 15 mil pela venda'] },
  [INTENCOES.REGISTRAR_ENTRADA_ESTOQUE]: { tipo: 'cadastro', exemplos: ['adicionar 20 sacos de sal no estoque'] },
  [INTENCOES.CONFIRMAR]: { tipo: 'sistema', exemplos: ['/confirmar', 'confirmo'] },
  [INTENCOES.CANCELAR]: { tipo: 'sistema', exemplos: ['/cancelar', 'cancelar'] },
  [INTENCOES.AMBIGUO]: { tipo: 'sistema', exemplos: ['trocar lote 1 para lote 2'] },
  [INTENCOES.DESCONHECIDO]: { tipo: 'sistema', exemplos: [] },
};

/** Intenções de um tipo (consulta/acao/cadastro/sistema). */
export function intencoesPorTipo(tipo) {
  return Object.entries(CATALOGO_INTENCOES).filter(([, m]) => m.tipo === tipo).map(([nome]) => nome);
}
