import { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import Card from '../components/ui/Card';
import { calcLote, formatNumber } from '../utils/calculations'; // Assumindo calcLote e formatNumber são robustos
import { getResumoLote } from '../domain/resumoLote';
import { formatarMoeda } from '../utils/formatters'; // Assumindo formatarMoeda é robusto
import CurvasCrescimento from '../components/comparativo/CurvasCrescimento';
import GraficoFinanceiro from '../components/comparativo/GraficoFinanceiro';
import GraficoGmd from '../components/comparativo/GraficoGmd';
import RankingLotes from '../components/comparativo/RankingLotes';
import SeletorLotes from '../components/comparativo/SeletorLotes';
import TabelaComparativa from '../components/comparativo/TabelaComparativa';
import '../styles/comparativo.css';

const coresLotes = ['#22C55E', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

/**
 * Componente da página de Análise Comparativa de Lotes.
 * Permite comparar o desempenho, crescimento e resultado financeiro entre lotes ativos,
 * exibindo gráficos, tabelas e um ranking de indicadores.
 *
 * @param {object} props - As propriedades do componente.
 * @param {object} props.db - O objeto do banco de dados.
 * @param {function} [props.onNavigate] - Função de callback para navegação.
 */
export default function ComparativoPage({ db, onNavigate }) {
  const lotesAtivos = useMemo(() => (db.lotes || []).filter((l) => l.status === 'ativo'), [db.lotes]);
  const [lotesSelecionadosIds, setLotesSelecionadosIds] = useState(lotesAtivos.map((l) => l.id));
  const [periodo, setPeriodo] = useState('todos');

  const lotesSelecionados = useMemo(
    () => lotesAtivos.filter((lote) => lotesSelecionadosIds.includes(lote.id)),
    [lotesAtivos, lotesSelecionadosIds]
  );

  const pesagensFiltradas = useMemo(() => {
    const base = (db.pesagens || []).filter((p) => lotesSelecionadosIds.includes(p.lote_id));
    if (periodo === '30') return base.slice(-30);
    if (periodo === '90') return base.slice(-90);
    return base;
  }, [db.pesagens, lotesSelecionadosIds, periodo]);

  // Otimização: Pré-indexar pesagens por lote e data para busca eficiente
  const pesagensByLoteAndDate = useMemo(() => {
    const map = new Map();
    pesagensFiltradas.forEach(p => {
      const key = `${p.lote_id}-${p.data}`;
      map.set(key, p);
    });
    return map;
  }, [pesagensFiltradas]);

  const dadosGrafico = useMemo(() => {
    const todasDatas = [...new Set(pesagensFiltradas.map((p) => p.data))].sort();

    return todasDatas.map((data) => {
      const ponto = { data };
      lotesSelecionados.forEach((lote) => {
        // Busca otimizada
        const pesagem = pesagensByLoteAndDate.get(`${lote.id}-${data}`);
        if (pesagem) {
          ponto[`lote_${lote.id}`] = Number(pesagem.peso_medio || 0);
        }
      });
      return ponto;
    });
  }, [pesagensFiltradas, lotesSelecionados, pesagensByLoteAndDate]);

  // Otimização: Calcular as métricas para TODOS os lotes ativos uma única vez
  const allActiveLoteMetrics = useMemo(() => {
    return lotesAtivos.map(lote => {
      const calc = calcLote(db, lote.id); // Mantido para métricas produtivas
      const resumo = getResumoLote(db, lote.id);
      const metaPeso = Number(lote.meta_peso || lote.peso_meta || 480); // Assumindo meta_peso ou peso_meta no lote
      return {
        id: lote.id,
        nome: lote.nome,
        cabecas: calc.totalAnimais,
        pesoEntrada: calc.pesoInicialMedio,
        pesoAtual: calc.pesoAtualMedio,
        ganhoTotal: calc.pesoAtualMedio - calc.pesoInicialMedio,
        gmd: calc.gmdMedio,
        dias: calc.dias,
        metaPeso,
        arrobasCabeca: calc.pesoAtualMedio / 15,
        custoTotal: resumo.custoTotal,
        custoCabeca: resumo.custoPorCabeca,
        margemPct: resumo.margemPct,
        receita: resumo.receitaTotal,
        lucro: resumo.lucroTotal,
        // Adicionar aqui quaisquer outras métricas base que não dependam de lotesSelecionados
      };
    });
  }, [db, lotesAtivos]); // Recalcula apenas quando db ou a lista de lotes ativos muda

  // Filtra e calcula métricas derivadas para os lotes SELECIONADOS
  const metricas = useMemo(() => {
    return allActiveLoteMetrics
      .filter(m => lotesSelecionadosIds.includes(m.id))
      .map(m => {
        // Calcula métricas derivadas que dependem de metaPeso ou outras
        const pctMeta = m.metaPeso ? (m.pesoAtual / m.metaPeso) * 100 : 0;
        const diasSaida = m.gmd > 0 && m.metaPeso > m.pesoAtual
          ? Math.ceil((m.metaPeso - m.pesoAtual) / m.gmd)
          : 0;
        return { ...m, pctMeta, diasSaida };
      });
  }, [allActiveLoteMetrics, lotesSelecionadosIds]); // Recalcula quando as métricas de todos os lotes ou os IDs selecionados mudam

  const dadosGmd = metricas.map((m) => ({ id: m.id, nome: m.nome, gmd: Number(m.gmd || 0) }));
  const dadosFinanceiros = metricas.map((m) => ({ id: m.id, nome: m.nome, custo: m.custoTotal, receita: m.receita, lucro: m.lucro }));

  const indicadoresTabela = useMemo(() => {
    return [
      { key: 'cabecas', label: 'Cabeças', highlight: 'max', format: (v) => `${v}` },
      { key: 'pesoEntrada', label: 'Peso de entrada', highlight: 'max', format: (v) => `${formatNumber(v, 1)} kg` },
      { key: 'pesoAtual', label: 'Peso atual', highlight: 'max', format: (v) => `${formatNumber(v, 1)} kg` },
      { key: 'ganhoTotal', label: 'Ganho total', highlight: 'max', format: (v) => `+${formatNumber(v, 1)} kg` },
      { key: 'gmd', label: 'GMD', highlight: 'max', format: (v) => `${formatNumber(v, 3)} kg/dia` },
      { key: 'dias', label: 'Dias em campo', highlight: 'min', format: (v) => `${formatNumber(v, 0)} dias` },
      { key: 'metaPeso', label: 'Meta de peso', format: (v) => `${formatNumber(v, 0)} kg` },
      { key: 'pctMeta', label: '% da meta', highlight: 'max', format: (v) => `${formatNumber(v, 1)}%` },
      { key: 'diasSaida', label: 'Dias p/ saída', highlight: 'min', format: (v) => `~${formatNumber(v, 0)} dias` },
      { key: 'arrobasCabeca', label: 'Arrobas/cabeça', highlight: 'max', format: (v) => `${formatNumber(v, 2)} @` },
      { key: 'custoTotal', label: 'Custo total', highlight: 'min', format: (v) => formatarMoeda(v) },
      { key: 'custoCabeca', label: 'Custo/cabeça', highlight: 'min', format: (v) => formatarMoeda(v) },
      { key: 'margemPct', label: 'Margem estimada', highlight: 'max', format: (v) => `${formatNumber(v, 1)}%` },
    ].map((item) => ({
      ...item,
      valores: Object.fromEntries(metricas.map((m) => [m.id, { raw: m[item.key], display: item.format(m[item.key]) }])),
    }));
  }, [metricas]); // Depende apenas de 'metricas'

  const ranking = useMemo(() => {
    const by = (key, type = 'max') => {
      if (!metricas.length) return null;
      const ordered = [...metricas].sort((a, b) => type === 'max' ? b[key] - a[key] : a[key] - b[key]);
      return ordered[0];
    };
    const melhorGmd = by('gmd', 'max');
    const maiorMargem = by('margemPct', 'max');
    const proximoSaida = by('diasSaida', 'min');
    const menorCustoCab = by('custoCabeca', 'min');

    return [
      { metric: 'Melhor GMD', lote: melhorGmd?.nome || '—', valor: `${formatNumber(melhorGmd?.gmd, 3)} kg/d` },
      { metric: 'Maior Margem', lote: maiorMargem?.nome || '—', valor: `${formatNumber(maiorMargem?.margemPct, 1)}%` },
      { metric: 'Mais próximo saída', lote: proximoSaida?.nome || '—', valor: `${formatNumber(proximoSaida?.diasSaida, 0)} dias` },
      { metric: 'Menor custo/cab', lote: menorCustoCab?.nome || '—', valor: formatarMoeda(menorCustoCab?.custoCabeca || 0) },
    ];
  }, [metricas]);

  const dadosSuficientes = lotesSelecionados.length >= 2 && dadosGrafico.length >= 2;

  function toggleLote(id) {
    setLotesSelecionadosIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      // Limita a seleção a um número razoável de lotes para evitar sobrecarga visual/performance
      if (prev.length >= coresLotes.length) { // Exemplo: Limitar ao número de cores disponíveis
        alert(`Você pode comparar no máximo ${coresLotes.length} lotes.`);
        return prev;
      }
      return [...prev, id];
    });
  }

  return (
    <div className="page comparativo-page">
      <header className="page-header">
        <h1>Análise Comparativa de Lotes</h1>
        <p>Compare desempenho, crescimento e resultado entre os lotes ativos.</p>
      </header>

      <Card>
        <div className="comparativo-topbar">
          <div>
            <p className="comparativo-label">Lotes selecionados</p>
            <SeletorLotes lotes={lotesAtivos} selecionados={lotesSelecionadosIds} onToggle={toggleLote} coresLotes={coresLotes} />
          </div>
          <div>
            <p className="comparativo-label">Período</p>
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="comparativo-select">
              <option value="todos">Todos</option>
              <option value="90">Últimos 90 registros</option>
              <option value="30">Últimos 30 registros</option>
            </select>
          </div>
        </div>
      </Card>

      {!dadosSuficientes ? (
        <Card>
          <div className="empty-state">
            <div className="empty-state-icon">
              <TrendingUp size={28} />
            </div>
            <p className="empty-state-title">Sem dados suficientes para comparar</p>
            <p className="empty-state-desc">Registre pelo menos 2 pesagens em lotes diferentes para visualizar a análise comparativa.</p>
            <button className="btn-primary" type="button" onClick={() => onNavigate?.('pesagens')}>Registrar pesagem</button>
          </div>
        </Card>
      ) : (
        <>
          <Card title="Curvas de crescimento" subtitle="Evolução do peso médio por lote">
            <CurvasCrescimento dadosGrafico={dadosGrafico} lotes={lotesSelecionados} db={db} coresLotes={coresLotes} />
          </Card>

          <Card title="Tabela comparativa de indicadores">
            <TabelaComparativa lotes={lotesSelecionados} indicadores={indicadoresTabela} />
          </Card>

          <section className="comparativo-grid-2">
            <Card title="GMD comparativo">
              <GraficoGmd dados={dadosGmd} coresLotes={coresLotes} />
            </Card>
            <Card title="Custo x Receita x Lucro">
              <GraficoFinanceiro dados={dadosFinanceiros} />
            </Card>
          </section>

          <RankingLotes ranking={ranking} />
        </>
      )}
    </div>
  );
}
