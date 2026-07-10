import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatarFazendas,
  formatarLotes,
  formatarLote,
  formatarEstoque,
  formatarFinanceiro,
  formatarManejos,
  formatarPesagens,
  formatarResumo,
} from './respostasConsulta.js';

const hojeIso = new Date().toISOString().slice(0, 10);
const ontem = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
const amanha = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
const anoPassado = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);

function db() {
  return {
    fazendas: [{ id: 1, nome: 'Santa Clara' }],
    lotes: [
      { id: 10, nome: 'Recria 01', status: 'ativo', qtd: 80, ultima_pesagem: anoPassado, faz_id: 1 },
      { id: 11, nome: 'Engorda 02', status: 'ativo', qtd: 60, ultima_pesagem: hojeIso, faz_id: 1 },
    ],
    animais: [
      { id: 1, lote_id: 10, qtd: 80, p_ini: 300, p_at: 312, dias: 40, sexo: 'M' },
      { id: 2, lote_id: 11, qtd: 60, p_ini: 400, p_at: 478, dias: 60, sexo: 'M' },
    ],
    custos: [],
    pesagens: [
      { id: 1, lote_id: 11, data: hojeIso, peso_medio: 478 },
      { id: 2, lote_id: 10, data: anoPassado, peso_medio: 300 },
    ],
    estoque: [
      { id: 1, produto: 'Sal mineral', quantidade_atual: 7, quantidade_minima: 10, unidade: 'sacos' },
      { id: 2, produto: 'Milho', quantidade_atual: 8400, quantidade_minima: 1000, unidade: 'kg' },
    ],
    movimentacoes_financeiras: [
      { id: 1, tipo: 'despesa', valor: 500, data_vencimento: ontem, status: 'pendente', descricao: 'Ração' },
      { id: 2, tipo: 'despesa', valor: 300, data_vencimento: amanha, status: 'pendente', descricao: 'Vacina' },
    ],
    sanitario: [
      { id: 1, nome: 'Vermífugo', proxima: ontem, status: 'pendente', lote_id: 10 },
      { id: 2, nome: 'Vacina aftosa', proxima: amanha, status: 'pendente', lote_id: 11 },
    ],
  };
}

test('fazendas: uma fazenda', () => {
  assert.match(formatarFazendas([{ id: 1, nome: 'Santa Clara' }], 1), /Fazenda atual: Santa Clara/);
});

test('fazendas: várias marcam a selecionada', () => {
  const txt = formatarFazendas([{ id: 1, nome: 'Santa Clara' }, { id: 2, nome: 'Boa Vista' }], 2);
  assert.match(txt, /Boa Vista — selecionada/);
  assert.match(txt, /usar fazenda/);
});

test('lotes lista com contagem', () => {
  const txt = formatarLotes(db(), { fazendaNome: 'Santa Clara' });
  assert.match(txt, /Recria 01/);
  assert.match(txt, /Engorda 02/);
  assert.match(txt, /80 animais/);
});

test('lote detalhe', () => {
  const d = db();
  const txt = formatarLote(d, d.lotes[1]);
  assert.match(txt, /Engorda 02/);
  assert.match(txt, /Animais: 60/);
});

test('estoque separa atenção de normal', () => {
  const txt = formatarEstoque(db(), {});
  assert.match(txt, /Sal mineral/);
  assert.match(txt, /Atenção:/);
  assert.match(txt, /Milho/);
});

test('estoque item específico', () => {
  assert.match(formatarEstoque(db(), { item: 'sal' }), /Sal mineral: 7 sacos/);
  assert.match(formatarEstoque(db(), { item: 'inexistente' }), /Não encontrei/);
});

test('estoque baixo', () => {
  const txt = formatarEstoque(db(), { filtro: 'baixo' });
  assert.match(txt, /Sal mineral/);
  assert.doesNotMatch(txt, /Milho/);
});

test('financeiro mostra vencidas e a vencer', () => {
  const txt = formatarFinanceiro(db(), {});
  assert.match(txt, /vencida/);
  assert.match(txt, /Ração/);
  assert.match(txt, /a vencer/);
});

test('manejos separa atrasados e próximos', () => {
  const txt = formatarManejos(db());
  assert.match(txt, /Atrasados/);
  assert.match(txt, /Vermífugo/);
  assert.match(txt, /Próximos/);
  assert.match(txt, /Vacina aftosa/);
});

test('pesagens lista últimas e lotes sem pesagem', () => {
  const txt = formatarPesagens(db());
  assert.match(txt, /Últimas pesagens/);
  assert.match(txt, /sem pesagem recente/);
  assert.match(txt, /Recria 01/);
});

test('resumo agrega contadores', () => {
  const txt = formatarResumo(db(), { fazendaNome: 'Santa Clara' });
  assert.match(txt, /2 lote\(s\) ativo\(s\)/);
  assert.match(txt, /140 animais/);
  assert.match(txt, /conta\(s\) vencida/);
});

test('vazios não inventam dados', () => {
  assert.match(formatarLotes({ lotes: [] }), /Nenhum lote ativo/);
  assert.match(formatarEstoque({ estoque: [] }), /Nenhum item/);
  assert.match(formatarFinanceiro({ movimentacoes_financeiras: [] }), /Nenhuma movimenta/);
  assert.match(formatarManejos({ sanitario: [] }), /Nenhum manejo/);
});
