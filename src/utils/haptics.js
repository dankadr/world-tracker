function canVibrate() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function vibrate(pattern) {
  if (!canVibrate()) return false;
  return navigator.vibrate(pattern);
}

export function hapticSelection() {
  return vibrate(8);
}

export function hapticSuccess() {
  return vibrate([10, 40, 12]);
}

export function hapticWarning() {
  return vibrate([8, 30, 8]);
}
