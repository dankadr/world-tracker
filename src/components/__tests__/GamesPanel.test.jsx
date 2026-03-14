import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import GamesPanel from '../GamesPanel';

vi.mock('../games/MapQuiz', () => ({ default: () => <div>Mock Map Quiz</div> }));
vi.mock('../games/FlagQuiz', () => ({ default: () => <div>Mock Flag Quiz</div> }));
vi.mock('../games/CapitalQuiz', () => ({ default: () => <div>Mock Capital Quiz</div> }));
vi.mock('../games/ShapeQuiz', () => ({ default: () => <div>Mock Shape Quiz</div> }));

describe('GamesPanel', () => {
  it('opens map quiz flow from the games hub', async () => {
    const user = userEvent.setup();
    render(<GamesPanel worldVisited={new Set()} />);

    expect(screen.getByText('🎮 Geography Games')).toBeInTheDocument();

    const mapCard = screen.getByText('Map Quiz').closest('.game-card');
    await user.click(mapCard.querySelector('.game-card-play'));

    expect(screen.getByText('🗺️ Map Quiz')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Quiz' }));

    expect(screen.getByText('Mock Map Quiz')).toBeInTheDocument();
  });
});
