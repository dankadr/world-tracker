import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import useGeographyGame from '../../hooks/useGeographyGame';
import { saveHighScore, isNewHighScore } from '../../utils/gameScores';
import { recordGameCompletion } from '../../utils/gameAchievements';
import GameTopBar from './GameTopBar';
import GameResultScreen from './GameResultScreen';
import WorldMap from '../WorldMap';
import worldData from '../../data/world.json';
import continentMap from '../../config/continents.json';
import './games.css';

const CONTINENT_FILTER_KEYS = {
  africa: 'Africa',
  asia: 'Asia',
  europe: 'Europe',
  north_america: 'North America',
  south_america: 'South America',
  oceania: 'Oceania',
};

function buildPool(filter, worldVisited) {
  return worldData.features
    .filter(f => {
      const id = f.properties.id;
      if (filter === 'visited') return worldVisited.has(id);
      if (filter === 'unvisited') return !worldVisited.has(id);
      if (CONTINENT_FILTER_KEYS[filter]) return continentMap[id] === CONTINENT_FILTER_KEYS[filter];
      return true; // 'all'
    })
    .map(f => ({ id: f.properties.id, name: f.properties.name }));
}

function getScoreKey(filter) {
  return `map_${filter}`;
}

export default function MapQuiz({ filter = 'all', worldVisited = new Set(), onBack, onPlayAgain }) {
  const pool = useMemo(() => buildPool(filter, worldVisited), [filter, worldVisited]);
  const isNewBestRef = useRef(false);

  const [correctId, setCorrectId] = useState(null);
  const [incorrectId, setIncorrectId] = useState(null);

  const handleFinish = useCallback((score) => {
    const total = score.correct + score.incorrect + score.skipped;
    const pct = total > 0 ? Math.round((score.correct / total) * 100) : 0;
    const key = getScoreKey(filter);
    isNewBestRef.current = isNewHighScore(key, pct);
    saveHighScore(key, { correct: score.correct, total, pct });
    recordGameCompletion(getScoreKey(filter), pct);
  }, [filter]);

  const {
    question, questionIndex, total, score, timeLeft,
    status, isCorrect, submit, skip, finish,
  } = useGeographyGame(pool, { onFinish: handleFinish });

  // Clear highlights immediately when the question advances
  useEffect(() => {
    setCorrectId(null);
    setIncorrectId(null);
  }, [questionIndex]);

  // Keep a ref to always-fresh click state so handleCountryClick can be stable
  const clickStateRef = useRef({ status, question, submit });
  clickStateRef.current = { status, question, submit };

  // Stable callback — Leaflet registers this once at GeoJSON mount; the ref ensures
  // it always reads the current question and status, not a stale closure.
  const handleCountryClick = useCallback((clickedId) => {
    const { status: s, question: q, submit: sub } = clickStateRef.current;
    if (s !== 'playing' || !q) return;
    const correct = clickedId === q.id;
    if (correct) {
      setCorrectId(clickedId);
      setIncorrectId(null);
    } else {
      setIncorrectId(clickedId);
      setCorrectId(q.id);
    }
    sub(clickedId);
  }, []); // empty deps — stable reference, reads live state via ref

  if (status === 'finished') {
    return (
      <GameResultScreen
        title="Map Quiz"
        score={score}
        timeTaken={null}
        isNewBest={isNewBestRef.current}
        onPlayAgain={onPlayAgain}
        onBack={onBack}
      />
    );
  }

  if (!question) return null;

  const gameMode = useMemo(() => ({
    onCountryClick: handleCountryClick,
    targetId: question.id,
    correctId,
    incorrectId,
  }), [handleCountryClick, question.id, correctId, incorrectId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <GameTopBar
        questionIndex={questionIndex}
        total={total}
        score={score}
        timeLeft={timeLeft}
        onQuit={finish}
      />
      <div style={{
        position: 'absolute', top: 56, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.75)', color: '#fff', borderRadius: 10,
        padding: '8px 16px', fontSize: '0.9rem', fontWeight: 600, zIndex: 500,
        pointerEvents: 'none', whiteSpace: 'nowrap',
      }} data-testid="map-quiz-prompt">
        Find: {question.name}
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <WorldMap
          visited={new Set()}
          onToggle={() => {}}
          wishlist={new Set()}
          comparisonMode={false}
          gameMode={gameMode}
        />
      </div>
      {status === 'reviewing' && (
        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: isCorrect ? '#22c55e' : '#ef4444', color: '#fff',
          borderRadius: 10, padding: '10px 24px', fontWeight: 700, fontSize: '1rem', zIndex: 500,
        }}>
          {isCorrect ? '✓ Correct!' : `✗ ${question.name}`}
        </div>
      )}
    </div>
  );
}
