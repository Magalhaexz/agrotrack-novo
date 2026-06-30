// Avalia o desempenho de GMD (Ganho Médio Diário) de um lote comparando o
// GMD realizado com o GMD esperado/meta cadastrado. Usado para alertar o
// produtor quando o lote está rendendo abaixo do esperado.
//
// Regras:
// - Sem meta cadastrada ou sem pesagens suficientes (< 2) → status 'sem_dados'
//   (não exibe alerta, pois não há base de comparação confiável).
// - GMD realizado abaixo da meta → status 'abaixo' (alerta).
// - GMD realizado dentro/acima da meta → status 'ok'.

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function avaliarDesempenhoGmd({ gmdMeta, gmdReal, qtdPesagens } = {}) {
  const meta = toNumber(gmdMeta);
  const real = toNumber(gmdReal);
  const pesagens = toNumber(qtdPesagens);

  const semDados = meta <= 0 || pesagens < 2;
  if (semDados) {
    return {
      status: 'sem_dados',
      gmdMeta: meta,
      gmdReal: real,
      diferenca: 0,
      mensagem: 'Sem dados suficientes para avaliar o GMD.',
    };
  }

  const diferenca = Number((real - meta).toFixed(3));
  if (real < meta) {
    return {
      status: 'abaixo',
      gmdMeta: meta,
      gmdReal: real,
      diferenca,
      mensagem: 'Atenção: este lote está abaixo do GMD esperado.',
    };
  }

  return {
    status: 'ok',
    gmdMeta: meta,
    gmdReal: real,
    diferenca,
    mensagem: 'Lote dentro ou acima do GMD esperado.',
  };
}
