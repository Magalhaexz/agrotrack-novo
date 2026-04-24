function IconeRanking({ index }) {
  return <span className={`ranking-badge ranking-badge--${index < 3 ? 'top' : 'default'}`}>#{index + 1}</span>;
}

export default function RankingLotes({ ranking = [] }) {
  if (!ranking.length) {
    return (
      <div className="ranking-card">
        <div className="ranking-card-header">
          <span className="ranking-kicker">Ranking</span>
          <h3>Ranking de lotes</h3>
        </div>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
          Nenhum dado disponivel para ranking.
        </p>
      </div>
    );
  }

  return (
    <div className="ranking-card">
      <div className="ranking-card-header">
        <span className="ranking-kicker">Ranking</span>
        <h3>Ranking de lotes</h3>
      </div>
      {ranking.map((item, index) => (
        <div className="ranking-item" key={`${item.metric}-${index}`}>
          <IconeRanking index={index} />
          <span className="ranking-metric">{item.metric}</span>
          <span className="ranking-lote">{item.lote}</span>
          <span className="ranking-valor">{item.valor}</span>
        </div>
      ))}
    </div>
  );
}
