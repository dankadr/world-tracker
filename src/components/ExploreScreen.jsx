import { useState } from 'react';
import GamesPanel from './GamesPanel';
import WorldSidebar from './WorldSidebar';
import './ExploreScreen.css';

export default function ExploreScreen({ worldVisited, onToggleWorld, onExploreCountry }) {
  const [tab, setTab] = useState('games');

  return (
    <div className="tab-screen explore-screen">
      <div className="explore-seg-header">
        <div className="explore-seg-control" role="tablist" aria-label="Explore navigation">
          <button
            role="tab"
            aria-selected={tab === 'games'}
            className={`explore-seg-btn${tab === 'games' ? ' active' : ''}`}
            onClick={() => setTab('games')}
          >
            Games
          </button>
          <button
            role="tab"
            aria-selected={tab === 'discover'}
            className={`explore-seg-btn${tab === 'discover' ? ' active' : ''}`}
            onClick={() => setTab('discover')}
          >
            Discover
          </button>
        </div>
      </div>

      {/* Both panes stay mounted to preserve game state mid-round */}
      <div className="explore-tab-pane" style={tab !== 'games' ? { display: 'none' } : undefined}>
        <GamesPanel worldVisited={worldVisited} />
      </div>
      <div className="explore-tab-pane" style={tab !== 'discover' ? { display: 'none' } : undefined}>
        <WorldSidebar
          visited={worldVisited}
          onToggle={onToggleWorld}
          onExploreCountry={onExploreCountry}
          collapsed={false}
        />
      </div>
    </div>
  );
}
