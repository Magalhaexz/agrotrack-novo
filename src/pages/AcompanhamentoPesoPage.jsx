import { useMemo, useState } from 'react';
import PesoChart from '../components/PesoChart';
import { formatarNumero, formatarData } from '../utils/formatters';
import { calcularDias } from '../utils/calculations'; // Importado de utils

/**
 * Componente para a página de acompanhamento de peso dos lotes.
 * Exibe a evolução do peso médio por lote, histórico detalhado e KPIs.
 *
 * @param {object} props - As propriedades do componente.
 * @param {object} props.db - O objeto do banco de dados contendo lotes e pesagens.
 */
export default function AcompanhamentoPesoPage({ db }) {
  const lotes = db?.lotes || [];
  const pesagens = db?.pesagens || [];

  // Estado para o lote atualmente selecionado no filtro
  const [loteSelecionado, setLoteSelecionado] = useState(
    lotes.length ? String(lotes[0].id) : ''
  );

  // Memoriza o objeto do lote selecionado
  const loteAtual = useMemo(() => {
    return lotes.find((item) => String(item.id) === String(loteSelecionado));
  }, [lotes, loteSelecionado]);

  // Memoriza as pesagens filtradas para o lote selecionado e as ordena por data
  const pesagensLote = useMemo(() => {
    return pesagens
      .filter((item) => String(item.lote_id) === String(loteSelecionado))
      .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()); // Usar getTime() para comparação robusta
  }, [pesagens, loteSelecionado]);

  // Memoriza o resumo dos dados de pesagem (primeira, última, ganho total, GMD)
  const resumo = useMemo(() => {
    if (!pesagensLote.length) {
      return {
        primeiraPesagem: null,
        ultimaPesagem: null,
        ganhoTotal: 0,
        dias: 0,
        gmd: 0,
      };
    }

    const primeira = pesagensLote[0];
    const ultima = pesagensLote[pesagensLote.length - 1];

    const ganhoTotal =
      Number(ultima.peso_medio || 0) - Number(primeira.peso_medio || 0);

    const dias = calcularDias(primeira.data, ultima.data);
    const gmd = dias > 0 ? ganhoTotal / dias : 0;

    return {
      primeiraPesagem: primeira,
      ultimaPesagem: ultima,
      ganhoTotal,
      dias,
      gmd,
    };
  }, [pesagensLote]);

  return (
    <div className="page">
      <div className="page-header page-topbar">
        <div>
          <h1>Acompanhamento de Peso</h1>
          <p>Evolução do peso médio por lote, com histórico e ganho diário.</p>
        </div>

        <div className="page-topbar-actions">
          <select
            value={loteSelecionado}
            onChange={(e) => setLoteSelecionado(e.target.value)}
            className="filtro-select"
          >
            {lotes.map((lote) => (
              <option key={lote.id} value={lote.id}>
                {lote.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="kpi-grid-3">
        <div className="kpi-card">
          <div className="kpi-label">Primeira pesagem</div>
          <div className="kpi-value">
            {resumo.primeiraPesagem
              ? `${formatarNumero(resumo.primeiraPesagem.peso_medio)} kg`
              : '—'}
          </div>
          <div className="kpi-sub">
            {resumo.primeiraPesagem
              ? formatarData(resumo.primeiraPesagem.data)
              : 'sem dados'}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Última pesagem</div>
          <div className="kpi-value">
            {resumo.ultimaPesagem
              ? `${formatarNumero(resumo.ultimaPesagem.peso_medio)} kg`
              : '—'}
          </div>
          <div className="kpi-sub">
            {resumo.ultimaPesagem
              ? formatarData(resumo.ultimaPesagem.data)
              : 'sem dados'}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Ganho total</div>
          <div className="kpi-value">
            {pesagensLote.length ? `${formatarNumero(resumo.ganhoTotal)} kg` : '—'}
          </div>
          <div className="kpi-sub">
            {resumo.dias > 0
              ? `${resumo.dias} dias · GMD ${formatarNumero(resumo.gmd)} kg/dia`
              : 'dados insuficientes'}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="fazendas-card">
          <div className="fazendas-card-header">
            <span className="fazendas-card-title">
              Evolução do lote {loteAtual?.nome || '—'}
            </span>
          </div>

          <div className="card-body">
            <PesoChart
              data={pesagensLote}
              metaGmd={loteAtual?.gmd_meta || 0}
            />
          </div>
        </div>

        <div className="fazendas-card">
          <div className="fazendas-card-header">
            <span className="fazendas-card-title">Resumo do lote</span>
          </div>

          <div className="card-body">
            <div className="peso-summary-grid">
              <div className="peso-summary-card">
                <div className="peso-summary-value">{pesagensLote.length}</div>
                <div className="peso-summary-label">Pesagens</div>
                <div className="peso-summary-desc">registros do lote</div>
              </div>

              <div className="peso-summary-card">
                <div className="peso-summary-value">{resumo.dias}</div>
                <div className="peso-summary-label">Dias</div>
                <div className="peso-summary-desc">
                  entre 1ª e última pesagem
                </div>
              </div>

              <div className="peso-summary-card">
                <div className="peso-summary-value">
                  {formatarNumero(resumo.gmd)}
                </div>
                <div className="peso-summary-label">GMD</div>
                <div className="peso-summary-desc">kg por dia</div>
              </div>

              <div className="peso-summary-card">
                <div className="peso-summary-value">
                  {loteAtual?.gmd_meta
                    ? formatarNumero(loteAtual.gmd_meta)
                    : '0,00'}
                </div>
                <div className="peso-summary-label">Meta GMD</div>
                <div className="peso-summary-desc">meta do lote</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fazendas-card" style={{ marginTop: 24 }}>
        <div className="fazendas-card-header">
          <span className="fazendas-card-title">Histórico detalhado</span>
        </div>

        <div className="fazendas-table-wrap">
          {pesagensLote.length === 0 ? (
            <div className="empty-box">
              <strong>Este lote ainda não possui pesagens.</strong>
              <span>Cadastre pesagens para acompanhar a evolução.</span>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Peso médio</th>
                  <th>Variação</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {pesagensLote.map((item, index) => {
                  const anterior = index > 0 ? pesagensLote[index - 1] : null;
                  const variacao = anterior
                    ? Number(item.peso_medio || 0) -
                      Number(anterior.peso_medio || 0)
                    : null;

                  return (
                    <tr key={item.id}>
                      <td>{formatarData(item.data)}</td>
                      <td className="text-h">
                        {formatarNumero(item.peso_medio)} kg
                      </td>
                      <td>{renderVariacao(variacao)}</td>
                      <td>{item.observacao || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Renderiza a variação de peso com um badge colorido.
 * @param {number|null|undefined} variacao - A variação de peso.
 * @returns {JSX.Element|string} Um elemento span com badge ou um traço.
 */
function renderVariacao(variacao) {
  if (variacao === null || variacao === undefined) return '—';

  if (variacao > 0) {
    return (
      <span className="badge badge-g">
        +{formatarNumero(variacao)} kg
      </span>
    );
  }

  if (variacao < 0) {
    return (
      <span className="badge badge-r">
        {formatarNumero(variacao)} kg
      </span>
    );
  }

  return <span className="badge badge-a">0,00 kg</span>;
}