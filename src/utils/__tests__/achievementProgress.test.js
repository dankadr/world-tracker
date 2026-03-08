import { describe, it, expect, beforeEach } from 'vitest';
import { computeProgress, formatProgressText } from '../achievementProgress';

// ---------------------------------------------------------------------------
// Mock heavy data dependencies at module boundary
// ---------------------------------------------------------------------------

vi.mock('../../data/countries', () => ({
  countryList: [
    {
      id: 'ch',
      data: {
        features: [
          { properties: { id: 'ZH' } },
          { properties: { id: 'BE' } },
        ],
      },
    },
    {
      id: 'us',
      data: {
        features: [
          { properties: { id: 'CA' } },
          { properties: { id: 'MAN', isBorough: true } },
        ],
      },
    },
  ],
}));

vi.mock('../../data/world.json', () => ({
  default: { features: [{ id: 'CH' }, { id: 'US' }] },
}));

vi.mock('../../config/continents.json', () => ({
  default: { CH: 'Europe', US: 'North America' },
}));

vi.mock('../../config/countryMeta.json', () => ({
  default: {
    CH: { tags: ['europe'], area: 41285, population: 8700000 },
    US: { tags: ['northamerica'], area: 9833520, population: 331000000 },
  },
}));

// CH capital: lng=8.55, lat=47.37 → Northern + Eastern hemisphere
vi.mock('../../data/capitals.json', () => ({
  default: {
    features: [
      {
        properties: { country: 'CH' },
        geometry: { coordinates: [8.55, 47.37] },
      },
      {
        properties: { country: 'US' },
        geometry: { coordinates: [-77.0, 38.9] }, // Washington DC → North + West
      },
    ],
  },
}));

