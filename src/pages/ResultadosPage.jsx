import { useMemo, useRef, useState, useCallback } from 'react';
import { DollarSign, FileText, Package, Pill, Scale, TrendingUp } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import RelatorioFechamentoLote from '../components/RelatorioFechamentoLote'; // Assuming this is a specific report component
import RelatorioLote from '../components/relatorios/RelatorioLote';
import RelatorioSanitario from '../components/relatorios/RelatorioSanitario';
import RelatorioEstoque from '../components/relatorios/RelatorioEstoque';
import RelatorioVendas from '../components/relatorios/RelatorioVendas';
import { exportarRelatorio } from '../utils/exportarPDF';
import { exportarParaExcel } from '../utils/exportarExcel';
import { calcLote, formatCurrency } from '../utils/calculations';
import { useToast } from '../hooks/useToast'; // Assuming a toast hook for user feedback

const RELATORIOS = [
  { id: 'lote', titulo: 'Relatório por Lote', descricao: 'Indicadores produtivos e financeiros por lote.', icon: FileText },
  { id: 'sanitario', titulo: 'Relatório Sanitário', descricao: 'Vacinas, tratamentos e calendário sanitário.', icon: Pill },
  { id: 'estoque', titulo: 'Relatório de Estoque', descricao: 'Entradas, saídas, saldo e custos por categoria.', icon: Package },
  { id: 'custos', titulo: 'Relatório de Custos', descricao: 'Custos totais, por categoria e por lote.', icon: DollarSign },
  { id: 'vendas', titulo: 'Relatório de Saídas/Vendas', descricao: 'Receita, compradores e arrobas vendidas.', icon: TrendingUp },
  { id: 'comparativo', titulo: 'Comparativo entre Períodos', descricao: 'Comparação de KPIs entre faixas de datas.', icon: Scale },
  { id: 'dre', titulo: 'DRE por Fazenda', descricao: 'Receitas, custos e margem por fazenda.', icon: FileText },
];

/**
 * Componente para gerar o relatório de custos.
 * @param {object} props - As propriedades do componente.
 * @param {object} props.db - O objeto do banco de dados.
 * @param {string[]} props.loteIds - IDs dos lotes selecionados.
 * @returns {JSX.Element} O componente do relatório de custos.
 */
function RelatorioCustos({ db, loteIds = [] }) {
  const custosPorLote = useMemo(() => {
    const filteredLotes = (db.lotes || []).filter((l) => loteIds.length === 0 || loteIds.includes(String(l.id)));
    return filteredLotes.map((lote) => {
      const custos = (db.custos || []).filter((c) => Number(c.lote_id) === Number(lote.id));
      const total = custos.reduce((acc, c) => acc + Number(c.val || 0), 0);
      return { lote: lote.nome, total };
    });
  }, [db.lotes, db.custos, loteIds]);

  return (
    <Card title="Custos por lote">
      {custosPorLote.length === 0 ? (
        <p>Nenhum custo encontrado para os lotes selecionados.</p>
      ) : (
        <ul>{custosPorLote.map((l) => <li key={l.lote}>{l.lote}: {formatCurrency(l.total)}</li>)}</ul>
      )}
    </Card>
  );
}

/**
 * Componente para gerar o relatório comparativo entre períodos.
 * @param {object} props - As propriedades do componente.
 * @param {object} props.db - O objeto do banco de dados.
 * @param {string} props.dataInicio - Data de início do período.
 * @param {string} props.dataFim - Data de fim do período.
 * @returns {JSX.Element} O componente do relatório comparativo.
 */
