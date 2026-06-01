import { useMemo } from 'react';
import Card from '../components/ui/Card';
import PageHeader from '../components/PageHeader';
import { computeIndicadoresEstrategicos } from '../domain/indicadoresEstrategicos';
import { calcularProjecaoCenario } from '../domain/simuladorCenarios';

function nowPeriod() {
  const today = new Date();
  const year = today.getFullYear();
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

function formatNumber(value, digits = 2, suffix = '') {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Sem dados suficientes';
  return `${number.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}${suffix}`;
}

function formatCurrency(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Sem dados suficientes';
  return `R$ ${number.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercent(value) {
  return formatNumber(value, 2, '%');
}

export default function RelatoriosGerenciaisPage({ db }) {
  const period = useMemo(() => nowPeriod(), []);
  const indicadores = useMemo(
    () => computeIndicadoresEstrategicos(db, period.start, period.end),
    [db, period.start, period.end]
  );
  const cenarios = useMemo(() => (Array.isArray(db?.cenarios) ? db.cenarios : []), [db]);

  const cenariosResumo = useMemo(() => (
    cenarios.map((cenario) => ({
      ...cenario,
      projecao: calcularProjecaoCenario(
        db,
        String(cenario?.periodo_inicio || period.start),
        String(cenario?.periodo_fim || period.end),
        cenario
      ),
    }))
  ), [cenarios, db, period.start, period.end]);

  return (
    <div className="page reports-page">
      <PageHeader
        title="Relatórios Gerenciais"
        subtitle="Resumo executivo consolidado para leitura estratégica."
      />

      <Card title="Resumo da fazenda" subtitle={`Período: ${period.start} até ${period.end}`}>
        <div className="metrics-2col">
          <p>Rebanho ativo: <strong>{formatNumber(indicadores?.evolucao?.resumo?.estoque_final, 0)}</strong></p>
          <p>Lotes monitorados: <strong>{formatNumber(Array.isArray(db?.lotes) ? db.lotes.length : 0, 0)}</strong></p>
          <p>Fazendas cadastradas: <strong>{formatNumber(Array.isArray(db?.fazendas) ? db.fazendas.length : 0, 0)}</strong></p>
          <p>Status de lotação: <strong>{indicadores?.pastagem?.statusLotacao === 'superlotado' ? 'Superlotado' : 'Dentro da capacidade'}</strong></p>
        </div>
      </Card>

      <div className="dashboard-grid dashboard-grid--dual">
        <Card title="Indicadores técnicos">
          <div className="metrics-2col">
            <p>Taxa de desfrute: <strong>{formatPercent(indicadores?.tecnicos?.desfrutePct)}</strong></p>
            <p>Taxa de abate: <strong>{formatPercent(indicadores?.tecnicos?.taxaAbatePct)}</strong></p>
            <p>Crescimento do rebanho: <strong>{formatPercent(indicadores?.tecnicos?.taxaCrescimentoPct)}</strong></p>
            <p>Kg vivo/ha: <strong>{formatNumber(indicadores?.tecnicos?.kgVivoHa, 2, ' kg/ha')}</strong></p>
            <p>Arrobas vendidas: <strong>{formatNumber(indicadores?.tecnicos?.arrobasVendidas, 2, ' @')}</strong></p>
          </div>
        </Card>

        <Card title="Indicadores econômicos">
          <div className="metrics-2col">
            <p>Receita total: <strong>{formatCurrency(indicadores?.economicos?.receitaTotal)}</strong></p>
            <p>Custos totais: <strong>{formatCurrency(indicadores?.economicos?.custosTotais)}</strong></p>
            <p>Margem bruta: <strong>{formatCurrency(indicadores?.economicos?.margemBruta)}</strong></p>
            <p>Margem por hectare: <strong>{formatCurrency(indicadores?.economicos?.margemPorHa)}</strong></p>
            <p>Margem por cabeça: <strong>{formatCurrency(indicadores?.economicos?.margemPorCabeca)}</strong></p>
          </div>
        </Card>
      </div>

      <div className="dashboard-grid dashboard-grid--dual">
        <Card title="Pastagens e lotação">
          <div className="metrics-2col">
            <p>Área total de pastagem: <strong>{formatNumber(indicadores?.pastagem?.areaTotalPastagem, 2, ' ha')}</strong></p>
            <p>Capacidade total UA: <strong>{formatNumber(indicadores?.pastagem?.capacidadeTotalUa, 2)}</strong></p>
            <p>UA demandada: <strong>{formatNumber(indicadores?.unidadeAnimal?.uaTotalFazenda, 2)}</strong></p>
            <p>Saldo UA: <strong>{formatNumber(indicadores?.pastagem?.saldoUa, 2)}</strong></p>
            <p>Pasto a arrendar: <strong>{formatNumber(indicadores?.pastagem?.pastoAArrendarHa, 2, ' ha')}</strong></p>
          </div>
        </Card>

        <Card title="Evolução do rebanho">
          <div className="metrics-2col">
            <p>Estoque inicial: <strong>{formatNumber(indicadores?.evolucao?.resumo?.estoque_inicial, 0)}</strong></p>
            <p>Compras: <strong>{formatNumber(indicadores?.evolucao?.resumo?.compras, 0)}</strong></p>
            <p>Nascimentos: <strong>{formatNumber(indicadores?.evolucao?.resumo?.nascimentos, 0)}</strong></p>
            <p>Vendas: <strong>{formatNumber(indicadores?.evolucao?.resumo?.vendas, 0)}</strong></p>
            <p>Mortes: <strong>{formatNumber(indicadores?.evolucao?.resumo?.mortes, 0)}</strong></p>
            <p>Transferências (entrada/saída): <strong>{formatNumber(indicadores?.evolucao?.resumo?.transferencias_entrada, 0)} / {formatNumber(indicadores?.evolucao?.resumo?.transferencias_saida, 0)}</strong></p>
            <p>Estoque final: <strong>{formatNumber(indicadores?.evolucao?.resumo?.estoque_final, 0)}</strong></p>
            <p>Variação de inventário: <strong>{formatNumber(indicadores?.evolucao?.resumo?.variacao_inventario, 0)}</strong></p>
          </div>
        </Card>
      </div>

      <Card title="Cenários simulados">
        {!cenariosResumo.length ? (
          <div className="empty-state">
            <strong>Sem dados suficientes</strong>
            <span>Cadastre cenários para visualizar o resumo gerencial projetado.</span>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cenário</th>
                  <th>Status</th>
                  <th>Margem projetada</th>
                  <th>Estoque final projetado</th>
                  <th>Saldo UA projetado</th>
                </tr>
              </thead>
              <tbody>
                {cenariosResumo.map((item) => (
                  <tr key={item.id}>
                    <td>{item.nome || 'Sem dados suficientes'}</td>
                    <td>{item.status || 'Sem dados suficientes'}</td>
                    <td>{formatCurrency(item?.projecao?.projecao?.margem_bruta_projetada)}</td>
                    <td>{formatNumber(item?.projecao?.projecao?.estoque_final_projetado, 2)}</td>
                    <td>{formatNumber(item?.projecao?.projecao?.saldo_ua_projetado, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
