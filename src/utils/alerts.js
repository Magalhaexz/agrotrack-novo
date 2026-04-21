const NIVEL_ORDEM = {
  critical: 0,
  warning: 1,
  info: 2,
};

/**
 * Converte um valor para número, tratando valores nulos/indefinidos como 0.
 * @param {*} value - O valor a ser convertido.
 * @returns {number} O valor numérico.
 */
function toNumber(value) {
  return Number(value || 0);
}

/**
 * Analisa uma string de data ISO (YYYY-MM-DD) e retorna um objeto Date.
 * Garante que o mês e o dia sejam válidos, caso contrário, usa 1.
 * @param {string} valor - A string de data ISO.
 * @returns {Date} O objeto Date correspondente.
 */
function parseISODate(valor) {
  if (!valor) return zerarHora(new Date());

  const [ano, mes, dia] = String(valor).split('-').map(Number);
  // Date constructor uses 0-indexed month, so subtract 1 from 'mes'
  return new Date(ano, (mes || 1) - 1, dia || 1);
}

/**
 * Zera as horas, minutos, segundos e milissegundos de um objeto Date.
 * @param {Date} data - O objeto Date a ser modificado.
 * @returns {Date} Um novo objeto Date com a hora zerada.
 */
function zerarHora(data) {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Calcula a diferença em dias entre duas datas.
 * @param {Date} dataA - A primeira data.
 * @param {Date} dataB - A segunda data.
 * @returns {number} A diferença em dias (dataA - dataB).
 */
function diferencaEmDias(dataA, dataB) {
  const msPorDia = 1000 * 60 * 60 * 24;
  // Zera a hora de ambas as datas para garantir que a diferença seja apenas em dias completos
  return Math.round((zerarHora(dataA).getTime() - zerarHora(dataB).getTime()) / msPorDia);
}

/**
 * Formata um objeto Date para uma string ISO (YYYY-MM-DD).
 * @param {Date} data - O objeto Date.
 * @returns {string} A data formatada.
 */
function formatarDataISO(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * Formata uma string de data ISO (YYYY-MM-DD) para o formato brasileiro (DD/MM/YYYY).
 * @param {string} valor - A string de data ISO.
 * @returns {string} A data formatada ou '—' se o valor for nulo/indefinido.
 */
function formatarDataBR(valor) {
  if (!valor) return '—';
  const [ano, mes, dia] = String(valor).split('-');
  return `${dia}/${mes}/${ano}`;
}

/**
 * Formata um número para exibição simples no formato brasileiro.
 * @param {number} valor - O número a ser formatado.
 * @returns {string} O número formatado.
 */
function formatarNumeroSimples(valor) {
  return toNumber(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Normaliza o tipo de manejo sanitário para um label mais amigável.
 * @param {string} tipo - O tipo de manejo sanitário.
 * @returns {string} O label normalizado.
 */
function normalizarTipoSanitario(tipo) {
  const mapa = {
    vacina: 'Vacina',
    vermifugo: 'Vermífugo',
    medicamento: 'Medicamento',
    exame: 'Exame',
    outro: 'Outro',
  };
  return mapa[tipo] || tipo || 'Manejo';
}

/**
 * Verifica se uma rotina recorrente é válida para uma determinada data.
 * @param {object} item - O objeto da rotina.
 * @param {Date} dataReferencia - A data de referência para verificação.
 * @returns {boolean} True se a recorrência é válida na data, false caso contrário.
 */
function recorrenciaValeNaData(item, dataReferencia) {
  if (!item.recorrente) return false;
  if (!item.data_inicio) return false;

  const inicio = zerarHora(parseISODate(item.data_inicio));
  const fim = item.data_fim ? zerarHora(parseISODate(item.data_fim)) : null;
  const hoje = zerarHora(dataReferencia);

  if (hoje.getTime() < inicio.getTime()) return false;
  if (fim && hoje.getTime() > fim.getTime()) return false;

  if (item.recorrencia_tipo === 'diaria') return true;

  if (item.recorrencia_tipo === 'semanal') {
    const diaHoje = hoje.getDay(); // 0 for Sunday, 1 for Monday, etc.
    return Array.isArray(item.dias_semana) && item.dias_semana.includes(diaHoje);
  }

  // Adicione outros tipos de recorrência aqui, se houver
  return false;
}

/**
 * Constrói uma lista de alertas com base nos dados do banco de dados.
 * Os alertas são categorizados por nível (critical, warning, info) e ordenados.
 * @param {object} db - O objeto do banco de dados contendo estoque, sanitário, rotinas, lotes e funcionários.
 * @returns {Array<object>} Uma lista de objetos de alerta.
 */
export function buildAlerts(db = {}) {
  // Garante que as propriedades do DB são arrays ou arrays vazios
  const estoque = Array.isArray(db.estoque) ? db.estoque : [];
  const sanitario = Array.isArray(db.sanitario) ? db.sanitario : [];
  const rotinas = Array.isArray(db.rotinas) ? db.rotinas : [];
  const lotes = Array.isArray(db.lotes) ? db.lotes : [];
  const funcionarios = Array.isArray(db.funcionarios) ? db.funcionarios : [];

  // Cria Maps para lookup eficiente de lotes e funcionários
  const lotesMap = new Map(lotes.map((item) => [toNumber(item.id), item]));
  const funcionariosMap = new Map(
    funcionarios.map((item) => [toNumber(item.id), item])
  );

  const hoje = zerarHora(new Date());
  const hojeStr = formatarDataISO(hoje);

  const alerts = [];

  // --- Alertas de Estoque ---
  estoque.forEach((item) => {
    const produto = item.produto || 'Produto sem nome';
    const unidade = item.unidade || 'un';
    const qtdAtual = toNumber(item.quantidade_atual);
    const qtdMinima = toNumber(item.quantidade_minima);

    // Estoque crítico (abaixo ou igual ao mínimo)
    if (qtdMinima > 0 && qtdAtual <= qtdMinima) {
      const chave = `estoque-critico-${item.id}-${qtdAtual}-${qtdMinima}`;
      alerts.push({
        id: chave,
        ackKey: chave,
        tipo: 'estoque',
        tipoLabel: 'Estoque',
        nivel: 'critical',
        titulo: 'Estoque crítico',
        mensagem: `${produto} está com ${formatarNumeroSimples(
          qtdAtual
        )} ${unidade}, no mínimo configurado de ${formatarNumeroSimples(
          qtdMinima
        )} ${unidade}.`,
        pagina: 'estoque',
        // Prioriza alertas críticos de estoque mais antigos ou com ID menor
        data_sort: Number.MIN_SAFE_INTEGER + toNumber(item.id),
      });
    }
    // Estoque baixo (entre o mínimo e 1.5x o mínimo)
    else if (qtdMinima > 0 && qtdAtual <= qtdMinima * 1.5) {
      const chave = `estoque-baixo-${item.id}-${qtdAtual}-${qtdMinima}`;
      alerts.push({
        id: chave,
        ackKey: chave,
        tipo: 'estoque',
        tipoLabel: 'Estoque',
        nivel: 'warning',
        titulo: 'Estoque baixo',
        mensagem: `${produto} está se aproximando do estoque mínimo.`,
        pagina: 'estoque',
        // Prioriza alertas de estoque baixo mais antigos ou com ID menor, mas depois dos críticos
        data_sort: Number.MIN_SAFE_INTEGER + 1000 + toNumber(item.id),
      });
    }

    // Validade de produtos
    if (item.data_validade) {
      const dataValidade = parseISODate(item.data_validade);
      const diffDias = diferencaEmDias(dataValidade, hoje);
      const alertaDiasAntes = toNumber(item.alerta_dias_antes);

      // Produto vencido
      if (diffDias < 0) {
        const chave = `estoque-vencido-${item.id}-${item.data_validade}`;
        alerts.push({
          id: chave,
          ackKey: chave,
          tipo: 'estoque',
          tipoLabel: 'Estoque',
          nivel: 'critical',
          titulo: 'Produto vencido no estoque',
          mensagem: `${produto} venceu em ${formatarDataBR(
            item.data_validade
          )}.`,
          pagina: 'estoque',
          data_sort: dataValidade.getTime(),
        });
      }
      // Validade próxima
      else if (diffDias <= alertaDiasAntes) {
        const chave = `estoque-validade-${item.id}-${item.data_validade}`;
        alerts.push({
          id: chave,
          ackKey: chave,
          tipo: 'estoque',
          tipoLabel: 'Estoque',
          nivel: 'warning',
          titulo: 'Validade próxima no estoque',
          mensagem: `${produto} vence em ${formatarDataBR(
            item.data_validade
          )}.`,
          pagina: 'estoque',
          data_sort: dataValidade.getTime(),
        });
      }
    }
  });

  // --- Alertas Sanitários ---
  sanitario.forEach((item) => {
    if (!item.proxima) return; // Requer data da próxima ocorrência

    const dataProxima = parseISODate(item.proxima);
    const diffDias = diferencaEmDias(dataProxima, hoje);
    const alertaDiasAntes = toNumber(item.alerta_dias_antes);
    const loteNome =
      lotesMap.get(toNumber(item.lote_id))?.nome || 'Lote sem identificação';
    const funcionarioNome =
      funcionariosMap.get(toNumber(item.funcionario_responsavel_id))?.nome ||
      'Sem responsável';
    const tipo = normalizarTipoSanitario(item.tipo);
    const descricao = item.desc || 'Manejo sem descrição';

    // Manejo sanitário vencido
    if (diffDias < 0) {
      const chave = `sanitario-vencido-${item.id}-${item.proxima}`;
      alerts.push({
        id: chave,
        ackKey: chave,
        tipo: 'sanitario',
        tipoLabel: 'Sanitário',
        nivel: 'critical',
        titulo: 'Manejo sanitário vencido',
        mensagem: `${tipo}: ${descricao} no ${loteNome} venceu em ${formatarDataBR(
          item.proxima
        )}. Responsável: ${funcionarioNome}.`,
        pagina: 'sanitario',
        data_sort: dataProxima.getTime(),
      });
    }
    // Manejo sanitário próximo
    else if (diffDias <= alertaDiasAntes) {
      const chave = `sanitario-proximo-${item.id}-${item.proxima}`;
      alerts.push({
        id: chave,
        ackKey: chave,
        tipo: 'sanitario',
        tipoLabel: 'Sanitário',
        nivel: 'warning',
        titulo: 'Manejo sanitário próximo',
        mensagem: `${tipo}: ${descricao} no ${loteNome} está previsto para ${formatarDataBR(
          item.proxima
        )}. Responsável: ${funcionarioNome}.`,
        pagina: 'sanitario',
        data_sort: dataProxima.getTime(),
      });
    }
  });

  // --- Alertas de Rotinas (Tarefas) ---
  rotinas.forEach((item) => {
    const funcionarioNome =
      funcionariosMap.get(toNumber(item.funcionario_id))?.nome ||
      'Sem responsável';
    const loteNome = item.lote_id
      ? lotesMap.get(toNumber(item.lote_id))?.nome || 'Lote sem identificação'
      : '';

    // Ignora rotinas de origem sanitária para evitar duplicidade com alertas sanitários
    if (!item.recorrente && item.origem_sistema === 'sanitario') {
      return;
    }

    // Rotinas não recorrentes
    if (!item.recorrente) {
      if (!item.data || item.status === 'concluido') return; // Requer data e não pode estar concluída

      const dataTarefa = parseISODate(item.data);

      // Tarefa atrasada
      if (dataTarefa.getTime() < hoje.getTime()) {
        const chave = `rotina-atrasada-${item.id}-${item.data}`;
        alerts.push({
          id: chave,
          ackKey: chave,
          tipo: 'rotina',
          tipoLabel: 'Rotina',
          nivel: 'critical',
          titulo: 'Tarefa atrasada',
          mensagem: `${item.tarefa} está atrasada desde ${formatarDataBR(
            item.data
          )}${loteNome ? ` • ${loteNome}` : ''} • ${funcionarioNome}.`,
          pagina: 'rotina',
          data_sort: dataTarefa.getTime(),
        });
      }
      // Tarefa para hoje
      else if (dataTarefa.getTime() === hoje.getTime()) {
        const chave = `rotina-hoje-${item.id}-${item.data}`;
        alerts.push({
          id: chave,
          ackKey: chave,
          tipo: 'rotina',
          tipoLabel: 'Rotina',
          nivel: 'warning',
          titulo: 'Tarefa pendente hoje',
          mensagem: `${item.tarefa} precisa ser executada hoje${
            loteNome ? ` • ${loteNome}` : ''
          } • ${funcionarioNome}.`,
          pagina: 'rotina',
          data_sort: dataTarefa.getTime(),
        });
      }
      return;
    }

    // Rotinas recorrentes
    if (!recorrenciaValeNaData(item, hoje)) return; // Verifica se a recorrência é válida para hoje

    const concluidas = Array.isArray(item.concluido_datas)
      ? item.concluido_datas
      : [];

    if (concluidas.includes(hojeStr)) return; // Já concluída para hoje

    const chave = `rotina-recorrente-${item.id}-${hojeStr}`;
    alerts.push({
      id: chave,
      ackKey: chave,
      tipo: 'rotina',
      tipoLabel: 'Rotina',
      nivel: 'warning',
      titulo: 'Rotina recorrente pendente hoje',
      mensagem: `${item.tarefa} está prevista para hoje${
        loteNome ? ` • ${loteNome}` : ''
      } • ${funcionarioNome}.`,
      pagina: 'rotina',
      data_sort: hoje.getTime(),
    });
  });

  // Ordena os alertas: primeiro por nível (critical, warning, info), depois por data_sort
  return alerts
    .sort((a, b) => {
      const nivelA = NIVEL_ORDEM[a.nivel] ?? 99; // Fallback para nível desconhecido
      const nivelB = NIVEL_ORDEM[b.nivel] ?? 99;

      if (nivelA !== nivelB) return nivelA - nivelB;

      // Ordenação secundária por data_sort, com fallback para o maior valor seguro
      return (
        (a.data_sort ?? Number.MAX_SAFE_INTEGER) -
        (b.data_sort ?? Number.MAX_SAFE_INTEGER)
      );
    })
    .map(({ data_sort, ...item }) => item); // Remove a propriedade data_sort antes de retornar
}
