import './games.css';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function GameTopBar({ questionIndex, total, score, timeLeft, onQuit }) {
  return (
    <div className="game-top-bar">
      <div className="game-top-bar-stats">
        <span>Q {questionIndex + 1}/{total}</span>
        <span className="game-top-bar-correct">✓ {score.correct}</span>
        <span className="game-top-bar-incorrect">✗ {score.incorrect}</span>
        {timeLeft !== null && (
          <span className={`game-top-bar-timer ${timeLeft <= 10 ? 'urgent' : ''}`}>
            ⏱ {formatTime(timeLeft)}
          </span>
        )}
      </div>
      <button className="game-quit-btn" onClick={onQuit}>Quit</button>
    </div>
  );
}
