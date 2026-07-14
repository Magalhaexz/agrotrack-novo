import { daysBetween, toDateKey, toNumber } from '../domain/calcHelpers.js';
import { hojeLocalISO } from '../domain/dataCivil.js';
import { normalizarStatusMovimentacao, getDataVencimento } from '../domain/financeiroStatus.js';
import { calcularOcupacaoPastos, listarLotesSemPasto } from '../domain/ocupacaoPastos.js';

const NIVEL_ORDEM = {
  critical: 0,
  warning: 1,
  info: 2,
};

const PESAGEM_WARN_DIAS = 30;
const PESAGEM_CRITICAL_DIAS = 45;
const LOTE_SAIDA_ALERT_DIAS = 7;
const FINANCEIRO_VENCIMENTO_WARN_DIAS = 3;

// Só para ordenação (data_sort) — um número consistente por data civil, não
// usado para diferença de dias (isso é sempre daysBetween/toDateKey, que já
// tratam corretamente o dia civil em America/Sao_Paulo).
function dataOrdenavel(valor) {
  const dateKey = toDateKey(valor);
  if (!dateKey) return 0;
  const [ano, mes, dia] = dateKey.split('-').map(Number);
  return Date.UTC(ano, (mes || 1) - 1, dia || 1);
}

function formatarDataBR(valor) {
  if (!valor) return '—';
  const [ano, mes, dia] = String(valor).split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarNumeroSimples(valor) {
  return toNumber(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatarMoedaSimples(valor) {
  return toNumber(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

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

function recorrenciaValeNaData(item, hojeStr) {
  if (!item.recorrente) return false;
  if (!item.data_inicio) return false;

  if (daysBetween(hojeStr, item.data_inicio) > 0) return false;
  if (item.data_fim && daysBetween(hojeStr, item.data_fim) < 0) return false;

  if (item.recorrencia_tipo === 'diaria') return true;

  if (item.recorrencia_tipo === 'semanal') {
    // T00:00:00 sem offset força horário local, evitando o shift de um dia
    // que "YYYY-MM-DD" puro sofre ao ser parseado como UTC pelo spec do JS.
    const diaHoje = new Date(`${hojeStr}T00:00:00`).getDay();
    return Array.isArray(item.dias_semana) && item.dias_semana.includes(diaHoje);
  }

  return false;
}

/**
 * Constrói lista unificada de alertas a partir dos dados do banco.
 * Cobre estoque, sanitário, rotinas, pesagem, saída de lote e financeiro.
 * @param {object} db - Objeto de dados operacionais
 * @returns {Array<object>} Lista de alertas ordenados por nível e data
 */
export function buildAlerts(db = {}) {
  const estoque = Array.isArray(db.estoque) ? db.estoque : [];
  const sanitario = Array.isArray(db.sanitario) ? db.sanitario : [];
  const rotinas = Array.isArray(db.rotinas) ? db.rotinas : [];
  const lotes = Array.isArray(db.lotes) ? db.lotes : [];
  const funcionarios = Array.isArray(db.funcionarios) ? db.funcionarios : [];
  const pesagens = Array.isArray(db.pesagens) ? db.pesagens : [];
  const movimentacoes = Array.isArray(db.movimentacoes_financeiras) ? db.movimentacoes_financeiras : [];

  const lotesMap = new Map(lotes.map((item) => [toNumber(item.id), item]));
  const funcionariosMap = new Map(funcionarios.map((item) => [toNumber(item.id), item]));

  const hojeStr = hojeLocalISO();

  const alerts = [];

  // --- Alertas de Estoque ---
  estoque.forEach((item) => {
    const produto = item.produto || 'Produto sem nome';
    const unidade = item.unidade || 'un';
    const qtdAtual = toNumber(item.quantidade_atual);
    const qtdMinima = toNumber(item.quantidade_minima);

    if (qtdMinima > 0 && qtdAtual <= qtdMinima) {
      const chave = `estoque-critico-${item.id}-${qtdAtual}-${qtdMinima}`;
      alerts.push({
        id: chave,
        ackKey: chave,
        tipo: 'estoque',
        tipoLabel: 'Estoque',
        nivel: 'critical',
        titulo: 'Estoque crítico',
        mensagem: `${produto} está com ${formatarNumeroSimples(qtdAtual)} ${unidade}, abaixo do mínimo de ${formatarNumeroSimples(qtdMinima)} ${unidade}.`,
        pagina: 'estoque',
        data_sort: Number.MIN_SAFE_INTEGER + toNumber(item.id),
      });
    } else if (qtdMinima > 0 && qtdAtual <= qtdMinima * 1.5) {
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
        data_sort: Number.MIN_SAFE_INTEGER + 1000 + toNumber(item.id),
      });
    }

    if (item.data_validade) {
      const diffDias = daysBetween(hojeStr, item.data_validade);
      const alertaDiasAntes = toNumber(item.alerta_dias_antes);

      if (diffDias < 0) {
        const chave = `estoque-vencido-${item.id}-${item.data_validade}`;
        alerts.push({
          id: chave,
          ackKey: chave,
          tipo: 'estoque',
          tipoLabel: 'Estoque',
          nivel: 'critical',
          titulo: 'Produto vencido no estoque',
          mensagem: `${produto} venceu em ${formatarDataBR(item.data_validade)}.`,
          pagina: 'estoque',
          data_sort: dataOrdenavel(item.data_validade),
        });
      } else if (diffDias <= alertaDiasAntes) {
        const chave = `estoque-validade-${item.id}-${item.data_validade}`;
        alerts.push({
          id: chave,
          ackKey: chave,
          tipo: 'estoque',
          tipoLabel: 'Estoque',
          nivel: 'warning',
          titulo: 'Validade próxima no estoque',
          mensagem: `${produto} vence em ${formatarDataBR(item.data_validade)}.`,
          pagina: 'estoque',
          data_sort: dataOrdenavel(item.data_validade),
        });
      }
    }
  });

  // --- Alertas Sanitários ---
  sanitario.forEach((item) => {
    if (!item.proxima) return;

    const diffDias = daysBetween(hojeStr, item.proxima);
    const alertaDiasAntes = toNumber(item.alerta_dias_antes);
    const loteNome = lotesMap.get(toNumber(item.lote_id))?.nome || 'Lote sem identificação';
    const funcionarioNome = funcionariosMap.get(toNumber(item.funcionario_responsavel_id))?.nome || 'Sem responsável';
    const tipo = normalizarTipoSanitario(item.tipo);
    const descricao = item.desc || 'Manejo sem descrição';

    if (diffDias < 0) {
      const chave = `sanitario-vencido-${item.id}-${item.proxima}`;
      alerts.push({
        id: chave,
        ackKey: chave,
        tipo: 'sanitario',
        tipoLabel: 'Sanitário',
        nivel: 'critical',
        titulo: 'Manejo sanitário vencido',
        mensagem: `${tipo}: ${descricao} no ${loteNome} venceu em ${formatarDataBR(item.proxima)}. Responsável: ${funcionarioNome}.`,
        pagina: 'sanitario',
        data_sort: dataOrdenavel(item.proxima),
      });
    } else if (diffDias <= alertaDiasAntes) {
      const chave = `sanitario-proximo-${item.id}-${item.proxima}`;
      alerts.push({
        id: chave,
        ackKey: chave,
        tipo: 'sanitario',
        tipoLabel: 'Sanitário',
        nivel: 'warning',
        titulo: 'Manejo sanitário próximo',
        mensagem: `${tipo}: ${descricao} no ${loteNome} está previsto para ${formatarDataBR(item.proxima)}. Responsável: ${funcionarioNome}.`,
        pagina: 'sanitario',
        data_sort: dataOrdenavel(item.proxima),
      });
    }
  });

  // --- Alertas de Rotinas (Tarefas) ---
  rotinas.forEach((item) => {
    const funcionarioNome = funcionariosMap.get(toNumber(item.funcionario_id))?.nome || 'Sem responsável';
    const loteNome = item.lote_id
      ? lotesMap.get(toNumber(item.lote_id))?.nome || 'Lote sem identificação'
      : '';

    if (!item.recorrente && item.origem_sistema === 'sanitario') return;

    if (!item.recorrente) {
      if (!item.data || item.status === 'concluido') return;

      const diffDias = daysBetween(hojeStr, item.data);

      if (diffDias < 0) {
        const chave = `rotina-atrasada-${item.id}-${item.data}`;
        alerts.push({
          id: chave,
          ackKey: chave,
          tipo: 'rotina',
          tipoLabel: 'Rotina',
          nivel: 'critical',
          titulo: 'Tarefa atrasada',
          mensagem: `${item.tarefa} está atrasada desde ${formatarDataBR(item.data)}${loteNome ? ` • ${loteNome}` : ''} • ${funcionarioNome}.`,
          pagina: 'rotina',
          data_sort: dataOrdenavel(item.data),
        });
      } else if (diffDias === 0) {
        const chave = `rotina-hoje-${item.id}-${item.data}`;
        alerts.push({
          id: chave,
          ackKey: chave,
          tipo: 'rotina',
          tipoLabel: 'Rotina',
          nivel: 'warning',
          titulo: 'Tarefa pendente hoje',
          mensagem: `${item.tarefa} precisa ser executada hoje${loteNome ? ` • ${loteNome}` : ''} • ${funcionarioNome}.`,
          pagina: 'rotina',
          data_sort: dataOrdenavel(item.data),
        });
      }
      return;
    }

    if (!recorrenciaValeNaData(item, hojeStr)) return;

    const concluidas = Array.isArray(item.concluido_datas) ? item.concluido_datas : [];
    if (concluidas.includes(hojeStr)) return;

    const chave = `rotina-recorrente-${item.id}-${hojeStr}`;
    alerts.push({
      id: chave,
      ackKey: chave,
      tipo: 'rotina',
      tipoLabel: 'Rotina',
      nivel: 'warning',
      titulo: 'Rotina recorrente pendente hoje',
      mensagem: `${item.tarefa} está prevista para hoje${loteNome ? ` • ${loteNome}` : ''} • ${funcionarioNome}.`,
      pagina: 'rotina',
      data_sort: dataOrdenavel(hojeStr),
    });
  });

  // --- Alertas de Pesagem ---
  const latestPesagemByLote = new Map();
  pesagens.forEach((p) => {
    if (!p?.lote_id) return;
    const loteId = toNumber(p.lote_id);
    const existing = latestPesagemByLote.get(loteId);
    const dataP = toDateKey(p.data) || '';
    const dataExisting = existing ? (toDateKey(existing.data) || '') : '';
    if (!existing || dataP > dataExisting) {
      latestPesagemByLote.set(loteId, p);
    }
  });

  lotes.filter((l) => l.status === 'ativo').forEach((l) => {
    const loteId = toNumber(l.id);
    const ultima = latestPesagemByLote.get(loteId);

    if (!ultima) {
      const chave = `pesagem-ausente-${l.id}`;
      alerts.push({
        id: chave,
        ackKey: chave,
        tipo: 'pesagem',
        tipoLabel: 'Pesagem',
        nivel: 'critical',
        titulo: 'Lote sem pesagem',
        mensagem: `${l.nome} não possui nenhuma pesagem registrada.`,
        pagina: 'pesagens',
        data_sort: Number.MIN_SAFE_INTEGER + loteId,
      });
      return;
    }

    const diasSemPesar = daysBetween(ultima.data, hojeStr);

    if (diasSemPesar >= PESAGEM_CRITICAL_DIAS) {
      const chave = `pesagem-atrasada-${l.id}`;
      alerts.push({
        id: chave,
        ackKey: chave,
        tipo: 'pesagem',
        tipoLabel: 'Pesagem',
        nivel: 'critical',
        titulo: 'Pesagem muito atrasada',
        mensagem: `${l.nome} não é pesado há ${diasSemPesar} dias (última: ${formatarDataBR(ultima.data)}).`,
        pagina: 'pesagens',
        data_sort: dataOrdenavel(ultima.data),
      });
    } else if (diasSemPesar >= PESAGEM_WARN_DIAS) {
      const chave = `pesagem-pendente-${l.id}`;
      alerts.push({
        id: chave,
        ackKey: chave,
        tipo: 'pesagem',
        tipoLabel: 'Pesagem',
        nivel: 'warning',
        titulo: 'Pesagem pendente',
        mensagem: `${l.nome} não é pesado há ${diasSemPesar} dias (última: ${formatarDataBR(ultima.data)}).`,
        pagina: 'pesagens',
        data_sort: dataOrdenavel(ultima.data),
      });
    }
  });

  // --- Alertas de Saída de Lote ---
  lotes.filter((l) => l.status === 'ativo' && l.saida).forEach((l) => {
    const diasAteSaida = daysBetween(hojeStr, l.saida);

    if (diasAteSaida < 0) {
      const chave = `lote-saida-vencida-${l.id}`;
      alerts.push({
        id: chave,
        ackKey: chave,
        tipo: 'lote',
        tipoLabel: 'Lote',
        nivel: 'critical',
        titulo: 'Saída de lote vencida',
        mensagem: `${l.nome} tinha saída prevista para ${formatarDataBR(l.saida)} e ainda está ativo.`,
        pagina: 'lotes',
        data_sort: dataOrdenavel(l.saida),
      });
    } else if (diasAteSaida <= LOTE_SAIDA_ALERT_DIAS) {
      const chave = `lote-saida-proxima-${l.id}`;
      alerts.push({
        id: chave,
        ackKey: chave,
        tipo: 'lote',
        tipoLabel: 'Lote',
        nivel: 'warning',
        titulo: 'Saída de lote próxima',
        mensagem: `${l.nome} tem saída prevista para ${formatarDataBR(l.saida)} (em ${diasAteSaida} dia${diasAteSaida !== 1 ? 's' : ''}).`,
        pagina: 'lotes',
        data_sort: dataOrdenavel(l.saida),
      });
    }
  });

  // --- Alertas Financeiros ---
  movimentacoes.forEach((mov) => {
    if (!mov) return;
    const status = normalizarStatusMovimentacao(mov);
    if (status === 'cancelado' || status === 'pago') return;
    if (mov.tipo !== 'despesa') return;

    const dataVenc = getDataVencimento(mov);
    if (!dataVenc) return;

    const diasAteVenc = daysBetween(hojeStr, dataVenc);
    const descricao = mov.descricao || mov.categoria || 'Despesa';
    const valor = mov.valor ? ` (${formatarMoedaSimples(mov.valor)})` : '';

    if (diasAteVenc < 0) {
      const chave = `financeiro-vencido-${mov.id}`;
      alerts.push({
        id: chave,
        ackKey: chave,
        tipo: 'financeiro',
        tipoLabel: 'Financeiro',
        nivel: 'critical',
        titulo: 'Pagamento vencido',
        mensagem: `${descricao}${valor} venceu em ${formatarDataBR(dataVenc)}.`,
        pagina: 'financeiro',
        data_sort: dataOrdenavel(dataVenc),
      });
    } else if (diasAteVenc <= FINANCEIRO_VENCIMENTO_WARN_DIAS) {
      const chave = `financeiro-proximo-${mov.id}`;
      alerts.push({
        id: chave,
        ackKey: chave,
        tipo: 'financeiro',
        tipoLabel: 'Financeiro',
        nivel: 'warning',
        titulo: 'Pagamento próximo do vencimento',
        mensagem: `${descricao}${valor} vence em ${formatarDataBR(dataVenc)} (em ${diasAteVenc} dia${diasAteVenc !== 1 ? 's' : ''}).`,
        pagina: 'financeiro',
        data_sort: dataOrdenavel(dataVenc),
      });
    }
  });

  // --- Alertas de Ocupação de Pastos (Sprint 25) ---
  const ocupacaoPastos = calcularOcupacaoPastos(db);

  ocupacaoPastos.forEach((pasto) => {
    if (pasto.status === 'acima_capacidade') {
      const chave = `pasto-acima-capacidade-${pasto.id}`;
      alerts.push({
        id: chave,
        ackKey: chave,
        tipo: 'pasto',
        tipoLabel: 'Pasto',
        nivel: 'critical',
        titulo: 'Pasto acima da capacidade',
        mensagem: `${pasto.nome} está com lotação acima da capacidade informada (${formatarNumeroSimples(pasto.percentualOcupacao * 100)}% da capacidade estimada).`,
        pagina: 'pastagens',
        data_sort: Number.MIN_SAFE_INTEGER + toNumber(pasto.id),
      });
    } else if (pasto.status === 'atencao') {
      const chave = `pasto-atencao-${pasto.id}`;
      alerts.push({
        id: chave,
        ackKey: chave,
        tipo: 'pasto',
        tipoLabel: 'Pasto',
        nivel: 'warning',
        titulo: 'Pasto em atenção na lotação',
        mensagem: `${pasto.nome} está perto da capacidade informada (${formatarNumeroSimples(pasto.percentualOcupacao * 100)}% da capacidade estimada).`,
        pagina: 'pastagens',
        data_sort: Number.MIN_SAFE_INTEGER + 1000 + toNumber(pasto.id),
      });
    } else if (pasto.status === 'sem_dados') {
      const chave = `pasto-sem-dados-${pasto.id}`;
      alerts.push({
        id: chave,
        ackKey: chave,
        tipo: 'pasto',
        tipoLabel: 'Pasto',
        nivel: 'info',
        titulo: 'Pasto sem área ou capacidade informada',
        mensagem: `${pasto.nome} tem lote vinculado, mas falta área e/ou capacidade para acompanhar a lotação.`,
        pagina: 'pastagens',
        data_sort: Number.MAX_SAFE_INTEGER - toNumber(pasto.id),
      });
    }
  });

  listarLotesSemPasto(db).forEach((lote) => {
    const chave = `lote-sem-pasto-${lote.id}`;
    alerts.push({
      id: chave,
      ackKey: chave,
      tipo: 'pasto',
      tipoLabel: 'Pasto',
      nivel: 'warning',
      titulo: 'Lote sem pasto definido',
      mensagem: `${lote.nome || `Lote ${lote.id}`} está ativo, mas não tem pasto vinculado.`,
      pagina: 'lotes',
      data_sort: Number.MIN_SAFE_INTEGER + 2000 + toNumber(lote.id),
    });
  });

  return alerts
    .sort((a, b) => {
      const nivelA = NIVEL_ORDEM[a.nivel] ?? 99;
      const nivelB = NIVEL_ORDEM[b.nivel] ?? 99;
      if (nivelA !== nivelB) return nivelA - nivelB;
      return (a.data_sort ?? Number.MAX_SAFE_INTEGER) - (b.data_sort ?? Number.MAX_SAFE_INTEGER);
    })
    .map((item) => {
      const sanitized = { ...item };
      delete sanitized.data_sort;
      return sanitized;
    });
}
