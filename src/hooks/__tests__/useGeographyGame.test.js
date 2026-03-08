import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useGeographyGame from '../useGeographyGame';

const POOL = [
  { id: 'fr', name: 'France' },
  { id: 'de', name: 'Germany' },
  { id: 'es', name: 'Spain' },
];

describe('useGeographyGame', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts in playing status with first question from pool', () => {
    const { result } = renderHook(() => useGeographyGame(POOL, {}));
    expect(result.current.status).toBe('playing');
    expect(result.current.questionIndex).toBe(0);
    expect(result.current.total).toBe(3);
    expect(POOL.map(p => p.id)).toContain(result.current.question.id);
  });

  it('correct submit increments correct score and enters reviewing', () => {
    const { result } = renderHook(() => useGeographyGame(POOL, {}));
    const id = result.current.question.id;
    act(() => { result.current.submit(id); });
    expect(result.current.isCorrect).toBe(true);
    expect(result.current.score.correct).toBe(1);
    expect(result.current.status).toBe('reviewing');
  });

  it('wrong submit increments incorrect score and enters reviewing', () => {
    const { result } = renderHook(() => useGeographyGame(POOL, {}));
    act(() => { result.current.submit('xx'); });
    expect(result.current.isCorrect).toBe(false);
    expect(result.current.score.incorrect).toBe(1);
    expect(result.current.status).toBe('reviewing');
  });

  it('wrong submit auto-advances after 1200ms reviewing', () => {
    const { result } = renderHook(() => useGeographyGame(POOL, {}));
    act(() => { result.current.submit('xx'); });
    expect(result.current.questionIndex).toBe(0);
    act(() => { vi.advanceTimersByTime(1200); });
    expect(result.current.questionIndex).toBe(1);
    expect(result.current.status).toBe('playing');
    expect(result.current.isCorrect).toBeNull();
  });

  it('advances to next question after 1200ms reviewing', () => {
    const { result } = renderHook(() => useGeographyGame(POOL, {}));
    act(() => { result.current.submit(result.current.question.id); });
    expect(result.current.questionIndex).toBe(0);
    act(() => { vi.advanceTimersByTime(1200); });
    expect(result.current.questionIndex).toBe(1);
    expect(result.current.status).toBe('playing');
  });

  it('skip increments skipped score and advances', () => {
    const { result } = renderHook(() => useGeographyGame(POOL, {}));
    act(() => { result.current.skip(); });
    act(() => { vi.advanceTimersByTime(1200); });
    expect(result.current.score.skipped).toBe(1);
    expect(result.current.questionIndex).toBe(1);
  });

  it('finishes after all questions answered', () => {
    const onFinish = vi.fn();
    const { result } = renderHook(() => useGeographyGame(POOL, { onFinish }));
    for (let i = 0; i < 3; i++) {
      act(() => { result.current.submit(result.current.question.id); });
      act(() => { vi.advanceTimersByTime(1200); });
    }
    expect(result.current.status).toBe('finished');
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ correct: 3 }));
  });

  it('finish() forces end immediately', () => {
    const onFinish = vi.fn();
    const { result } = renderHook(() => useGeographyGame(POOL, { onFinish }));
    act(() => { result.current.finish(); });
    expect(result.current.status).toBe('finished');
    expect(onFinish).toHaveBeenCalled();
  });

  it('counts down timeLeft and finishes when it hits 0', () => {
    const onFinish = vi.fn();
    const { result } = renderHook(() => useGeographyGame(POOL, { timeLimit: 5, onFinish }));
    expect(result.current.timeLeft).toBe(5);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current.status).toBe('finished');
    expect(onFinish).toHaveBeenCalled();
  });

  it('timeLeft is null when no timeLimit provided', () => {
    const { result } = renderHook(() => useGeographyGame(POOL, {}));
    expect(result.current.timeLeft).toBeNull();
  });

  // Fix 4a: empty pool → immediately finished
  it('empty pool starts with status finished', () => {
    const onFinish = vi.fn();
    const { result } = renderHook(() => useGeographyGame([], { onFinish }));
    expect(result.current.status).toBe('finished');
    expect(result.current.question).toBeNull();
  });

  it('empty pool calls onFinish on mount with zeroed score', () => {
    const onFinish = vi.fn();
    renderHook(() => useGeographyGame([], { onFinish }));
    expect(onFinish).toHaveBeenCalledWith({ correct: 0, incorrect: 0, skipped: 0 });
  });

  // Fix 4b: double-submit guard — second call in same tick is ignored
  it('double submit in same tick only counts one incorrect', () => {
    const { result } = renderHook(() => useGeographyGame(POOL, {}));
    act(() => {
      result.current.submit('xx');
      result.current.submit('xx'); // second call should be a no-op (status is 'reviewing')
    });
    expect(result.current.score.incorrect).toBe(1);
  });

  // Fix 4c: onFinish receives full { correct, incorrect, skipped } shape
  it('onFinish receives complete score with correct, incorrect, and skipped counts', () => {
    const onFinish = vi.fn();
    const { result } = renderHook(() => useGeographyGame(POOL, { onFinish }));

    // skip first question
    act(() => { result.current.skip(); });
    act(() => { vi.advanceTimersByTime(1200); });

    // answer second question incorrectly
    act(() => { result.current.submit('xx'); });
    act(() => { vi.advanceTimersByTime(1200); });

    // answer third question correctly
    act(() => { result.current.submit(result.current.question.id); });
    act(() => { vi.advanceTimersByTime(1200); });

    expect(result.current.status).toBe('finished');
    expect(onFinish).toHaveBeenCalledWith({
      correct: 1,
      incorrect: 1,
      skipped: 1,
    });
  });
});
