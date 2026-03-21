import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MapQuiz from '../MapQuiz';

// WorldMap needs Leaflet which doesn't run in jsdom; capture the gameMode prop for assertions
let capturedGameMode = null;
vi.mock('../../WorldMap', () => ({
  default: (props) => {
    capturedGameMode = props.gameMode;
    return <div data-testid="world-map" />;
  },
}));
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
  it('outer container uses height:100% so it fills its containing block', () => {
    const { container } = render(
      <MapQuiz worldVisited={new Set()} onBack={vi.fn()} />,
    );

    const root = container.firstChild;
    expect(root.style.height).toBe('100%');
  });
});

describe('MapQuiz answer reveal', () => {
  it('passes targetId to WorldMap but keeps revealTarget false during playing state', () => {
    render(<MapQuiz worldVisited={new Set()} onBack={vi.fn()} />);
    // targetId stays set so the map can zoom to the region and data-game-target is on the SVG path
    expect(capturedGameMode?.targetId).toBe('FR');
    // But the blue colour must be suppressed until the user has answered
    expect(capturedGameMode?.revealTarget).toBe(false);
  });
});
