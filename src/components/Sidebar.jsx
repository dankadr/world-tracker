import { countryList } from '../data/countries';
import AuthButton from './AuthButton';

export default function Sidebar({
  country,
  visited,
  onToggle,
  onReset,
  onCountryChange,
}) {
  const regionList = country.data.features
    .map((f) => ({ id: f.properties.id, name: f.properties.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const total = regionList.length;
  const count = visited.size;
  const pct = Math.round((count / total) * 100);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">Travel Tracker</h1>
        <p className="sidebar-subtitle">Mark the places you've been</p>
      </div>

      <AuthButton />

      <nav className="country-tabs">
        {countryList.map((c) => (
          <button
            key={c.id}
            className={`country-tab ${c.id === country.id ? 'active' : ''}`}
            onClick={() => onCountryChange(c.id)}
            title={c.name}
          >
            <span className="tab-flag">{c.flag}</span>
            <span className="tab-name">{c.name}</span>
          </button>
        ))}
      </nav>

      <div className="stats-card" style={{ '--accent': country.visitedColor }}>
        <div className="stats-numbers">
          <span className="stats-count">{count}</span>
          <span className="stats-separator">/</span>
          <span className="stats-total">{total}</span>
        </div>
        <p className="stats-label">{country.regionLabel.toLowerCase()} visited</p>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${country.visitedColor}, ${country.visitedHover})`,
            }}
          />
        </div>
        <p className="stats-pct" style={{ color: country.visitedColor }}>
          {pct}%
        </p>
      </div>

      <div className="canton-list">
        <h2 className="list-heading">All {country.regionLabel}</h2>
        <ul>
          {regionList.map(({ id, name }) => {
            const isVisited = visited.has(id);
            return (
              <li key={id} className="canton-item">
                <label
                  className={`canton-label ${isVisited ? 'visited' : ''}`}
                  style={isVisited ? { '--visit-bg': country.visitedColor + '18', '--visit-bg-hover': country.visitedColor + '28', '--visit-color': country.visitedHover } : {}}
                >
                  <input
                    type="checkbox"
                    checked={isVisited}
                    onChange={() => onToggle(id)}
                    style={{ accentColor: country.visitedColor }}
                  />
                  <span className="canton-abbr">{id}</span>
                  <span className="canton-name">{name}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <button className="reset-btn" onClick={onReset}>
        Reset {country.regionLabel}
      </button>
    </aside>
  );
}
