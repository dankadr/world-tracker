import { useState, useEffect, useRef, useCallback } from 'react';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function useGeographyGame(pool, { timeLimit = null, onFinish } = {}) {
  const [questions] = useState(() => shuffle(pool));
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState({ correct: 0, incorrect: 0, skipped: 0 });
  // Fix 2: start as 'finished' immediately when pool is empty
  const [status, setStatus] = useState(() => pool.length === 0 ? 'finished' : 'playing');
  const [isCorrect, setIsCorrect] = useState(null);
  const [lastCorrectAnswer, setLastCorrectAnswer] = useState(null);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const onFinishRef = useRef(onFinish);
  useEffect(() => { onFinishRef.current = onFinish; }, [onFinish]);

  // Fix 2: call onFinish once on mount when pool is empty
  useEffect(() => {
    if (pool.length === 0) {
      onFinishRef.current?.({ correct: 0, incorrect: 0, skipped: 0 });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep refs to mutable values the timer needs without causing re-registration
  const scoreRef = useRef(score);
  useEffect(() => { scoreRef.current = score; }, [score]);
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);

  // Fix 1: ref to track the reviewing setTimeout so we can clear it on unmount
  const reviewTimeoutRef = useRef(null);
  useEffect(() => () => {
    if (reviewTimeoutRef.current) clearTimeout(reviewTimeoutRef.current);
  }, []);

  // Synchronous flag to prevent double-submit within the same render tick.
  // statusRef alone can't block this because useEffect syncs it after render.
  const isSubmittingRef = useRef(false);

  // Global countdown timer — use setInterval so it keeps ticking within a single act() call
  useEffect(() => {
    if (timeLimit === null) return;
    const id = setInterval(() => {
      if (statusRef.current === 'finished') {
        clearInterval(id);
        return;
      }
      // Fix 3: pause decrement while reviewing
      if (statusRef.current === 'reviewing') return;
      setTimeLeft(prev => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(id);
          setStatus('finished');
          onFinishRef.current?.(scoreRef.current);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timeLimit]); // eslint-disable-line react-hooks/exhaustive-deps

  const advance = useCallback((nextScore) => {
    setQuestionIndex(i => {
      const next = i + 1;
      if (next >= questions.length) {
        setStatus('finished');
        onFinishRef.current?.(nextScore);
      } else {
        setStatus('playing');
        setIsCorrect(null);
        setLastCorrectAnswer(null);
      }
      return next >= questions.length ? i : next;
    });
  }, [questions.length]);

  const submit = useCallback((answer) => {
    if (statusRef.current !== 'playing' || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    const question = questions[questionIndex];
    const correct = String(answer).trim().toLowerCase() === String(question.id).toLowerCase();
    const nextScore = {
      ...score,
      correct: score.correct + (correct ? 1 : 0),
      incorrect: score.incorrect + (correct ? 0 : 1),
    };
    setScore(nextScore);
    setIsCorrect(correct);
    setLastCorrectAnswer(correct ? null : question);
    setStatus('reviewing');
    // Fix 1: store timeout ref so it can be cleared on unmount
    reviewTimeoutRef.current = setTimeout(() => {
      isSubmittingRef.current = false;
      advance(nextScore);
    }, 1200);
  }, [questions, questionIndex, score, advance]);

  const skip = useCallback(() => {
    if (statusRef.current !== 'playing' || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    const nextScore = { ...score, skipped: score.skipped + 1 };
    setScore(nextScore);
    setIsCorrect(null);
    setLastCorrectAnswer(null);
    setStatus('reviewing');
    // Fix 1: store timeout ref so it can be cleared on unmount
    reviewTimeoutRef.current = setTimeout(() => {
      isSubmittingRef.current = false;
      advance(nextScore);
    }, 1200);
  }, [score, advance]);

  const finish = useCallback(() => {
    setStatus('finished');
    onFinishRef.current?.(score);
  }, [score]);

  return {
    question: questions[questionIndex] ?? null,
    questionIndex,
    total: questions.length,
    score,
    timeLeft,
    status,
    isCorrect,
    lastCorrectAnswer,
    submit,
    skip,
    finish,
  };
}
