import GamesPanel from './GamesPanel';
import './ExploreScreen.css';

export default function ExploreScreen({ worldVisited }) {
  return (
    <div className="tab-screen explore-screen">
      <GamesPanel worldVisited={worldVisited} />
    </div>
  );
}
