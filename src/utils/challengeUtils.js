export function formatTimeRemaining(endAt) {
  if (!endAt) return null;
  
  const end = new Date(endAt);
  const now = new Date();
  const diff = end - now;
  
  if (diff <= 0) return 'Expired';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

export function getDifficultyLabel(difficulty) {
  const map = {
    easy: { emoji: '🟢', label: 'Easy', color: '#27ae60' },
    medium: { emoji: '🟡', label: 'Medium', color: '#f39c12' },
    hard: { emoji: '🔴', label: 'Hard', color: '#e74c3c' },
  };
  return map[difficulty] || null;
}

export function getDurationLabel(duration) {
  const map = {
    '48h': '48 hours',
    '1w': '1 week',
    '1m': '1 month',
    'open-ended': 'No deadline',
  };
  return map[duration] || 'No deadline';
}
