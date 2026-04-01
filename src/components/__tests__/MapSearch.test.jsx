import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import MapSearch from '../MapSearch';

const {
  fitBounds,
  flyTo,
  disableClickPropagation,
  disableScrollPropagation,
} = vi.hoisted(() => ({
  fitBounds: vi.fn(),
  flyTo: vi.fn(),
  disableClickPropagation: vi.fn(),
  disableScrollPropagation: vi.fn(),
}));

vi.mock('react-leaflet', () => ({
  useMap: () => ({
    fitBounds,
    flyTo,
  }),
}));

vi.mock('leaflet', () => ({
  default: {
    DomEvent: {
      disableClickPropagation,
      disableScrollPropagation,
    },
  },
}));

describe('MapSearch', () => {
  function renderSearch(options = {}) {
    const franceLayer = {
      feature: { properties: { id: 'fr' } },
      getBounds: () => 'france-bounds',
    };

    const geoJsonRef = options.geoJsonRef ?? {
      current: {
        eachLayer: (callback) => {
          callback(franceLayer);
        },
      },
    };

    const searchWorldData = options.searchWorldData ?? {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: 'fr', name: 'France' },
          geometry: { type: 'Polygon', coordinates: [] },
        },
      ],
    };

    return render(<MapSearch geoJsonRef={geoJsonRef} searchWorldData={searchWorldData} />);
  }

  it('searches visible world data and fits bounds for a selected country', async () => {
    const user = userEvent.setup();
    renderSearch();

    const input = screen.getByLabelText('Search for a country or city');
    await user.type(input, 'France');

    await user.click(screen.getByRole('button', { name: /France/ }));

    expect(fitBounds).toHaveBeenCalledWith('france-bounds', { padding: [40, 40] });
    expect(screen.queryByRole('button', { name: /France/ })).not.toBeInTheDocument();
  });

  it('flies to a capital result and closes on escape', async () => {
    const user = userEvent.setup();
    renderSearch();

    const input = screen.getByLabelText('Search for a country or city');
    await user.type(input, 'Paris');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: /Paris/ })).not.toBeInTheDocument();

    await user.click(input);
    await user.click(screen.getByRole('button', { name: /Paris/ }));

    expect(flyTo).toHaveBeenCalledWith([48.8566, 2.3522], 8);
  });

  it('does not return countries removed from the displayed world data', async () => {
    const user = userEvent.setup();
    renderSearch({
      searchWorldData: {
        type: 'FeatureCollection',
        features: [],
      },
    });

    const input = screen.getByLabelText('Search for a country or city');
    await user.type(input, 'France');

    expect(screen.queryByRole('button', { name: 'France' })).not.toBeInTheDocument();
  });
});
