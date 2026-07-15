import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararCadastroTarefa } from './cadastroTarefa.js';

const db = {
  lotes: [{ id: 1, nome: 'Recria 2026', status: 'ativo' }],
  funcionarios: [{ id: 9, nome: 'João Silva' }],
};

test('cadastra tarefa mínima (só título e data)', () => {
  const r = prepararCadastroTarefa(db, { titulo: 'Pesar o lote 12', data_vencimento: '2026-07-20' });
  assert.equal(r.ok, true);
  assert.equal(r.writes[0].tabela, 'tarefas');
  assert.equal(r.writes[0].registro.titulo, 'Pesar o lote 12');
  assert.equal(r.writes[0].registro.status, 'pendente');
  assert.equal(r.writes[0].registro.prioridade, 'media');
  assert.equal(r.writes[0].registro.lote_id, null);
});

test('título vazio é rejeitado', () => {
  const r = prepararCadastroTarefa(db, { titulo: '  ', data_vencimento: '2026-07-20' });
  assert.equal(r.ok, false);
  assert.equal(r.erro, 'TITULO_VAZIO');
});

test('data de vencimento é obrigatória', () => {
  const r = prepararCadastroTarefa(db, { titulo: 'Vacinar' });
  assert.equal(r.erro, 'DATA_VENCIMENTO_VAZIA');
});

test('resolve lote e responsável por nome quando informados', () => {
  const r = prepararCadastroTarefa(db, {
    titulo: 'Vacinar lote', data_vencimento: '2026-07-20', lote: 'Recria', responsavel: 'João',
  });
  assert.equal(r.ok, true);
  assert.equal(r.writes[0].registro.lote_id, 1);
  assert.equal(r.writes[0].registro.responsavel_id, 9);
});

test('lote não encontrado é rejeitado', () => {
  const r = prepararCadastroTarefa(db, { titulo: 'X', data_vencimento: '2026-07-20', lote: 'Inexistente' });
  assert.equal(r.erro, 'LOTE_NAO_ENCONTRADO');
});

test('prioridade/categoria fora do enum caem no default', () => {
  const r = prepararCadastroTarefa(db, { titulo: 'X', data_vencimento: '2026-07-20', prioridade: 'urgentissimo', categoria: 'inventado' });
  assert.equal(r.writes[0].registro.prioridade, 'media');
  assert.equal(r.writes[0].registro.categoria, 'manejo');
});

test('não inventa campo de recorrência (tarefas não tem essa coluna)', () => {
  const r = prepararCadastroTarefa(db, { titulo: 'X', data_vencimento: '2026-07-20' });
  assert.equal('recorrencia' in r.writes[0].registro, false);
});
