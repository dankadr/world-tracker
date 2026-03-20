import './ExplorationDepthLegend.css';

const LIGHT_STOPS = ['#cfd8dc', '#f5e8c0', '#e8c96a', '#c9a84c', '#b8943a'];
const DARK_STOPS = ['#3a3a3a', '#5a4a1a', '#8a6a1a', '#c9a84c', '#f0cc60'];

const LABELS = ['Unvisited', 'Exploring (1–33%)', 'Halfway (34–66%)', 'Mastered (67–100%)'];

export default function ExplorationDepthLegend({ darkMode }) {
  const stops = darkMode ? DARK_STOPS : LIGHT_STOPS;
  // stops[0] is unvisited, stops[1-4] are the 4 depth bands
  const entries = [
    { color: stops[0], label: LABELS[0] },
    { color: stops[1], label: LABELS[1] },
    { color: stops[2], label: LABELS[2] },  // "halfway" starts at stop 2 (index 1 in depth range)
    { color: stops[4], label: LABELS[3] },  // mastered = last stop
  ];

  return (
    <div className="depth-legend" role="complementary" aria-label="Exploration depth legend">
      <div className="depth-legend-title">Exploration Depth</div>
      {entries.map(({ color, label }) => (
        <div key={label} className="depth-legend-row">
          <span
            className="depth-legend-swatch"
            style={{ background: color }}
            aria-hidden="true"
          />
          <span className="depth-legend-label">{label}</span>
        </div>
      ))}
    </div>
  );
}
