import Screen from './Screen';
import GamesPanel from './GamesPanel';

export default function GamesScreen({ worldVisited, onBack }) {
  return (
    <Screen title="Geography Games" onBack={onBack}>
      <GamesPanel worldVisited={worldVisited} />
    </Screen>
  );
}
