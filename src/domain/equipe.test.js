import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  contarAdministradoresAtivos,
  contarUsuariosDoPlano,
  ehUnicoProprietario,
  podeAlterarPapel,
  podeRemoverAcesso,
  obterResumoPermissoesPerfil,
  separarProprietarioEMembros,
} from './equipe.js';
import { perfilPodeGerenciarAcessos, perfilTemPermissao } from '../auth/perfis.js';
import { buildAccountAccessGate } from '../services/accessControl.js';
import { canInviteUser } from '../services/subscriptions.js';

function membrosPadrao() {
  return [
    { id: 'dono-1', owner_user_id: 'dono-1', nome: 'Dono', perfil: 'admin', status: 'ativo' },
    { id: 'ger-1', owner_user_id: 'dono-1', nome: 'Gerente', perfil: 'gerente', status: 'ativo' },
    { id: 'op-1', owner_user_id: 'dono-1', nome: 'Operador', perfil: 'operador', status: 'ativo' },
    { id: 'vis-1', owner_user_id: 'dono-1', nome: 'Visualizador', perfil: 'visualizador', status: 'ativo' },
  ];
}

// ─── 1/2/3/4: quem pode gerenciar a equipe ─────────────────────────────────

test('admin/proprietario pode gerenciar equipe', () => {
  assert.equal(perfilPodeGerenciarAcessos('admin'), true);
  assert.equal(perfilPodeGerenciarAcessos('proprietario'), true);
});

test('gerente não pode gerenciar equipe (Sprint 6 restringiu essa permissão)', () => {
  assert.equal(perfilPodeGerenciarAcessos('gerente'), false);
});

test('operador não pode gerenciar equipe', () => {
  assert.equal(perfilPodeGerenciarAcessos('operador'), false);
});

test('visualizador não pode gerenciar equipe', () => {
  assert.equal(perfilPodeGerenciarAcessos('visualizador'), false);
});

// ─── 5: subusuário herda status comercial do proprietário ──────────────────

test('subusuário herda o status comercial do proprietário independente do próprio papel', () => {
  const contaAtiva = { status: 'active', plan_code: 'pro', owner_user_id: 'dono-1' };
  const contaBloqueada = { status: 'blocked', plan_code: 'pro', owner_user_id: 'dono-1' };

  // A avaliação de acesso é feita sobre a MESMA assinatura da conta, não
  // sobre um registro por usuário — por isso o resultado é idêntico
  // independente de qual papel está perguntando.
  assert.equal(buildAccountAccessGate(contaAtiva, { now: Date.now() }).allowed, true);
  assert.equal(buildAccountAccessGate(contaBloqueada, { now: Date.now() }).allowed, false);
});

// ─── 6: visualizador não escreve mesmo com plano ativo ─────────────────────

test('visualizador não tem nenhuma permissão de escrita, mesmo com assinatura ativa', () => {
  const gate = buildAccountAccessGate({ status: 'active', plan_code: 'premium' }, { now: Date.now() });
  assert.equal(gate.allowed, true);
  // A conta (herdada do proprietário) pode escrever, mas o papel
  // visualizador não tem nenhuma permissão ':editar'/':excluir'/':movimentar'
  // na matriz (perfis.js) — a escrita é sempre negada para esse papel,
  // independente do status comercial da assinatura.
  assert.equal(perfilTemPermissao('visualizador', 'lotes:editar'), false);
  assert.equal(perfilTemPermissao('visualizador', 'pesagens:editar'), false);
  assert.equal(perfilTemPermissao('visualizador', 'estoque:movimentar'), false);
  assert.equal(perfilTemPermissao('visualizador', 'financeiro:excluir'), false);
  assert.equal(perfilTemPermissao('visualizador', 'lotes:ver'), true);

  // E também não gerencia equipe, mesmo com a conta liberada para escrita:
  const resposta = podeAlterarPapel({ atorPerfil: 'visualizador', membros: membrosPadrao(), membroId: 'op-1', novoPerfil: 'gerente', atorId: 'vis-1' });
  assert.equal(resposta.permitido, false);
});

// ─── 7: não permitir remover o único proprietário ──────────────────────────

test('não permite remover o único proprietário da conta', () => {
  const membros = membrosPadrao();
  // Caso real: o próprio dono tentando se remover — bloqueado por ser o
  // próprio ator E por ser o único proprietário.
  const resposta = podeRemoverAcesso({ atorPerfil: 'admin', membros, membroId: 'dono-1', atorId: 'dono-1' });
  assert.equal(resposta.permitido, false);

  // Defesa em profundidade: mesmo que o ator não seja o próprio alvo, a
  // proteção de "único proprietário" continua valendo por conta própria.
  const respostaAtorDiferente = podeRemoverAcesso({ atorPerfil: 'admin', membros, membroId: 'dono-1', atorId: 'alguem-fora-da-lista' });
  assert.equal(respostaAtorDiferente.permitido, false);
  assert.match(respostaAtorDiferente.motivo, /único proprietário/i);
});

