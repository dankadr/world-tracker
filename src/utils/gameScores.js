const STORAGE_KEY = 'swiss-tracker-game-scores';

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch {
    return {};
  }
}

function save(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch { /* ignore quota errors */ }
}

export function getHighScore(key) {
  return load()[key] ?? null;
}

export function isNewHighScore(key, pct) {
  const best = getHighScore(key);
  return !best || typeof best.pct !== 'number' || pct > best.pct;
}

export function saveHighScore(key, scoreObj) {
  const all = load();
  if (!all[key] || scoreObj.pct > all[key].pct) {
    all[key] = scoreObj;
    save(all);
  }
}
