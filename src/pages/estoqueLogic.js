// itemEhNutricao (EstoquePage.jsx) extraída para ser testável (mesmo padrão
// de financeiroDreLogic.js/lotesLogic.js).
//
// Bug bash BB-02: um item cadastrado em Estoque geral com categoria
// explícita "Medicamento" e nome "Sal Mineral" sumia da aba padrão — o
// heurístico de nome (`nome.includes('sal')`) reclassificava como nutrição
// mesmo com categoria explícita dizendo o contrário. `metadata.modulo` é o
// sinal oficial (setado só pelo fluxo de Suplementação, ver
// SuplementacaoPage.jsx) e categoria explícita vinda do próprio formulário
// de "Novo item" (Medicamento/Vacina/Material/Produto veterinário/Insumo
// geral/Outro — nenhuma é nutrição) sempre vence. O heurístico por nome só
// roda quando não há categoria nenhuma (dado legado/importado).
export function itemEhNutricao(item) {
  if (String(item?.metadata?.modulo || '').toLowerCase() === 'nutricao') return true;

  const categoria = String(item?.categoria || item?.tipo || '').toLowerCase();
  if (categoria) {
    return (
      categoria.includes('suplement')
      || categoria.includes('dieta')
      || categoria.includes('aliment')
      || categoria.includes('proteinado')
      || categoria.includes('sal')
      || categoria.includes('núcleo')
      || categoria.includes('nucleo')
    );
  }

  const nome = String(item?.produto || '').toLowerCase();
  return (
    nome.includes('suplement')
    || nome.includes('dieta')
    || nome.includes('sal')
    || nome.includes('núcleo')
    || nome.includes('nucleo')
    || nome.includes('proteinado')
  );
}
