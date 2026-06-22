// Mesma lista de categorias de despesa usada em FinanceiroPage.jsx — mantida
// aqui também porque o formulário offline não importa páginas.
export const CATEGORIAS_DESPESA_OFFLINE = ['Compra Animal', 'Racao', 'Suplemento', 'Medicamento', 'Vacina', 'Frete', 'Funcionario', 'Arrendamento', 'Manutencao', 'Outro'];

export const TIPOS_OCORRENCIA = [
  { value: 'manejo', label: 'Manejo' },
  { value: 'sanidade', label: 'Sanidade' },
  { value: 'mortalidade', label: 'Mortalidade' },
  { value: 'observacao', label: 'Observação' },
  { value: 'outro', label: 'Outro' },
];

export function filterLotesAtivosPorFazenda(lotes = [], fazId = null) {
  if (!fazId) return [];
  return (Array.isArray(lotes) ? lotes : []).filter(
    (lote) => Number(lote?.faz_id) === Number(fazId) && String(lote?.status || 'ativo') === 'ativo'
  );
}

export function validarPesagemOfflineForm(form = {}) {
  if (!form.loteId) return 'Selecione o lote.';
  if (!form.data) return 'Informe a data da pesagem.';
  const peso = Number(form.pesoMedio);
  if (!Number.isFinite(peso) || peso <= 0) return 'Informe o peso médio.';
  if (form.quantidadeCabecas !== '' && form.quantidadeCabecas !== null && form.quantidadeCabecas !== undefined) {
    const quantidade = Number(form.quantidadeCabecas);
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      return 'A quantidade de cabeças deve ser maior que zero.';
    }
  }
  return null;
}

export function validarDespesaOfflineForm(form = {}) {
  if (!form.fazendaId) return 'Selecione a fazenda.';
  if (!form.data) return 'Informe a data da despesa.';
  if (!String(form.descricao || '').trim()) return 'Informe a descrição da despesa.';
  const valor = Number(form.valor);
  if (!Number.isFinite(valor) || valor <= 0) return 'Informe o valor da despesa.';
  return null;
}

export function validarOcorrenciaOfflineForm(form = {}) {
  if (!form.fazendaId) return 'Selecione a fazenda.';
  if (!form.data) return 'Informe a data da ocorrência.';
  if (!form.tipo) return 'Selecione o tipo de ocorrência.';
  if (!String(form.descricao || '').trim()) return 'Informe a descrição.';
  return null;
}
