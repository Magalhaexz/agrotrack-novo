// Camada de insights da fazenda: traduz a lista de alertas do motor
// (`alertasInteligentes.js`) em um retrato geral — quantos alertas por
// severidade, uma classificação de "saúde da fazenda" e um resumo em texto
// simples. Serve de base para Assistente HERDON / Saúde do Lote / Relatórios,
// sem criar nenhuma tela nova.
import { gerarAlertasPriorizados, SEVERIDADE } from './alertasInteligentes.js';

export const SAUDE_FAZENDA = {
  CRITICA: 'critica',
  ATENCAO: 'atencao',
  BOA: 'boa',
  OTIMA: 'otima',
};

const LABEL_SAUDE = {
  [SAUDE_FAZENDA.CRITICA]: 'Crítica — existem pontos que exigem ação imediata.',
  [SAUDE_FAZENDA.ATENCAO]: 'Atenção — há pontos importantes para revisar.',
  [SAUDE_FAZENDA.BOA]: 'Boa — poucos pontos de atenção, sem urgência.',
  [SAUDE_FAZENDA.OTIMA]: 'Ótima — nenhum alerta pendente no momento.',
};

function contarPorSeveridade(alertas = []) {
  const contagem = {
    [SEVERIDADE.CRITICO]: 0,
    [SEVERIDADE.ALTO]: 0,
    [SEVERIDADE.MEDIO]: 0,
    [SEVERIDADE.BAIXO]: 0,
  };
  alertas.forEach((alerta) => {
    if (contagem[alerta?.severidade] !== undefined) {
      contagem[alerta.severidade] += 1;
    }
  });
  return contagem;
}

function classificarSaudeFazenda(porSeveridade) {
  if (porSeveridade[SEVERIDADE.CRITICO] > 0) return SAUDE_FAZENDA.CRITICA;
  if (porSeveridade[SEVERIDADE.ALTO] > 0) return SAUDE_FAZENDA.ATENCAO;
  if (porSeveridade[SEVERIDADE.MEDIO] > 0 || porSeveridade[SEVERIDADE.BAIXO] > 0) return SAUDE_FAZENDA.BOA;
  return SAUDE_FAZENDA.OTIMA;
}

function agruparPorTipo(alertas = []) {
  const grupos = new Map();
  alertas.forEach((alerta) => {
    const tipo = alerta?.tipo || 'outro';
    grupos.set(tipo, (grupos.get(tipo) || 0) + 1);
  });
  return Object.fromEntries(grupos);
}

/**
 * Constrói o retrato geral da fazenda a partir do motor de alertas.
 * `db` e `agora` são repassados diretamente para `gerarAlertasPriorizados`.
 */
export function construirInsightsFazenda(db = {}, agora = new Date()) {
  const alertas = gerarAlertasPriorizados(db, agora);
  const porSeveridade = contarPorSeveridade(alertas);
  const porTipo = agruparPorTipo(alertas);
  const saude = classificarSaudeFazenda(porSeveridade);

  return {
    totalAlertas: alertas.length,
    porSeveridade,
    porTipo,
    saude,
    saudeLabel: LABEL_SAUDE[saude],
    topAlertas: alertas.slice(0, 5),
    alertas,
  };
}

function pluralizar(quantidade, singular, plural) {
  return quantidade === 1 ? singular : plural;
}

/**
 * Resumo em texto simples (para chat/assistente ou card de dashboard),
 * a partir do retrato de `construirInsightsFazenda`.
 */
export function construirResumoTextoInsights(insights) {
  if (!insights || insights.totalAlertas === 0) {
    return ['Nenhum alerta pendente. A fazenda está em dia.'];
  }

  const { porSeveridade, totalAlertas } = insights;
  const partes = [];
  if (porSeveridade[SEVERIDADE.CRITICO] > 0) {
    partes.push(`${porSeveridade[SEVERIDADE.CRITICO]} ${pluralizar(porSeveridade[SEVERIDADE.CRITICO], 'crítico', 'críticos')}`);
  }
  if (porSeveridade[SEVERIDADE.ALTO] > 0) {
    partes.push(`${porSeveridade[SEVERIDADE.ALTO]} de alta prioridade`);
  }
  if (porSeveridade[SEVERIDADE.MEDIO] > 0) {
    partes.push(`${porSeveridade[SEVERIDADE.MEDIO]} de média prioridade`);
  }
  if (porSeveridade[SEVERIDADE.BAIXO] > 0) {
    partes.push(`${porSeveridade[SEVERIDADE.BAIXO]} de baixa prioridade`);
  }

  return [`${totalAlertas} ${pluralizar(totalAlertas, 'alerta encontrado', 'alertas encontrados')}: ${partes.join(', ')}.`];
}
