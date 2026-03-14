const VIBRATION_PATTERNS = {
  selection: 8,
  action: 10,
  confirm: 14,
  visitOn: 12,
  visitOff: [8, 30, 8],
  achievement: [10, 24, 16],
  levelUp: [14, 24, 12, 24, 18],
};

function canVibrate() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

function vibrate(pattern) {
  if (!canVibrate()) return false;
  return navigator.vibrate(pattern);
}

function play(patternKey) {
  const pattern = VIBRATION_PATTERNS[patternKey];
  if (!pattern) return;
  vibrate(pattern);
}

export const haptics = {
  selection() {
    play('selection');
  },
  action() {
    play('action');
  },
  confirmation() {
    play('confirm');
  },
  visitToggle(wasVisited) {
    play(wasVisited ? 'visitOff' : 'visitOn');
  },
  achievementUnlock() {
    play('achievement');
  },
  levelUp() {
    play('levelUp');
  },
};

export default haptics;
