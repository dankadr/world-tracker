import { describe, it, expect } from 'vitest';
import { normalizeAnswer, checkTextAnswer, fuzzyMatches } from '../gameAnswers';

describe('normalizeAnswer', () => {
  it('lowercases', () => expect(normalizeAnswer('France')).toBe('france'));
  it('strips diacritics', () => expect(normalizeAnswer('Bogotá')).toBe('bogota'));
  it("strips diacritics complex", () => expect(normalizeAnswer("Côte d'Ivoire")).toBe("cote d'ivoire"));
  it('trims whitespace', () => expect(normalizeAnswer('  France  ')).toBe('france'));
});

describe('checkTextAnswer', () => {
  it('accepts exact match', () => expect(checkTextAnswer('france', 'france')).toBe(true));
  it('accepts case-insensitive match', () => expect(checkTextAnswer('France', 'france')).toBe(true));
  it('accepts diacritic-stripped match', () => expect(checkTextAnswer('Bogota', 'Bogotá')).toBe(true));
  it('rejects wrong answer', () => expect(checkTextAnswer('Germany', 'France')).toBe(false));
  it('accepts alias USA for United States', () => expect(checkTextAnswer('USA', 'United States')).toBe(true));
  it('accepts alias UK for United Kingdom', () => expect(checkTextAnswer('UK', 'United Kingdom')).toBe(true));
  it('accepts alias Czech Republic for Czechia', () => expect(checkTextAnswer('Czech Republic', 'Czechia')).toBe(true));
});

describe('fuzzyMatches', () => {
  const countries = [
    { id: 'fr', name: 'France' },
    { id: 'de', name: 'Germany' },
    { id: 'es', name: 'Spain' },
    { id: 'gf', name: 'French Guiana' },
  ];
  it('returns matches containing input as substring', () => {
    const results = fuzzyMatches('fran', countries);
    expect(results.map(c => c.id)).toContain('fr');
    expect(results.map(c => c.id)).not.toContain('gf');
  });
  it('matches both France and French Guiana for "fr"', () => {
    const results = fuzzyMatches('fr', countries);
    expect(results.map(c => c.id)).toContain('fr');
    expect(results.map(c => c.id)).toContain('gf');
  });
  it('returns empty for no matches', () => expect(fuzzyMatches('xyz', countries)).toHaveLength(0));
  it('returns empty for empty input', () => expect(fuzzyMatches('', countries)).toHaveLength(0));
  it('limits results to 5', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `a${i}`, name: `Country ${i}` }));
    expect(fuzzyMatches('country', many)).toHaveLength(5);
  });
  it('is case-insensitive', () => {
    const results = fuzzyMatches('FRAN', countries);
    expect(results.map(c => c.id)).toContain('fr');
  });
});
