import Card from '../ui/Card';
import { formatCurrency, formatDate, formatNumber } from '../../utils/calculations';

export default function LoteOverviewTab({ lote, resumo }) {
  return (
    <Card title="Visão geral" subtitle="Resumo técnico e financeiro do lote">
      <div className="metrics-2col lote-details-grid">
        <p><strong>Status:</strong> {lote.status}</p>
        <p><strong>Entrada:</strong> {formatDate(lote.entrada)}</p>
        <p><strong>Saída prevista:</strong> {formatDate(lote.saida)}</p>
        <p><strong>Cabeças:</strong> {formatNumber(resumo.totalAnimais, 0)}</p>
        <p><strong>Peso inicial médio:</strong> {formatNumber(resumo.pesoInicialMedio, 1)} kg</p>
        <p><strong>Peso atual médio:</strong> {formatNumber(resumo.pesoAtualMedio, 1)} kg</p>
        <p><strong>GMD médio:</strong> {formatNumber(resumo.gmdKgDia, 3)} kg/dia</p>
        <p><strong>Custo total:</strong> {formatCurrency(resumo.custoTotal)}</p>
        <p><strong>Receita total:</strong> {formatCurrency(resumo.receitaTotal)}</p>
        <p><strong>Resultado:</strong> {formatCurrency(resumo.lucroTotal)}</p>
      </div>
    </Card>
  );
}
