import { useState } from 'react';
import { getHighScore } from '../utils/gameScores';
import MapQuiz from './games/MapQuiz';
import FlagQuiz from './games/FlagQuiz';
import CapitalQuiz from './games/CapitalQuiz';
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

function MapConfig({ onStart, onBack }) {
  const [filter, setFilter] = useState('all');
  return (
    <div className="game-config-screen">
      <button className="game-config-back" onClick={onBack}>← Back</button>
      <p className="game-config-title">🗺️ Map Quiz</p>
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
      <button className="game-config-start" onClick={() => onStart(filter)}>Start Quiz</button>
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

export default function GamesPanel({ worldVisited }) {
  const [screen, setScreen] = useState('home');
  const [mapFilter, setMapFilter] = useState('all');
  const [capitalSubMode, setCapitalSubMode] = useState('country_to_capital');

  const handleBack = () => setScreen('home');

  if (screen === 'map-config') return <MapConfig onBack={handleBack} onStart={f => { setMapFilter(f); setScreen('map'); }} />;
  if (screen === 'capital-config') return <CapitalConfig onBack={handleBack} onStart={s => { setCapitalSubMode(s); setScreen('capital'); }} />;
  if (screen === 'map') return <MapQuiz filter={mapFilter} worldVisited={worldVisited} onBack={handleBack} />;
  if (screen === 'flag') return <FlagQuiz onBack={handleBack} />;
  if (screen === 'capital') return <CapitalQuiz subMode={capitalSubMode} onBack={handleBack} />;

  return (
    <div className="games-panel">
      <h1 className="games-panel-title">🎮 Geography Games</h1>
      <p className="games-panel-subtitle">Test your geography knowledge</p>
      <div className="games-grid">
        <div className="game-card">
          <span className="game-card-icon">🗺️</span>
          <span className="game-card-title">Map Quiz</span>
          <span className="game-card-desc">Click the highlighted country on a blank map</span>
          <span className="game-card-best">{bestLabel('map_all')}</span>
          <button className="game-card-play" onClick={() => setScreen('map-config')}>Play</button>
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
      </div>
    </div>
  );
}
