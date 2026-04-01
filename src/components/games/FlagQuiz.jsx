import { useCallback, useMemo, useRef } from 'react';
import useGeographyGame from '../../hooks/useGeographyGame';
import { checkTextAnswer } from '../../utils/gameAnswers';
import { saveHighScore, isNewHighScore } from '../../utils/gameScores';
import { recordGameCompletion } from '../../utils/gameAchievements';
import GameTopBar from './GameTopBar';
import AnswerInput from './AnswerInput';
import GameResultScreen from './GameResultScreen';
import worldData from '../../data/world.json';
import './games.css';

function countryCodeToFlag(code) {
  return code.toUpperCase().split('').map(c =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  ).join('');
}

function buildPool() {
  return worldData.features.map(f => ({
    id: f.properties.id,
    name: f.properties.name,
    flag: countryCodeToFlag(f.properties.id),
  }));
}

const SCORE_KEY = 'flag';

export default function FlagQuiz({ onBack, onQuit, onPlayAgain }) {
  const pool = useMemo(() => buildPool(), []);
  const isNewBestRef = useRef(false);

  const handleFinish = useCallback((score) => {
    const total = score.correct + score.incorrect + score.skipped;
    const pct = total > 0 ? Math.round((score.correct / total) * 100) : 0;
    isNewBestRef.current = isNewHighScore(SCORE_KEY, pct);
    saveHighScore(SCORE_KEY, { correct: score.correct, total, pct });
    recordGameCompletion('flag', pct);
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
    return (
      <GameResultScreen
        title="Flag Quiz"
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <GameTopBar
        questionIndex={questionIndex}
        total={total}
        score={score}
        timeLeft={timeLeft}
        onQuit={onQuit ?? onBack}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', gap: 20 }}>
        <div style={{ fontSize: '5rem', lineHeight: 1 }}>{question.flag}</div>
        {status === 'reviewing' && (
          <div
            data-testid="flag-quiz-feedback"
            role="status"
            aria-live="polite"
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.1rem', fontWeight: 600, color: isCorrect ? '#22c55e' : '#ef4444', textAlign: 'center' }}
          >
            {!isCorrect && <span aria-hidden="true" style={{ fontSize: '1.5rem', lineHeight: 1 }}>{question.flag}</span>}
            <span>{isCorrect ? 'Correct!' : `Incorrect — ${question.name}`}</span>
          </div>
        )}
        <div style={{ width: '100%', maxWidth: 400 }}>
          <p
            data-testid="flag-quiz-prompt"
            style={{ textAlign: 'center', margin: '0 0 8px', fontSize: '0.95rem', color: 'var(--text-secondary, #6b7280)' }}
          >
            <span style={{ fontSize: '1.6rem', verticalAlign: 'middle', marginRight: 6 }}>{question.flag}</span>
            Name this country:
          </p>
          <AnswerInput
            candidates={pool.map(({ id, name }) => ({ id, name }))}
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
