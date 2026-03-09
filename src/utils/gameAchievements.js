const KEY = 'swiss-tracker-game-completed';

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY));
    return (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch {
    return {};
  }
}

function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); }
  catch {}
}

export function recordGameCompletion(modeKey, pct) {
  const data = load();
  data.any = true;
  data[modeKey] = Math.max(data[modeKey] || 0, pct);
  save(data);
}

export function getGameCompletions() {
  return load();
}
