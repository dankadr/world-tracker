import './games.css';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function GameResultScreen({ title, score, timeTaken, isNewBest, onPlayAgain, onBack }) {
  const total = score.correct + score.incorrect + score.skipped;
  const pct = total > 0 ? Math.round((score.correct / total) * 100) : 0;

  return (
    <div className="game-result-screen">
      <p className="game-result-title">{title} — Results</p>

      <div className="game-result-score">{score.correct}/{total}</div>
      <p className="game-result-pct">{pct}% correct · {formatTime(timeTaken ?? 0)}</p>

      <div className="game-result-breakdown">
        <div className="game-result-stat">
          <span className="game-result-stat-num" style={{ color: '#22c55e' }}>✓ {score.correct}</span>
          <span className="game-result-stat-label">correct</span>
        </div>
        <div className="game-result-stat">
          <span className="game-result-stat-num" style={{ color: '#ef4444' }}>✗ {score.incorrect}</span>
          <span className="game-result-stat-label">wrong</span>
        </div>
        <div className="game-result-stat">
          <span className="game-result-stat-num" style={{ color: '#f59e0b' }}>⤼ {score.skipped}</span>
          <span className="game-result-stat-label">skipped</span>
        </div>
      </div>

      {isNewBest && <div className="game-result-new-best">🏆 New best score!</div>}

      <div className="game-result-actions">
        <button className="game-btn game-btn-primary" onClick={onPlayAgain}>Play Again</button>
        <button className="game-btn game-btn-secondary" onClick={onBack}>Back to Games</button>
      </div>
    </div>
  );
}
