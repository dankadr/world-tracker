import { describe, it, expect } from 'vitest';
import { findRegion, greatCircleDistance } from '../geo';

// Simple square: corners at (0,0), (10,0), (10,10), (0,10) in [lng, lat]
const squarePolygon = {
  type: 'Polygon',
  coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
};

function makeFeature(id, name, geometry) {
  return { type: 'Feature', properties: { id, name }, geometry };
}

function makeCollection(features) {
  return { type: 'FeatureCollection', features };
}

describe('findRegion — Polygon', () => {
  const geojson = makeCollection([
    makeFeature('ZH', 'Zurich', squarePolygon),
  ]);

  it('returns the region for a point inside', () => {
    const result = findRegion(5, 5, geojson); // lat=5, lng=5
    expect(result).toEqual({ id: 'ZH', name: 'Zurich' });
  });

  it('returns null for a point outside', () => {
    const result = findRegion(15, 15, geojson);
    expect(result).toBeNull();
  });

  it('returns null for a point clearly outside', () => {
    const result = findRegion(-1, -1, geojson);
    expect(result).toBeNull();
  });
});

describe('findRegion — MultiPolygon', () => {
  const multiPolygon = {
    type: 'MultiPolygon',
    // Two separate squares: one at [0-10, 0-10], another at [20-30, 20-30]
    coordinates: [
      [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
      [[[20, 20], [30, 20], [30, 30], [20, 30], [20, 20]]],
    ],
  };
  const geojson = makeCollection([
    makeFeature('MP', 'MultiPoly', multiPolygon),
  ]);

  it('returns region for point in first sub-polygon', () => {
    const result = findRegion(5, 5, geojson);
    expect(result).toEqual({ id: 'MP', name: 'MultiPoly' });
  });

  it('returns region for point in second sub-polygon', () => {
    const result = findRegion(25, 25, geojson);
    expect(result).toEqual({ id: 'MP', name: 'MultiPoly' });
  });

  it('returns null for point between sub-polygons', () => {
    const result = findRegion(15, 15, geojson);
    expect(result).toBeNull();
  });
});

describe('findRegion — unknown geometry type', () => {
  const pointGeometry = { type: 'Point', coordinates: [5, 5] };
  const geojson = makeCollection([
    makeFeature('PT', 'APoint', pointGeometry),
  ]);

  it('returns null without throwing for unknown geometry', () => {
    expect(() => findRegion(5, 5, geojson)).not.toThrow();
    expect(findRegion(5, 5, geojson)).toBeNull();
  });
});

describe('findRegion — multiple non-overlapping regions', () => {
  const square1 = {
    type: 'Polygon',
    coordinates: [[[0, 0], [5, 0], [5, 5], [0, 5], [0, 0]]],
  };
  const square2 = {
    type: 'Polygon',
    coordinates: [[[10, 10], [20, 10], [20, 20], [10, 20], [10, 10]]],
  };
  const geojson = makeCollection([
    makeFeature('R1', 'Region1', square1),
    makeFeature('R2', 'Region2', square2),
  ]);

  it('returns correct region when point is in first region', () => {
    expect(findRegion(2, 2, geojson)).toEqual({ id: 'R1', name: 'Region1' });
  });

  it('returns correct region when point is in second region', () => {
    expect(findRegion(15, 15, geojson)).toEqual({ id: 'R2', name: 'Region2' });
  });

  it('returns null when point is in neither region', () => {
    expect(findRegion(7, 7, geojson)).toBeNull();
  });
});

describe('findRegion — empty collection', () => {
  it('returns null for empty feature collection', () => {
    expect(findRegion(5, 5, makeCollection([]))).toBeNull();
  });
});

describe('greatCircleDistance', () => {
  it('returns 0 for identical points', () => {
    expect(greatCircleDistance(48.8566, 2.3522, 48.8566, 2.3522)).toBe(0);
  });

  it('calculates approximate distance between Paris and London (~340 km)', () => {
    // Paris: 48.8566, 2.3522  London: 51.5074, -0.1278
    const dist = greatCircleDistance(48.8566, 2.3522, 51.5074, -0.1278);
    expect(dist).toBeGreaterThan(330);
    expect(dist).toBeLessThan(360);
  });

  it('calculates approximate distance between NYC and LA (~3940 km)', () => {
    // NYC: 40.7128, -74.0060  LA: 34.0522, -118.2437
    const dist = greatCircleDistance(40.7128, -74.0060, 34.0522, -118.2437);
    expect(dist).toBeGreaterThan(3900);
    expect(dist).toBeLessThan(4000);
  });

  it('is symmetric (a→b equals b→a)', () => {
    const d1 = greatCircleDistance(48.8566, 2.3522, 51.5074, -0.1278);
    const d2 = greatCircleDistance(51.5074, -0.1278, 48.8566, 2.3522);
    expect(Math.abs(d1 - d2)).toBeLessThan(0.001);
  });

  it('handles antipodal points (approximately half the circumference, ~20015 km)', () => {
    const dist = greatCircleDistance(0, 0, 0, 180);
    expect(dist).toBeGreaterThan(20000);
    expect(dist).toBeLessThan(20030);
  });
});