function RelatorioComparativo({ db, dataInicio, dataFim }) {
  const { totalA, totalB, variacao } = useMemo(() => {
    if (!dataInicio || !dataFim) return { totalA: 0, totalB: 0, variacao: 0 };

    const ini = new Date(dataInicio);
    const fim = new Date(dataFim);
    const meio = new Date((ini.getTime() + fim.getTime()) / 2);

    const movimentos = (db.movimentacoes_financeiras || []).filter((m) => {
      const movDate = new Date(m.data);
      return movDate >= ini && movDate <= fim;
    });

    const intervaloA = movimentos.filter((m) => new Date(m.data) <= meio);
    const intervaloB = movimentos.filter((m) => new Date(m.data) > meio);

    const totalA = intervaloA.reduce((acc, item) => acc + Number(item.valor || 0), 0);
    const totalB = intervaloB.reduce((acc, item) => acc + Number(item.valor || 0), 0);

    return { totalA, totalB, variacao: totalB - totalA };
  }, [db.movimentacoes_financeiras, dataInicio, dataFim]);

  return (
    <Card title="Comparativo de períodos">
      <p>Período A: {formatCurrency(totalA)}</p>
      <p>Período B: {formatCurrency(totalB)}</p>
      <p>Variação: {formatCurrency(variacao)}</p>
    </Card>
  );
}

/**
 * Componente para gerar o relatório DRE por fazenda.
 * @param {object} props - As propriedades do componente.
 * @param {object} props.db - O objeto do banco de dados.
 * @param {string} props.fazendaId - ID da fazenda selecionada.
 * @param {Map<number, object>} props.allLoteIndicators - Indicadores pré-calculados para todos os lotes.
 * @returns {JSX.Element} O componente do relatório DRE.
 */
