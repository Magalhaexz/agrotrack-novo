import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGO_INTENCOES, intencoesPorTipo } from './catalogoIntencoes.js';
import { INTENCOES } from './interpretarComandoTelegram.js';

test('catálogo cobre todas as INTENCOES (não pode drift)', () => {
  for (const intencao of Object.values(INTENCOES)) {
    assert.ok(CATALOGO_INTENCOES[intencao], `faltou catalogar ${intencao}`);
  }
});

test('intencoesPorTipo agrupa corretamente', () => {
  assert.ok(intencoesPorTipo('cadastro').includes(INTENCOES.REGISTRAR_PESAGEM));
  assert.ok(intencoesPorTipo('consulta').includes(INTENCOES.LISTAR_LOTES));
  assert.ok(intencoesPorTipo('acao').includes(INTENCOES.TRANSFERIR_ANIMAIS_ENTRE_LOTES));
});
