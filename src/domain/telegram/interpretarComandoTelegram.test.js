import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretarComandoTelegram, INTENCOES } from './interpretarComandoTelegram.js';

const i = (texto) => interpretarComandoTelegram(texto);

test('vazio → desconhecido', () => {
  assert.equal(i('').intencao, INTENCOES.DESCONHECIDO);
  assert.equal(i('   ').intencao, INTENCOES.DESCONHECIDO);
  assert.equal(i('asdf qwerty').intencao, INTENCOES.DESCONHECIDO);
});

test('listar fazendas (comando e frases equivalentes)', () => {
  for (const txt of ['/fazendas', 'mostrar fazendas', 'listar fazendas', 'quais fazendas eu tenho?', 'minhas fazendas', 'trocar de fazenda']) {
    assert.equal(i(txt).intencao, INTENCOES.LISTAR_FAZENDAS, txt);
  }
});

test('selecionar fazenda extrai o nome preservando a grafia', () => {
  const r = i('usar fazenda Boa Vista');
  assert.equal(r.intencao, INTENCOES.SELECIONAR_FAZENDA);
  assert.equal(r.parametros.nome, 'Boa Vista');
  assert.equal(i('trocar para fazenda Santa Clara').parametros.nome, 'Santa Clara');
  assert.equal(i('selecionar fazenda São José').parametros.nome, 'São José');
});

test('selecionar não confunde com transferência de lote', () => {
  assert.equal(i('trocar para fazenda Boa Vista').intencao, INTENCOES.SELECIONAR_FAZENDA);
});

test('listar lotes', () => {
  for (const txt of ['/lotes', 'listar lotes', 'quais são meus lotes?', 'ver lotes', 'meus lotes']) {
    assert.equal(i(txt).intencao, INTENCOES.LISTAR_LOTES, txt);
  }
});

test('ver lote específico', () => {
  const r = i('/lote Engorda 02');
  assert.equal(r.intencao, INTENCOES.VER_LOTE);
  assert.equal(r.parametros.nome, 'Engorda 02');
  assert.equal(i('ver lote Recria 01').parametros.nome, 'Recria 01');
});

test('lotes (plural) não vira ver_lote', () => {
  assert.equal(i('/lotes').intencao, INTENCOES.LISTAR_LOTES);
});

test('consultar estoque com e sem item', () => {
  assert.equal(i('/estoque').intencao, INTENCOES.CONSULTAR_ESTOQUE);
  assert.deepEqual(i('/estoque').parametros, {});
  assert.equal(i('como está o estoque?').intencao, INTENCOES.CONSULTAR_ESTOQUE);
  assert.equal(i('/estoque sal').parametros.item, 'sal');
  assert.equal(i('quanto tenho de sal mineral?').parametros.item, 'sal mineral');
  assert.equal(i('o que está acabando?').parametros.filtro, 'baixo');
  assert.equal(i('estoque baixo').parametros.filtro, 'baixo');
});

test('consultar financeiro e filtros', () => {
  assert.equal(i('/financeiro').intencao, INTENCOES.CONSULTAR_FINANCEIRO);
  assert.equal(i('mostrar contas a vencer').intencao, INTENCOES.CONSULTAR_FINANCEIRO);
  assert.equal(i('/financeiro vencidas').parametros.filtro, 'vencida');
  assert.equal(i('/financeiro hoje').parametros.filtro, 'hoje');
  assert.equal(i('/financeiro semana').parametros.filtro, 'semana');
  assert.equal(i('/financeiro lote Engorda 02').parametros.lote, 'Engorda 02');
});

test('alertas, manejos, pesagens, resumo', () => {
  assert.equal(i('/alertas').intencao, INTENCOES.VER_ALERTAS);
  assert.equal(i('tem vacina atrasada?').intencao, INTENCOES.VER_ALERTAS);
  assert.equal(i('/manejos').intencao, INTENCOES.VER_MANEJOS);
  assert.equal(i('mostrar manejos da semana').intencao, INTENCOES.VER_MANEJOS);
  assert.equal(i('/pesagens').intencao, INTENCOES.VER_PESAGENS);
  assert.equal(i('qual lote precisa pesar?').intencao, INTENCOES.VER_PESAGENS);
  assert.equal(i('/resumo').intencao, INTENCOES.RESUMO);
  assert.equal(i('resumo da fazenda').intencao, INTENCOES.RESUMO);
});

