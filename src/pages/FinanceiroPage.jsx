import { useMemo } from 'react';
import { calcularResultadoLote } from '../domain/calculos';
import { formatarNumero } from '../utils/formatters';
import { STATUS_LOTE } from '../utils/constantes';

export default function FinanceiroPage({ db }) {
  const lotes = db?.lotes || [];

  const linhas = useMemo(() => {
    return lotes
      .map((lote) => ({
        lote,
        resultado: calcularResultadoLote(db, lote.id),
      }))
      .sort((a, b) => b.resultado.lucroTotal - a.resultado.lucroTotal);
  }, [db, lotes]);

  const totais = useMemo(() => {
    return linhas.reduce(
      (acc, linha) => ({
        custo: acc.custo + Number(linha.resultado.custoTotal || 0),
        receita: acc.receita + Number(linha.resultado.receitaTotal || 0),
        lucro: acc.lucro + Number(linha.resultado.lucroTotal || 0),
      }),
      { custo: 0, receita: 0, lucro: 0 }
    );
  }, [linhas]);

  return (
    <div className="page">
      <div className="page-header page-topbar">
        <div>
          <h1>Financeiro</h1>
          <p>Resultado consolidado por lote com custo, receita e lucro.</p>
        </div>
      </div>

      <div className="fazendas-card">
        <div className="fazendas-card-header">
          <span className="fazendas-card-title">Financeiro por lote</span>
        </div>

        <div className="fazendas-table-wrap">
          {linhas.length === 0 ? (
            <div className="empty-box">
              <strong>Nenhum lote encontrado.</strong>
              <span>Cadastre lotes para acompanhar o resultado financeiro.</span>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Status</th>
                  <th>Custo total</th>
                  <th>Receita total</th>
                  <th>Lucro total</th>
                  <th>Lucro/cabeça</th>
                  <th>Lucro/@</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(({ lote, resultado }) => (
                  <tr key={lote.id}>
                    <td className="text-h">{lote.nome}</td>
                    <td>{normalizarStatus(lote.status)}</td>
                    <td>R$ {formatarNumero(resultado.custoTotal)}</td>
                    <td>R$ {formatarNumero(resultado.receitaTotal)}</td>
                    <td
                      style={{
                        color: resultado.lucroTotal >= 0 ? '#8ad879' : '#ff8a8a',
                        fontWeight: 700,
                      }}
                    >
                      R$ {formatarNumero(resultado.lucroTotal)}
                    </td>
                    <td>R$ {formatarNumero(resultado.lucroporCabeca)}</td>
                    <td>R$ {formatarNumero(resultado.lucroPorArroba)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} style={{ fontWeight: 700 }}>Total</td>
                  <td style={{ fontWeight: 700 }}>R$ {formatarNumero(totais.custo)}</td>
                  <td style={{ fontWeight: 700 }}>R$ {formatarNumero(totais.receita)}</td>
                  <td
                    style={{
                      fontWeight: 700,
                      color: totais.lucro >= 0 ? '#8ad879' : '#ff8a8a',
                    }}
                  >
                    R$ {formatarNumero(totais.lucro)}
                  </td>
                  <td>—</td>
                  <td>—</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}


function normalizarStatus(status) {
  return STATUS_LOTE[status] || 'Sem status';
}
