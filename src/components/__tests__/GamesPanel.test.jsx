import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import GamesPanel from '../GamesPanel';

vi.mock('../games/MapQuiz', () => ({ default: () => <div>Mock Map Quiz</div> }));
vi.mock('../games/FlagQuiz', () => ({ default: () => <div>Mock Flag Quiz</div> }));
vi.mock('../games/CapitalQuiz', () => ({ default: () => <div>Mock Capital Quiz</div> }));
vi.mock('../games/ShapeQuiz', () => ({ default: () => <div>Mock Shape Quiz</div> }));

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
});
