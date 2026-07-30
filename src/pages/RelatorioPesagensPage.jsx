import { useMemo, useRef, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import AcoesRelatorio from '../components/relatorios/AcoesRelatorio';
import { buildRelatorioPesagens } from '../domain/relatorios';
import { gerarResumoPesagensTexto } from '../domain/whatsappResumo';
import { formatDate, formatNumber } from '../utils/calculations';
import { isModoConsolidado } from '../domain/escopoFazenda';

export default function RelatorioPesagensPage({ db, onNavigate, fazendaSelecionada }) {
  const consolidado = isModoConsolidado(fazendaSelecionada);
  const fazendas = Array.isArray(db?.fazendas) ? db.fazendas : [];
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const [fazendaId, setFazendaId] = useState('');
  const [loteId, setLoteId] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const containerRef = useRef(null);

  const linhas = useMemo(
    () => buildRelatorioPesagens(db, { fazendaId: fazendaId || null, loteId: loteId || null, dataInicio, dataFim }),
    [db, fazendaId, loteId, dataInicio, dataFim]
  );

  const loteNome = lotes.find((l) => String(l.id) === String(loteId))?.nome;

  return (
    <div className="page reports-page">
      <PageHeader
        title="Relatório de Pesagens"
        subtitle={`${consolidado ? 'Todas as fazendas' : (fazendaSelecionada?.nome || 'Todas as fazendas')} · Acompanhe a evolução de peso e o GMD entre pesagens.`}
      />

      <Card title="Filtros">
        <div className="filters-row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <select className="ui-input" value={fazendaId} onChange={(e) => { setFazendaId(e.target.value); setLoteId(''); }}>
            <option value="">Todas as fazendas</option>
            {fazendas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <select className="ui-input" value={loteId} onChange={(e) => setLoteId(e.target.value)}>
            <option value="">Todos os lotes</option>
            {lotes
              .filter((l) => !fazendaId || String(l.fazenda_id ?? l.faz_id) === String(fazendaId))
              .map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
          <input className="ui-input" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          <input className="ui-input" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        </div>
      </Card>

      <AcoesRelatorio
        containerRef={containerRef}
        getTexto={() => gerarResumoPesagensTexto(linhas, { loteNome })}
        titulo="Relatório de Pesagens"
        nomeArquivo="relatorio-pesagens"
      />

      <div ref={containerRef}>
        <Card title="Pesagens no período">
          {!linhas.length ? (
            <EmptyState
              title="Ainda não há pesagens para este período."
              subtitle="Registre a primeira pesagem para acompanhar a evolução de peso."
              action={<Button size="sm" onClick={() => onNavigate?.('pesagens')}>Ir para Pesagens</Button>}
            />
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Lote</th>
                    <th>Peso médio</th>
                    <th>Variação</th>
                    <th>GMD entre pesagens</th>
                    <th>Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((linha) => (
                    <tr key={linha.id}>
                      <td>{formatDate(linha.data)}</td>
                      <td>{linha.loteNome}</td>
                      <td>{formatNumber(linha.pesoMedio, 1)} kg</td>
                      <td>{linha.variacao != null ? `${formatNumber(linha.variacao, 1)} kg` : '—'}</td>
                      <td>{linha.gmdEntrePesagens != null ? `${formatNumber(linha.gmdEntrePesagens, 2)} kg/dia` : '—'}</td>
                      <td>{linha.observacao || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
