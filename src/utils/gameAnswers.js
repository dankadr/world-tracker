// Map of normalized alias → normalized correct name
const ALIASES = {
  'usa': 'united states',
  'united states of america': 'united states',
  'uk': 'united kingdom',
  'great britain': 'united kingdom',
  'czech republic': 'czechia',
  'ivory coast': "cote d'ivoire",
  'democratic republic of the congo': 'dr congo',
  'drc': 'dr congo',
  'congo kinshasa': 'dr congo',
  'republic of the congo': 'congo',
  'burma': 'myanmar',
  'cape verde': 'cabo verde',
  'swaziland': 'eswatini',
  'east timor': 'timor-leste',
  'macedonia': 'north macedonia',
};

export function normalizeAnswer(str) {
  if (str == null) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function checkTextAnswer(userInput, correctAnswer) {
  const normalized = normalizeAnswer(userInput);
  const correct = normalizeAnswer(correctAnswer);
  if (normalized === correct) return true;
  const aliasTarget = ALIASES[normalized];
  if (aliasTarget && aliasTarget === correct) return true;
  return false;
}

export function fuzzyMatches(input, candidates, key = 'name', limit = 5) {
  if (!input.trim()) return [];
  const q = normalizeAnswer(input);
  return candidates
    .filter(c => normalizeAnswer(c[key]).includes(q))
    .slice(0, limit);
}