test('transferência válida extrai qtd, origem e destino e exige confirmação', () => {
  const r = i('transferir 10 animais do lote Recria 01 para Engorda 02');
  assert.equal(r.intencao, INTENCOES.TRANSFERIR_ANIMAIS_ENTRE_LOTES);
  assert.equal(r.requerConfirmacao, true);
  assert.equal(r.parametros.quantidade, 10);
  assert.equal(r.parametros.loteOrigem, 'Recria 01');
  assert.equal(r.parametros.loteDestino, 'Engorda 02');
});

test('transferência aceita sinônimos e lotes por número', () => {
  // "Lote A"/"Lote B": a palavra-chave "lote" é removida — o resolvedor no
  // webhook casa "A" com um lote chamado "Lote A" (com e sem prefixo).
  let r = i('mover 15 cabeças de Lote A para Lote B');
  assert.equal(r.parametros.quantidade, 15);
  assert.equal(r.parametros.loteOrigem, 'A');
  assert.equal(r.parametros.loteDestino, 'B');

  r = i('passar 8 animais do lote 12 para o lote 15');
  assert.equal(r.parametros.quantidade, 8);
  assert.equal(r.parametros.loteOrigem, '12');
  assert.equal(r.parametros.loteDestino, '15');
});

test('transferência sem quantidade ainda é transferência (qtd null)', () => {
  const r = i('transferir animais do lote Recria 01 para Engorda 02');
  assert.equal(r.intencao, INTENCOES.TRANSFERIR_ANIMAIS_ENTRE_LOTES);
  assert.equal(r.requerConfirmacao, true);
  assert.equal(r.parametros.quantidade, null);
  assert.equal(r.parametros.loteOrigem, 'Recria 01');
});

test('renomear lote exige confirmação e preserva o ID (só nomes)', () => {
  const r = i('renomear lote Recria 01 para Recria Norte');
  assert.equal(r.intencao, INTENCOES.RENOMEAR_LOTE);
  assert.equal(r.requerConfirmacao, true);
  assert.equal(r.parametros.loteAtual, 'Recria 01');
  assert.equal(r.parametros.novoNome, 'Recria Norte');
});

test('mensagem ambígua não vira ação destrutiva', () => {
  const r = i('trocar lote 1 para lote 2');
  assert.equal(r.intencao, INTENCOES.AMBIGUO);
  assert.equal(r.requerConfirmacao, false);
  assert.equal(r.parametros.lote1, '1');
  assert.equal(r.parametros.lote2, '2');
});

test('cadastros são reconhecidos e exigem confirmação', () => {
  assert.equal(i('registre pesagem de 425 kg no lote Engorda 02').intencao, INTENCOES.REGISTRAR_PESAGEM);
  assert.equal(i('o lote Engorda pesou 470 quilos').intencao, INTENCOES.REGISTRAR_PESAGEM);
  assert.equal(i('gastei 500 reais com sal').intencao, INTENCOES.CADASTRAR_DESPESA);
  assert.equal(i('cadastrar despesa').intencao, INTENCOES.CADASTRAR_DESPESA);
  assert.equal(i('recebi 15 mil pela venda').intencao, INTENCOES.CADASTRAR_RECEITA);
  assert.equal(i('adicionar 20 sacos de sal no estoque').intencao, INTENCOES.REGISTRAR_ENTRADA_ESTOQUE);
  for (const txt of ['registre pesagem de 425 kg no lote X', 'gastei 500 reais', 'recebi 15 mil']) {
    assert.equal(i(txt).requerConfirmacao, true, txt);
  }
});

test('pergunta de gasto é consulta, não cadastro', () => {
  assert.equal(i('quanto gastei este mês').intencao, INTENCOES.CONSULTAR_FINANCEIRO);
  assert.equal(i('qual meu lucro').intencao, INTENCOES.CONSULTAR_FINANCEIRO);
});

test('confirmar e cancelar', () => {
  assert.equal(i('/confirmar').intencao, INTENCOES.CONFIRMAR);
  assert.equal(i('confirmo').intencao, INTENCOES.CONFIRMAR);
  assert.equal(i('/cancelar').intencao, INTENCOES.CANCELAR);
  assert.equal(i('cancela').intencao, INTENCOES.CANCELAR);
});

test('ajuda / start', () => {
  assert.equal(i('/ajuda').intencao, INTENCOES.AJUDA);
  assert.equal(i('/start').intencao, INTENCOES.AJUDA);
  assert.equal(i('menu').intencao, INTENCOES.AJUDA);
});

test('nenhuma consulta muda dados (requerConfirmacao só em ação)', () => {
  const consultas = ['/fazendas', '/lotes', '/estoque', '/financeiro', '/alertas', '/manejos', '/pesagens', '/resumo', 'usar fazenda X'];
  for (const txt of consultas) {
    assert.equal(i(txt).requerConfirmacao, false, txt);
  }
});
