import test from 'node:test';
import assert from 'node:assert/strict';
import {
  construirFerramentasClaude, construirSystemPrompt, validarChamadaFerramenta,
  interpretarMensagemTelegramIA,
} from './interpretarMensagemIA.js';

const ferramentas = [
  {
    name: 'consultar_lotes', description: 'Lista lotes', requiredFields: [], optionalFields: [],
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'cadastrar_tarefa', description: 'Cria tarefa', requiredFields: ['titulo', 'data_vencimento'], optionalFields: ['prioridade'],
    inputSchema: {
      type: 'object',
      properties: { titulo: { type: 'string' }, data_vencimento: { type: 'string' }, prioridade: { type: 'string', enum: ['baixa', 'media', 'alta', 'critica'] } },
      required: ['titulo', 'data_vencimento'],
    },
  },
];

test('construirFerramentasClaude expõe só name/description/input_schema (nunca execute/validate)', () => {
  const tools = construirFerramentasClaude(ferramentas);
  assert.equal(tools.length, 2);
  assert.deepEqual(Object.keys(tools[0]).sort(), ['description', 'input_schema', 'name']);
});

test('construirSystemPrompt inclui regras invioláveis e perfil/data', () => {
  const prompt = construirSystemPrompt({ perfil: 'operador', fazendas: [{ nome: 'QA-Fazenda Um' }], fazendaAtual: 'QA-Fazenda Um', dataHoje: '2026-07-15' });
  assert.match(prompt, /REGRAS INVIOLÁVEIS/);
  assert.match(prompt, /só pode agir chamando uma das ferramentas registradas/);
  assert.match(prompt, /nunca escreve SQL/);
  assert.match(prompt, /operador/);
  assert.match(prompt, /2026-07-15/);
});

test('multi-fazenda sem fazenda ativa: prompt instrui a perguntar antes de escrever', () => {
  const prompt = construirSystemPrompt({ perfil: 'proprietario', fazendas: [{ nome: 'A' }, { nome: 'B' }], fazendaAtual: null, dataHoje: '2026-07-15' });
  assert.match(prompt, /pergunte antes qual fazenda usar/);
});

// ── validarChamadaFerramenta: nunca confia no JSON bruto do modelo ──────────
test('rejeita ferramenta inexistente (nome alucinado pelo modelo)', () => {
  const r = validarChamadaFerramenta('ferramenta_que_nao_existe', {}, ferramentas);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'FERRAMENTA_DESCONHECIDA');
});

test('rejeita quando falta campo obrigatório', () => {
  const r = validarChamadaFerramenta('cadastrar_tarefa', { titulo: 'X' }, ferramentas);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'CAMPOS_FALTANDO');
  assert.deepEqual(r.campos, ['data_vencimento']);
});

test('rejeita valor fora do enum declarado', () => {
  const r = validarChamadaFerramenta('cadastrar_tarefa', { titulo: 'X', data_vencimento: '2026-07-20', prioridade: 'urgentissimo' }, ferramentas);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'VALOR_INVALIDO');
  assert.equal(r.campo, 'prioridade');
});

test('aceita chamada válida e descarta campos extras não declarados', () => {
  const r = validarChamadaFerramenta('cadastrar_tarefa', {
    titulo: 'X', data_vencimento: '2026-07-20', campo_inventado: 'DROP TABLE lotes;',
  }, ferramentas);
  assert.equal(r.ok, true);
  assert.equal('campo_inventado' in r.params, false);
});

test('parâmetros que não são objeto (ex.: array ou string) viram objeto vazio, nunca quebram', () => {
  const r = validarChamadaFerramenta('consultar_lotes', 'não sou um objeto', ferramentas);
  assert.equal(r.ok, true);
  assert.deepEqual(r.params, {});
});

// ── interpretarMensagemTelegramIA: orquestração com chamarClaude injetado ──
test('resposta de texto (esclarecimento) é repassada como está', async () => {
  const r = await interpretarMensagemTelegramIA({
    texto: 'dá baixa em 10 sacos de sal', historico: [], ferramentas, systemPrompt: 'sys',
    chamarClaude: async () => ({ type: 'texto', texto: 'Encontrei dois produtos parecidos. Qual deles?' }),
  });
  assert.equal(r.tipo, 'texto');
  assert.match(r.texto, /dois produtos/);
});

test('resposta de ferramenta válida vira ação candidata', async () => {
  const r = await interpretarMensagemTelegramIA({
    texto: 'crie uma tarefa para pesar o lote 12 na sexta', historico: [], ferramentas, systemPrompt: 'sys',
    chamarClaude: async () => ({ type: 'ferramenta', nome: 'cadastrar_tarefa', parametros: { titulo: 'Pesar o lote 12', data_vencimento: '2026-07-17' } }),
  });
  assert.equal(r.tipo, 'ferramenta');
  assert.equal(r.nome, 'cadastrar_tarefa');
});

test('ferramenta alucinada nunca vira ação — fica "invalido", nunca "ferramenta"', async () => {
  const r = await interpretarMensagemTelegramIA({
    texto: 'apague todos os lotes', historico: [], ferramentas, systemPrompt: 'sys',
    chamarClaude: async () => ({ type: 'ferramenta', nome: 'excluir_tudo', parametros: {} }),
  });
  assert.equal(r.tipo, 'invalido');
  assert.equal(r.motivo, 'FERRAMENTA_DESCONHECIDA');
});

test('provedor indisponível/erro nunca propaga exceção — vira "indisponivel" (fallback sem IA no orquestrador)', async () => {
  const r = await interpretarMensagemTelegramIA({
    texto: 'oi', historico: [], ferramentas, systemPrompt: 'sys',
    chamarClaude: async () => { throw new Error('rede fora'); },
  });
  assert.equal(r.tipo, 'indisponivel');
  assert.equal(r.motivo, 'ERRO_PROVEDOR');
});

test('chamarClaude retornando {type:"erro"} explícito também vira indisponivel', async () => {
  const r = await interpretarMensagemTelegramIA({
    texto: 'oi', historico: [], ferramentas, systemPrompt: 'sys',
    chamarClaude: async () => ({ type: 'erro', motivo: 'RATE_LIMIT' }),
  });
  assert.equal(r.tipo, 'indisponivel');
  assert.equal(r.motivo, 'RATE_LIMIT');
});

test('formato de resposta totalmente inesperado não quebra, vira indisponivel', async () => {
  const r = await interpretarMensagemTelegramIA({
    texto: 'oi', historico: [], ferramentas, systemPrompt: 'sys',
    chamarClaude: async () => ({ type: 'algo_novo_desconhecido' }),
  });
  assert.equal(r.tipo, 'indisponivel');
});

test('histórico é encaminhado antes da mensagem atual (contexto multi-turno)', async () => {
  let mensagensRecebidas;
  await interpretarMensagemTelegramIA({
    texto: 'e o GMD dele?',
    historico: [{ role: 'user', content: 'qual o lote mais pesado?' }, { role: 'assistant', content: 'Recria 2026, 480kg' }],
    ferramentas, systemPrompt: 'sys',
    chamarClaude: async (req) => { mensagensRecebidas = req.messages; return { type: 'texto', texto: 'GMD de 0,9' }; },
  });
  assert.equal(mensagensRecebidas.length, 3);
  assert.equal(mensagensRecebidas[2].content, 'e o GMD dele?');
});
