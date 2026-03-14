import Screen from './Screen';
import StatsModal from './StatsModal';

export default function StatsScreen({ onBack }) {
  return (
    <Screen title="Travel Stats" onBack={onBack} backLabel="Map">
      <StatsModal embedded hideHeader onClose={onBack} />
    </Screen>
  );
}
