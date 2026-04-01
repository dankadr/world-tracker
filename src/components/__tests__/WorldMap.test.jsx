import { forwardRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WorldMap from '../WorldMap';
import { computeZoomFactor } from '../WorldMap';
import { ThemeProvider } from '../../context/ThemeContext';

const mockPane = vi.hoisted(() => ({ style: {} }));

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
    DomEvent: {
      stopPropagation: () => {},
      disableClickPropagation: () => {},
      disableScrollPropagation: () => {},
    },
    latLngBounds: () => ({
      extend: () => {},
      isValid: () => false,
    }),
  },
}));

vi.mock('react-leaflet', () => ({
  MapContainer: forwardRef(({ children, zoomControl, scrollWheelZoom, minZoom, maxZoom, worldCopyJump, maxBounds, maxBoundsViscosity, ...props }, ref) => (
    <div ref={ref} data-max-zoom={maxZoom} {...props}>{children}</div>
  )),
  TileLayer: () => null,
  Pane: ({ children }) => <div>{children}</div>,
  useMap: () => ({
    setView: () => {},
    fitBounds: () => {},
    getPane: () => mockPane,
    getZoom: () => 2,
    on: () => {},
    off: () => {},
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

describe('computeZoomFactor', () => {
  it('returns 1 at zoom 6 and below', () => {
    expect(computeZoomFactor(0)).toBe(1);
    expect(computeZoomFactor(6)).toBe(1);
  });

  it('returns 0 at zoom 10 and above', () => {
    expect(computeZoomFactor(10)).toBe(0);
    expect(computeZoomFactor(18)).toBe(0);
  });

  it('linearly fades between zoom 6 and 10', () => {
    expect(computeZoomFactor(8)).toBe(0.5);
    expect(computeZoomFactor(7)).toBe(0.75);
    expect(computeZoomFactor(9)).toBe(0.25);
  });
});

describe('OverlayFader wiring', () => {
  beforeEach(() => {
    // Reset shared pane between tests
    mockPane.style.opacity = undefined;
  });

  it('initializes pane to full opacity at low zoom (zoom 2)', () => {
    render(
      <ThemeProvider>
        <WorldMap visited={new Set()} onToggle={() => {}} wishlist={new Set()} comparisonMode={false} />
      </ThemeProvider>
    );
    // OverlayFader calls onZoomEnd() at mount; getZoom() mock returns 2 → factor = 1
    // Note: mock stores a number (1), not a DOM string ("1") — toBe(1) is correct for this mock
    expect(mockPane.style.opacity).toBe(1);
  });

  it('initializes pane to full opacity when game mode is active', () => {
    render(
      <ThemeProvider>
        <WorldMap
          visited={new Set()}
          onToggle={() => {}}
          wishlist={new Set()}
          comparisonMode={false}
          gameMode={{ targetId: 'fr', onCountryClick: () => {} }}
        />
      </ThemeProvider>
    );
    // Game mode branch sets opacity = 1; mock stores number, toBe(1) is correct
    expect(mockPane.style.opacity).toBe(1);
  });
});

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

  it('sets maxZoom to 18 on the map container', () => {
    const { container } = render(
      <ThemeProvider>
        <WorldMap
          visited={new Set()}
          onToggle={() => {}}
          wishlist={new Set()}
          comparisonMode={false}
        />
      </ThemeProvider>
    );
    expect(container.querySelector('[data-max-zoom]').dataset.maxZoom).toBe('18');
  });
});
