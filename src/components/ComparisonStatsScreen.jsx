import Screen from './Screen';
import ComparisonStats from './ComparisonStats';

export default function ComparisonStatsScreen({
  onBack,
  myVisited,
  friendVisited,
  total,
  friendName,
  friendPicture,
  regionLabel,
}) {
  return (
    <Screen title="Comparison" onBack={onBack} backLabel="Map">
      <ComparisonStats
        embedded
        myVisited={myVisited}
        friendVisited={friendVisited}
        total={total}
        friendName={friendName}
        friendPicture={friendPicture}
        regionLabel={regionLabel}
        onClose={onBack}
      />
    </Screen>
  );
}
