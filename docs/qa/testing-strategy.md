# QA Testing Strategy

This project uses a layered QA setup so fast regressions are caught on every PR and browser-level issues are still covered.

## Layers

1. `npm test`
   Frontend unit and component tests with Vitest and Testing Library.
2. `cd backend && pytest -v`
   Backend and API validation.
3. `npm run test:e2e`
   Playwright smoke coverage for the main world-map and games flows.

## Browser Smoke Scope

The Playwright smoke suite is intentionally small and deterministic:

- App shell and world map render successfully.
- A specific world country can be clicked and its visited state changes.
- Geography Games opens from the main map UI.
- Map Quiz starts and the highlighted target can be answered in the browser.

## Local Runbook

```bash
# frontend unit/component coverage
npm test

# backend checks
cd backend && pytest -v

# first-time Playwright browser install
npx playwright install chromium

# browser smoke tests
npm run test:e2e

# combined frontend QA
npm run test:qa
```

## Notes

- Browser tests rely on stable `data-testid` and `data-country-id` attributes instead of brittle CSS selectors.
- The Vitest config is scoped to `src/` so local worktrees and generated output do not pollute the frontend test run.
