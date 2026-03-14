# Production QA Team Blueprint

This project should treat QA as a **cross-functional team**, not just one test command.

## QA Team Roles

- **QA Lead (owner):** defines release quality gates, test strategy, and sign-off checklist.
- **UI Automation Engineer:** maintains frontend interaction tests (map click, tab navigation, mini-games).
- **API/Backend QA Engineer:** validates `/api` contracts, auth, sync, and migration safety.
- **Performance QA Engineer:** tracks Web Vitals, large-geojson rendering, and memory regressions.
- **Release Champion (rotating):** runs smoke tests on release candidate and coordinates go/no-go.

## Production Quality Gates

A release is "green" only when all gates pass:

1. Frontend unit/integration tests (`npm test`)
2. Backend tests (`cd backend && pytest -v`)
3. UI smoke tests for key user journeys:
   - Open app and render world map
   - Click map country and verify visited state updates
   - Open Geography Games and start each game mode
4. Dockerized local run succeeds (`docker compose up --build`)
5. No console errors in smoke session

## UI Smoke Test Coverage (Current)

Automated smoke checks currently include:

- `WorldMap` click interaction invokes the world toggle handler.
- `GamesPanel` navigation flow (home -> map config -> start quiz) works.

These checks are intentionally lightweight so they can run on every PR quickly.

## Local QA Runbook

```bash
# Frontend checks
npm test

# Backend checks
cd backend && pytest -v

# Full local environment (manual exploratory QA)
docker compose up --build
```

## "Web scraping" vs real UI testing

For production readiness, prefer **browser-driven UI tests** over scraping HTML:

- Scraping validates static DOM snapshots.
- Browser UI tests validate real user behavior (clicks, transitions, map interactions, overlays).

A Selenium smoke suite is now included under `qa/selenium/` for real browser validation in local Docker or CI. For future expansion, Playwright can be added for richer trace/debug tooling.
