import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararTratativaAlerta, prepararReabrirAlerta, listarAlertasAtivosNumerados } from './acoesAlerta.js';
import { STATUS_TRATATIVA } from '../tratativasAlertas.js';

// Estoque vencido é o gatilho mais simples de `gerarAlertasUnificados` para
// produzir um alerta determinístico sem depender de `agora` (data bem no
// passado é "vencida" em qualquer momento em que o teste rodar).
function db() {
  return {
    estoque: [
      { id: 1, produto: 'Sal mineral', data_validade: '2020-01-01', alerta_dias_antes: 5, quantidade_atual: 100, quantidade_minima: 10 },
    ],
    alertas_tratativas: [],
  };
}

test('lista o alerta ativo de estoque vencido', () => {
  const alertas = listarAlertasAtivosNumerados(db());
  assert.equal(alertas.length, 1);
  assert.match(alertas[0].titulo, /vencid/i);
});

test('prepara marcar em análise por posição (1)', () => {
  const r = prepararTratativaAlerta(db(), { referencia: '1', status: STATUS_TRATATIVA.EM_ANALISE });
  assert.equal(r.ok, true);
  assert.match(r.resumo.join(' '), /em análise/i);
  assert.equal(r.writes[0].tipo, 'insert');
  assert.equal(r.writes[0].registro.status, 'em_analise');
  assert.equal(r.writes[0].registro.alerta_id, listarAlertasAtivosNumerados(db())[0].id);
});

test('prepara resolver por trecho do título', () => {
  const r = prepararTratativaAlerta(db(), { referencia: 'vencido', status: STATUS_TRATATIVA.RESOLVIDO });
  assert.equal(r.ok, true);
  assert.equal(r.writes[0].registro.status, 'resolvido');
});

test('adiar exige data', () => {
  assert.equal(prepararTratativaAlerta(db(), { referencia: '1', status: STATUS_TRATATIVA.ADIADO }).erro, 'DATA_ADIAMENTO_VAZIA');
  const r = prepararTratativaAlerta(db(), { referencia: '1', status: STATUS_TRATATIVA.ADIADO, adiadoAte: '2026-08-01' });
  assert.equal(r.ok, true);
  assert.equal(r.writes[0].registro.adiado_ate, '2026-08-01');
});

test('responsável entra dentro da observação (sem coluna própria)', () => {
  const r = prepararTratativaAlerta(db(), { referencia: '1', status: STATUS_TRATATIVA.RESOLVIDO, responsavel: 'João', observacao: 'Aplicação feita' });
  assert.equal(r.ok, true);
  assert.equal(r.writes[0].registro.observacao, 'Responsável: João — Aplicação feita');
});

test('atualiza (não duplica) quando já existe tratativa para o mesmo alerta', () => {
  const alertaId = listarAlertasAtivosNumerados(db())[0].id;
  const dbComTratativa = { ...db(), alertas_tratativas: [{ id: 'trat-1', alerta_id: alertaId, status: 'em_analise' }] };
  const r = prepararTratativaAlerta(dbComTratativa, { referencia: '1', status: STATUS_TRATATIVA.RESOLVIDO });
  assert.equal(r.ok, true);
  assert.equal(r.writes[0].tipo, 'update');
  assert.equal(r.writes[0].match.id, 'trat-1');
});

test('rejeita referência vazia, inexistente e status inválido', () => {
  assert.equal(prepararTratativaAlerta(db(), { referencia: '', status: STATUS_TRATATIVA.RESOLVIDO }).erro, 'ALERTA_NAO_ENCONTRADO');
  assert.equal(prepararTratativaAlerta(db(), { referencia: '99', status: STATUS_TRATATIVA.RESOLVIDO }).erro, 'ALERTA_NAO_ENCONTRADO');
  assert.equal(prepararTratativaAlerta(db(), { referencia: '1', status: 'invalido' }).erro, 'STATUS_INVALIDO');
});

// ── Reabrir ──────────────────────────────────────────────────────────────────
test('reabrir remove a tratativa existente (delete)', () => {
  const alertaId = listarAlertasAtivosNumerados(db())[0].id;
  const dbComTratativa = { ...db(), alertas_tratativas: [{ id: 'trat-1', alerta_id: alertaId, status: 'resolvido' }] };
  const r = prepararReabrirAlerta(dbComTratativa, { referencia: 'vencido' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.writes[0], { tabela: 'alertas_tratativas', tipo: 'delete', match: { id: 'trat-1' } });
});

test('reabrir rejeita alerta sem tratativa (nada para reabrir)', () => {
  const r = prepararReabrirAlerta(db(), { referencia: '1' });
  assert.equal(r.erro, 'ALERTA_NAO_TRATADO');
});
