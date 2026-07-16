import test from 'node:test';
import assert from 'node:assert/strict';
import { extrairDadosIniciais, interpretarResposta, prepararCadastro, slotsDoCadastro } from './cadastros.js';
import { INTENCOES } from './interpretarComandoTelegram.js';

const HOJE = new Date(Date.UTC(2026, 6, 10));
const db = () => ({
  lotes: [
    { id: 10, nome: 'Recria 01', status: 'ativo', faz_id: 1, pastagem_id: 'pasto-a' },
    { id: 11, nome: 'Engorda 02', status: 'ativo', faz_id: 1, pastagem_id: 'pasto-a' },
  ],
  estoque: [
    { id: 1, produto: 'Sal mineral', quantidade_atual: 7, unidade: 'sacos' },
    { id: 2, produto: 'Milho', quantidade_atual: 8400, unidade: 'kg' },
  ],
  pastagens: [
    { id: 'pasto-a', nome: 'Capim Sul', faz_id: 1 },
    { id: 'pasto-b', nome: 'Capim Norte', faz_id: 1 },
  ],
  funcionarios: [{ id: 5, nome: 'João Silva' }],
});
const ctx = () => ({ db: db(), hoje: HOJE, fazendaId: 1 });

test('extração inicial de pesagem por mensagem única', () => {
  const d = extrairDadosIniciais(INTENCOES.REGISTRAR_PESAGEM, 'registre pesagem de 425 kg no lote Engorda 02', ctx());
  assert.equal(d.peso, 425);
  assert.equal(d.lote, 'Engorda 02');
});

test('extração inicial de despesa', () => {
  const d = extrairDadosIniciais(INTENCOES.CADASTRAR_DESPESA, 'gastei 500 reais com sal mineral', ctx());
  assert.equal(d.valor, 500);
  assert.equal(d.descricao, 'sal mineral');
});

test('interpretarResposta por tipo de slot', () => {
  assert.equal(interpretarResposta('valor', '850 reais'), 850);
  assert.equal(interpretarResposta('peso', '425'), 425);
  assert.equal(interpretarResposta('data', 'hoje', { hoje: HOJE }), '2026-07-10');
  assert.equal(interpretarResposta('texto', 'Compra de sal'), 'Compra de sal');
  assert.equal(interpretarResposta('opcional_texto', 'não'), '');
  assert.equal(interpretarResposta('lote', 'Engorda 02'), 'Engorda 02');
});

test('slotsDoCadastro define perguntas', () => {
  const slots = slotsDoCadastro(INTENCOES.CADASTRAR_DESPESA);
  assert.equal(slots[0].nome, 'valor');
  assert.equal(slots[1].nome, 'descricao');
});

test('prepararCadastro pesagem gera insert em pesagens', () => {
  const r = prepararCadastro(INTENCOES.REGISTRAR_PESAGEM, { lote: 'Engorda 02', peso: 425 }, ctx());
  assert.equal(r.ok, true);
  assert.equal(r.writes[0].tabela, 'pesagens');
  assert.equal(r.writes[0].registro.lote_id, 11);
  assert.equal(r.writes[0].registro.peso_medio, 425);
  assert.equal(r.writes[0].registro.data, '2026-07-10');
});

test('pesagem exige lote resolvível e peso positivo', () => {
  assert.equal(prepararCadastro(INTENCOES.REGISTRAR_PESAGEM, { lote: 'Engorda 02', peso: 0 }, ctx()).erro, 'PESO_INVALIDO');
  assert.equal(prepararCadastro(INTENCOES.REGISTRAR_PESAGEM, { lote: 'Inexistente', peso: 425 }, ctx()).erro, 'LOTE_NAO_ENCONTRADO');
});

