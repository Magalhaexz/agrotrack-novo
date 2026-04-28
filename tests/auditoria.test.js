import test from 'node:test';
import assert from 'node:assert/strict';
import { registrarAuditoria } from '../src/services/auditoria.js';

test('registrarAuditoria mantém fluxo local mesmo sem sessão/persistência remota', () => {
  const db = { auditoria: [] };
  const out = registrarAuditoria(db, { acao: 'acao_teste', entidade: 'sistema' }, {});
  assert.equal(Array.isArray(out.auditoria), true);
  assert.equal(out.auditoria.length, 1);
  assert.equal(out.auditoria[0].acao, 'acao_teste');
});
