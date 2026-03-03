import '@testing-library/jest-dom';

// Provide a reliable in-memory localStorage for all tests.
// jsdom 25 + vitest 3 localstorage file persistence can be flaky, so we stub it.
const _store = {};
vi.stubGlobal('localStorage', {
  getItem: (key) => Object.prototype.hasOwnProperty.call(_store, key) ? _store[key] : null,
  setItem: (key, value) => { _store[String(key)] = String(value); },
  removeItem: (key) => { delete _store[key]; },
  clear: () => { Object.keys(_store).forEach((k) => delete _store[k]); },
  get length() { return Object.keys(_store).length; },
  key: (index) => Object.keys(_store)[index] ?? null,
});

afterEach(() => {
  vi.useRealTimers();
  Object.keys(_store).forEach((k) => delete _store[k]);
  vi.restoreAllMocks();
});
