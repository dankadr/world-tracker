import { describe, it, expect } from 'vitest';
import LAYERS from '../mapLayers.json';

describe('mapLayers config', () => {
  it('includes a streets layer with CartoDB Voyager URLs', () => {
    const streets = LAYERS.find((l) => l.id === 'streets');
    expect(streets).toBeDefined();
    expect(streets.label).toBe('Streets');
    expect(streets.light).toContain('voyager');
    expect(streets.dark).toContain('voyager');
  });

  it('all base layers have light and dark URLs', () => {
    LAYERS.filter((l) => !l.overlay).forEach((l) => {
      expect(l.light, `${l.id} missing light URL`).toBeTruthy();
      expect(l.dark, `${l.id} missing dark URL`).toBeTruthy();
    });
  });
});