test('prepararCadastro despesa com lote opcional', () => {
  const r = prepararCadastro(INTENCOES.CADASTRAR_DESPESA, { valor: 500, descricao: 'Sal', lote: 'Recria 01' }, ctx());
  assert.equal(r.ok, true);
  assert.equal(r.tipo, 'despesa');
  assert.equal(r.writes[0].registro.tipo, 'despesa');
  assert.equal(r.writes[0].registro.valor, 500);
  assert.equal(r.writes[0].registro.lote_id, 10);
});

test('despesa sem lote vincula a nenhum', () => {
  const r = prepararCadastro(INTENCOES.CADASTRAR_DESPESA, { valor: 300, descricao: 'Combustível' }, ctx());
  assert.equal(r.ok, true);
  assert.equal(r.writes[0].registro.lote_id, null);
});

test('despesa valida valor e descrição', () => {
  assert.equal(prepararCadastro(INTENCOES.CADASTRAR_DESPESA, { valor: 0, descricao: 'x' }, ctx()).erro, 'VALOR_INVALIDO');
  assert.equal(prepararCadastro(INTENCOES.CADASTRAR_DESPESA, { valor: 100, descricao: '' }, ctx()).erro, 'DESCRICAO_VAZIA');
});

test('receita gera insert de receita', () => {
  const r = prepararCadastro(INTENCOES.CADASTRAR_RECEITA, { valor: 15000, descricao: 'Venda lote' }, ctx());
  assert.equal(r.writes[0].registro.tipo, 'receita');
  assert.equal(r.writes[0].registro.valor, 15000);
});

test('entrada de estoque resolve item e atualiza saldo', () => {
  const r = prepararCadastro(INTENCOES.REGISTRAR_ENTRADA_ESTOQUE, { item: 'sal', quantidade: 20 }, ctx());
  assert.equal(r.ok, true);
  assert.equal(r.writes.length, 2);
  assert.equal(r.writes[0].tabela, 'movimentacoes_estoque');
  assert.equal(r.writes[0].registro.quantidade, 20);
  assert.equal(r.writes[1].tabela, 'estoque');
  assert.equal(r.writes[1].patch.quantidade_atual, 27);
});

test('entrada de estoque item inexistente', () => {
  assert.equal(prepararCadastro(INTENCOES.REGISTRAR_ENTRADA_ESTOQUE, { item: 'inexistente', quantidade: 5 }, ctx()).erro, 'ITEM_NAO_ENCONTRADO');
});

// ── Sprint bot operacional determinístico: 4 novos cadastros/ações ──────────
test('prepararCadastro cadastrar_tarefa insere em tarefas com fazenda_id do contexto', () => {
  const r = prepararCadastro(INTENCOES.CADASTRAR_TAREFA, { titulo: 'Pesar lote', data_vencimento: '2026-07-20' }, ctx());
  assert.equal(r.ok, true);
  assert.equal(r.tipo, 'tarefa');
  assert.equal(r.writes[0].tabela, 'tarefas');
  assert.equal(r.writes[0].registro.titulo, 'Pesar lote');
  assert.equal(r.writes[0].registro.fazenda_id, 1);
});

test('cadastrar_tarefa exige título e data de vencimento', () => {
  assert.equal(prepararCadastro(INTENCOES.CADASTRAR_TAREFA, { data_vencimento: '2026-07-20' }, ctx()).erro, 'TITULO_VAZIO');
  assert.equal(prepararCadastro(INTENCOES.CADASTRAR_TAREFA, { titulo: 'X' }, ctx()).erro, 'DATA_VENCIMENTO_VAZIA');
});

test('prepararCadastro cadastrar_item_estoque insere item novo em estoque', () => {
  const r = prepararCadastro(INTENCOES.CADASTRAR_ITEM_ESTOQUE, { nome: 'Sal Proteinado', quantidade_inicial: 20 }, ctx());
  assert.equal(r.ok, true);
  assert.equal(r.tipo, 'item_estoque');
  assert.equal(r.writes[0].tabela, 'estoque');
  assert.equal(r.writes[0].registro.produto, 'Sal Proteinado');
  assert.equal(r.writes[0].registro.quantidade_atual, 20);
});

