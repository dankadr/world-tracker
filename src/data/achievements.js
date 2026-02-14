import { countryList } from './countries';

const STORAGE_PREFIX = 'swiss-tracker-visited-';

function getVisited(countryId) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + countryId);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data.length;
      if (typeof data === 'object') return Object.keys(data).length;
    }
  } catch { /* ignore */ }
  return 0;
}

function getTotalRegions(countryId) {
  const c = countryList.find((x) => x.id === countryId);
  return c ? c.data.features.length : 0;
}

function getAllVisited() {
  return countryList.reduce((sum, c) => sum + getVisited(c.id), 0);
}

function getAllTotal() {
  return countryList.reduce((sum, c) => sum + c.data.features.length, 0);
}

const achievements = [
  {
    id: 'first-steps',
    icon: '👣',
    title: 'First Steps',
    desc: 'Visit your first region',
    check: () => getAllVisited() >= 1,
  },
  {
    id: 'swiss-complete',
    icon: '🇨🇭',
    title: 'Swiss Complete',
    desc: 'Visit all 26 Swiss cantons',
    check: () => getVisited('ch') >= getTotalRegions('ch'),
  },
  {
    id: 'state-explorer',
    icon: '🗽',
    title: 'State Explorer',
    desc: 'Visit 25+ US states',
    check: () => getVisited('us') >= 25,
  },
  {
    id: 'park-ranger',
    icon: '🏞️',
    title: 'Park Ranger',
    desc: 'Visit 10+ national parks',
    check: () => getVisited('usparks') >= 10,
  },
  {
    id: 'nordic-wanderer',
    icon: '🇳🇴',
    title: 'Nordic Wanderer',
    desc: 'Visit 8+ Norwegian counties',
    check: () => getVisited('no') >= 8,
  },
  {
    id: 'canadian-trail',
    icon: '🇨🇦',
    title: 'Canadian Trail',
    desc: 'Visit 7+ Canadian provinces',
    check: () => getVisited('ca') >= 7,
  },
  {
    id: 'half-way',
    icon: '🏅',
    title: 'Half Way There',
    desc: 'Reach 50% overall progress',
    check: () => {
      const total = getAllTotal();
      return total > 0 && getAllVisited() / total >= 0.5;
    },
  },
  {
    id: 'globe-trotter',
    icon: '🌍',
    title: 'Globe Trotter',
    desc: 'Visit regions in all countries',
    check: () => countryList.every((c) => getVisited(c.id) > 0),
  },
];

export default achievements;
