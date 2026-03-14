import { forwardRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import WorldMap from '../WorldMap';
import { ThemeProvider } from '../../context/ThemeContext';

vi.mock('../MapLayerControl', () => ({ default: () => null, LAYERS: [{ light: 'light-0', dark: 'dark-0' }, { light: 'light-1', dark: 'dark-1' }] }));
vi.mock('../UnescoLayer', () => ({ default: () => null }));
vi.mock('../FriendOverlayLegend', () => ({ default: () => null }));
vi.mock('../ComparisonLegend', () => ({ default: () => null }));
vi.mock('../../utils/easterEggs', () => ({
  applyEasterEggModifications: (data) => data,
  isGreaterIsraelEnabled: () => false,
}));

vi.mock('leaflet', () => ({
  default: {
    DomEvent: { stopPropagation: () => {} },
  },
}));

vi.mock('react-leaflet', () => ({
  MapContainer: forwardRef(({ children, zoomControl, scrollWheelZoom, minZoom, maxZoom, worldCopyJump, maxBounds, maxBoundsViscosity, ...props }, ref) => (
    <div ref={ref} {...props}>{children}</div>
  )),
  TileLayer: () => null,
  Pane: ({ children }) => <div>{children}</div>,
  useMap: () => ({
    setView: () => {},
    fitBounds: () => {},
  }),
  GeoJSON: forwardRef(({ data, onEachFeature }, ref) => {
    if (ref && typeof ref === 'object') {
      ref.current = {
        eachLayer: () => {},
      };
    }
    const features = data.features.slice(0, 3);
    return (
      <div>
        {features.map((feature) => {
          const handlers = {};
          const element = {
            setAttribute: () => {},
            classList: {
              add: () => {},
              remove: () => {},
            },
            style: {},
          };
          const layer = {
            feature,
            options: {},
            setStyle: () => {},
            bindTooltip: () => {},
            bringToFront: () => {},
            getElement: () => element,
            on: (nextHandlers) => {
              Object.assign(handlers, nextHandlers);
            },
          };

          onEachFeature(feature, layer);
          handlers.add?.({ target: layer });

          return (
            <button
              key={feature.properties.id}
              onClick={() => handlers.click?.({ target: layer })}
            >
              {feature.properties.name}
            </button>
          );
        })}
      </div>
    );
  }),
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
