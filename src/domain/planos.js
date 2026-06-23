import { getPlanLimits } from '../services/subscriptions.js';

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
 */
export function obterResumoUso(db = {}, assinatura = null) {
  const fazendas = arr(db?.fazendas).length;
  const cabecas = arr(db?.animais).reduce((acc, animal) => acc + Number(animal?.qtd || 1), 0);
  const usuarios = arr(db?.usuarios).filter((item) => String(item?.status || 'ativo') === 'ativo').length;

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
