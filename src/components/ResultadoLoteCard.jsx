import { calcularResultadoLote } from '../domain/calculos';
import { formatarNumero } from '../utils/formatters';

// Props:
// db: objeto de banco em memória
// lote: { id, nome, qtd, status }
export default function ResultadoLoteCard({ db, lote }) {
  const resultado = calcularResultadoLote(db, lote.id);
  const situacao = obterSituacao(resultado.lucroTotal);

  return (
    <div className="fazendas-card" style={{ marginBottom: 16 }}>
      <div className="fazendas-card-header">
        <span className="fazendas-card-title">Resultado financeiro — {lote.nome}</span>
      </div>

      <div className="card-body">
        <div className="kpi-grid-3">
          <div className="kpi-card">
            <div className="kpi-label">Receita total</div>
            <div className="kpi-value">R$ {formatarNumero(resultado.receitaTotal)}</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">Custo total</div>
            <div className="kpi-value">R$ {formatarNumero(resultado.custoTotal)}</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">Lucro total</div>
            <div
              className="kpi-value"
              style={{ color: resultado.lucroTotal >= 0 ? '#8ad879' : '#ff8a8a' }}
            >
              R$ {formatarNumero(resultado.lucroTotal)}
            </div>
          </div>
        </div>

        <div className="kpi-grid-3" style={{ marginTop: 12 }}>
          <div className="kpi-card">
            <div className="kpi-label">Lucro por cabeça</div>
            <div className="kpi-value">R$ {formatarNumero(resultado.lucroporCabeca)}</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">Lucro por @</div>
            <div className="kpi-value">R$ {formatarNumero(resultado.lucroPorArroba)}</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">Situação</div>
            <div className="kpi-value" style={{ fontSize: 24 }}>
              {situacao}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function obterSituacao(lucroTotal) {
  if (lucroTotal > 0) return 'Lucrativo';
  if (lucroTotal < 0) return 'No prejuízo';
  return 'Em andamento';
}
