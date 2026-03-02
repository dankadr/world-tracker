export function emitVisitedChange() {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }

  try {
    window.dispatchEvent(new Event('visitedchange'));
  } catch {
    // ignore
  }
}
