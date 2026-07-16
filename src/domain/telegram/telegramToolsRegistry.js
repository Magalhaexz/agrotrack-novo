// Catálogo central de ferramentas do bot operacional do Telegram
// (interpretador determinístico — sem provedor de IA em nenhum ponto). Puro,
// sem I/O próprio — cada entrada só declara metadados e chama funções de
// domínio já existentes (formatadores de consulta, `acoesLote.js`,
// `cadastros.js`, e os 4 preparadores novos da consolidação determinística).
// O orquestrador NUNCA executa nada fora deste catálogo: só aceita chamadas
// cujo `name` exista aqui, valida `requiredFields` e `requiredPermission`
// antes de qualquer escrita, e nunca interpreta um payload como instrução —
// só como candidato a validar.
//
// riskLevel:
//   'leitura'          → executa direto, sem confirmação.
//   'escrita_simples'  → exige /confirmar (resumo simples).
//   'critica'          → exige /confirmar com resumo completo (consequência
//                         financeira ou de rebanho relevante).
import {
  formatarFazendas, formatarLotes, formatarLote, formatarEstoque,
  formatarFinanceiro, formatarManejos, formatarPesagens, formatarResumo,
} from './respostasConsulta.js';
import { prepararTransferenciaAnimais, prepararRenomearLote } from './acoesLote.js';
import { prepararCadastro } from './cadastros.js';
import { prepararCadastroTarefa } from './cadastroTarefa.js';
import { prepararCadastroItemEstoque } from './cadastroItemEstoque.js';
import { prepararSaidaEstoque } from './acoesEstoque.js';
import { prepararTrocaLotePasto } from './acoesPasto.js';
import { resolverLotePorNome } from './resolvedores.js';

const erro = (codigo) => ({ ok: false, erro: codigo });

/** Texto de confirmação padrão para toda ferramenta de escrita. */
export function formatarConfirmacao(resumo, { confirmado = false } = {}) {
  const linhas = Array.isArray(resumo) ? resumo : [String(resumo)];
  if (!confirmado) {
    return [...linhas, '', 'Responda /confirmar para concluir ou /cancelar para desistir.'].join('\n');
  }
  const primeira = linhas[0] || 'Confirme a ação:';
  return primeira.replace(/^Confirme\b/, 'Registrado').replace(/:$/, '.');
}

// ── Consultas (leitura, sem confirmação) ─────────────────────────────────────
function ferramentaLeitura({ name, description, requiredPermission, properties = {}, required = [], executarTexto }) {
  return {
    name,
    description,
    category: 'consulta',
    riskLevel: 'leitura',
    requiredPermission,
    requiredFields: required,
    optionalFields: Object.keys(properties).filter((k) => !required.includes(k)),
    inputSchema: { type: 'object', properties, required, additionalProperties: false },
    execute(db, params, ctx = {}) {
      return { ok: true, texto: executarTexto(db, params, ctx) };
    },
    formatResult(resultado) {
      return resultado.texto;
    },
  };
}

