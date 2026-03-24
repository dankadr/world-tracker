import { useState } from 'react';
import { getHighScore } from '../utils/gameScores';
import MapQuiz from './games/MapQuiz';
import FlagQuiz from './games/FlagQuiz';
import CapitalQuiz from './games/CapitalQuiz';
import ShapeQuiz from './games/ShapeQuiz';
import './GamesPanel.css';

const MAP_FILTERS = [
  { key: 'all', label: 'All countries' },
  { key: 'visited', label: 'Countries I visited' },
  { key: 'unvisited', label: "Countries I haven't visited" },
  { key: 'europe', label: 'Europe only' },
  { key: 'africa', label: 'Africa only' },
  { key: 'asia', label: 'Asia only' },
  { key: 'north_america', label: 'North America only' },
  { key: 'south_america', label: 'South America only' },
  { key: 'oceania', label: 'Oceania only' },
];

const CAPITAL_SUBMODES = [
  { key: 'country_to_capital', label: 'Country → Capital (guess the capital)' },
  { key: 'capital_to_country', label: 'Capital → Country (guess the country)' },
];

function bestLabel(key) {
  const best = getHighScore(key);
  if (!best) return 'Not played yet';
  return `Best: ${best.pct}% (${best.correct}/${best.total})`;
}

function MapConfig({ onStart, onBack, title = '🗺️ Map Quiz' }) {
  const [filter, setFilter] = useState('all');
  return (
    <div className="game-config-screen" data-testid="map-config-screen">
      <button className="game-config-back" onClick={onBack}>← Back</button>
      <p className="game-config-title">{title}</p>
      <p className="game-config-label">Choose your question pool:</p>
      <div className="game-config-options">
        {MAP_FILTERS.map(f => (
          <button
            key={f.key}
            className={`game-config-option ${filter === f.key ? 'selected' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <button className="game-config-start" onClick={() => onStart(filter)} data-testid="map-config-start">Start Quiz</button>
    </div>
  );
}

function CapitalConfig({ onStart, onBack }) {
  const [subMode, setSubMode] = useState('country_to_capital');
  return (
    <div className="game-config-screen">
      <button className="game-config-back" onClick={onBack}>← Back</button>
      <p className="game-config-title">🏛️ Capital Quiz</p>
      <p className="game-config-label">Choose mode:</p>
      <div className="game-config-options">
        {CAPITAL_SUBMODES.map(s => (
          <button
            key={s.key}
            className={`game-config-option ${subMode === s.key ? 'selected' : ''}`}
            onClick={() => setSubMode(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <button className="game-config-start" onClick={() => onStart(subMode)}>Start Quiz</button>
    </div>
  );
}

export default function GamesPanel({ worldVisited, onClose }) {
  const [screen, setScreen] = useState('home');
  const [mapFilter, setMapFilter] = useState('all');
  const [capitalSubMode, setCapitalSubMode] = useState('country_to_capital');
  const [shapeFilter, setShapeFilter] = useState('all');
  const [gameKey, setGameKey] = useState(0);

  const handleBack = () => { setScreen('home'); setGameKey(0); };
  const handleQuit = onClose ?? handleBack;
  const handlePlayAgain = () => setGameKey(k => k + 1);

  if (screen === 'map-config') return <MapConfig onBack={handleBack} onStart={f => { setMapFilter(f); setScreen('map'); }} />;
  if (screen === 'capital-config') return <CapitalConfig onBack={handleBack} onStart={s => { setCapitalSubMode(s); setScreen('capital'); }} />;
  if (screen === 'map') return <MapQuiz key={gameKey} filter={mapFilter} worldVisited={worldVisited} onBack={handleBack} onQuit={handleQuit} onPlayAgain={handlePlayAgain} />;
  if (screen === 'flag') return <FlagQuiz key={gameKey} onBack={handleBack} onQuit={handleQuit} onPlayAgain={handlePlayAgain} />;
  if (screen === 'capital') return <CapitalQuiz key={gameKey} subMode={capitalSubMode} onBack={handleBack} onQuit={handleQuit} onPlayAgain={handlePlayAgain} />;
  if (screen === 'shape-config') return <MapConfig title="🌍 Shape Quiz" onBack={handleBack} onStart={f => { setShapeFilter(f); setScreen('shape'); }} />;
  if (screen === 'shape') return <ShapeQuiz key={gameKey} filter={shapeFilter} worldVisited={worldVisited} onBack={handleBack} onQuit={handleQuit} onPlayAgain={handlePlayAgain} />;

  return (
    <div className="games-panel" data-testid="games-panel">
      {onClose && (
        <button className="games-panel-close" onClick={onClose}>✕</button>
      )}
      <h1 className="games-panel-title">🎮 Geography Games</h1>
      <p className="games-panel-subtitle">Test your geography knowledge</p>
      <div className="games-grid">
        <div className="game-card">
          <span className="game-card-icon">🗺️</span>
          <span className="game-card-title">Map Quiz</span>
          <span className="game-card-desc">Click the highlighted country on a blank map</span>
          <span className="game-card-best">{bestLabel('map_all')}</span>
          <button className="game-card-play" onClick={() => setScreen('map-config')} data-testid="play-map-quiz">Play</button>
        </div>
        <div className="game-card">
          <span className="game-card-icon">🏳️</span>
          <span className="game-card-title">Flag Quiz</span>
          <span className="game-card-desc">Guess the country from its flag</span>
          <span className="game-card-best">{bestLabel('flag')}</span>
          <button className="game-card-play" onClick={() => setScreen('flag')}>Play</button>
        </div>
        <div className="game-card">
          <span className="game-card-icon">🏛️</span>
          <span className="game-card-title">Capital Quiz</span>
          <span className="game-card-desc">Match countries with their capitals</span>
          <span className="game-card-best">{bestLabel('capital_country_to_capital')}</span>
          <button className="game-card-play" onClick={() => setScreen('capital-config')}>Play</button>
        </div>
        <div className="game-card">
          <span className="game-card-icon">🌍</span>
          <span className="game-card-title">Shape Quiz</span>
          <span className="game-card-desc">Name the highlighted country on the map</span>
          <span className="game-card-best">{bestLabel('shape_all')}</span>
          <button className="game-card-play" onClick={() => setScreen('shape-config')}>Play</button>
        </div>
      </div>
    </div>
  );
}
