const NIVEL_ORDEM = {
  critical: 0,
  warning: 1,
  info: 2,
};

export function buildAlerts(db = {}) {
  const estoque = Array.isArray(db.estoque) ? db.estoque : [];
  const sanitario = Array.isArray(db.sanitario) ? db.sanitario : [];
  const rotinas = Array.isArray(db.rotinas) ? db.rotinas : [];
  const lotes = Array.isArray(db.lotes) ? db.lotes : [];
  const funcionarios = Array.isArray(db.funcionarios) ? db.funcionarios : [];

  const lotesMap = new Map(lotes.map((item) => [Number(item.id), item]));
  const funcionariosMap = new Map(
    funcionarios.map((item) => [Number(item.id), item])
  );

  const hoje = zerarHora(new Date());
  const hojeStr = formatarDataISO(hoje);

  const alerts = [];

  estoque.forEach((item) => {
    const produto = item.produto || 'Produto sem nome';
    const unidade = item.unidade || 'un';
    const qtdAtual = Number(item.quantidade_atual || 0);
    const qtdMinima = Number(item.quantidade_minima || 0);

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
        data_sort: Number.MIN_SAFE_INTEGER + Number(item.id || 0),
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
        data_sort: Number.MIN_SAFE_INTEGER + 1000 + Number(item.id || 0),
      });
    }

    if (item.data_validade) {
      const dataValidade = parseISODate(item.data_validade);
      const diffDias = diferencaEmDias(dataValidade, hoje);
      const alertaDiasAntes = Number(item.alerta_dias_antes || 0);

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
      } else if (diffDias <= alertaDiasAntes) {
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

  sanitario.forEach((item) => {
    if (!item.proxima) return;

    const dataProxima = parseISODate(item.proxima);
    const diffDias = diferencaEmDias(dataProxima, hoje);
    const alertaDiasAntes = Number(item.alerta_dias_antes || 0);
    const loteNome =
      lotesMap.get(Number(item.lote_id))?.nome || 'Lote sem identificação';
    const funcionarioNome =
      funcionariosMap.get(Number(item.funcionario_responsavel_id))?.nome ||
      'Sem responsável';
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
        mensagem: `${tipo}: ${descricao} no ${loteNome} venceu em ${formatarDataBR(
          item.proxima
        )}. Responsável: ${funcionarioNome}.`,
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
        mensagem: `${tipo}: ${descricao} no ${loteNome} está previsto para ${formatarDataBR(
          item.proxima
        )}. Responsável: ${funcionarioNome}.`,
        pagina: 'sanitario',
        data_sort: dataProxima.getTime(),
      });
    }
  });

  rotinas.forEach((item) => {
    const funcionarioNome =
      funcionariosMap.get(Number(item.funcionario_id))?.nome ||
      'Sem responsável';
    const loteNome = item.lote_id
      ? lotesMap.get(Number(item.lote_id))?.nome || 'Lote sem identificação'
      : '';

    if (!item.recorrente && item.origem_sistema === 'sanitario') {
      return;
    }

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
          mensagem: `${item.tarefa} está atrasada desde ${formatarDataBR(
            item.data
          )}${loteNome ? ` • ${loteNome}` : ''} • ${funcionarioNome}.`,
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
          mensagem: `${item.tarefa} precisa ser executada hoje${
            loteNome ? ` • ${loteNome}` : ''
          } • ${funcionarioNome}.`,
          pagina: 'rotina',
          data_sort: dataTarefa.getTime(),
        });
      }

      return;
    }

    if (!recorrenciaValeNaData(item, hoje)) return;

    const concluidas = Array.isArray(item.concluido_datas)
      ? item.concluido_datas
      : [];

    if (concluidas.includes(hojeStr)) return;

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

  return alerts
    .sort((a, b) => {
      const nivelA = NIVEL_ORDEM[a.nivel] ?? 99;
      const nivelB = NIVEL_ORDEM[b.nivel] ?? 99;

      if (nivelA !== nivelB) return nivelA - nivelB;

      return (
        (a.data_sort ?? Number.MAX_SAFE_INTEGER) -
        (b.data_sort ?? Number.MAX_SAFE_INTEGER)
      );
    })
    .map(({ data_sort, ...item }) => item);
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

function parseISODate(valor) {
  if (!valor) return zerarHora(new Date());

  const [ano, mes, dia] = String(valor).split('-').map(Number);
  return new Date(ano, (mes || 1) - 1, dia || 1);
}

function zerarHora(data) {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
}

function diferencaEmDias(dataA, dataB) {
  const msPorDia = 1000 * 60 * 60 * 24;
  return Math.round((zerarHora(dataA) - zerarHora(dataB)) / msPorDia);
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
  return Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
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