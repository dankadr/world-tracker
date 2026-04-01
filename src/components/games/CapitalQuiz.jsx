import { useCallback, useMemo, useRef } from 'react';
import useGeographyGame from '../../hooks/useGeographyGame';
import { checkTextAnswer } from '../../utils/gameAnswers';
import { saveHighScore, isNewHighScore } from '../../utils/gameScores';
import { recordGameCompletion } from '../../utils/gameAchievements';
import GameTopBar from './GameTopBar';
import AnswerInput from './AnswerInput';
import GameResultScreen from './GameResultScreen';
import capitalsData from '../../data/capitals.json';
import worldData from '../../data/world.json';
import './games.css';

// Build country name lookup: id → name
const COUNTRY_NAME = {};
worldData.features.forEach(f => { COUNTRY_NAME[f.properties.id] = f.properties.name; });

function buildPool(subMode) {
  // capitals.json is a GeoJSON FeatureCollection with .features array
  const features = capitalsData.features ?? capitalsData;
  return features
    .filter(f => {
      const countryId = f.properties?.country ?? f.country;
      return !!COUNTRY_NAME[countryId];
    })
    .map(f => {
      const capitalName = f.properties?.name ?? f.name;
      const countryId = f.properties?.country ?? f.country;
      const countryName = COUNTRY_NAME[countryId];
      const prompt = subMode === 'country_to_capital' ? countryName : capitalName;
      const answer = subMode === 'country_to_capital' ? capitalName : countryName;
      return {
        id: countryId,
        capitalName,
        countryId,
        countryName,
        prompt,
        answer,
      };
    });
}

export default function CapitalQuiz({ subMode = 'country_to_capital', onBack, onQuit, onPlayAgain }) {
  const pool = useMemo(() => buildPool(subMode), [subMode]);
  const scoreKey = `capital_${subMode}`;
  const isNewBestRef = useRef(false);

  // Set id = answer text so hook's id comparison works for text matching
  const enginePool = useMemo(() => pool.map(p => ({ ...p, id: p.answer })), [pool]);

  const handleFinish = useCallback((score) => {
    const total = score.correct + score.incorrect + score.skipped;
    const pct = total > 0 ? Math.round((score.correct / total) * 100) : 0;
    isNewBestRef.current = isNewHighScore(scoreKey, pct);
    saveHighScore(scoreKey, { correct: score.correct, total, pct });
    recordGameCompletion(scoreKey, pct);
  }, [scoreKey]);

  const {
    question, questionIndex, total, score, timeLeft,
    status, isCorrect, submit, skip, finish,
  } = useGeographyGame(enginePool, { onFinish: handleFinish });

  const candidates = useMemo(() =>
    pool.map(p => ({ id: p.answer, name: p.answer })),
  [pool]);

  const handleTextSubmit = useCallback((text) => {
    if (!question) return;
    const match = candidates.find(c => checkTextAnswer(text, c.name));
    submit(match?.id ?? text);
  }, [question, candidates, submit]);

  if (status === 'finished') {
    return (
      <GameResultScreen
        title={subMode === 'country_to_capital' ? 'Capital Quiz' : 'Country Quiz'}
        score={score}
        timeTaken={null}
        isNewBest={isNewBestRef.current}
        onPlayAgain={onPlayAgain}
        onBack={onBack}
      />
    );
  }

  if (!question) return null;

  const promptLabel = subMode === 'country_to_capital'
    ? 'What is the capital of'
    : 'Which country has capital';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <GameTopBar
        questionIndex={questionIndex}
        total={total}
        score={score}
        timeLeft={timeLeft}
        onQuit={onQuit ?? onBack}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', gap: 24 }}>
        <p style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '0.9rem', margin: 0 }}>{promptLabel}</p>
        <div style={{ fontSize: '1.8rem', fontWeight: 700, textAlign: 'center', color: 'var(--text, #1a1a1a)' }}>
          {question.prompt}
        </div>
        {status === 'reviewing' && (
          <div role="status" aria-live="polite" style={{ fontSize: '1.1rem', fontWeight: 600, color: isCorrect ? '#22c55e' : '#ef4444', textAlign: 'center' }}>
            {isCorrect ? 'Correct!' : `Incorrect — ${question.answer}`}
          </div>
        )}
        <div style={{ width: '100%', maxWidth: 400 }}>
          <AnswerInput
            candidates={candidates}
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
