import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import useGeographyGame from '../../hooks/useGeographyGame';
import { checkTextAnswer } from '../../utils/gameAnswers';
import { saveHighScore, isNewHighScore } from '../../utils/gameScores';
import { recordGameCompletion } from '../../utils/gameAchievements';
import GameTopBar from './GameTopBar';
import AnswerInput from './AnswerInput';
import GameResultScreen from './GameResultScreen';
import WorldMap from '../WorldMap';
import worldData from '../../data/world.json';
import continentMap from '../../config/continents.json';
import './games.css';

const EMPTY_SET = new Set();
const EMPTY_VISITED = new Set();
const EMPTY_WISHLIST = new Set();

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
      return true;
    })
    .map(f => ({ id: f.properties.id, name: f.properties.name }));
}

function getScoreKey(filter) {
  return `shape_${filter}`;
}

export default function ShapeQuiz({ filter = 'all', worldVisited = EMPTY_SET, onBack, onQuit, onPlayAgain }) {
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
    recordGameCompletion(key, pct);
  }, [filter]);

  const {
    question, questionIndex, total, score, timeLeft,
    status, isCorrect, submit, skip, finish,
  } = useGeographyGame(pool, { onFinish: handleFinish });

  // Clear highlights when question advances
  useEffect(() => {
    setCorrectId(null);
    setIncorrectId(null);
  }, [questionIndex]);

  // Stable submit ref so handleTextSubmit has empty deps
  const submitStateRef = useRef({ question, submit, pool });
  submitStateRef.current = { question, submit, pool };

  const handleTextSubmit = useCallback((text) => {
    const { question: q, submit: sub, pool: p } = submitStateRef.current;
    if (!q) return;
    const match = p.find(c => checkTextAnswer(text, c.name));
    const correct = match?.id === q.id;
    if (correct) {
      setCorrectId(q.id);
      setIncorrectId(null);
    } else {
      setIncorrectId(q.id);
      setCorrectId(null);
    }
    sub(match?.id ?? null);
  }, []);

  const gameMode = useMemo(() => ({
    targetId: question?.id ?? null,
    revealTarget: true,
    correctId,
    incorrectId,
    onCountryClick: null,
  }), [question?.id, correctId, incorrectId]);

  if (status === 'finished') {
    return (
      <GameResultScreen
        title="Shape Quiz"
        score={score}
        timeTaken={null}
        isNewBest={isNewBestRef.current}
        onPlayAgain={onPlayAgain}
        onBack={onBack}
      />
    );
  }

  if (!question) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <GameTopBar
        questionIndex={questionIndex}
        total={total}
        score={score}
        timeLeft={timeLeft}
        onQuit={onQuit ?? onBack}
      />
      <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <WorldMap
            visited={EMPTY_VISITED}
            onToggle={() => {}}
            wishlist={EMPTY_WISHLIST}
            comparisonMode={false}
            gameMode={gameMode}
          />
        </div>
      </div>
      <div style={{ padding: '12px 16px 20px', background: 'var(--bg, #fff)' }}>
        {status === 'reviewing' && (
          <div style={{
            textAlign: 'center', fontWeight: 700, fontSize: '1rem', marginBottom: 10,
            color: isCorrect ? '#22c55e' : '#ef4444',
          }}>
            {isCorrect ? '✓ Correct!' : `✗ ${question.name}`}
          </div>
        )}
        <AnswerInput
          candidates={pool}
          nameKey="name"
          onSubmit={handleTextSubmit}
          onSkip={skip}
          disabled={status === 'reviewing'}
          dropUp
        />
      </div>
    </div>
  );
}
