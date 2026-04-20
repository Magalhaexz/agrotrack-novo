export const formatarMoeda = (valor) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

export const formatarNumero = (valor, casas = 2) =>
  Number(valor || 0).toFixed(casas);

export const formatarData = (data) => {
  if (!data) return '-';
  return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR');
};

export const formatarArroba = (valor) =>
  `${formatarNumero(valor)} @`;
