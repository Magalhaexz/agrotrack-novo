import { getPlanLimits, getModuleBlockedMessage, getSubscriptionLimitMessage } from '../services/subscriptions.js';

function arr(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Configuração completa de um plano (preço, limites, módulos). Wrapper fino
 * sobre getPlanLimits() de services/subscriptions.js — não duplica o
 * catálogo de planos, apenas expõe um nome de domínio mais claro.
 */
export function getPlanoConfig(plano) {
  return getPlanLimits(plano);
}

export function getLimitesPlano(plano) {
  return getPlanoConfig(plano)?.limits || null;
}

export function getModulosPlano(plano) {
  return getPlanoConfig(plano)?.modules || null;
}

/**
 * Compara o uso atual (fazendas/cabeças/usuários) com os limites do plano.
 * Não considera status da assinatura (ativa/vencida/cancelada) — essa é uma
 * checagem de regra de plano pura. Bloqueio por status de assinatura é
 * responsabilidade de evaluateLimit()/canAccessModule() em services/subscriptions.js.
 */
export function verificarLimiteUso(plano, usoAtual = {}) {
  const limites = getLimitesPlano(plano) || {};
  const chaves = ['farms', 'animals', 'users'];

  return chaves.reduce((resultado, chave) => {
    const limite = limites[chave];
    const atual = Number(usoAtual?.[chave] || 0);

    if (limite === null || limite === undefined) {
      resultado[chave] = { allowed: true, limit: null, current: atual, remaining: null };
      return resultado;
    }

    const limiteNumero = Number(limite);
    const allowed = atual < limiteNumero;
    resultado[chave] = {
      allowed,
      limit: limiteNumero,
      current: atual,
      remaining: Math.max(limiteNumero - atual, 0),
    };
    return resultado;
  }, {});
}

/**
 * Plano não reconhecido (legado/sem cadastro) é permissivo por padrão —
 * não bloqueia contas de teste/beta sem um motivo explícito.
 */
export function verificarAcessoModulo(plano, modulo) {
  const config = getPlanoConfig(plano);
  if (!config) return true;
  if (config.modules?.includes('*') || config.customLimits) return true;
  if (!modulo) return true;
  return Array.isArray(config.modules) ? config.modules.includes(modulo) : true;
}

/**
 * Resumo de uso da conta: fazendas, cabeças ativas e usuários, comparados
 * aos limites do plano da assinatura informada. `assinatura` pode ser nula
 * (conta sem assinatura) — nesse caso os limites não são aplicados.
 *
 * `opcoes.usuariosAtivos`, se informado, substitui a contagem de usuários
 * baseada em `db.usuarios` — tabela legada, usada apenas no fallback local
 * de antes da Sprint 6. Desde que a Equipe passou a usar `profiles`/`invites`
 * (tabelas fora do `db` operacional), quem chama esta função com a conta real
 * do App deve passar a contagem de `domain/equipe.js` (`contarUsuariosDoPlano`)
 * aqui — sem isso, o número mostrado ficaria preso ao dado antigo.
 */
export function obterResumoUso(db = {}, assinatura = null, opcoes = {}) {
  const fazendas = arr(db?.fazendas).length;
  const cabecas = arr(db?.animais).reduce((acc, animal) => acc + Number(animal?.qtd || 1), 0);
  const usuariosFallback = arr(db?.usuarios).filter((item) => String(item?.status || 'ativo') === 'ativo').length;
  const usuarios = Number.isFinite(opcoes?.usuariosAtivos) ? opcoes.usuariosAtivos : usuariosFallback;

  const planoCode = assinatura?.plan_code || assinatura?.planCode || null;
  const config = getPlanoConfig(planoCode);
  const uso = { farms: fazendas, animals: cabecas, users: usuarios };

  return {
    planoCode,
    planoNome: config?.planName || null,
    status: assinatura?.status || 'none',
    uso,
    limites: verificarLimiteUso(planoCode, uso),
    modulos: config?.modules || null,
  };
}

// Recursos mostrados na tela de assinatura (Sprint 7, Parte 3/9). `modulo`
// aponta para a MESMA lista de módulos do catálogo (MODULES_BASIC/PRO/PREMIUM
// em services/subscriptions.js) — não inventa uma segunda régua de acesso.
// Quando `modulo` é null, o recurso não tem restrição de plano hoje (Backup/
// exportação é bloqueado só pelo paywall de escrita — ver writeGuard.js — e
// o Assistente HERDON funciona propositalmente até sem plano, Sprint 5); a
// tela mostra isso como "disponível para todos" em vez de inventar um bloqueio
// que não existe de fato.
const RECURSOS_PLANO = [
  { chave: 'cenarios', label: 'Cenários', modulo: 'cenarios' },
  { chave: 'relatorios_avancados', label: 'Relatórios avançados', modulo: 'relatoriosGerenciais' },
  { chave: 'backup', label: 'Backup/exportação', modulo: null },
  { chave: 'equipe', label: 'Equipe', modulo: 'equipeAcessos' },
  { chave: 'assistente', label: 'Assistente HERDON', modulo: null },
  { chave: 'decisoes', label: 'Decisões da Fazenda', modulo: 'decisoesFazenda' },
];

/** Lista os recursos da tela de assinatura com liberado/bloqueado no plano informado. */
export function listarRecursosPlano(planoCode) {
  return RECURSOS_PLANO.map((recurso) => ({
    chave: recurso.chave,
    label: recurso.label,
    liberado: recurso.modulo ? verificarAcessoModulo(planoCode, recurso.modulo) : true,
    semRestricaoDePlano: !recurso.modulo,
  }));
}

// Escada de upgrade "normal" (Fundador é oferta de lançamento à parte, não faz
// parte do caminho de upgrade recomendado; Enterprise é sempre o teto/"fale
// conosco" para quem já esgotou os planos fixos).
const ORDEM_PLANOS_UPGRADE = ['essencial', 'pro', 'premium', 'enterprise'];

/**
 * Primeiro plano, a partir do atual, que resolve a restrição informada:
 * `chaveLimite` ('farms'/'animals'/'users') pede um limite maior que o do
 * plano atual; `modulo` pede que o plano inclua aquele módulo. Sem nenhum
 * dos dois, retorna o próximo plano da escada. Nunca inventa um plano novo —
 * só percorre `PLAN_CATALOG` (via getPlanoConfig) na ordem de upgrade.
 */
export function recomendarProximoPlano({ planoAtual = null, chaveLimite = null, modulo = null } = {}) {
  const atual = getPlanoConfig(planoAtual);
  const indiceAtual = ORDEM_PLANOS_UPGRADE.indexOf(normalizePlanoParaOrdem(planoAtual));
  const inicio = indiceAtual === -1 ? 0 : indiceAtual + 1;

  for (let i = inicio; i < ORDEM_PLANOS_UPGRADE.length; i += 1) {
    const candidato = getPlanoConfig(ORDEM_PLANOS_UPGRADE[i]);
    if (!candidato) continue;

    if (chaveLimite) {
      const limiteAtual = atual?.limits?.[chaveLimite];
      const limiteCandidato = candidato.limits?.[chaveLimite];
      const resolveLimite = limiteCandidato === null || limiteCandidato === undefined
        || limiteAtual === null || limiteAtual === undefined
        || Number(limiteCandidato) > Number(limiteAtual);
      if (!resolveLimite) continue;
    }

    if (modulo && !verificarAcessoModulo(candidato.planCode, modulo)) continue;

    return candidato;
  }

  return getPlanoConfig('enterprise');
}

function normalizePlanoParaOrdem(planoCode) {
  return String(planoCode || '').trim().toLowerCase();
}

/**
 * Monta a mensagem + plano recomendado para uma tela de upgrade, a partir de
 * um bloqueio real já decidido em services/subscriptions.js (nunca recalcula
 * a decisão de bloqueio aqui — só traduz em "o que fazer a seguir").
 * `tipo`: 'limite' (usa getSubscriptionLimitMessage) ou 'modulo' (usa
 * getModuleBlockedMessage).
 */
export function getUpgradeReason({ planoAtual = null, tipo = 'limite', chaveLimite = null, modulo = null, avaliacao = null } = {}) {
  const recomendado = recomendarProximoPlano({ planoAtual, chaveLimite, modulo });
  const mensagem = tipo === 'modulo'
    ? getModuleBlockedMessage()
    : getSubscriptionLimitMessage(chaveLimite, avaliacao) || getModuleBlockedMessage();

  return {
    mensagem,
    planoAtualCodigo: getPlanoConfig(planoAtual)?.planCode || null,
    planoAtualNome: getPlanoConfig(planoAtual)?.planName || null,
    planoRecomendadoCodigo: recomendado?.planCode || null,
    planoRecomendadoNome: recomendado?.planName || null,
  };
}