test('prepararCadastro dar_baixa_estoque decrementa o saldo real', () => {
  const r = prepararCadastro(INTENCOES.DAR_BAIXA_ESTOQUE, { item: 'sal', quantidade: 3 }, ctx());
  assert.equal(r.ok, true);
  assert.equal(r.tipo, 'saida_estoque');
  const upd = r.writes.find((w) => w.tabela === 'estoque');
  assert.equal(upd.patch.quantidade_atual, 4);
});

test('dar_baixa_estoque impede saldo negativo', () => {
  assert.equal(prepararCadastro(INTENCOES.DAR_BAIXA_ESTOQUE, { item: 'sal', quantidade: 999 }, ctx()).erro, 'SALDO_INSUFICIENTE');
});

test('prepararCadastro trocar_lote_pasto move o lote sem alterar quantidade', () => {
  const r = prepararCadastro(INTENCOES.TROCAR_LOTE_PASTO, { lote: 'Recria', pasto: 'Capim Norte' }, ctx());
  assert.equal(r.ok, true);
  assert.equal(r.tipo, 'troca_pasto');
  const updLote = r.writes.find((w) => w.tabela === 'lotes');
  assert.equal(updLote.patch.pastagem_id, 'pasto-b');
  assert.equal('qtd' in updLote.patch, false);
});

test('trocar_lote_pasto de pasto de outra fazenda é rejeitado', () => {
  const dbOutraFazenda = { ...db(), pastagens: [...db().pastagens, { id: 'pasto-c', nome: 'Longe', faz_id: 99 }] };
  const r = prepararCadastro(INTENCOES.TROCAR_LOTE_PASTO, { lote: 'Recria', pasto: 'Longe' }, { db: dbOutraFazenda, hoje: HOJE, fazendaId: 1 });
  assert.equal(r.erro, 'PASTO_OUTRA_FAZENDA');
});

// ── Sprint de expansão do bot operacional: 8 novos cadastros/ações ──────────
const dbComRebanho = () => ({
  ...db(),
  fazendas: [{ id: 1, nome: 'Fazenda Um' }],
  lotes: db().lotes.map((l) => ({ ...l, qtd: 30, p_at: 380, supl_meta_dias: 30 })),
});
const ctxComRebanho = () => ({ db: dbComRebanho(), hoje: HOJE, fazendaId: 1 });

test('prepararCadastro cadastrar_lote insere lote novo na fazenda do contexto', () => {
  const r = prepararCadastro(INTENCOES.CADASTRAR_LOTE, { nome_lote: 'Nova Recria', quantidade: 20, sexo: 'macho' }, ctxComRebanho());
  assert.equal(r.ok, true);
  assert.equal(r.tipo, 'cadastro_lote');
  assert.equal(r.writes[0].tabela, 'lotes');
  assert.equal(r.writes[0].registro.nome, 'Nova Recria');
  assert.equal(r.writes[0].registro.faz_id, 1);
  assert.equal(r.writes[0].registro.qtd, 20);
});

test('prepararCadastro cadastrar_pasto insere pasto novo na fazenda do contexto', () => {
  const r = prepararCadastro(INTENCOES.CADASTRAR_PASTO, { nome_pasto: 'Pasto Leste', area: 12 }, ctxComRebanho());
  assert.equal(r.ok, true);
  assert.equal(r.tipo, 'cadastro_pasto');
  assert.equal(r.writes[0].tabela, 'pastagens');
  assert.equal(r.writes[0].registro.nome, 'Pasto Leste');
  assert.equal(r.writes[0].registro.faz_id, 1);
});

test('prepararCadastro registrar_venda resolve o lote pelo nome e gera receita', () => {
  const r = prepararCadastro(INTENCOES.REGISTRAR_VENDA, { lote: 'Recria 01', quantidade: 10, valor: 25000 }, ctxComRebanho());
  assert.equal(r.ok, true);
  assert.equal(r.tipo, 'venda');
  const loteUpdate = r.writes.find((w) => w.tabela === 'lotes');
  assert.equal(loteUpdate.patch.qtd, 20);
  const financeiro = r.writes.find((w) => w.tabela === 'movimentacoes_financeiras');
  assert.equal(financeiro.registro.valor, 25000);
});

