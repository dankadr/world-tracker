import { describe, it, expect, vi } from 'vitest';

// Mock countries data before importing the module
vi.mock('../../data/countries', () => ({
  countryList: [
    {
      id: 'us',
      data: {
        features: [
          { properties: { id: 'ca' } },
          { properties: { id: 'ny' } },
          { properties: { id: 'tx' } },
          { properties: { id: 'fl', isBorough: true } }, // borough — excluded from total
        ],
      },
    },
    {
      id: 'ch',
      data: {
        features: [
          { properties: { id: 'zh' } },
          { properties: { id: 'be' } },
        ],
      },
    },
    {
      id: 'empty',
      data: {
        features: [],
      },
    },
  ],
}));

import { getExplorationDepth, depthToColor } from '../explorationDepth';

describe('getExplorationDepth', () => {
  it('returns 0 for a country with no visited regions', () => {
    expect(getExplorationDepth('us', [])).toBe(0);
  });

  it('returns correct depth for partial visits', () => {
    // us has 3 non-borough features: ca, ny, tx
    const keys = ['us:ca', 'us:ny'];
    expect(getExplorationDepth('us', keys)).toBeCloseTo(2 / 3);
  });

  it('returns 1.0 when all regions are visited', () => {
    const keys = ['us:ca', 'us:ny', 'us:tx'];
    expect(getExplorationDepth('us', keys)).toBe(1);
  });

  it('ignores keys from other countries', () => {
    const keys = ['ch:zh', 'ch:be', 'us:ca'];
    expect(getExplorationDepth('us', keys)).toBeCloseTo(1 / 3);
  });

  it('returns 0 for an unknown country', () => {
    expect(getExplorationDepth('zz', ['zz:foo'])).toBe(0);
  });

  it('returns 0 for a country with no non-borough features', () => {
    expect(getExplorationDepth('empty', ['empty:x'])).toBe(0);
  });

  it('clamps at 1.0 if somehow more keys than features', () => {
    const keys = ['us:ca', 'us:ny', 'us:tx', 'us:extra', 'us:extra2'];
    expect(getExplorationDepth('us', keys)).toBe(1);
  });

  it('uses prefix matching — does not count partial matches', () => {
    const keys = ['usage:foo'];
    expect(getExplorationDepth('us', keys)).toBe(0);
  });
});

describe('depthToColor', () => {
  it('returns unvisited color for depth 0 (light)', () => {
    expect(depthToColor(0, false)).toBe('#cfd8dc');
  });

  it('returns unvisited color for depth 0 (dark)', () => {
    expect(depthToColor(0, true)).toBe('#3a3a3a');
  });

  it('returns first light stop for depth in [0.01, 0.25)', () => {
    expect(depthToColor(0.1, false)).toBe('#f5e8c0');
  });

  it('returns second light stop for depth in [0.25, 0.5)', () => {
    expect(depthToColor(0.4, false)).toBe('#e8c96a');
  });

  it('returns third light stop for depth in [0.5, 0.75)', () => {
    expect(depthToColor(0.6, false)).toBe('#c9a84c');
  });

  it('returns fourth light stop for depth in [0.75, 1.0]', () => {
    expect(depthToColor(0.9, false)).toBe('#b8943a');
  });

  it('returns last stop for depth exactly 1.0', () => {
    expect(depthToColor(1.0, false)).toBe('#b8943a');
  });

  it('returns first dark stop for depth in [0.01, 0.25)', () => {
    expect(depthToColor(0.1, true)).toBe('#5a4a1a');
  });

  it('returns fourth dark stop for depth in [0.75, 1.0]', () => {
    expect(depthToColor(0.8, true)).toBe('#f0cc60');
  });
});
