// Regras puras de gestão de equipe (Sprint 6). Não faz I/O — só decide o que
// a UI deve permitir a partir da lista de membros já carregada (profiles) e
// de quem está agindo. Reaproveita `auth/perfis.js` para permissão/normalização
// de papel — não duplica nenhuma regra de perfil já existente.
import { normalizarPerfil, obterLabelPerfil, perfilEhAdministrador, perfilPodeGerenciarAcessos, PERFIS } from '../auth/perfis.js';

const MENSAGEM_SEM_PERMISSAO = 'Você não tem permissão para gerenciar a equipe.';

/** Membros com papel de proprietário/admin e status ativo (não removidos). */
export function contarAdministradoresAtivos(membros = []) {
  return (Array.isArray(membros) ? membros : [])
    .filter((m) => perfilEhAdministrador(m?.perfil) && String(m?.status || 'ativo').toLowerCase() !== 'removido')
    .length;
}

/** Verdadeiro se `membroId` é administrador e não há nenhum outro administrador ativo na conta. */
export function ehUnicoProprietario(membros = [], membroId) {
  const membro = (Array.isArray(membros) ? membros : []).find((m) => String(m?.id) === String(membroId));
  if (!membro || !perfilEhAdministrador(membro.perfil)) return false;
  if (String(membro?.status || 'ativo').toLowerCase() === 'removido') return false;
  return contarAdministradoresAtivos(membros) <= 1;
}

/**
 * Decide se `atorPerfil` pode alterar o papel de `membroId` para `novoPerfil`.
 * Regras (Sprint 6, Parte 6): só quem gerencia acessos altera papel; ninguém
 * altera o próprio papel se isso deixar a conta sem nenhum proprietário/admin;
 * a conta nunca pode ficar com zero administradores.
 */
export function podeAlterarPapel({ atorPerfil, membros = [], membroId, novoPerfil, atorId } = {}) {
  if (!perfilPodeGerenciarAcessos(atorPerfil)) {
    return { permitido: false, motivo: MENSAGEM_SEM_PERMISSAO };
  }

  const perfilNovoNormalizado = normalizarPerfil(novoPerfil);
  const ficariaSemAdmin = ehUnicoProprietario(membros, membroId) && perfilNovoNormalizado !== PERFIS.PROPRIETARIO;

  if (ficariaSemAdmin) {
    const isSelf = String(membroId) === String(atorId);
    return {
      permitido: false,
      motivo: isSelf
        ? 'Você é o único proprietário da conta — não é possível remover o próprio acesso de administrador.'
        : 'Esta conta ficaria sem nenhum proprietário/admin — mantenha ao menos um.',
    };
  }

  return { permitido: true, motivo: null };
}

/**
 * Decide se `atorPerfil` pode remover o acesso de `membroId` (Sprint 6,
 * Parte 7). Ninguém remove o próprio acesso; o único proprietário nunca pode
 * ser removido.
 */
export function podeRemoverAcesso({ atorPerfil, membros = [], membroId, atorId } = {}) {
  if (!perfilPodeGerenciarAcessos(atorPerfil)) {
    return { permitido: false, motivo: MENSAGEM_SEM_PERMISSAO };
  }
  if (String(membroId) === String(atorId)) {
    return { permitido: false, motivo: 'Você não pode remover o próprio acesso.' };
  }
  if (ehUnicoProprietario(membros, membroId)) {
    return { permitido: false, motivo: 'Não é possível remover o único proprietário da conta.' };
  }
  return { permitido: true, motivo: null };
}

// Frases curtas por papel — usadas no resumo de permissões da tela Equipe
// (Sprint 6, Parte 4). Texto de apresentação sobre a matriz que já existe em
// `permissoesPorPerfil`, não uma nova fonte de verdade sobre o que cada papel pode fazer.
const RESUMO_PERMISSOES_PERFIL = {
  [PERFIS.PROPRIETARIO]: 'Acessa tudo, gerencia a equipe e a assinatura, e pode criar, editar e excluir qualquer dado.',
  [PERFIS.GERENTE]: 'Gerencia a operação, mas não altera assinatura nem a equipe.',
  [PERFIS.OPERADOR]: 'Registra atividades de campo, mas não altera configurações.',
  [PERFIS.VISUALIZADOR]: 'Consulta informações, mas não edita dados.',
};

export function obterResumoPermissoesPerfil(perfil) {
  const normalizado = normalizarPerfil(perfil);
  return RESUMO_PERMISSOES_PERFIL[normalizado] || RESUMO_PERMISSOES_PERFIL[PERFIS.VISUALIZADOR];
}

export function listarResumosPermissoesPerfil() {
  return [PERFIS.PROPRIETARIO, PERFIS.GERENTE, PERFIS.OPERADOR, PERFIS.VISUALIZADOR].map((perfil) => ({
    perfil,
    label: obterLabelPerfil(perfil),
    resumo: RESUMO_PERMISSOES_PERFIL[perfil],
  }));
}

/**
 * Separa a lista de `profiles` da conta (já filtrada pelo RLS same_account)
 * em { proprietario, membros }. "Proprietário" aqui é a raiz da conta: o
 * profile cujo `id` é o próprio `owner_user_id` (mesma convenção usada em
 * `services/userAccess.js`/`resolveUserRoleFromAuthAndCache`).
 */
export function separarProprietarioEMembros(profiles = []) {
  const lista = Array.isArray(profiles) ? profiles : [];
  const proprietario = lista.find((p) => p?.id != null && String(p.id) === String(p.owner_user_id)) || null;
  const membros = lista.filter((p) => !proprietario || String(p.id) !== String(proprietario.id));
  return { proprietario, membros };
}
