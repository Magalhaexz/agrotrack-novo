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
  // Sprint bot operacional determinístico — novos cadastros/ações:
  [INTENCOES.CADASTRAR_TAREFA]: { tipo: 'cadastro', exemplos: ['crie uma tarefa para pesar o lote amanha', 'me lembra de comprar sal'] },
  [INTENCOES.CADASTRAR_ITEM_ESTOQUE]: { tipo: 'cadastro', exemplos: ['cadastre um item novo', 'novo produto Sal Proteinado'] },
  [INTENCOES.DAR_BAIXA_ESTOQUE]: { tipo: 'cadastro', exemplos: ['dar baixa em 50 kg de sal', 'usei 3 litros de vermifugo'] },
  [INTENCOES.TROCAR_LOTE_PASTO]: { tipo: 'cadastro', exemplos: ['mova o lote Recria para o pasto Norte'] },
  // Sprint de expansão do bot operacional — novos cadastros/ações:
  [INTENCOES.CADASTRAR_LOTE]: { tipo: 'cadastro', exemplos: ['cadastre o lote Recria com 30 machos'] },
  [INTENCOES.CADASTRAR_PASTO]: { tipo: 'cadastro', exemplos: ['cadastre o pasto Norte com 18 hectares'] },
  [INTENCOES.REGISTRAR_VENDA]: { tipo: 'cadastro', exemplos: ['venda 10 animais do lote Recria'] },
  [INTENCOES.REGISTRAR_MORTE]: { tipo: 'cadastro', exemplos: ['morreram 2 animais do lote Recria'] },
  [INTENCOES.FINALIZAR_LOTE]: { tipo: 'cadastro', exemplos: ['finalize o lote Confinamento'] },
  [INTENCOES.CADASTRAR_MANEJO]: { tipo: 'cadastro', exemplos: ['vacinei o lote Recria hoje'] },
  [INTENCOES.CADASTRAR_PLANEJAMENTO_SUPLEMENTACAO]: { tipo: 'cadastro', exemplos: ['planeje 2 kg por cabeça de ração para o lote Recria'] },
  [INTENCOES.REGISTRAR_CONSUMO_SUPLEMENTACAO]: { tipo: 'cadastro', exemplos: ['registre consumo de 80 kg de sal no lote Recria'] },
  // Sprint Paridade 1 — Fazendas/Lotes/Pesagens/Pastagens:
  [INTENCOES.CADASTRAR_FAZENDA]: { tipo: 'cadastro', exemplos: ['cadastre uma fazenda chamada Boa Esperança'] },
  [INTENCOES.RENOMEAR_FAZENDA]: { tipo: 'cadastro', exemplos: ['altere o nome da Fazenda Um para Fazenda São João'] },
  [INTENCOES.LISTAR_PASTOS]: { tipo: 'consulta', exemplos: ['quais pastos estão vazios?', '/pastos'] },
  [INTENCOES.CONSULTAR_RESULTADO_LOTE]: { tipo: 'consulta', exemplos: ['qual o resultado do lote Recria?'] },
  [INTENCOES.CONFIRMAR]: { tipo: 'sistema', exemplos: ['/confirmar', 'confirmo'] },
  [INTENCOES.CANCELAR]: { tipo: 'sistema', exemplos: ['/cancelar', 'cancelar'] },
  [INTENCOES.AMBIGUO]: { tipo: 'sistema', exemplos: ['trocar lote 1 para lote 2'] },
  [INTENCOES.DESCONHECIDO]: { tipo: 'sistema', exemplos: [] },
};

/** Intenções de um tipo (consulta/acao/cadastro/sistema). */
export function intencoesPorTipo(tipo) {
  return Object.entries(CATALOGO_INTENCOES).filter(([, m]) => m.tipo === tipo).map(([nome]) => nome);
}
