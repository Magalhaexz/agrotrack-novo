import Card from '../ui/Card';
import { formatCurrency, formatDate, formatNumber } from '../../utils/calculations';

export default function LoteOverviewTab({ lote, resumo }) {
  const pesoInicial = Number(resumo.pesoInicialMedio || lote.p_ini || 0);
  const pesoAtual = Number(resumo.pesoAtualMedio || lote.p_at || 0);
  const gmdEsperado = Number(lote.gmd_meta || 0);

  return (
    <Card title="Visão geral" subtitle="Resumo técnico e financeiro do lote">
      <div className="metrics-2col lote-details-grid">
        <p><strong>Status:</strong> {lote.status}</p>
        <p><strong>Entrada:</strong> {formatDate(lote.entrada)}</p>
        <p><strong>Saída prevista:</strong> {formatDate(lote.saida)}</p>
        <p><strong>Pastagem atual:</strong> {lote.pastagemNome || '—'}</p>
        <p><strong>Categoria animal:</strong> {lote.categoriaAnimal || '—'}</p>
        <p><strong>Raça:</strong> {lote.raca || '—'}</p>
        <p><strong>Cabeças:</strong> {formatNumber(resumo.totalAnimais || lote.qtd, 0)}</p>
        <p><strong>Peso inicial médio:</strong> {formatNumber(pesoInicial, 1)} kg</p>
        <p><strong>Peso atual médio:</strong> {formatNumber(pesoAtual, 1)} kg</p>
        <p><strong>Peso alvo final:</strong> {formatNumber(lote.peso_alvo, 1)} kg</p>
        <p><strong>GMD médio:</strong> {formatNumber(resumo.gmdKgDia, 3)} kg/dia</p>
        <p><strong>GMD esperado:</strong> {formatNumber(gmdEsperado, 3)} kg/dia</p>
        <p><strong>Dias estimados:</strong> {formatNumber(lote.dias_estimados, 0)} dias</p>
        <p><strong>Custo total:</strong> {formatCurrency(resumo.custoTotal)}</p>
        <p><strong>Receita total:</strong> {formatCurrency(resumo.receitaTotal)}</p>
        <p><strong>Resultado:</strong> {formatCurrency(resumo.lucroTotal)}</p>
      </div>
    </Card>
  );
}
