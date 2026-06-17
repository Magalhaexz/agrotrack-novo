import { daysBetween, toDateKey, toNumber } from '../domain/calcHelpers.js';
import { normalizarStatusMovimentacao, getDataVencimento } from '../domain/financeiroStatus.js';

const NIVEL_ORDEM = {
  critical: 0,
  warning: 1,
  info: 2,
};

const PESAGEM_WARN_DIAS = 30;
const PESAGEM_CRITICAL_DIAS = 45;
const LOTE_SAIDA_ALERT_DIAS = 7;
const FINANCEIRO_VENCIMENTO_WARN_DIAS = 3;

function parseISODate(valor) {
  const dateKey = toDateKey(valor);
  if (!dateKey) return zerarHora(new Date());
  const [ano, mes, dia] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(ano, (mes || 1) - 1, dia || 1));
}

function zerarHora(data) {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
}

function diferencaEmDias(dataA, dataB) {
  return daysBetween(
    zerarHora(dataB).toISOString().slice(0, 10),
    zerarHora(dataA).toISOString().slice(0, 10)
  );
}

function formatarDataISO(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
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
    const diaHoje = hoje.getDay();
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

  const hoje = zerarHora(new Date());
  const hojeStr = formatarDataISO(hoje);

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
      const dataValidade = parseISODate(item.data_validade);
      const diffDias = diferencaEmDias(dataValidade, hoje);
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
          data_sort: dataValidade.getTime(),
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
          data_sort: dataValidade.getTime(),
        });
      }
    }
  });

  // --- Alertas Sanitários ---
  sanitario.forEach((item) => {
    if (!item.proxima) return;

    const dataProxima = parseISODate(item.proxima);
    const diffDias = diferencaEmDias(dataProxima, hoje);
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
        data_sort: dataProxima.getTime(),
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
        data_sort: dataProxima.getTime(),
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

      const dataTarefa = parseISODate(item.data);

      if (dataTarefa.getTime() < hoje.getTime()) {
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
          data_sort: dataTarefa.getTime(),
        });
      } else if (dataTarefa.getTime() === hoje.getTime()) {
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
          data_sort: dataTarefa.getTime(),
        });
      }
      return;
    }

    if (!recorrenciaValeNaData(item, hoje)) return;

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
      data_sort: hoje.getTime(),
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

    const diasSemPesar = diferencaEmDias(hoje, parseISODate(ultima.data));

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
        data_sort: parseISODate(ultima.data).getTime(),
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
        data_sort: parseISODate(ultima.data).getTime(),
      });
    }
  });

  // --- Alertas de Saída de Lote ---
  lotes.filter((l) => l.status === 'ativo' && l.saida).forEach((l) => {
    const dataSaida = parseISODate(l.saida);
    const diasAteSaida = diferencaEmDias(dataSaida, hoje);

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
        data_sort: dataSaida.getTime(),
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
        data_sort: dataSaida.getTime(),
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

    const dataVencDate = parseISODate(dataVenc);
    const diasAteVenc = diferencaEmDias(dataVencDate, hoje);
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
        data_sort: dataVencDate.getTime(),
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
        data_sort: dataVencDate.getTime(),
      });
    }
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
