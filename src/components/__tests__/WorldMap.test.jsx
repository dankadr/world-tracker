import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import WorldMap from '../WorldMap';
import { ThemeProvider } from '../../context/ThemeContext';

vi.mock('../MapLayerControl', () => ({ default: () => null }));
vi.mock('../UnescoLayer', () => ({ default: () => null }));
vi.mock('../FriendOverlayLegend', () => ({ default: () => null }));
vi.mock('../ComparisonLegend', () => ({ default: () => null }));

vi.mock('leaflet', () => ({
  default: {
    DomEvent: { stopPropagation: () => {} },
  },
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="world-map">{children}</div>,
  TileLayer: () => null,
  Pane: ({ children }) => <div>{children}</div>,
  useMap: () => ({
    setView: () => {},
    invalidateSize: () => {},
    eachLayer: () => {},
  }),
  GeoJSON: ({ data, onEachFeature }) => {
    const features = data.features.slice(0, 3);
    return (
      <div>
        {features.map((feature) => {
          const handlers = {};
          const layer = {
            options: {},
            setStyle: () => {},
            bindTooltip: () => {},
            on: (event, callback) => {
              handlers[event] = callback;
            },
          };
          onEachFeature(feature, layer);
          return (
            <button
              key={feature.properties.id}
              onClick={() => handlers.click?.({})}
            >
              {feature.properties.name}
            </button>
          );
        })}
      </div>
    );
  },
}));

describe('WorldMap', () => {
  it('toggles a country when a map feature is clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <ThemeProvider>
        <WorldMap
          visited={new Set()}
          onToggle={onToggle}
          wishlist={new Set()}
          comparisonMode={false}
        />
      </ThemeProvider>
    );

    await user.click(screen.getAllByRole('button')[0]);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
