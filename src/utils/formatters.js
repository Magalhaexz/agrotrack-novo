export const parseNumeroEntrada = (valor) => {
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : NaN;
  }

  if (valor == null) {
    return NaN;
  }

  const texto = String(valor).trim();
  if (!texto) {
    return NaN;
  }

  const semEspacos = texto.replace(/\s+/g, '');
  const ultimaVirgula = semEspacos.lastIndexOf(',');
  const ultimoPonto = semEspacos.lastIndexOf('.');

  let normalizado = semEspacos;

  if (ultimaVirgula > -1 && ultimoPonto > -1) {
    normalizado = ultimaVirgula > ultimoPonto
      ? semEspacos.replace(/\./g, '').replace(',', '.')
      : semEspacos.replace(/,/g, '');
  } else if (ultimaVirgula > -1) {
    normalizado = semEspacos.replace(',', '.');
  }

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : NaN;
};

export const formatarMoeda = (valor) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

export const formatarNumero = (valor, casas = 2) => {
  const numero = parseNumeroEntrada(valor);
  return (Number.isFinite(numero) ? numero : 0).toFixed(casas);
};

export const formatarData = (data) => {
  if (!data) return '-';
  return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR');
};

export const formatarArroba = (valor) =>
  `${formatarNumero(valor)} @`;