test('permite remover um segundo administrador quando não é o único', () => {
  const membros = [...membrosPadrao(), { id: 'admin-2', owner_user_id: 'dono-1', nome: 'Admin 2', perfil: 'admin', status: 'ativo' }];
  const resposta = podeRemoverAcesso({ atorPerfil: 'admin', membros, membroId: 'admin-2', atorId: 'dono-1' });
  assert.equal(resposta.permitido, true);
});

// ─── 8: não permitir alterar o próprio perfil se isso deixar a conta sem admin ──

test('não permite o único proprietário rebaixar o próprio papel', () => {
  const membros = membrosPadrao();
  const resposta = podeAlterarPapel({ atorPerfil: 'admin', membros, membroId: 'dono-1', novoPerfil: 'gerente', atorId: 'dono-1' });
  assert.equal(resposta.permitido, false);
  assert.match(resposta.motivo, /único proprietário/i);
});

test('permite rebaixar um administrador quando há outro admin ativo', () => {
  const membros = [...membrosPadrao(), { id: 'admin-2', owner_user_id: 'dono-1', nome: 'Admin 2', perfil: 'admin', status: 'ativo' }];
  const resposta = podeAlterarPapel({ atorPerfil: 'admin', membros, membroId: 'dono-1', novoPerfil: 'gerente', atorId: 'admin-2' });
  assert.equal(resposta.permitido, true);
});

test('quem não gerencia acessos nunca pode alterar papel de ninguém', () => {
  const membros = membrosPadrao();
  const resposta = podeAlterarPapel({ atorPerfil: 'gerente', membros, membroId: 'op-1', novoPerfil: 'visualizador', atorId: 'ger-1' });
  assert.equal(resposta.permitido, false);
  assert.match(resposta.motivo, /permissão/i);
});

// ─── contarAdministradoresAtivos / ehUnicoProprietario ─────────────────────

test('contarAdministradoresAtivos ignora administradores removidos', () => {
  const membros = [
    { id: 'a', perfil: 'admin', status: 'ativo' },
    { id: 'b', perfil: 'admin', status: 'removido' },
  ];
  assert.equal(contarAdministradoresAtivos(membros), 1);
  assert.equal(ehUnicoProprietario(membros, 'a'), true);
});

test('ehUnicoProprietario é falso para quem não é administrador', () => {
  assert.equal(ehUnicoProprietario(membrosPadrao(), 'op-1'), false);
});

// ─── resumo de permissões por papel (Parte 4) ──────────────────────────────

test('resumo de permissões usa exatamente o texto pedido para gerente/operador/visualizador', () => {
  assert.equal(obterResumoPermissoesPerfil('gerente'), 'Gerencia a operação, mas não altera assinatura nem a equipe.');
  assert.equal(obterResumoPermissoesPerfil('operador'), 'Registra atividades de campo, mas não altera configurações.');
  assert.equal(obterResumoPermissoesPerfil('visualizador'), 'Consulta informações, mas não edita dados.');
});

// ─── separarProprietarioEMembros ────────────────────────────────────────────

test('separarProprietarioEMembros identifica a raiz da conta e o resto da equipe', () => {
  const { proprietario, membros } = separarProprietarioEMembros(membrosPadrao());
  assert.equal(proprietario?.id, 'dono-1');
  assert.equal(membros.length, 3);
  assert.ok(!membros.some((m) => m.id === 'dono-1'));
});

test('separarProprietarioEMembros não quebra com lista vazia', () => {
  const { proprietario, membros } = separarProprietarioEMembros([]);
  assert.equal(proprietario, null);
  assert.deepEqual(membros, []);
});

// ─── contarUsuariosDoPlano (Sprint 7) — única fonte de "quantos assentos a conta usa" ──

test('contarUsuariosDoPlano soma proprietário + membros ativos + convites pendentes', () => {
  const total = contarUsuariosDoPlano({
    profiles: [
      { id: 'dono-1', owner_user_id: 'dono-1', status: 'ativo' },
      { id: 'ger-1', owner_user_id: 'dono-1', status: 'ativo' },
      { id: 'op-1', owner_user_id: 'dono-1', status: 'removido' },
    ],
    invites: [
      { id: 'inv-1', status: 'pendente' },
      { id: 'inv-2', status: 'cancelado' },
    ],
  });
  // proprietário + gerente ativo (operador removido não conta) + 1 convite pendente
  assert.equal(total, 3);
});

test('contarUsuariosDoPlano não quebra sem dado nenhum', () => {
  assert.equal(contarUsuariosDoPlano({}), 0);
  assert.equal(contarUsuariosDoPlano(), 0);
});

test('bloqueia convite acima do limite de usuários usando a contagem real da equipe', () => {
  const contaNoLimite = { status: 'active', plan_code: 'essencial' }; // limite: 2 usuários
  const totalUsado = contarUsuariosDoPlano({
    profiles: [
      { id: 'dono-1', owner_user_id: 'dono-1', status: 'ativo' },
      { id: 'vis-1', owner_user_id: 'dono-1', status: 'ativo' },
    ],
    invites: [],
  });
  assert.equal(canInviteUser(contaNoLimite, totalUsado).allowed, false);

  const contaComVaga = { status: 'active', plan_code: 'pro' }; // limite: 5 usuários
  assert.equal(canInviteUser(contaComVaga, totalUsado).allowed, true);
});