function RelatorioDRE({ db, fazendaId, allLoteIndicators }) {
  const { linhas, totalReceita, totalCusto, totalLucro } = useMemo(() => {
    const filteredLotes = (db.lotes || []).filter((l) => !fazendaId || String(l.faz_id) === String(fazendaId));
    const calculatedLinhas = filteredLotes.map((lote) => {
      const indicadores = allLoteIndicators.get(lote.id) || {}; // Usar indicadores pré-calculados
      return {
        id: lote.id,
        nome: lote.nome,
        receita: indicadores.receitaTotal || 0,
        custo: indicadores.custoTotalLote || 0,
        lucro: (indicadores.receitaTotal || 0) - (indicadores.custoTotalLote || 0),
      };
    });
    const totalReceita = calculatedLinhas.reduce((acc, l) => acc + l.receita, 0);
    const totalCusto = calculatedLinhas.reduce((acc, l) => acc + l.custo, 0);
    const totalLucro = calculatedLinhas.reduce((acc, l) => acc + l.lucro, 0);
    return { linhas: calculatedLinhas, totalReceita, totalCusto, totalLucro };
  }, [db.lotes, fazendaId, allLoteIndicators]);

  return (
    <Card title="DRE por Fazenda">
      <p>Receita Total: {formatCurrency(totalReceita)}</p>
      <p>Custo Total: {formatCurrency(totalCusto)}</p>
      <p>Lucro Total: {formatCurrency(totalLucro)}</p>
      {linhas.length > 0 && (
        <>
          <h4>Detalhes por Lote:</h4>
          <ul>
            {linhas.map((l) => (
              <li key={l.id}>
                {l.nome}: Receita {formatCurrency(l.receita)}, Custo {formatCurrency(l.custo)}, Lucro {formatCurrency(l.lucro)}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

export default function RelatoriosPage({ db }) {
  const { showToast } = useToast();

  const areaRelatorioRef = useRef(null);
  const [tipoRelatorio, setTipoRelatorio] = useState('');
  const [aberto, setAberto] = useState(false);
  const [filtros, setFiltros] = useState({
    dataInicio: '',
    dataFim: '',
    lotes: [],
    fazenda: '',
    formato: 'visualizar',
  });
  const [relatorioGerado, setRelatorioGerado] = useState(null);

  const fazendas = useMemo(() => (db.fazendas || []), [db.fazendas]);

  const relatorioAtual = useMemo(() => RELATORIOS.find((r) => r.id === tipoRelatorio), [tipoRelatorio]);

  // Pré-calcular calcLote para todos os lotes para otimização
  const allLoteIndicators = useMemo(() => {
    const indicatorsMap = new Map();
    (db.lotes || []).forEach(lote => {
      indicatorsMap.set(lote.id, calcLote(db, lote.id));
    });
    return indicatorsMap;
  }, [db]);

  const gerarRelatorio = useCallback(async () => {
    if (filtros.formato === 'pdf') {
      if (!areaRelatorioRef.current) {
        showToast({ type: 'error', message: 'Conteúdo do relatório não disponível para exportação em PDF.' });
        return;
      }
      // Renderiza o relatório para que o conteúdo esteja disponível no DOM
      setRelatorioGerado({ ...filtros, tipo: tipoRelatorio });
      // Espera um pouco para o React renderizar o conteúdo
      await new Promise(resolve => setTimeout(resolve, 100));
      try {
        await exportarRelatorio(areaRelatorioRef.current, relatorioAtual?.titulo || 'Relatório');
        showToast({ type: 'success', message: 'Relatório exportado para PDF com sucesso!' });
      } catch (error) {
        console.error('Erro ao exportar PDF:', error);
        showToast({ type: 'error', message: 'Erro ao exportar relatório para PDF.' });
      }
    } else if (filtros.formato === 'excel') {
      let dadosParaExportar = [];
      // Lógica de exportação para Excel para cada tipo de relatório
      switch (tipoRelatorio) {
        case 'lote':
        case 'dre':
          // Para 'lote' e 'dre', podemos usar os dados já processados
          const lotesData = (db.lotes || [])
            .filter(l => filtros.lotes.length === 0 || filtros.lotes.includes(String(l.id)))
            .filter(l => !filtros.fazenda || String(l.faz_id) === String(filtros.fazenda))
            .map(l => {
              const ind = allLoteIndicators.get(l.id) || {};
              return {
                'ID Lote': l.id,
                'Nome Lote': l.nome,
                'Status': l.status,
                'Fazenda': (db.fazendas || []).find(f => f.id === l.faz_id)?.nome || 'N/A',
                'Data Entrada': l.entrada,
                'Total Animais': ind.totalAnimais || 0,
                'Peso Médio Atual (kg)': formatNumber(ind.pesoAtualMedio || 0, 2),
                'GMD Médio (kg/dia)': formatNumber(ind.gmdMedio || 0, 3),
                'Custo Total (R$)': formatNumber(ind.custoTotalLote || 0, 2),
                'Receita Total (R$)': formatNumber(ind.receitaTotal || 0, 2),
                'Lucro (R$)': formatNumber(ind.margem || 0, 2),
                'Margem (%)': formatNumber(ind.margemPct || 0, 2),
              };
            });
          dadosParaExportar = lotesData;
          break;
        case 'sanitario':
          dadosParaExportar = (db.sanitario || [])
            .filter(s => filtros.lotes.length === 0 || filtros.lotes.includes(String(s.lote_id)))
            .filter(s => !filtros.dataInicio || s.data >= filtros.dataInicio)
            .filter(s => !filtros.dataFim || s.data <= filtros.dataFim)
            .map(s => ({
              'ID': s.id,
              'Lote': (db.lotes || []).find(l => l.id === s.lote_id)?.nome || 'N/A',
              'Data': s.data,
              'Tipo': s.tipo,
              'Produto': s.produto,
              'Dose': s.dose,
              'Próxima Aplicação': s.proxima,
              'Observação': s.obs,
            }));
          break;
        case 'estoque':
          dadosParaExportar = (db.movimentacoes_estoque || [])
            .filter(m => !filtros.dataInicio || m.data >= filtros.dataInicio)
            .filter(m => !filtros.dataFim || m.data <= filtros.dataFim)
            .map(m => ({
              'ID': m.id,
              'Item': (db.estoque || []).find(i => i.id === m.item_estoque_id)?.produto || 'N/A',
              'Tipo Movimentação': m.tipo,
              'Quantidade': m.quantidade,
              'Data': m.data,
              'Lote': (db.lotes || []).find(l => l.id === m.lote_id)?.nome || 'N/A',
              'Valor Total (R$)': formatNumber(m.valor_total || 0, 2),
              'Observação': m.obs,
            }));
          break;
        case 'custos':
          dadosParaExportar = (db.custos || [])
            .filter(c => filtros.lotes.length === 0 || filtros.lotes.includes(String(c.lote_id)))
            .filter(c => !filtros.dataInicio || c.data >= filtros.dataInicio)
            .filter(c => !filtros.dataFim || c.data <= filtros.dataFim)
            .map(c => ({
              'ID': c.id,
              'Lote': (db.lotes || []).find(l => l.id === c.lote_id)?.nome || 'N/A',
              'Categoria': c.cat,
              'Descrição': c.desc,
              'Data': c.data,
              'Valor (R$)': formatNumber(c.val || 0, 2),
            }));
          break;
        case 'vendas':
          dadosParaExportar = (db.movimentacoes_animais || [])
            .filter(m => m.tipo === 'venda')
            .filter(m => filtros.lotes.length === 0 || filtros.lotes.includes(String(m.lote_id)))
            .filter(m => !filtros.dataInicio || m.data >= filtros.dataInicio)
            .filter(m => !filtros.dataFim || m.data <= filtros.dataFim)
            .map(m => ({
              'ID': m.id,
              'Lote': (db.lotes || []).find(l => l.id === m.lote_id)?.nome || 'N/A',
              'Data': m.data,
              'Quantidade': m.qtd,
              'Peso Médio (kg)': formatNumber(m.peso_medio || 0, 2),
              'Valor Total (R$)': formatNumber(m.valor_total || 0, 2),
              'Comprador': m.comprador_fornecedor,
              'Observação': m.obs,
            }));
          break;
        case 'comparativo':
          // O relatório comparativo é mais complexo para exportar como dados brutos simples.
          // Poderia exportar os totais dos períodos A e B.
          const { totalA, totalB, variacao } = (() => {
            if (!filtros.dataInicio || !filtros.dataFim) return { totalA: 0, totalB: 0, variacao: 0 };
            const ini = new Date(filtros.dataInicio);
            const fim = new Date(filtros.dataFim);
            const meio = new Date((ini.getTime() + fim.getTime()) / 2);
            const movimentos = (db.movimentacoes_financeiras || []).filter((m) => {
              const movDate = new Date(m.data);
              return movDate >= ini && movDate <= fim;
            });
            const intervaloA = movimentos.filter((m) => new Date(m.data) <= meio);
            const intervaloB = movimentos.filter((m) => new Date(m.data) > meio);
            const tA = intervaloA.reduce((acc, item) => acc + Number(item.valor || 0), 0);
            const tB = intervaloB.reduce((acc, item) => acc + Number(item.valor || 0), 0);
            return { totalA: tA, totalB: tB, variacao: tB - tA };
          })();
          dadosParaExportar = [{
            'Período A (R$)': formatNumber(totalA, 2),
            'Período B (R$)': formatNumber(totalB, 2),
            'Variação (R$)': formatNumber(variacao, 2),
          }];
          break;
        default:
          showToast({ type: 'warning', message: 'Exportação para Excel não implementada para este tipo de relatório.' });
          return;
      }

      if (dadosParaExportar.length > 0) {
        try {
          exportarParaExcel(dadosParaExportar, relatorioAtual?.titulo || 'Relatório');
          showToast({ type: 'success', message: 'Relatório exportado para Excel com sucesso!' });
        } catch (error) {
          console.error('Erro ao exportar Excel:', error);
          showToast({ type: 'error', message: 'Erro ao exportar relatório para Excel.' });
        }
      } else {
        showToast({ type: 'info', message: 'Nenhum dado para exportar para Excel com os filtros selecionados.' });
      }
    } else {
      setRelatorioGerado({ ...filtros, tipo: tipoRelatorio });
      showToast({ type: 'success', message: 'Relatório gerado para visualização.' });
    }
    setAberto(false);
  }, [filtros, tipoRelatorio, relatorioAtual, areaRelatorioRef, db, allLoteIndicators, showToast]);

  const renderRelatorio = useCallback(() => {
    if (!relatorioGerado) return null;

    const { tipo, dataInicio, dataFim, lotes: selectedLotes, fazenda: selectedFazenda } = relatorioGerado;

    switch (tipo) {
      case 'lote':
        return <RelatorioLote db={db} loteIds={selectedLotes} dataInicio={dataInicio} dataFim={dataFim} allLoteIndicators={allLoteIndicators} />;
      case 'sanitario':
        return <RelatorioSanitario db={db} loteIds={selectedLotes} dataInicio={dataInicio} dataFim={dataFim} />;
      case 'estoque':
        return <RelatorioEstoque db={db} dataInicio={dataInicio} dataFim={dataFim} />;
      case 'custos':
        return <RelatorioCustos db={db} loteIds={selectedLotes} />;
      case 'vendas':
        return <RelatorioVendas db={db} loteIds={selectedLotes} dataInicio={dataInicio} dataFim={dataFim} />;
      case 'comparativo':
        return <RelatorioComparativo db={db} dataInicio={dataInicio} dataFim={dataFim} />;
      case 'dre':
        return <RelatorioDRE db={db} fazendaId={selectedFazenda} allLoteIndicators={allLoteIndicators} />;
      default:
        return <p>Selecione um relatório para visualizar.</p>;
    }
  }, [relatorioGerado, db, allLoteIndicators]);

  return (
    <>
      <PageHeader
        title="Relatórios"
        subtitle="Gere e exporte relatórios detalhados sobre sua operação."
      />

      <div className="grid-3">
        {RELATORIOS.map((relatorio) => {
          const Icone = relatorio.icon;
          return (
            <Card
              key={relatorio.id}
              title={relatorio.titulo}
              subtitle={relatorio.descricao}
              action={<Icone size={18} />}
            >
              <Button
                variant="outline"
                onClick={() => {
                  setTipoRelatorio(relatorio.id);
                  setAberto(true);
                  setRelatorioGerado(null); // Limpa o relatório gerado anterior ao abrir o modal
                }}
              >
                Gerar Relatório
              </Button>
            </Card>
          );
        })}
      </div>

      {/* A seção de impressão deve ser renderizada condicionalmente ou ter seu conteúdo atualizado */}
      {/* O botão de imprimir só deve aparecer se houver um relatório gerado para visualização */}
      {relatorioGerado && filtros.formato === 'visualizar' && (
        <div className="sem-impressao" style={{ marginBottom: 16 }}>
          <Button onClick={() => window.print()} variant="secondary">Imprimir Relatório</Button>
        </div>
      )}

      <section ref={areaRelatorioRef} className="so-impressao">
        {/* Renderiza o relatório apenas se estiver no modo de visualização ou se for para PDF/Excel */}
        {relatorioGerado && renderRelatorio()}
        {/* O RelatorioFechamentoLote hardcoded foi removido, pois não era dinâmico */}
      </section>

      <Modal
        open={aberto}
        onClose={() => setAberto(false)}
        title={`Configurar ${relatorioAtual?.titulo || 'Relatório'}`}
        footer={<Button onClick={gerarRelatorio}>Gerar relatório</Button>}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <Input label="Data início" type="date" value={filtros.dataInicio} onChange={(e) => setFiltros((p) => ({ ...p, dataInicio: e.target.value }))} />
          <Input label="Data fim" type="date" value={filtros.dataFim} onChange={(e) => setFiltros((p) => ({ ...p, dataFim: e.target.value }))} />

          <label className="ui-input-label">Lotes (opcional)</label>
          <select
            multiple
            className="ui-input"
            value={filtros.lotes}
            onChange={(e) => setFiltros((p) => ({ ...p, lotes: Array.from(e.target.selectedOptions).map((o) => o.value) }))}
            style={{ minHeight: 120 }}
          >
            {(db.lotes || []).map((lote) => <option key={lote.id} value={String(lote.id)}>{lote.nome}</option>)}
          </select>

          {fazendas.length > 1 ? (
            <>
              <label className="ui-input-label">Fazenda</label>
              <select className="ui-input" value={filtros.fazenda} onChange={(e) => setFiltros((p) => ({ ...p, fazenda: e.target.value }))}>
                <option value="">Todas</option>
                {fazendas.map((fazenda) => <option key={fazenda.id} value={String(fazenda.id)}>{fazenda.nome}</option>)}
              </select>
            </>
          ) : null}

          <label className="ui-input-label">Formato de exportação</label>
          <select className="ui-input" value={filtros.formato} onChange={(e) => setFiltros((p) => ({ ...p, formato: e.target.value }))}>
            <option value="visualizar">Visualizar</option>
            <option value="pdf">PDF</option>
            <option value="excel">Excel</option>
          </select>
        </div>
      </Modal>
    </>
  );
}