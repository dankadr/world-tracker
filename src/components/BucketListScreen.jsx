import Screen from './Screen';
import BucketListPanel from './BucketListPanel';

export default function BucketListScreen({
  onBack,
  items,
  onUpdate,
  onDelete,
  onMarkVisited,
}) {
  return (
    <Screen title="Bucket List" onBack={onBack} backLabel="Map">
      <BucketListPanel
        embedded
        items={items}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onMarkVisited={onMarkVisited}
      />
    </Screen>
  );
}
