import test from 'node:test';
import assert from 'node:assert/strict';
import {
  interpretarMensagemTelegram, perguntaConfirmarIntencao, mensagemReformular,
  LIMIAR_EXECUTAR, LIMIAR_CONFIRMAR_INTENCAO,
} from './interpretadorTelegram.js';
import { INTENCOES } from './interpretarComandoTelegram.js';

test('texto reconhecido de primeira (sem correção) tem confiança alta e executa direto', () => {
  const r = interpretarMensagemTelegram('/lotes');
  assert.equal(r.intencao, INTENCOES.LISTAR_LOTES);
  assert.equal(r.confidence, 0.95);
  assert.ok(r.confidence >= LIMIAR_EXECUTAR);
  assert.equal(r.correcoes.length, 0);
});

test('frase fora da alternância de regex, mas dentro dos sinônimos, é reconhecida com confiança média-alta', () => {
  // "tirei" só está no dicionário de sinônimos (grupo estoque_saida) — a
  // regex crua de RE_SAIDA_ESTOQUE não reconhece esse verbo diretamente.
  const r = interpretarMensagemTelegram('tirei 10 kg de sal do estoque');
  assert.equal(r.intencao, INTENCOES.DAR_BAIXA_ESTOQUE);
  assert.equal(r.confidence, 0.80);
  assert.ok(r.confidence >= LIMIAR_CONFIRMAR_INTENCAO && r.confidence < LIMIAR_EXECUTAR);
});

test('erro de digitação simples é corrigido e reconhecido com confiança média', () => {
  const r = interpretarMensagemTelegram('registrar pesajen de 425 kg no lote Recria');
  assert.equal(r.intencao, INTENCOES.REGISTRAR_PESAGEM);
  assert.equal(r.confidence, 0.65);
  assert.equal(r.correcoes.length, 1);
  assert.equal(r.correcoes[0].corrigida, 'pesagem');
});

test('texto totalmente incompreensível tem confiança 0 e intenção desconhecida', () => {
  const r = interpretarMensagemTelegram('blablabla xyz 123 nada a ver');
  assert.equal(r.intencao, INTENCOES.DESCONHECIDO);
  assert.equal(r.confidence, 0);
});

test('vazio também é desconhecido, sem lançar exceção', () => {
  assert.equal(interpretarMensagemTelegram('').intencao, INTENCOES.DESCONHECIDO);
  assert.equal(interpretarMensagemTelegram(undefined).intencao, INTENCOES.DESCONHECIDO);
});

test('nunca finge compreensão: não existe confiança "no meio" arbitrária além dos 3 buckets', () => {
  const r = interpretarMensagemTelegram('registre pesagem de 425 kg no lote Recria');
  assert.ok([0, 0.65, 0.80, 0.95].includes(r.confidence));
});

test('perguntaConfirmarIntencao menciona a correção quando houve uma', () => {
  const r = interpretarMensagemTelegram('estoqe da fazenda');
  const p = perguntaConfirmarIntencao(r);
  assert.match(p, /estoque/);
});

test('perguntaConfirmarIntencao genérica quando não houve correção de digitação', () => {
  const p = perguntaConfirmarIntencao({ correcoes: [] });
  assert.match(p, /confirmar ou reformular/i);
});

test('mensagemReformular sugere exemplos e /ajuda (nunca deixa o usuário sem saída)', () => {
  const m = mensagemReformular();
  assert.match(m, /Não entendi/);
  assert.match(m, /\/ajuda/);
  assert.match(m, /Quanto gado/);
});

test('nunca corrompe nome próprio de lote/fazenda por estar perto de uma palavra-chave (regressão)', () => {
  // "Recria" (nome real de lote) ficou a distância 2 de "receita" — sem a
  // proteção de maiúscula-no-meio-da-frase, a tolerância trocaria o nome do
  // lote pela palavra-chave "receita", corrompendo a entidade.
  const r = interpretarMensagemTelegram('registrar pesajen de 425 kg no lote Recria');
  assert.equal(r.intencao, INTENCOES.REGISTRAR_PESAGEM);
  assert.equal(r.correcoes.length, 1);
  assert.equal(r.correcoes[0].original, 'pesajen');
  assert.match(r.textoInterpretado, /\bRecria\b/);
});

test('parametros e requerConfirmacao são preservados do classificador original', () => {
  const r = interpretarMensagemTelegram('transferir 10 animais do lote A para o lote B');
  assert.equal(r.intencao, INTENCOES.TRANSFERIR_ANIMAIS_ENTRE_LOTES);
  assert.equal(r.parametros.quantidade, 10);
  assert.equal(r.requerConfirmacao, true);
});
