<<<<<<< HEAD
import { useMemo } from 'react';
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
import Card from '../ui/Card';
import { formatCurrency, formatDate } from '../../utils/calculations';

export default function RelatorioSanitario({ db, dataInicio, dataFim, loteIds = [] }) {
  const inicio = dataInicio || '0000-01-01';
  const fim = dataFim || '9999-12-31';
<<<<<<< HEAD

  const mapaLotes = useMemo(() =>
    Object.fromEntries((db.lotes || []).map((l) => [l.id, l])),
    [db.lotes]
  );

  const registros = useMemo(() =>
    (db.sanitario || []).filter((item) => {
      const dataBase = item.data_aplic || item.proxima || '';
      const okData = dataBase >= inicio && dataBase <= fim;
      const okLote = loteIds.length === 0 || loteIds.includes(String(item.lote_id));
      return okData && okLote;
    }),
    [db.sanitario, inicio, fim, loteIds]
  );

  const concluidos = useMemo(() =>
    registros.filter((r) => r.data_aplic).length,
    [registros]
  );

  const pendentes = registros.length - concluidos;

  const gastoTotal = useMemo(() =>
    registros.reduce((acc, item) => acc + Number(item.custo || 0), 0),
    [registros]
  );

  return (
    <div style={{ display: 'grid', gap: 16 }}>

      <Card title="Resumo sanitário">
        <p>Vacinas e tratamentos: <strong>{registros.length}</strong></p>
        <p>
          Calendário cumprido x pendente:{' '}
          <strong style={{ color: 'var(--color-success)' }}>{concluidos}</strong>
          {' x '}
          <strong style={{ color: pendentes > 0 ? 'var(--color-danger)' : 'inherit' }}>
            {pendentes}
          </strong>
        </p>
        <p>Gastos sanitários: <strong>{formatCurrency(gastoTotal)}</strong></p>
      </Card>

      <Card title="Vacinas e tratamentos no período">
        {registros.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
            Nenhum registro sanitário no período selecionado.
          </p>
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Descrição</th>
                  <th>Lote</th>
                  <th>Aplicação</th>
                  <th>Próxima</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((item) => {
                  const nomeLote = mapaLotes[item.lote_id]?.nome || '—';
                  const concluido = Boolean(item.data_aplic);

                  return (
                    <tr key={item.id}>
                      <td>{item.tipo || '—'}</td>
                      <td>{item.desc || item.descricao || '—'}</td>
                      <td>{nomeLote}</td>
                      <td>{formatDate(item.data_aplic) || '—'}</td>
                      <td>{formatDate(item.proxima) || '—'}</td>
                      <td>
                        <span className={concluido ? 'badge-ativo' : 'badge-inativo'}>
                          {concluido ? 'Concluído' : 'Pendente'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

    </div>
  );
}
=======
  const registros = (db.sanitario || []).filter((item) => {
    const dataBase = item.data_aplic || item.proxima || '';
    const okData = dataBase >= inicio && dataBase <= fim;
    const okLote = loteIds.length === 0 || loteIds.includes(String(item.lote_id));
    return okData && okLote;
  });

  const concluidos = registros.filter((r) => r.data_aplic).length;
  const pendentes = registros.length - concluidos;
  const gastoTotal = registros.reduce((acc, item) => acc + Number(item.custo || 0), 0);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card title="Resumo sanitário">
        <p>Vacinas e tratamentos: <strong>{registros.length}</strong></p>
        <p>Calendário cumprido x pendente: <strong>{concluidos}</strong> x <strong>{pendentes}</strong></p>
        <p>Gastos sanitários: <strong>{formatCurrency(gastoTotal)}</strong></p>
      </Card>
      <Card title="Vacinas e tratamentos no período">
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead><tr><th>Tipo</th><th>Descrição</th><th>Lote</th><th>Aplicação</th><th>Próxima</th></tr></thead>
            <tbody>
              {registros.map((item) => (
                <tr key={item.id}>
                  <td>{item.tipo}</td>
                  <td>{item.desc}</td>
                  <td>{item.lote_id}</td>
                  <td>{formatDate(item.data_aplic)}</td>
                  <td>{formatDate(item.proxima)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