const consultas = [
  ferramentaLeitura({
    name: 'consultar_fazendas',
    description: 'Lista as fazendas da conta e qual está ativa. Use para "quais são minhas fazendas", "trocar de fazenda".',
    requiredPermission: 'fazendas:ver',
    executarTexto: (db, params, ctx) => formatarFazendas(ctx.fazendas, ctx.fazendaId),
  }),
  ferramentaLeitura({
    name: 'consultar_lotes',
    description: 'Lista os lotes ativos da fazenda com quantidade, peso médio e GMD. Use para "quantos lotes tenho", "quanto gado eu tenho".',
    requiredPermission: 'lotes:ver',
    executarTexto: (db, params, ctx) => formatarLotes(db, { fazendaNome: ctx.fazendaNome }),
  }),
  ferramentaLeitura({
    name: 'consultar_lote',
    description: 'Detalhe de UM lote específico pelo nome: animais, peso, GMD, última pesagem, pasto. Use quando o usuário nomear um lote.',
    requiredPermission: 'lotes:ver',
    properties: { nome: { type: 'string', description: 'Nome ou parte do nome do lote' } },
    required: ['nome'],
    executarTexto: (db, params) => {
      const r = resolverLotePorNome(db.lotes, params.nome);
      if (r.status === 'ambiguo') return `Há mais de um lote com esse nome:\n\n${r.candidatos.map((c, i) => `${i + 1}. ${c.nome}`).join('\n')}`;
      if (r.status !== 'ok') return 'Não encontrei esse lote na fazenda atual.';
      return formatarLote(db, r.lote);
    },
  }),
  ferramentaLeitura({
    name: 'consultar_estoque',
    description: 'Saldo de estoque, geral ou de um item específico ("quanto sal ainda tenho"), ou itens abaixo do mínimo ("o que está acabando").',
    requiredPermission: 'estoque:ver',
    properties: {
      item: { type: 'string', description: 'Nome do produto, quando a pergunta for sobre um item específico' },
      filtro: { type: 'string', enum: ['baixo'], description: 'Use "baixo" para itens abaixo do estoque mínimo' },
    },
    executarTexto: (db, params) => formatarEstoque(db, params),
  }),
  ferramentaLeitura({
    name: 'consultar_financeiro',
    description: 'Contas a vencer/vencidas, saldo, gastos — geral ou de um lote específico. Use para "quanto gastei este mês", "tem conta vencendo".',
    requiredPermission: 'financeiro:ver',
    properties: {
      filtro: { type: 'string', enum: ['vencer', 'vencida', 'hoje', 'semana'], description: 'Recorte do período/tipo de conta' },
      lote: { type: 'string', description: 'Nome do lote, quando a pergunta for sobre custo/resultado de um lote' },
    },
    executarTexto: (db, params) => formatarFinanceiro(db, { filtro: params.filtro, loteNome: params.lote }),
  }),
  ferramentaLeitura({
    name: 'consultar_manejos',
    description: 'Manejos sanitários atrasados e próximos (vacinas, vermifugação, etc). Use para "quais manejos estão atrasados".',
    requiredPermission: 'sanitario:ver',
    executarTexto: (db) => formatarManejos(db, { hoje: new Date() }),
  }),
  ferramentaLeitura({
    name: 'consultar_pesagens',
    description: 'Últimas pesagens e lotes sem pesagem recente. Use para "qual lote está há mais tempo sem pesar".',
    requiredPermission: 'pesagens:ver',
    executarTexto: (db) => formatarPesagens(db),
  }),
  ferramentaLeitura({
    name: 'consultar_resumo',
    description: 'Resumo geral da fazenda: lotes, animais, contas, estoque baixo, pesagens pendentes. Use para perguntas amplas sem foco em um módulo.',
    requiredPermission: 'dashboard:ver',
    executarTexto: (db, params, ctx) => formatarResumo(db, { fazendaNome: ctx.fazendaNome }),
  }),
];

// ── Ações críticas existentes (lote) — adaptadas para o formato genérico ────
function resolverLoteOuErro(db, nome, campo) {
  const r = resolverLotePorNome(db.lotes, nome, { somenteAtivos: true });
  if (r.status === 'ambiguo') return { erro: `LOTE_${campo}_AMBIGUO`, candidatos: r.candidatos };
  if (r.status !== 'ok') return { erro: `LOTE_${campo}_NAO_ENCONTRADO` };
  return { lote: r.lote };
}

