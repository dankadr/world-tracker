import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FlagQuiz from '../FlagQuiz';

vi.mock('../GameTopBar', () => ({ default: () => <div data-testid="game-top-bar" /> }));
vi.mock('../GameResultScreen', () => ({ default: () => <div>Result</div> }));

vi.mock('../../../hooks/useGeographyGame', () => ({
  default: () => ({
    question: { id: 'FR', name: 'France', flag: '🇫🇷' },
    questionIndex: 0,
    total: 10,
    score: { correct: 0, incorrect: 0, skipped: 0 },
    timeLeft: null,
    status: 'playing',
    isCorrect: false,
    submit: vi.fn(),
    skip: vi.fn(),
    finish: vi.fn(),
  }),
}));

vi.mock('../../../utils/gameScores', () => ({
  saveHighScore: vi.fn(),
  isNewHighScore: vi.fn(() => false),
}));

vi.mock('../../../utils/gameAchievements', () => ({
  recordGameCompletion: vi.fn(),
}));

describe('FlagQuiz', () => {
  it('shows a "Name this country" label near the answer input', () => {
    render(<FlagQuiz onBack={vi.fn()} />);

    expect(screen.getByText(/name this country/i)).toBeInTheDocument();
  });
});
