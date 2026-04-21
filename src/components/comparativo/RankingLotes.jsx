<<<<<<< HEAD
const MEDALHAS = ['🥇', '🥈', '🥉'];

function IconeRanking({ index }) {
  if (index < 3) {
    return <span className="ranking-medalha">{MEDALHAS[index]}</span>;
  }
  return <span className="ranking-posicao">{index + 1}º</span>;
}

export default function RankingLotes({ ranking = [] }) {
  if (!ranking.length) {
    return (
      <div className="ranking-card">
        <h3 style={{ margin: '0 0 8px' }}>🏆 Ranking de Lotes</h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
          Nenhum dado disponível para ranking.
        </p>
      </div>
    );
  }

  return (
    <div className="ranking-card">
      <h3 style={{ margin: '0 0 8px' }}>🏆 Ranking de Lotes</h3>
      {ranking.map((item, index) => (
        <div className="ranking-item" key={`${item.metric}-${index}`}>
          <IconeRanking index={index} />
=======
export default function RankingLotes({ ranking = [] }) {
  return (
    <div className="ranking-card">
      <h3 style={{ margin: '0 0 8px' }}>🏆 Ranking de Lotes</h3>
      {ranking.map((item) => (
        <div className="ranking-item" key={item.metric}>
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
          <span className="ranking-metric">{item.metric}</span>
          <span className="ranking-lote">{item.lote}</span>
          <span className="ranking-valor">{item.valor}</span>
        </div>
      ))}
    </div>
  );
<<<<<<< HEAD
}
=======
}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