const transferirAnimais = {
  name: 'transferir_animais_entre_lotes',
  description: 'Move uma quantidade de animais de um lote para outro dentro da mesma conta. Operação crítica: sempre exige confirmação.',
  category: 'movimentacao',
  riskLevel: 'critica',
  requiredPermission: 'animais:movimentar',
  requiredFields: ['loteOrigem', 'loteDestino', 'quantidade'],
  optionalFields: [],
  inputSchema: {
    type: 'object',
    properties: {
      loteOrigem: { type: 'string', description: 'Nome do lote de origem' },
      loteDestino: { type: 'string', description: 'Nome do lote de destino' },
      quantidade: { type: 'integer', description: 'Quantidade de animais a transferir', minimum: 1 },
    },
    required: ['loteOrigem', 'loteDestino', 'quantidade'],
    additionalProperties: false,
  },
  execute(db, params) {
    const ro = resolverLoteOuErro(db, params.loteOrigem, 'ORIGEM');
    if (ro.erro) return erro(ro.erro);
    const rd = resolverLoteOuErro(db, params.loteDestino, 'DESTINO');
    if (rd.erro) return erro(rd.erro);
    const plano = prepararTransferenciaAnimais(db, {
      loteOrigemId: ro.lote.id, loteDestinoId: rd.lote.id, quantidade: params.quantidade,
    });
    if (!plano.ok) return plano;
    return {
      ok: true,
      resumo: ['Confirme a transferência:', '', `Origem: ${plano.resumo.origemNome}`, `Destino: ${plano.resumo.destinoNome}`, `Quantidade: ${plano.resumo.quantidade} animais`],
      // Sprint Paridade 1, bloco 4: `prepararTransferenciaAnimais` agora devolve
      // um plano de RPC transacional (`registrar_saida_lote`) em vez de um
      // `writes` bespoke — repassa direto, mesma RPC do caminho principal.
      rpc: plano.rpc,
    };
  },
  formatResult: (r, opts) => formatarConfirmacao(r.resumo, opts),
};

const renomearLote = {
  name: 'renomear_lote',
  description: 'Renomeia um lote existente, mantendo o mesmo ID e histórico. Não cria lote novo.',
  category: 'edicao',
  riskLevel: 'critica',
  requiredPermission: 'lotes:editar',
  requiredFields: ['loteAtual', 'novoNome'],
  optionalFields: [],
  inputSchema: {
    type: 'object',
    properties: {
      loteAtual: { type: 'string', description: 'Nome atual do lote' },
      novoNome: { type: 'string', description: 'Novo nome desejado' },
    },
    required: ['loteAtual', 'novoNome'],
    additionalProperties: false,
  },
  execute(db, params) {
    const r = resolverLoteOuErro(db, params.loteAtual, 'ATUAL');
    if (r.erro) return erro(r.erro);
    const plano = prepararRenomearLote(db, { loteId: r.lote.id, novoNome: params.novoNome });
    if (!plano.ok) return plano;
    return {
      ok: true,
      resumo: ['Confirme a renomeação:', '', `Lote: ${plano.resumo.nomeAnterior}`, `Novo nome: ${plano.resumo.nomeNovo}`],
      writes: [{ tabela: 'lotes', tipo: 'update', match: { id: plano.writes.loteUpdate.id }, patch: { nome: plano.writes.loteUpdate.nome } }],
    };
  },
  formatResult: (r, opts) => formatarConfirmacao(r.resumo, opts),
};

// ── Cadastros existentes (via cadastros.js — mesmo motor do bot determinístico) ──
function ferramentaCadastroExistente({ name, description, intencao, requiredPermission, properties, required }) {
  return {
    name,
    description,
    category: 'cadastro',
    riskLevel: 'escrita_simples',
    requiredPermission,
    requiredFields: required,
    optionalFields: Object.keys(properties).filter((k) => !required.includes(k)),
    inputSchema: { type: 'object', properties, required, additionalProperties: false },
    execute(db, params) {
      const plano = prepararCadastro(intencao, params, { db, hoje: new Date() });
      return plano;
    },
    formatResult: (r, opts) => formatarConfirmacao(r.resumo, opts),
  };
}

const registrarPesagem = ferramentaCadastroExistente({
  name: 'registrar_pesagem',
  description: 'Registra a pesagem (peso médio) de um lote em uma data.',
  intencao: 'REGISTRAR_PESAGEM',
  requiredPermission: 'pesagens:editar',
  properties: {
    lote: { type: 'string', description: 'Nome do lote pesado' },
    peso: { type: 'number', description: 'Peso médio em kg' },
    data: { type: 'string', description: 'Data no formato AAAA-MM-DD; se omitido, usa hoje' },
  },
  required: ['lote', 'peso'],
});

