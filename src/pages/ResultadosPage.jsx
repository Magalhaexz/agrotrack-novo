import { useMemo, useRef, useState } from 'react';
import { DollarSign, FileText, Package, Pill, Scale, TrendingUp } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import RelatorioFechamentoLote from '../components/RelatorioFechamentoLote';
import RelatorioLote from '../components/relatorios/RelatorioLote';
import RelatorioSanitario from '../components/relatorios/RelatorioSanitario';
import RelatorioEstoque from '../components/relatorios/RelatorioEstoque';
import RelatorioVendas from '../components/relatorios/RelatorioVendas';
import { exportarRelatorio } from '../utils/exportarPDF';
import { exportarParaExcel } from '../utils/exportarExcel';
import { calcLote, formatCurrency } from '../utils/calculations';

const RELATORIOS = [
  { id: 'lote', titulo: 'Relatório por Lote', descricao: 'Indicadores produtivos e financeiros por lote.', icon: FileText },
  { id: 'sanitario', titulo: 'Relatório Sanitário', descricao: 'Vacinas, tratamentos e calendário sanitário.', icon: Pill },
  { id: 'estoque', titulo: 'Relatório de Estoque', descricao: 'Entradas, saídas, saldo e custos por categoria.', icon: Package },
  { id: 'custos', titulo: 'Relatório de Custos', descricao: 'Custos totais, por categoria e por lote.', icon: DollarSign },
  { id: 'vendas', titulo: 'Relatório de Saídas/Vendas', descricao: 'Receita, compradores e arrobas vendidas.', icon: TrendingUp },
  { id: 'comparativo', titulo: 'Comparativo entre Períodos', descricao: 'Comparação de KPIs entre faixas de datas.', icon: Scale },
  { id: 'dre', titulo: 'DRE por Fazenda', descricao: 'Receitas, custos e margem por fazenda.', icon: FileText },
];

function RelatorioCustos({ db, loteIds = [] }) {
  const lotes = db.lotes.filter((l) => loteIds.length === 0 || loteIds.includes(String(l.id)));
  const linhas = lotes.map((lote) => {
    const custos = (db.custos || []).filter((c) => Number(c.lote_id) === Number(lote.id));
    const total = custos.reduce((acc, c) => acc + Number(c.val || 0), 0);
    return { lote: lote.nome, total };
  });
  return (
    <Card title="Custos por lote">
      <ul>{linhas.map((l) => <li key={l.lote}>{l.lote}: {formatCurrency(l.total)}</li>)}</ul>
    </Card>
  );
}

function RelatorioComparativo({ db, dataInicio, dataFim }) {
  const meio = useMemo(() => {
    if (!dataInicio || !dataFim) return null;
    const ini = new Date(dataInicio);
    const fim = new Date(dataFim);
    return new Date((ini.getTime() + fim.getTime()) / 2).toISOString().slice(0, 10);
  }, [dataInicio, dataFim]);

  const intervaloA = (db.movimentacoes_financeiras || []).filter((m) => m.data >= (dataInicio || '0000-01-01') && m.data <= (meio || '9999-12-31'));
  const intervaloB = (db.movimentacoes_financeiras || []).filter((m) => m.data > (meio || '0000-01-01') && m.data <= (dataFim || '9999-12-31'));

  const totalA = intervaloA.reduce((acc, item) => acc + Number(item.valor || 0), 0);
  const totalB = intervaloB.reduce((acc, item) => acc + Number(item.valor || 0), 0);

  return (
    <Card title="Comparativo de períodos">
      <p>Período A: {formatCurrency(totalA)}</p>
      <p>Período B: {formatCurrency(totalB)}</p>
      <p>Variação: {formatCurrency(totalB - totalA)}</p>
    </Card>
  );
}

