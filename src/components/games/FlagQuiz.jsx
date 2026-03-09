import { useCallback, useMemo } from 'react';
import useGeographyGame from '../../hooks/useGeographyGame';
import { checkTextAnswer } from '../../utils/gameAnswers';
import { getHighScore, saveHighScore, isNewHighScore } from '../../utils/gameScores';
import GameTopBar from './GameTopBar';
import AnswerInput from './AnswerInput';
import GameResultScreen from './GameResultScreen';
import worldData from '../../data/world.json';
import countriesConfig from '../../config/countries.json';
import './games.css';

// Build flag lookup: id → flag emoji
// countries.json is an array: [{ id, name, flag, ... }]
const FLAG_MAP = {};
countriesConfig.forEach(c => { if (c.id && c.flag) FLAG_MAP[c.id] = c.flag; });

function buildPool() {
  return worldData.features.map(f => ({
    id: f.properties.id,
    name: f.properties.name,
    flag: FLAG_MAP[f.properties.id] || '🏳️',
  }));
}

const SCORE_KEY = 'flag';

export default function FlagQuiz({ onBack }) {
  const pool = useMemo(() => buildPool(), []);

  const handleFinish = useCallback((score) => {
    const total = score.correct + score.incorrect + score.skipped;
    const pct = total > 0 ? Math.round((score.correct / total) * 100) : 0;
    saveHighScore(SCORE_KEY, { correct: score.correct, total, pct });
  }, []);

  const {
    question, questionIndex, total, score, timeLeft,
    status, isCorrect, submit, skip, finish,
  } = useGeographyGame(pool, { onFinish: handleFinish });

  const handleTextSubmit = useCallback((text) => {
    const match = pool.find(c => checkTextAnswer(text, c.name));
    submit(match?.id ?? text);
  }, [pool, submit]);

  if (status === 'finished') {
    const t = score.correct + score.incorrect + score.skipped;
    const pct = t > 0 ? Math.round((score.correct / t) * 100) : 0;
    const newBest = isNewHighScore(SCORE_KEY, pct);
    return (
      <GameResultScreen
        title="Flag Quiz"
        score={score}
        timeTaken={null}
        isNewBest={newBest}
        onPlayAgain={() => window.location.reload()}
        onBack={onBack}
      />
    );
  }

  if (!question) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <GameTopBar
        questionIndex={questionIndex}
        total={total}
        score={score}
        timeLeft={timeLeft}
        onQuit={finish}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', gap: 24 }}>
        <div style={{ fontSize: '6rem', lineHeight: 1 }}>{question.flag}</div>
        {status === 'reviewing' && (
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: isCorrect ? '#22c55e' : '#ef4444', textAlign: 'center' }}>
            {isCorrect ? '✓ Correct!' : `✗ ${question.name}`}
          </div>
        )}
        <div style={{ width: '100%', maxWidth: 400 }}>
          <AnswerInput
            candidates={pool}
            nameKey="name"
            onSubmit={handleTextSubmit}
            onSkip={skip}
            disabled={status === 'reviewing'}
          />
        </div>
      </div>
    </div>
  );
}
