// Matriz EXAUSTIVA de permissões (Sprint Paridade 1, bloco 5). Sistemática:
// itera TODAS as intenções mutáveis (`intencaoEhMutavel`) contra os 4 perfis
// e afirma o resultado esperado — cruzado com a matriz real do app
// (`src/auth/perfis.js`), não derivado da própria função sob teste (não é
// circular). Se alguém alterar `PERMISSAO_POR_INTENCAO` de forma que abra
// escrita para visualizador, ou feche escrita indevida, este teste quebra.
import test from 'node:test';
import assert from 'node:assert/strict';
import { podeExecutarComandoTelegram, intencaoEhMutavel } from './permissoesTelegram.js';
import { INTENCOES } from './interpretarComandoTelegram.js';

const MUTAVEIS = Object.values(INTENCOES).filter(intencaoEhMutavel);

// Operador NÃO tem: financeiro:editar (despesa/receita), fazendas:editar
// (cadastrar/renomear/excluir fazenda) nem pastagens:excluir (excluir pasto).
// Todas as demais escritas operacionais ele pode. Fonte: src/auth/perfis.js.
const OPERADOR_NEGADO = new Set([
  INTENCOES.CADASTRAR_DESPESA,
  INTENCOES.CADASTRAR_RECEITA,
  INTENCOES.CADASTRAR_FAZENDA,
  INTENCOES.RENOMEAR_FAZENDA,
  INTENCOES.EXCLUIR_FAZENDA,
  INTENCOES.EXCLUIR_PASTO,
]);

test('matriz de permissões cobre pelo menos as 33 operações mutáveis conhecidas', () => {
  assert.ok(MUTAVEIS.length >= 33, `esperava >=33 mutáveis, achei ${MUTAVEIS.length}`);
});

test('visualizador NUNCA grava — negado em todas as operações mutáveis (invariante)', () => {
  for (const intencao of MUTAVEIS) {
    assert.equal(podeExecutarComandoTelegram('visualizador', intencao).permitido, false, `visualizador deveria ser negado em ${intencao}`);
  }
});

test('proprietário pode todas as operações mutáveis', () => {
  for (const intencao of MUTAVEIS) {
    assert.equal(podeExecutarComandoTelegram('proprietario', intencao).permitido, true, `proprietario deveria poder ${intencao}`);
  }
});

test('gerente pode todas as operações mutáveis', () => {
  for (const intencao of MUTAVEIS) {
    assert.equal(podeExecutarComandoTelegram('gerente', intencao).permitido, true, `gerente deveria poder ${intencao}`);
  }
});

test('operador pode as operacionais, exceto financeiro/fazenda/exclusão de pasto', () => {
  for (const intencao of MUTAVEIS) {
    const esperado = !OPERADOR_NEGADO.has(intencao);
    assert.equal(
      podeExecutarComandoTelegram('operador', intencao).permitido,
      esperado,
      `operador em ${intencao}: esperava ${esperado}`,
    );
  }
});

test('toda operação mutável tem uma permissão mapeada (nunca "permitido por omissão")', () => {
  for (const intencao of MUTAVEIS) {
    const { permissao } = podeExecutarComandoTelegram('visualizador', intencao);
    assert.ok(permissao, `${intencao} não tem permissão mapeada — cairia no default de negação, mas deve ser explícito`);
  }
});

// As 5 tratativas de alerta e as 2 exclusões exigem o mesmo gate do app.
test('novas operações do bloco 5 usam o gate correto do app', () => {
  const esperado = {
    [INTENCOES.MARCAR_ALERTA_EM_ANALISE]: 'tarefas:editar',
    [INTENCOES.RESOLVER_ALERTA]: 'tarefas:editar',
    [INTENCOES.IGNORAR_ALERTA]: 'tarefas:editar',
    [INTENCOES.ADIAR_ALERTA]: 'tarefas:editar',
    [INTENCOES.REABRIR_ALERTA]: 'tarefas:editar',
    [INTENCOES.EXCLUIR_FAZENDA]: 'fazendas:editar',
    [INTENCOES.EXCLUIR_PASTO]: 'pastagens:excluir',
  };
  for (const [intencao, permissao] of Object.entries(esperado)) {
    assert.equal(podeExecutarComandoTelegram('visualizador', intencao).permissao, permissao, `${intencao} deveria mapear para ${permissao}`);
  }
});
