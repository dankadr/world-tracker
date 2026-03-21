import { useState, useMemo } from 'react';
import BucketListItem from './BucketListItem';
import countries from '../data/countries';
import { countryList } from '../data/countries';
import worldData from '../data/world.json';

const TABS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'priority', label: 'High Priority' },
  { id: 'all', label: 'All' },
];

const SORT_OPTIONS = [
  { id: 'date', label: 'By date' },
  { id: 'priority', label: 'By priority' },
  { id: 'tracker', label: 'By tracker' },
  { id: 'newest', label: 'Newest first' },
];

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

// Build a lookup for region names
function getRegionName(trackerId, regionId) {
  if (trackerId === 'world') {
    const feature = worldData.features.find((f) => f.properties.id === regionId);
    return feature?.properties?.name || regionId;
  }
  const country = countries[trackerId];
  if (!country) return regionId;
  const feature = country.data?.features?.find((f) => f.properties.id === regionId);
  return feature?.properties?.name || regionId;
}

function getTrackerInfo(trackerId) {
  if (trackerId === 'world') return { name: 'World', flag: '🌍' };
  const c = countryList.find((c) => c.id === trackerId);
  return c ? { name: c.name, flag: c.flag } : { name: trackerId, flag: '🌐' };
}

export default function BucketListPanel({ items, onUpdate, onDelete, onMarkVisited, onClose, embedded = false }) {
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState('priority');
  const [filterTracker, setFilterTracker] = useState('all');

  // Get unique trackers in the list
  const trackers = useMemo(() => {
    const set = new Set(items.map((i) => i.tracker_id));
    return Array.from(set).map((id) => ({ id, ...getTrackerInfo(id) }));
  }, [items]);

  // Filter items by tab and tracker
  const filteredItems = useMemo(() => {
    let filtered = [...items];

    // Filter by tracker
    if (filterTracker !== 'all') {
      filtered = filtered.filter((i) => i.tracker_id === filterTracker);
    }

    // Filter by tab
    if (activeTab === 'upcoming') {
      filtered = filtered.filter((i) => i.target_date);
    } else if (activeTab === 'priority') {
      filtered = filtered.filter((i) => i.priority === 'high');
    }

    const effectiveSort = activeTab === 'upcoming' ? 'date' : sortBy;

    // Sort
    if (effectiveSort === 'date') {
      filtered.sort((a, b) => {
        if (!a.target_date && !b.target_date) return 0;
        if (!a.target_date) return 1;
        if (!b.target_date) return -1;
        return a.target_date.localeCompare(b.target_date);
      });
    } else if (effectiveSort === 'priority') {
      filtered.sort((a, b) => (PRIORITY_ORDER[a.priority] || 1) - (PRIORITY_ORDER[b.priority] || 1));
    } else if (effectiveSort === 'tracker') {
      filtered.sort((a, b) => a.tracker_id.localeCompare(b.tracker_id));
    } else if (effectiveSort === 'newest') {
      filtered.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    }

    return filtered;
  }, [items, activeTab, sortBy, filterTracker]);

  // Stats
  const highCount = items.filter((i) => i.priority === 'high').length;
  const upcomingCount = items.filter((i) => i.target_date).length;

  return (
    <div className="bucket-panel">
      <div className="bucket-panel-header">
        <div className="bucket-panel-title-row">
          <h2 className="bucket-panel-title">Bucket List</h2>
          {!embedded && onClose && (
            <button className="modal-close" onClick={onClose}>&times;</button>
          )}
        </div>
        <div className="bucket-panel-stats">
          <span className="bucket-stat">{items.length} places</span>
          <span className="bucket-stat-sep">·</span>
          <span className="bucket-stat">{highCount} high</span>
          <span className="bucket-stat-sep">·</span>
          <span className="bucket-stat">{upcomingCount} dated</span>
        </div>
      </div>

      <div className="bucket-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`bucket-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.id === 'upcoming' && upcomingCount > 0 && (
              <span className="bucket-tab-count">{upcomingCount}</span>
            )}
            {tab.id === 'priority' && highCount > 0 && (
              <span className="bucket-tab-count">{highCount}</span>
            )}
            {tab.id === 'all' && items.length > 0 && (
              <span className="bucket-tab-count">{items.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="bucket-controls">
        <select
          className="bucket-sort-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        {trackers.length > 1 && (
          <select
            className="bucket-filter-select"
            value={filterTracker}
            onChange={(e) => setFilterTracker(e.target.value)}
          >
            <option value="all">All trackers</option>
            {trackers.map((t) => (
              <option key={t.id} value={t.id}>{t.flag} {t.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="bucket-list">
        {filteredItems.length === 0 ? (
          <div className="bucket-empty">
            <span className="bucket-empty-icon" aria-hidden="true">○</span>
            <p className="bucket-empty-text">
              {activeTab === 'upcoming'
                ? 'No upcoming trips planned yet'
                : activeTab === 'priority'
                ? 'No high priority items'
                : 'Your bucket list is empty'}
            </p>
            <p className="bucket-empty-hint">
              {items.length === 0
                ? 'Click the ☆ star on any region to add it here!'
                : 'Try a different filter'}
            </p>
          </div>
        ) : (
          activeTab === 'all' && filterTracker === 'all' ? (
            Object.entries(
              filteredItems.reduce((acc, item) => {
                const key = item.tracker_id;
                if (!acc[key]) acc[key] = [];
                acc[key].push(item);
                return acc;
              }, {})
            ).map(([trackerId, groupItems]) => {
              const tracker = getTrackerInfo(trackerId);
              return (
                <div key={trackerId} className="bucket-group">
                  <div className="bucket-group-header">
                    <span className="bucket-group-flag">{tracker.flag}</span>
                    <span className="bucket-group-name">{tracker.name}</span>
                    <span className="bucket-group-count">{groupItems.length}</span>
                  </div>
                  <div className="bucket-group-items">
                    {groupItems.map((item) => (
                      <BucketListItem
                        key={`${item.tracker_id}-${item.region_id}`}
                        item={item}
                        regionName={getRegionName(item.tracker_id, item.region_id)}
                        trackerFlag={tracker.flag}
                        onUpdate={onUpdate}
                        onDelete={onDelete}
                        onMarkVisited={onMarkVisited}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            filteredItems.map((item) => {
              const tracker = getTrackerInfo(item.tracker_id);
              return (
                <BucketListItem
                  key={`${item.tracker_id}-${item.region_id}`}
                  item={item}
                  regionName={getRegionName(item.tracker_id, item.region_id)}
                  trackerFlag={tracker.flag}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  onMarkVisited={onMarkVisited}
                />
              );
            })
          )
        )}
      </div>
    </div>
  );
}
