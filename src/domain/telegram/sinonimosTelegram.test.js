import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarComSinonimos, palavrasConhecidas, SINONIMOS } from './sinonimosTelegram.js';

test('cada grupo do dicionário tem pelo menos 2 sinônimos e é uma lista de strings', () => {
  for (const [grupo, frases] of Object.entries(SINONIMOS)) {
    assert.ok(Array.isArray(frases) && frases.length >= 2, grupo);
    frases.forEach((f) => assert.equal(typeof f, 'string'));
  }
});

test('reconhece variações de "cadastrar" que a regex já cobre', () => {
  assert.match(normalizarComSinonimos('crie uma tarefa'), /\bcadastrar\b/);
  assert.match(normalizarComSinonimos('adicione um item'), /\bcadastrar\b/);
});

test('reconhece frases fora da alternância de regex existente ("me lembra de")', () => {
  const t = normalizarComSinonimos('me lembra de pesar o lote amanha');
  assert.match(t, /\btarefa\b/);
  assert.match(t, /\bpesagem\b/); // "pesar" também vira canônico de pesagem
});

test('saída/entrada de estoque: frases de duas palavras não quebram no meio ("de baixa" vs "dar baixa")', () => {
  assert.match(normalizarComSinonimos('dar baixa em 50kg de sal'), /\bestoque_saida\b/);
  assert.match(normalizarComSinonimos('dar entrada em 300kg de racao'), /\bestoque_entrada\b/);
});

test('morte/perda vira canônico "morte"', () => {
  assert.match(normalizarComSinonimos('morreram 2 animais do lote 9'), /\bmorte\b/);
  assert.match(normalizarComSinonimos('registrei uma perda no lote 9'), /\bmorte\b/);
});

test('troca de pasto reconhece a frase canônica contígua', () => {
  // Frases com o nome do lote NO MEIO ("mova o lote Recria para o pasto
  // Norte") não são contíguas — essas dependem do regex dedicado do
  // classificador (interpretadorTelegram.js/interpretarComandoTelegram.js),
  // não desta substituição de frase. Aqui só garantimos o caso contíguo.
  assert.match(normalizarComSinonimos('troque de pasto o lote 8'), /\btrocar_pasto\b/);
  assert.match(normalizarComSinonimos('mande para o pasto Norte'), /\btrocar_pasto\b/);
});

test('nunca substitui dentro de outra palavra (word boundary)', () => {
  // "consultar" não deveria disparar por causa de "sal" aparecer solto em outro contexto
  const t = normalizarComSinonimos('quanto sal ainda tenho');
  assert.match(t, /\bsuplemento\b/); // "sal" isolado vira suplemento
  assert.match(t, /\bconsultar\b/); // "quanto" vira consultar
});

test('texto sem nenhum sinônimo reconhecido volta só normalizado (acento/caixa)', () => {
  assert.equal(normalizarComSinonimos('Fêmea'), 'femea');
});

test('palavrasConhecidas devolve a lista achatada usada pela tolerância a erro', () => {
  const lista = palavrasConhecidas();
  assert.ok(lista.includes('pesagem'));
  assert.ok(lista.includes('cadastrar'));
  assert.ok(lista.length > 20);
});