const cadastrarDespesa = ferramentaCadastroExistente({
  name: 'cadastrar_despesa',
  description: 'Lança uma despesa financeira, opcionalmente vinculada a um lote.',
  intencao: 'CADASTRAR_DESPESA',
  requiredPermission: 'financeiro:editar',
  properties: {
    valor: { type: 'number', description: 'Valor da despesa em reais' },
    descricao: { type: 'string', description: 'Descrição do lançamento' },
    lote: { type: 'string', description: 'Nome do lote vinculado, se houver' },
    data: { type: 'string', description: 'Data no formato AAAA-MM-DD; se omitido, usa hoje' },
  },
  required: ['valor', 'descricao'],
});

const cadastrarReceita = ferramentaCadastroExistente({
  name: 'cadastrar_receita',
  description: 'Lança uma receita financeira, opcionalmente vinculada a um lote.',
  intencao: 'CADASTRAR_RECEITA',
  requiredPermission: 'financeiro:editar',
  properties: {
    valor: { type: 'number', description: 'Valor da receita em reais' },
    descricao: { type: 'string', description: 'Descrição do lançamento' },
    lote: { type: 'string', description: 'Nome do lote vinculado, se houver' },
    data: { type: 'string', description: 'Data no formato AAAA-MM-DD; se omitido, usa hoje' },
  },
  required: ['valor', 'descricao'],
});

const registrarEntradaEstoque = ferramentaCadastroExistente({
  name: 'registrar_entrada_estoque',
  description: 'Registra ENTRADA de quantidade em um item de estoque JÁ EXISTENTE (soma ao saldo). Para criar um item novo, use cadastrar_item_estoque.',
  intencao: 'REGISTRAR_ENTRADA_ESTOQUE',
  requiredPermission: 'estoque:movimentar',
  properties: {
    item: { type: 'string', description: 'Nome do produto já cadastrado no estoque' },
    quantidade: { type: 'number', description: 'Quantidade que entrou' },
    data: { type: 'string', description: 'Data no formato AAAA-MM-DD; se omitido, usa hoje' },
  },
  required: ['item', 'quantidade'],
});

// ── Cadastros e ações NOVOS desta sprint ─────────────────────────────────────
const cadastrarTarefa = {
  name: 'cadastrar_tarefa',
  description: 'Cria uma tarefa/lembrete com data de vencimento, opcionalmente vinculada a um lote e/ou responsável.',
  category: 'cadastro',
  riskLevel: 'escrita_simples',
  requiredPermission: 'tarefas:editar',
  requiredFields: ['titulo', 'data_vencimento'],
  optionalFields: ['descricao', 'lote', 'responsavel', 'categoria', 'prioridade'],
  inputSchema: {
    type: 'object',
    properties: {
      titulo: { type: 'string', description: 'Título curto da tarefa' },
      data_vencimento: { type: 'string', description: 'Data no formato AAAA-MM-DD' },
      descricao: { type: 'string' },
      lote: { type: 'string', description: 'Nome do lote relacionado, se houver' },
      responsavel: { type: 'string', description: 'Nome do funcionário responsável, se houver' },
      categoria: { type: 'string', enum: ['manejo', 'sanitario', 'manutencao', 'administrativo', 'estoque'] },
      prioridade: { type: 'string', enum: ['baixa', 'media', 'alta', 'critica'] },
    },
    required: ['titulo', 'data_vencimento'],
    additionalProperties: false,
  },
  execute(db, params, ctx = {}) {
    return prepararCadastroTarefa(db, params, { fazendaId: ctx.fazendaId ?? null });
  },
  formatResult: (r, opts) => formatarConfirmacao(r.resumo, opts),
};

const cadastrarItemEstoque = {
  name: 'cadastrar_item_estoque',
  description: 'Cadastra um item NOVO de estoque (produto que ainda não existe). Para dar entrada em um item já existente, use registrar_entrada_estoque.',
  category: 'cadastro',
  riskLevel: 'escrita_simples',
  requiredPermission: 'estoque:editar',
  requiredFields: ['nome'],
  optionalFields: ['categoria', 'unidade', 'quantidade_inicial', 'custo_unitario', 'quantidade_minima', 'fornecedor', 'obs'],
  inputSchema: {
    type: 'object',
    properties: {
      nome: { type: 'string', description: 'Nome do produto' },
      categoria: { type: 'string', enum: ['Medicamento', 'Vacina', 'Material', 'Produto veterinário', 'Insumo geral', 'Outro'] },
      unidade: { type: 'string', description: 'kg, sacos, litros, un, fardos, toneladas, animais' },
      quantidade_inicial: { type: 'number', minimum: 0 },
      custo_unitario: { type: 'number', minimum: 0 },
      quantidade_minima: { type: 'number', minimum: 0 },
      fornecedor: { type: 'string' },
      obs: { type: 'string' },
    },
    required: ['nome'],
    additionalProperties: false,
  },
  execute(db, params, ctx = {}) {
    return prepararCadastroItemEstoque(db, params, { fazendaId: ctx.fazendaId ?? null });
  },
  formatResult: (r, opts) => formatarConfirmacao(r.resumo, opts),
};

