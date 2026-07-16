// Resumo consolidado de todas as fazendas da conta, via bot (Sprint Paridade
// 1, bloco 5). Puro, sem I/O. Reaproveita o mesmo recorte por fazenda
// (`filtrarDbPorFazenda`) e a mesma fonte de alertas (`gerarAlertasUnificados`
// + `aplicarTratativasAosAlertas`) que o resto do bot já usa — nunca mistura
// dados de uma fazenda com outra.
import { filtrarDbPorFazenda } from '../escopoFazenda.js';
import { getResumoLote } from '../resumoLote.js';
import { gerarAlertasUnificados } from '../alertasUnificados.js';
import { aplicarTratativasAosAlertas } from '../tratativasAlertas.js';

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function loteAtivo(lote) {
  return String(lote?.status || 'ativo').toLowerCase() !== 'encerrado';
}

function resumoDeUmaFazenda(dbConta, fazenda) {
  const db = filtrarDbPorFazenda(dbConta, fazenda.id);
  const lotesAtivos = (Array.isArray(db.lotes) ? db.lotes : []).filter(loteAtivo);
  const totalCabecas = lotesAtivos.reduce((s, l) => s + toNumber(l.qtd), 0);
  const resultado = lotesAtivos.reduce((s, l) => s + toNumber(getResumoLote(db, l.id)?.lucroTotal), 0);

  const movimentacoes = Array.isArray(db.movimentacoes_financeiras) ? db.movimentacoes_financeiras : [];
  const custos = movimentacoes.filter((m) => m.tipo === 'despesa').reduce((s, m) => s + toNumber(m.valor), 0);
  const receitas = movimentacoes.filter((m) => m.tipo === 'receita').reduce((s, m) => s + toNumber(m.valor), 0);

  const brutos = gerarAlertasUnificados(db);
  const alertasCriticos = aplicarTratativasAosAlertas(brutos, db.alertas_tratativas, new Date())
    .filter((a) => a.visivel && a.prioridade === 'critico').length;

  return {
    nome: fazenda.nome,
    totalLotes: lotesAtivos.length,
    totalCabecas,
    totalItensEstoque: Array.isArray(db.estoque) ? db.estoque.length : 0,
    custos,
    receitas,
    resultado,
    alertasCriticos,
  };
}

/** @param {object} dbConta — db da conta INTEIRA (não recortado — precisa ver todas as fazendas). */
export function construirResumoConsolidadoFazendas(dbConta) {
  const fazendas = Array.isArray(dbConta?.fazendas) ? dbConta.fazendas : [];
  return fazendas.map((f) => resumoDeUmaFazenda(dbConta, f));
}

function formatarMoeda(v) {
  return `R$ ${toNumber(v).toFixed(2).replace('.', ',')}`;
}

export function formatarResumoConsolidadoFazendas(dbConta) {
  const resumos = construirResumoConsolidadoFazendas(dbConta);
  if (resumos.length === 0) return 'Nenhuma fazenda cadastrada.';
  const linhas = ['📊 Resumo consolidado', ''];
  resumos.forEach((r) => {
    linhas.push(r.nome);
    linhas.push(`• Lotes: ${r.totalLotes}`);
    linhas.push(`• Cabeças: ${r.totalCabecas}`);
    linhas.push(`• Estoque: ${r.totalItensEstoque} item(ns)`);
    linhas.push(`• Custos: ${formatarMoeda(r.custos)}`);
    linhas.push(`• Receitas: ${formatarMoeda(r.receitas)}`);
    linhas.push(`• Resultado: ${formatarMoeda(r.resultado)}`);
    if (r.alertasCriticos > 0) linhas.push(`• 🔴 ${r.alertasCriticos} alerta(s) crítico(s)`);
    linhas.push('');
  });
  return linhas.join('\n').trim();
}