vi.mock('../../config/achievements.json', () => ({ default: [] }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PREFIX = 'swiss-tracker-';

function setVisited(countryId, ids) {
  localStorage.setItem(PREFIX + 'visited-' + countryId, JSON.stringify(ids));
}

function setWorldVisited(codes) {
  localStorage.setItem(PREFIX + 'visited-world', JSON.stringify(codes));
}

// ---------------------------------------------------------------------------
// computeProgress — rule types
// ---------------------------------------------------------------------------

describe('totalVisited', () => {
  it('returns 0 when nothing visited', () => {
    const r = computeProgress({ type: 'totalVisited', min: 5 }, null);
    expect(r.current).toBe(0);
    expect(r.unlocked).toBe(false);
  });

  it('counts all visited regions across countries', () => {
    setVisited('ch', ['ZH', 'BE']);
    setVisited('us', ['CA']);
    const r = computeProgress({ type: 'totalVisited', min: 3 }, null);
    expect(r.current).toBe(3);
    expect(r.unlocked).toBe(true);
  });

  it('is not unlocked when count is below min', () => {
    setVisited('ch', ['ZH']);
    const r = computeProgress({ type: 'totalVisited', min: 5 }, null);
    expect(r.current).toBe(1);
    expect(r.unlocked).toBe(false);
  });
});

describe('countryVisited', () => {
  it('counts visited regions for a specific country', () => {
    setVisited('ch', ['ZH']);
    const r = computeProgress({ type: 'countryVisited', country: 'ch', min: 1 }, null);
    expect(r.current).toBe(1);
    expect(r.unlocked).toBe(true);
  });

  it('is not unlocked when below min', () => {
    setVisited('ch', ['ZH']);
    const r = computeProgress({ type: 'countryVisited', country: 'ch', min: 2 }, null);
    expect(r.current).toBe(1);
    expect(r.unlocked).toBe(false);
  });
});

describe('countryComplete — isBorough exclusion', () => {
  it('target excludes boroughs (us has 1 non-borough region)', () => {
    const r = computeProgress({ type: 'countryComplete', country: 'us' }, null);
    expect(r.target).toBe(1); // MAN is a borough → excluded from total
  });

  it('ch has 2 non-borough regions', () => {
    const r = computeProgress({ type: 'countryComplete', country: 'ch' }, null);
    expect(r.target).toBe(2);
  });

  it('unlocks when all non-borough regions are visited', () => {
    setVisited('us', ['CA']); // visit the 1 non-borough region
    const r = computeProgress({ type: 'countryComplete', country: 'us' }, null);
    expect(r.current).toBe(1);
    expect(r.target).toBe(1);
    expect(r.unlocked).toBe(true);
  });

  it('is not unlocked when only partially visited', () => {
    setVisited('ch', ['ZH']); // only 1 of 2 regions
    const r = computeProgress({ type: 'countryComplete', country: 'ch' }, null);
    expect(r.current).toBe(1);
    expect(r.target).toBe(2);
    expect(r.unlocked).toBe(false);
  });
});

describe('worldVisited', () => {
  it('returns 0 with no world visits', () => {
    const r = computeProgress({ type: 'worldVisited', min: 1 }, null);
    expect(r.current).toBe(0);
    expect(r.unlocked).toBe(false);
  });

  it('counts visited world countries', () => {
    setWorldVisited(['CH', 'US']);
    const r = computeProgress({ type: 'worldVisited', min: 2 }, null);
    expect(r.current).toBe(2);
    expect(r.unlocked).toBe(true);
  });
});

describe('continentsVisited', () => {
  it('returns 0 when no world countries visited', () => {
    const r = computeProgress({ type: 'continentsVisited', min: 1 }, null);
    expect(r.current).toBe(0);
  });

  it('counts Europe when CH is visited', () => {
    setWorldVisited(['CH']);
    const r = computeProgress({ type: 'continentsVisited', min: 1 }, null);
    expect(r.current).toBe(1);
    expect(r.unlocked).toBe(true);
  });

  it('counts both continents when CH and US are visited', () => {
    setWorldVisited(['CH', 'US']);
    const r = computeProgress({ type: 'continentsVisited', min: 2 }, null);
    expect(r.current).toBe(2);
    expect(r.unlocked).toBe(true);
  });

  it('deduplicates continents (two countries in same continent count as 1)', () => {
    // Only CH and US → Europe + North America = 2 unique continents
    setWorldVisited(['CH']);
    const r = computeProgress({ type: 'continentsVisited', min: 2 }, null);
    expect(r.current).toBe(1); // only Europe
  });
});

describe('worldTagVisited', () => {
  it('returns 0 when no countries with the tag visited', () => {
    const r = computeProgress({ type: 'worldTagVisited', tag: 'europe', min: 1 }, null);
    expect(r.current).toBe(0);
  });

  it('counts visited countries matching the tag', () => {
    setWorldVisited(['CH']); // CH has 'europe' tag
    const r = computeProgress({ type: 'worldTagVisited', tag: 'europe', min: 1 }, null);
    expect(r.current).toBe(1);
    expect(r.unlocked).toBe(true);
  });

  it('ignores countries without the tag', () => {
    setWorldVisited(['US']); // US has 'northamerica' tag, not 'europe'
    const r = computeProgress({ type: 'worldTagVisited', tag: 'europe', min: 1 }, null);
    expect(r.current).toBe(0);
  });
});

describe('achievementsUnlocked', () => {
  it('counts unlocked achievements, excluding achievementsUnlocked type', () => {
    const allResults = [
      { unlocked: true, rule: { type: 'totalVisited' } },
      { unlocked: true, rule: { type: 'worldVisited' } },
      { unlocked: false, rule: { type: 'countryVisited' } },
      { unlocked: true, rule: { type: 'achievementsUnlocked' } }, // excluded
    ];
    const r = computeProgress({ type: 'achievementsUnlocked', min: 2 }, null, allResults);
    expect(r.current).toBe(2); // excludes the achievementsUnlocked entry
    expect(r.unlocked).toBe(true);
  });

  it('returns 0 when no achievements are unlocked', () => {
    const allResults = [
      { unlocked: false, rule: { type: 'totalVisited' } },
    ];
    const r = computeProgress({ type: 'achievementsUnlocked', min: 1 }, null, allResults);
    expect(r.current).toBe(0);
    expect(r.unlocked).toBe(false);
  });

  it('returns 0 with empty allResults', () => {
    const r = computeProgress({ type: 'achievementsUnlocked', min: 1 }, null, []);
    expect(r.current).toBe(0);
  });
});

describe('hemisphereVisited — mode ns', () => {
  it('returns 0 when no world countries visited', () => {
    const r = computeProgress({ type: 'hemisphereVisited', mode: 'ns' }, null);
    expect(r.current).toBe(0);
    expect(r.target).toBe(2);
  });

  it('counts northern hemisphere when CH is visited (lat > 0)', () => {
    setWorldVisited(['CH']); // lat=47.37 → north
    const r = computeProgress({ type: 'hemisphereVisited', mode: 'ns' }, null);
    expect(r.current).toBe(1); // only north
  });

  it('counts both hemispheres when north and south visited', () => {
    // CH → north; add a hypothetical south country... but we only have CH and US in our mock
    // US (lat=38.9) is also north — so visiting both still gives 1 (only north)
    setWorldVisited(['CH', 'US']);
    const r = computeProgress({ type: 'hemisphereVisited', mode: 'ns' }, null);
    expect(r.current).toBe(1); // both are northern
  });
});

describe('hemisphereVisited — mode all', () => {
  it('counts N+E hemispheres when CH visited (lat>0, lng>0)', () => {
    setWorldVisited(['CH']); // lat=47.37 (north), lng=8.55 (east)
    const r = computeProgress({ type: 'hemisphereVisited', mode: 'all' }, null);
    expect(r.current).toBe(2); // north + east
    expect(r.target).toBe(4);
  });

  it('counts N+E+N+W when both CH (N/E) and US (N/W) visited', () => {
    setWorldVisited(['CH', 'US']); // CH: N+E, US: N+W → N+E+W = 3
    const r = computeProgress({ type: 'hemisphereVisited', mode: 'all' }, null);
    expect(r.current).toBe(3); // north, east, west (no south)
  });
});

describe('unknown rule type', () => {
  it('returns 0/1 unlocked=false for unknown type', () => {
    const r = computeProgress({ type: 'unknownType' }, null);
    expect(r.current).toBe(0);
    expect(r.target).toBe(1);
    expect(r.unlocked).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatProgressText
// ---------------------------------------------------------------------------

describe('formatProgressText', () => {
  it('formats regular progress as "current / target"', () => {
    expect(formatProgressText(3, 5, 'totalVisited')).toBe('3 / 5');
  });

  it('clamps current to target for regular display', () => {
    expect(formatProgressText(10, 5, 'totalVisited')).toBe('5 / 5');
  });

  it('formats worldAreaVisited with K abbreviation', () => {
    expect(formatProgressText(41285, 50000, 'worldAreaVisited')).toBe('41.3K / 50.0K km²');
  });

  it('formats worldPopulationVisited with M abbreviation', () => {
    expect(formatProgressText(8700000, 10000000, 'worldPopulationVisited')).toBe('8.7M / 10.0M');
  });

  it('formats worldPopulationVisited with B abbreviation for billions', () => {
    expect(formatProgressText(1500000000, 2000000000, 'worldPopulationVisited')).toBe('1.5B / 2.0B');
  });
});
