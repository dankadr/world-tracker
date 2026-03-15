import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MapQuiz from '../MapQuiz';

// WorldMap needs Leaflet which doesn't run in jsdom
vi.mock('../../WorldMap', () => ({ default: () => <div data-testid="world-map" /> }));
vi.mock('../GameTopBar', () => ({ default: () => <div data-testid="game-top-bar" /> }));
vi.mock('../GameResultScreen', () => ({ default: () => <div>Result</div> }));

vi.mock('../../../hooks/useGeographyGame', () => ({
  default: () => ({
    question: { id: 'FR', name: 'France' },
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

describe('MapQuiz layout', () => {
  it('outer container uses flex:1 so it fills its flex parent', () => {
    const { container } = render(
      <MapQuiz worldVisited={new Set()} onBack={vi.fn()} />,
    );

    const root = container.firstChild;
    // jsdom expands `flex: 1` to the canonical shorthand `1 1 0%`
    expect(root.style.flex).toMatch(/^1/);
  });
});
