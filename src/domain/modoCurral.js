function arr(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Resumo puro do que o Modo Curral precisa saber para decidir o que mostrar
 * (ações disponíveis vs. estado vazio orientado). Não recalcula nada que já
 * exista em outro domínio — só conta o que já está em `db`.
 */
export function construirResumoModoCurral(db = {}) {
  const fazendas = arr(db?.fazendas);
  const lotesAtivos = arr(db?.lotes).filter((lote) => String(lote?.status || 'ativo') === 'ativo');
  const pastagens = arr(db?.pastagens);

  return {
    temFazenda: fazendas.length > 0,
    temLoteAtivo: lotesAtivos.length > 0,
    temPasto: pastagens.length > 0,
    totalFazendas: fazendas.length,
    totalLotesAtivos: lotesAtivos.length,
    totalPastagens: pastagens.length,
  };
}

/**
 * Mensagem de estado vazio a mostrar no Modo Curral, em ordem de prioridade
 * (offline sem dados → sem fazenda → sem lote → nenhum, pasto é só um aviso
 * complementar). Retorna `null` quando há dados suficientes para usar as
 * ações normalmente.
 */
export function obterMensagemEstadoVazio(resumo, online = true) {
  if (!resumo?.temFazenda) {
    if (!online) {
      return 'Você está sem internet. Abra o HERDON online pelo menos uma vez para carregar seus dados antes de registrar no campo.';
    }
    return 'Cadastre sua fazenda antes de usar o Modo Curral.';
  }
  if (!resumo?.temLoteAtivo) {
    return 'Cadastre um lote para registrar pesagens e movimentações.';
  }
  return null;
}
