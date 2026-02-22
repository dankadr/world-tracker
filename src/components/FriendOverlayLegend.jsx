import { useMemo } from 'react';

export default function FriendOverlayLegend({ friendOverlayData }) {
  const friendsList = useMemo(() => {
    return Object.entries(friendOverlayData).map(([id, data]) => ({
      id,
      name: data.name || 'Friend',
      color: data.color,
    }));
  }, [friendOverlayData]);

  if (friendsList.length === 0) return null;

  return (
    <div className="friend-overlay-legend">
      <div className="friend-legend-title">👥 Friends</div>
      {friendsList.map((f) => (
        <div key={f.id} className="friend-legend-item">
          <span
            className="friend-legend-dot"
            style={{ backgroundColor: f.color }}
          />
          <span className="friend-legend-name">{f.name}</span>
        </div>
      ))}
    </div>
  );
}
