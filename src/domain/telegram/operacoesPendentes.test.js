import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularExpiraEm, estaExpirada, podeConfirmar, STATUS } from './operacoesPendentes.js';

const base = () => ({
  status: STATUS.PENDENTE,
  user_id: 'u1',
  telegram_chat_id: '123',
  expira_em: new Date(Date.now() + 60_000).toISOString(),
});

test('calcularExpiraEm soma minutos', () => {
  const agora = new Date('2026-07-10T12:00:00Z');
  assert.equal(calcularExpiraEm(agora, 5).toISOString(), '2026-07-10T12:05:00.000Z');
});

test('confirmação válida pelo mesmo usuário/chat', () => {
  const r = podeConfirmar(base(), { userId: 'u1', chatId: '123' });
  assert.equal(r.ok, true);
});

test('confirmação por outro usuário é negada', () => {
  assert.equal(podeConfirmar(base(), { userId: 'u2', chatId: '123' }).motivo, 'OUTRO_USUARIO');
});

test('confirmação de outro chat é negada', () => {
  assert.equal(podeConfirmar(base(), { userId: 'u1', chatId: '999' }).motivo, 'OUTRO_CHAT');
});

test('operação expirada não é confirmada', () => {
  const op = { ...base(), expira_em: new Date(Date.now() - 1000).toISOString() };
  assert.equal(estaExpirada(op), true);
  assert.equal(podeConfirmar(op, { userId: 'u1', chatId: '123' }).motivo, 'EXPIRADA');
});

test('confirmação duplicada (já executada) é negada', () => {
  const op = { ...base(), status: STATUS.EXECUTADA };
  assert.equal(podeConfirmar(op, { userId: 'u1', chatId: '123' }).motivo, 'JA_EXECUTADA');
});

test('operação cancelada não confirma', () => {
  const op = { ...base(), status: STATUS.CANCELADA };
  assert.equal(podeConfirmar(op, { userId: 'u1', chatId: '123' }).motivo, 'NAO_PENDENTE');
});

test('sem operação', () => {
  assert.equal(podeConfirmar(null, { userId: 'u1', chatId: '123' }).motivo, 'SEM_OPERACAO');
});