test('registrar_venda lote inexistente', () => {
  assert.equal(prepararCadastro(INTENCOES.REGISTRAR_VENDA, { lote: 'Inexistente', quantidade: 5 }, ctxComRebanho()).erro, 'LOTE_NAO_ENCONTRADO');
});

test('prepararCadastro registrar_morte nunca gera lançamento financeiro', () => {
  const r = prepararCadastro(INTENCOES.REGISTRAR_MORTE, { lote: 'Recria 01', quantidade: 2, motivo: 'Doença' }, ctxComRebanho());
  assert.equal(r.ok, true);
  assert.equal(r.tipo, 'morte');
  assert.equal(r.writes.some((w) => w.tabela === 'movimentacoes_financeiras'), false);
});

test('prepararCadastro finalizar_lote atualiza só o status do lote', () => {
  const r = prepararCadastro(INTENCOES.FINALIZAR_LOTE, { lote: 'Recria 01', motivo: 'Ciclo encerrado' }, ctxComRebanho());
  assert.equal(r.ok, true);
  assert.equal(r.tipo, 'finalizar_lote');
  assert.equal(r.writes[0].patch.status, 'encerrado');
});

test('prepararCadastro cadastrar_manejo insere em sanitario', () => {
  const r = prepararCadastro(INTENCOES.CADASTRAR_MANEJO, { lote: 'Recria 01', tipo: 'vacina', quantidade_animais: 30 }, ctxComRebanho());
  assert.equal(r.ok, true);
  assert.equal(r.tipo, 'manejo');
  assert.equal(r.writes[0].tabela, 'sanitario');
  assert.equal(r.writes[0].registro.lote_id, 10);
});

test('cadastrar_manejo exige tipo e quantidade de animais', () => {
  assert.equal(prepararCadastro(INTENCOES.CADASTRAR_MANEJO, { lote: 'Recria 01', tipo: '', quantidade_animais: 10 }, ctxComRebanho()).erro, 'TIPO_VAZIO');
  assert.equal(prepararCadastro(INTENCOES.CADASTRAR_MANEJO, { lote: 'Recria 01', tipo: 'vacina', quantidade_animais: 0 }, ctxComRebanho()).erro, 'QUANTIDADE_INVALIDA');
});

test('prepararCadastro cadastrar_planejamento_suplementacao atualiza o lote sem baixar estoque', () => {
  const r = prepararCadastro(INTENCOES.CADASTRAR_PLANEJAMENTO_SUPLEMENTACAO, { lote: 'Recria 01', produto: 'Ração', quantidade_por_cabeca: 2 }, ctxComRebanho());
  assert.equal(r.ok, true);
  assert.equal(r.tipo, 'planejamento_suplementacao');
  assert.equal(r.writes.length, 1);
  assert.equal(r.writes[0].tabela, 'lotes');
});

test('prepararCadastro registrar_consumo_suplementacao baixa estoque e vincula fazenda do contexto', () => {
  const r = prepararCadastro(INTENCOES.REGISTRAR_CONSUMO_SUPLEMENTACAO, { lote: 'Recria 01', produto: 'sal', quantidade: 3 }, ctxComRebanho());
  assert.equal(r.ok, true);
  assert.equal(r.tipo, 'consumo_suplementacao');
  const consumo = r.writes.find((w) => w.tabela === 'consumo_suplementacao');
  assert.equal(consumo.registro.fazenda_id, 1);
  assert.equal(consumo.registro.quantidade, 3);
  const estoqueUpdate = r.writes.find((w) => w.tabela === 'estoque');
  assert.equal(estoqueUpdate.patch.quantidade_atual, 4);
});
