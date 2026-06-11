import { computeIndicadoresEstrategicos } from './indicadoresEstrategicos.js';
import { toNonNegativeNumber, toNumber } from './calcHelpers.js';

function round2(value) {
  const safe = toNumber(value);
  return Math.round(safe * 100) / 100;
}

function getPesoMedioAtual(db) {
  const animais = Array.isArray(db?.animais) ? db.animais : [];
  const ativos = animais.filter((animal) => {
    const status = String(animal?.status || 'ativo').toLowerCase();
    return !['vendido', 'morte', 'descarte', 'transferencia', 'perda', 'inativo'].includes(status);
  });

  const totalCabecas = ativos.reduce((sum, animal) => sum + toNonNegativeNumber(animal?.qtd || 1), 0);
  if (!totalCabecas) return null;

  const pesoTotal = ativos.reduce((sum, animal) => {
    const qtd = toNonNegativeNumber(animal?.qtd || 1);
    const peso = toNonNegativeNumber(animal?.p_at || animal?.peso_vivo_kg || animal?.p_ini);
    return sum + (qtd * peso);
  }, 0);
  return totalCabecas > 0 ? (pesoTotal / totalCabecas) : null;
}

export function calcularProjecaoCenario(db, periodoInicio, periodoFim, scenario = {}) {
  const base = computeIndicadoresEstrategicos(db, periodoInicio, periodoFim);
  const estoqueAtual = toNumber(base?.evolucao?.resumo?.estoque_final);
  const receitaAtual = toNumber(base?.economicos?.receitaTotal);
  const custoAtual = toNumber(base?.economicos?.custosTotais);
  const uaAtual = toNumber(base?.unidadeAnimal?.uaTotalFazenda);
  const pesoMedioAtual = getPesoMedioAtual(db);

  const comprasSimuladas = toNonNegativeNumber(scenario?.compras_simuladas);
  const vendasSimuladas = toNonNegativeNumber(scenario?.vendas_simuladas);
  const mortalidadePct = toNonNegativeNumber(scenario?.mortalidade_pct);
  const natalidadePct = toNonNegativeNumber(scenario?.natalidade_pct);
  const valorMedioVenda = toNonNegativeNumber(scenario?.valor_medio_venda);
  const custoMedioCompra = toNonNegativeNumber(scenario?.custo_medio_compra);

  const mortesSimuladas = round2(estoqueAtual * (mortalidadePct / 100));
  const nascimentosSimulados = round2(estoqueAtual * (natalidadePct / 100));

  const estoqueFinalProjetado = round2(
    estoqueAtual
    + comprasSimuladas
    + nascimentosSimulados
    - vendasSimuladas
    - mortesSimuladas
  );
  const variacaoRebanho = round2(estoqueFinalProjetado - estoqueAtual);

  const valorVendasSimuladas = round2(vendasSimuladas * valorMedioVenda);
  const valorComprasSimuladas = round2(comprasSimuladas * custoMedioCompra);

  const receitaProjetada = round2(receitaAtual + valorVendasSimuladas);
  const custoProjetado = round2(custoAtual + valorComprasSimuladas);
  const margemBrutaProjetada = round2(receitaProjetada - custoProjetado);

  const capacidadeSuporteUa = toNonNegativeNumber(scenario?.capacidade_suporte_ua);
  const areaPastagemHa = toNonNegativeNumber(scenario?.area_pastagem_ha);
  const capacidadeTotalUa = capacidadeSuporteUa > 0
    ? capacidadeSuporteUa
    : round2(areaPastagemHa * toNumber(base?.pastagem?.capacidadeMediaUaHa));

  let uaProjetada = null;
  if (pesoMedioAtual && estoqueFinalProjetado >= 0) {
    uaProjetada = round2((estoqueFinalProjetado * pesoMedioAtual) / 450);
  } else if (uaAtual >= 0 && estoqueAtual > 0) {
    uaProjetada = round2((uaAtual / estoqueAtual) * estoqueFinalProjetado);
  }
  uaProjetada = Number.isFinite(toNumber(uaProjetada)) ? toNumber(uaProjetada) : null;

  const saldoUaProjetado = uaProjetada != null ? round2(capacidadeTotalUa - uaProjetada) : null;
  const statusCapacidade = saldoUaProjetado == null
    ? 'sem_dados'
    : (saldoUaProjetado >= 0 ? 'dentro_da_capacidade' : 'superlotado');

  return {
    baseline: {
      estoque_atual: estoqueAtual,
      receita_atual: receitaAtual,
      custo_atual: custoAtual,
      ua_atual: uaAtual,
      capacidade_total_ua: toNumber(base?.pastagem?.capacidadeTotalUa),
    },
    simulacao: {
      compras_simuladas: comprasSimuladas,
      vendas_simuladas: vendasSimuladas,
      mortes_simuladas: mortesSimuladas,
      nascimentos_simulados: nascimentosSimulados,
      valor_vendas_simuladas: valorVendasSimuladas,
      valor_compras_simuladas: valorComprasSimuladas,
    },
    projecao: {
      estoque_final_projetado: estoqueFinalProjetado,
      variacao_rebanho: variacaoRebanho,
      receita_projetada: receitaProjetada,
      custo_projetado: custoProjetado,
      margem_bruta_projetada: margemBrutaProjetada,
      ua_projetada: uaProjetada,
      capacidade_total_ua: capacidadeTotalUa,
      saldo_ua_projetado: saldoUaProjetado,
      status_capacidade: statusCapacidade,
    },
  };
}