const darBaixaEstoque = {
  name: 'dar_baixa_estoque',
  description: 'Retira/baixa quantidade de um item de estoque já existente (consumo, ajuste, perda ou venda). Operação crítica: valida saldo e nunca deixa negativo.',
  category: 'movimentacao',
  riskLevel: 'critica',
  requiredPermission: 'estoque:movimentar',
  requiredFields: ['item', 'quantidade'],
  optionalFields: ['tipo', 'lote', 'data', 'obs'],
  inputSchema: {
    type: 'object',
    properties: {
      item: { type: 'string', description: 'Nome do produto' },
      quantidade: { type: 'number', minimum: 0.01 },
      tipo: { type: 'string', enum: ['consumo', 'ajuste', 'perda', 'venda'], description: 'Motivo da saída; padrão consumo' },
      lote: { type: 'string', description: 'Lote vinculado ao consumo, se houver' },
      data: { type: 'string', description: 'Data no formato AAAA-MM-DD; se omitido, usa hoje' },
      obs: { type: 'string' },
    },
    required: ['item', 'quantidade'],
    additionalProperties: false,
  },
  execute(db, params) {
    return prepararSaidaEstoque(db, params);
  },
  formatResult: (r, opts) => formatarConfirmacao(r.resumo, opts),
};

const trocarLotePasto = {
  name: 'trocar_lote_pasto',
  description: 'Move um lote para outro pasto da mesma fazenda. Não altera a quantidade de animais do lote. Operação crítica.',
  category: 'movimentacao',
  riskLevel: 'critica',
  requiredPermission: 'lotes:editar',
  requiredFields: ['lote', 'pasto'],
  optionalFields: ['quantidade_cabecas', 'motivo', 'observacoes', 'data'],
  inputSchema: {
    type: 'object',
    properties: {
      lote: { type: 'string', description: 'Nome do lote' },
      pasto: { type: 'string', description: 'Nome do pasto de destino' },
      quantidade_cabecas: { type: 'number', minimum: 0.01 },
      motivo: { type: 'string', description: 'Ex.: rotação de pasto, recuperação, manejo nutricional' },
      observacoes: { type: 'string' },
      data: { type: 'string', description: 'Data no formato AAAA-MM-DD; se omitido, usa hoje' },
    },
    required: ['lote', 'pasto'],
    additionalProperties: false,
  },
  execute(db, params) {
    return prepararTrocaLotePasto(db, params);
  },
  formatResult: (r, opts) => formatarConfirmacao(r.resumo, opts),
};

// ── Catálogo final ────────────────────────────────────────────────────────────
export const TELEGRAM_TOOLS = [
  ...consultas,
  transferirAnimais,
  renomearLote,
  registrarPesagem,
  cadastrarDespesa,
  cadastrarReceita,
  registrarEntradaEstoque,
  cadastrarTarefa,
  cadastrarItemEstoque,
  darBaixaEstoque,
  trocarLotePasto,
];

const TOOLS_BY_NAME = new Map(TELEGRAM_TOOLS.map((t) => [t.name, t]));

export function obterFerramenta(name) {
  return TOOLS_BY_NAME.get(name) || null;
}

/** Ferramentas que um perfil pode usar — nunca oferece ao interpretador algo que o usuário não pode confirmar. */
export function ferramentasPermitidas(perfilTemPermissaoFn, perfil) {
  return TELEGRAM_TOOLS.filter((t) => perfilTemPermissaoFn(perfil, t.requiredPermission));
}
