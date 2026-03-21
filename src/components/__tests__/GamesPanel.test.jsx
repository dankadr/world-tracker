import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import GamesPanel from '../GamesPanel';

vi.mock('../games/MapQuiz', () => ({ default: ({ onQuit }) => <div><button onClick={onQuit}>Quit</button>Mock Map Quiz</div> }));
vi.mock('../games/FlagQuiz', () => ({ default: ({ onQuit }) => <div><button onClick={onQuit}>Quit</button>Mock Flag Quiz</div> }));
vi.mock('../games/CapitalQuiz', () => ({ default: ({ onQuit }) => <div><button onClick={onQuit}>Quit</button>Mock Capital Quiz</div> }));
vi.mock('../games/ShapeQuiz', () => ({ default: ({ onQuit }) => <div><button onClick={onQuit}>Quit</button>Mock Shape Quiz</div> }));

describe('GamesPanel', () => {
  it('opens the map quiz flow from the games hub', async () => {
    const user = userEvent.setup();

    render(<GamesPanel worldVisited={new Set()} />);

    expect(screen.getByTestId('games-panel')).toBeInTheDocument();

    await user.click(screen.getByTestId('play-map-quiz'));

    expect(screen.getByText('🗺️ Map Quiz')).toBeInTheDocument();

    await user.click(screen.getByTestId('map-config-start'));

    expect(screen.getByText('Mock Map Quiz')).toBeInTheDocument();
  });

  describe('Quit button behaviour', () => {
    it('calls onClose when Quit is clicked from a game on desktop (onClose provided)', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<GamesPanel worldVisited={new Set()} onClose={onClose} />);

      await user.click(screen.getByTestId('play-map-quiz'));
      await user.click(screen.getByTestId('map-config-start'));
      expect(screen.getByText('Mock Map Quiz')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Quit' }));

      expect(onClose).toHaveBeenCalledOnce();
    });

    it('returns to games home when Quit is clicked on mobile (no onClose)', async () => {
      const user = userEvent.setup();

      render(<GamesPanel worldVisited={new Set()} />);

      await user.click(screen.getByTestId('play-map-quiz'));
      await user.click(screen.getByTestId('map-config-start'));
      expect(screen.getByText('Mock Map Quiz')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Quit' }));

      expect(screen.getByTestId('games-panel')).toBeInTheDocument();
    });
  });
});
