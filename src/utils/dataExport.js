/**
 * Data export utilities — JSON and CSV export for user travel data.
 *
 * Supports both authenticated users (fetches from API) and guest users
 * (reads from localStorage).
 */

const TRACKER_IDS = ['ch', 'us', 'usparks', 'nyc', 'no', 'ca', 'capitals', 'jp', 'au', 'unesco'];

// ── localStorage key helpers (mirrors useVisitedCantons.js) ──

function regionKey(userId, countryId) {
  return userId
    ? `swiss-tracker-u${userId}-visited-${countryId}`
    : `swiss-tracker-visited-${countryId}`;
}

function worldKey(userId) {
  return userId
    ? `swiss-tracker-u${userId}-visited-world`
    : 'swiss-tracker-visited-world';
}

// ── Guest mode (localStorage) export ──

function buildGuestExport(userId) {
  const visited = {};
  for (const id of TRACKER_IDS) {
    try {
      const raw = localStorage.getItem(regionKey(userId, id));
      visited[id] = raw ? JSON.parse(raw) : [];
    } catch {
      visited[id] = [];
    }
  }
  let world = [];
  try {
    const raw = localStorage.getItem(worldKey(userId));
    world = raw ? JSON.parse(raw) : [];
  } catch {}

  return { visited, world };
}

// ── Authenticated export (fetch from API) ──

async function fetchAuthExport(token) {
  const [visitedRes, wishlistRes, challengesRes, meRes] = await Promise.all([
    fetch('/api/visited/all', { headers: { Authorization: `Bearer ${token}` } }),
    fetch('/api/wishlist', { headers: { Authorization: `Bearer ${token}` } }),
    fetch('/api/challenges', { headers: { Authorization: `Bearer ${token}` } }),
    fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } }),
  ]);

  const visitedData = visitedRes.ok ? await visitedRes.json() : null;
  const wishlistData = wishlistRes.ok ? await wishlistRes.json() : [];
  const challengesData = challengesRes.ok ? await challengesRes.json() : [];
  const meData = meRes.ok ? await meRes.json() : null;

  return { visitedData, wishlistData, challengesData, meData };
}

// ── JSON export ──

export async function exportAsJson(token, userId) {
  let payload;

  if (token) {
    const { visitedData, wishlistData, challengesData, meData } = await fetchAuthExport(token);
    payload = {
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      user: meData ? { name: meData.name, email: meData.email, level: meData.level, xp: meData.xp } : null,
      visited: {
        regions: visitedData?.regions ?? {},
        world: visitedData?.world ?? [],
      },
      wishlist: wishlistData,
      challenges: challengesData,
    };
  } else {
    const { visited, world } = buildGuestExport(userId);
    payload = {
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      user: null,
      visited: { regions: visited, world },
      wishlist: [],
      challenges: [],
    };
  }

  triggerDownload(
    JSON.stringify(payload, null, 2),
    `world-tracker-export-${formatDate()}.json`,
    'application/json'
  );
}

// ── CSV export ──

function objectToCsv(rows, columns) {
  const header = columns.join(',');
  const lines = rows.map(row =>
    columns.map(col => {
      const val = row[col] ?? '';
      const str = Array.isArray(val) ? val.join(';') : String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(',')
  );
  return [header, ...lines].join('\n');
}

export async function exportTrackerAsCsv(trackerId, token, userId) {
  let regions = [];

  if (token) {
    const res = await fetch(`/api/visited/${trackerId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      regions = data.regions ?? [];
    }
  } else {
    try {
      const raw = localStorage.getItem(regionKey(userId, trackerId));
      regions = raw ? JSON.parse(raw) : [];
    } catch {}
  }

  const rows = regions.map(id => ({ tracker_id: trackerId, region_id: id }));
  const csv = objectToCsv(rows, ['tracker_id', 'region_id']);
  triggerDownload(csv, `world-tracker-${trackerId}-${formatDate()}.csv`, 'text/csv');
}

export async function exportWishlistAsCsv(token) {
  if (!token) {
    triggerDownload('tracker_id,region_id\n', `world-tracker-wishlist-${formatDate()}.csv`, 'text/csv');
    return;
  }
  const res = await fetch('/api/wishlist', { headers: { Authorization: `Bearer ${token}` } });
  const items = res.ok ? await res.json() : [];
  const rows = items.map(i => ({
    tracker_id: i.tracker_id,
    region_id: i.region_id,
    priority: i.priority,
    target_date: i.target_date ?? '',
    category: i.category,
    notes: i.notes ?? '',
  }));
  const csv = objectToCsv(rows, ['tracker_id', 'region_id', 'priority', 'target_date', 'category', 'notes']);
  triggerDownload(csv, `world-tracker-wishlist-${formatDate()}.csv`, 'text/csv');
}

// ── Helpers ──

function formatDate() {
  return new Date().toISOString().slice(0, 10);
}

function triggerDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
