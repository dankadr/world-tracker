import { useCallback, useEffect, useState } from 'react';
import Screen from './Screen';
import BucketListPanel from './BucketListPanel';

export default function BucketListScreen({ items = [], onUpdate, onDelete, onMarkVisited, onBack }) {
  const [localItems, setLocalItems] = useState(items);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const handleUpdate = useCallback((trackerId, regionId, updates) => {
    onUpdate?.(trackerId, regionId, updates);
    setLocalItems((prev) => prev.map((item) => (
      item.tracker_id === trackerId && item.region_id === regionId
        ? { ...item, ...updates }
        : item
    )));
  }, [onUpdate]);

  const handleDelete = useCallback((trackerId, regionId) => {
    onDelete?.(trackerId, regionId);
    setLocalItems((prev) => prev.filter((item) => !(item.tracker_id === trackerId && item.region_id === regionId)));
  }, [onDelete]);

  const handleMarkVisited = useCallback((trackerId, regionId) => {
    onMarkVisited?.(trackerId, regionId);
    setLocalItems((prev) => prev.filter((item) => !(item.tracker_id === trackerId && item.region_id === regionId)));
  }, [onMarkVisited]);

  return (
    <Screen title="Bucket List" onBack={onBack}>
      <BucketListPanel
        items={localItems}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onMarkVisited={handleMarkVisited}
      />
    </Screen>
  );
}
