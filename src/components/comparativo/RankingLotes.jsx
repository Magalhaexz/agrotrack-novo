export default function RankingLotes({ ranking = [] }) {
  return (
    <div className="ranking-card">
      <h3 style={{ margin: '0 0 8px' }}>🏆 Ranking de Lotes</h3>
      {ranking.map((item) => (
        <div className="ranking-item" key={item.metric}>
          <span className="ranking-metric">{item.metric}</span>
          <span className="ranking-lote">{item.lote}</span>
          <span className="ranking-valor">{item.valor}</span>
        </div>
      ))}
    </div>
  );
}
