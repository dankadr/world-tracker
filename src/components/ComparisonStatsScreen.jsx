import Screen from './Screen';
import ComparisonStats from './ComparisonStats';

export default function ComparisonStatsScreen({
  myVisited,
  friendVisited,
  total,
  friendName,
  friendPicture,
  regionLabel,
  onBack,
}) {
  return (
    <Screen title="Comparison" onBack={onBack}>
      <ComparisonStats
        myVisited={myVisited}
        friendVisited={friendVisited}
        total={total}
        friendName={friendName}
        friendPicture={friendPicture}
        regionLabel={regionLabel}
        embedded
        showCloseButton={false}
      />
    </Screen>
  );
}