function RelatorioDRE({ db, fazendaId }) {
  const lotesFazenda = (db.lotes || []).filter((l) => !fazendaId || String(l.faz_id) === String(fazendaId));
  const linhas = lotesFazenda.map((lote) => {
    const indicadores = calcLote(db, lote.id);
    return {
      id: lote.id,
      lote: lote.nome,
      receita: indicadores.receitaTotal,
      custos: indicadores.custoTotalLote,
      resultado: indicadores.margem,
    };
  });

  const receita = linhas.reduce((acc, item) => acc + item.receita, 0);
  const custos = linhas.reduce((acc, item) => acc + item.custos, 0);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card title="DRE consolidado">
        <p>Receita bruta: <strong>{formatCurrency(receita)}</strong></p>
        <p>Custos totais: <strong>{formatCurrency(custos)}</strong></p>
        <p>Resultado operacional: <strong>{formatCurrency(receita - custos)}</strong></p>
      </Card>
      <Card title="Detalhamento por lote">
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead><tr><th>Lote</th><th>Receita</th><th>Custos</th><th>Resultado</th></tr></thead>
            <tbody>
              {linhas.map((item) => (
                <tr key={item.id}><td>{item.lote}</td><td>{formatCurrency(item.receita)}</td><td>{formatCurrency(item.custos)}</td><td>{formatCurrency(item.resultado)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function ResultadosPage({ db }) {
  const [aberto, setAberto] = useState(false);
  const [tipoRelatorio, setTipoRelatorio] = useState('lote');
  const [filtros, setFiltros] = useState({ dataInicio: '', dataFim: '', lotes: [], fazenda: '', formato: 'visualizar' });
  const [relatorioGerado, setRelatorioGerado] = useState(null);
  const areaRelatorioRef = useRef(null);

  const relatorioAtual = RELATORIOS.find((item) => item.id === tipoRelatorio);
  const fazendas = db.fazendas || [];

  const dadosExcel = useMemo(() => {
    const lotes = db.lotes || [];
    const movAnimais = db.movimentacoes_animais || [];
    const movFin = db.movimentacoes_financeiras || [];
    const movEstoque = db.movimentacoes_estoque || [];

    return {
      lotes: lotes.map((l) => ({ lote: l.nome, fazenda_id: l.faz_id, status: l.status })),
      animais: movAnimais.map((m) => ({ data: m.data, lote_id: m.lote_id, tipo: m.tipo, qtd: m.qtd, valor_total: m.valor_total })),
      financeiro: movFin.map((m) => ({ data: m.data, tipo: m.tipo, categoria: m.categoria, valor: m.valor })),
      estoque: movEstoque.map((m) => ({ data: m.data, tipo: m.tipo, item_estoque_id: m.item_estoque_id, quantidade: m.quantidade, valor_total: m.valor_total })),
    };
  }, [db]);

  function gerarRelatorio() {
    const payload = { tipo: tipoRelatorio, ...filtros };
    setRelatorioGerado(payload);
    setAberto(false);

    if (filtros.formato === 'pdf') {
      setTimeout(() => {
        exportarRelatorio(areaRelatorioRef.current, relatorioAtual?.titulo || 'relatorio', {
          titulo: relatorioAtual?.titulo,
          fazenda: fazendas.find((f) => String(f.id) === String(filtros.fazenda))?.nome || fazendas[0]?.nome,
        });
      }, 100);
    }

    if (filtros.formato === 'excel') {
      exportarParaExcel(dadosExcel.lotes, [
        { key: 'lote', label: 'Lote' },
        { key: 'fazenda_id', label: 'Fazenda' },
        { key: 'status', label: 'Status' },
      ], 'lotes_indicadores');
      exportarParaExcel(dadosExcel.animais, [
        { key: 'data', label: 'Data' },
        { key: 'lote_id', label: 'Lote' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'qtd', label: 'Quantidade' },
        { key: 'valor_total', label: 'Valor total' },
      ], 'movimentacoes_animais');
      exportarParaExcel(dadosExcel.financeiro, [
        { key: 'data', label: 'Data' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'categoria', label: 'Categoria' },
        { key: 'valor', label: 'Valor' },
      ], 'lancamentos_financeiros');
      exportarParaExcel(dadosExcel.estoque, [
        { key: 'data', label: 'Data' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'item_estoque_id', label: 'Item' },
        { key: 'quantidade', label: 'Quantidade' },
        { key: 'valor_total', label: 'Valor total' },
      ], 'movimentacoes_estoque');
    }
  }

  function renderRelatorio() {
    if (!relatorioGerado) return null;

    const propsComuns = {
      db,
      dataInicio: relatorioGerado.dataInicio,
      dataFim: relatorioGerado.dataFim,
      loteIds: relatorioGerado.lotes,
    };

    switch (relatorioGerado.tipo) {
      case 'lote':
        return <RelatorioLote {...propsComuns} />;
      case 'sanitario':
        return <RelatorioSanitario {...propsComuns} />;
      case 'estoque':
        return <RelatorioEstoque {...propsComuns} />;
      case 'custos':
        return <RelatorioCustos {...propsComuns} />;
      case 'vendas':
        return <RelatorioVendas {...propsComuns} />;
      case 'comparativo':
        return <RelatorioComparativo {...propsComuns} />;
      case 'dre':
        return <RelatorioDRE db={db} fazendaId={relatorioGerado.fazenda} />;
      default:
        return null;
    }
  }

  return (
    <>
      <PageHeader title="Relatórios Gerenciais" subtitle="Geração, visualização e exportação de relatórios estratégicos." />

      <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', marginBottom: 16 }}>
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
                }}
              >
                Gerar Relatório
              </Button>
            </Card>
          );
        })}
      </div>

      <div className="sem-impressao" style={{ marginBottom: 16 }}>
        <Button onClick={() => window.print()} variant="secondary">Imprimir</Button>
      </div>

      <section ref={areaRelatorioRef} className="so-impressao">
        {renderRelatorio()}
        {relatorioGerado?.tipo === 'lote' ? (
          <div style={{ marginTop: 20 }}>
            <RelatorioFechamentoLote
              fazenda={db.fazendas?.[0]}
              lote={db.lotes?.[0]}
              pesagens={db.pesagens || []}
              custos={db.custos || []}
              manejos={db.sanitario || []}
              saidas={(db.movimentacoes_animais || []).filter((m) => m.tipo === 'venda')}
              indicadores={{ gmd_real: 1.2, arrobas_por_cab: 18, mortalidade: 0.5 }}
              financeiro={{ custoTotal: 100000, receitaTotal: 140000, lucroBruto: 40000, margem: 28.5 }}
            />
          </div>
        ) : null}
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
