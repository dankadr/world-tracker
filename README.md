# Right World Tracker

**Your world. Your journey.**

An interactive travel tracker where you mark countries, explore detailed region maps, track capitals and UNESCO sites, set goals, and unlock achievements.

**[→ Live App](https://world-tracker-eight.vercel.app)** · [![CI](https://github.com/dankadr/world-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/dankadr/world-tracker/actions/workflows/ci.yml) · [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/dantracker)

---

## Supported Trackers

| Tracker | Regions | Mode |
|---------|---------|------|
| 🌍 World Map | 238 countries | Polygon |
| 🏛️ World Capitals | 192 capitals | Point |
| 🇨🇭 Switzerland | 26 cantons | Polygon |
| 🇺🇸 United States | 50 states + DC + PR | Polygon |
| 🏞️ US National Parks | 63 parks | Point |
| 🗽 NYC | 197 neighborhoods | Polygon |
| 🇳🇴 Norway | 15 counties + Svalbard | Polygon |
| 🇨🇦 Canada | 13 provinces & territories | Polygon |
| 🇯🇵 Japan | 47 prefectures | Polygon |
| 🇦🇺 Australia | 8 states & territories | Polygon |
| 🇵🇭 Philippines | 17 regions | Polygon |
| 🇧🇷 Brazil | 26 states + DF | Polygon |
| 🇫🇷 France | 13 regions | Polygon |
| 🇩🇪 Germany | 16 states | Polygon |
| 🇮🇹 Italy | 20 regions | Polygon |
| 🇪🇸 Spain | 17 autonomous communities | Polygon |
| 🇲🇽 Mexico | 32 states | Polygon |
| 🇬🇧 United Kingdom | 4 nations / regional view support | Polygon |
| 🇮🇳 India | 36 states & union territories | Polygon |
| 🇳🇿 New Zealand | 16 regions | Polygon |

## Feature Highlights

- **World + Regional Maps** — 20 tracker/map views across world, capitals, and country sub-trackers
- **UNESCO Overlay** — optional UNESCO World Heritage layer with 270 sites
- **Bucket List Planner** — add planned trips, target dates, and mark destinations complete
- **Travel Challenges** — create personal or friend challenges with streak-friendly progress
- **XP + Levels** — gain XP for visits, achievements, and milestones
- **Achievements** — 173 unlockable badges spanning global and tracker-specific goals
- **Friends + Comparison** — share progress, compare maps, and use friend overlays
- **Stats Dashboard** — timeline, continent stats, totals, and progress summaries
- **Year in Review** — generate annual travel summaries and sharing cards
- **Trip Notes & Dates** — attach notes and dates to any visited destination
- **Wishlist / Planned** — mark places to visit next and manage a global wish list
- **Geography Mini Games** — Map Quiz, Flag Quiz, Capital Quiz, and Shape Quiz
- **Export + Import** — PNG map export, share cards, JSON backup/restore, and CSV exports
- **Dark Mode + Mobile UX** — optimized for desktop and touch devices with PWA support
- **Google Sign-In or Guest Mode** — local-only mode or account sync

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 6, Leaflet + react-leaflet |
| Backend | Python FastAPI, SQLAlchemy (async), PostgreSQL |
| Auth | Google Identity Services + JWT |
| Database (local) | PostgreSQL 16 (Docker) with asyncpg |
| Database (prod) | [Neon](https://neon.tech) serverless PostgreSQL with psycopg |
| Hosting | [Vercel](https://vercel.com) (frontend CDN + Python serverless functions) |
| Monitoring | Sentry (frontend), Vercel Analytics & Speed Insights |
| Container | Docker Compose (nginx + FastAPI + PostgreSQL) |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Two deployment modes                   │
├──────────────────────┬──────────────────────────────────┤
│   Docker Compose     │   Vercel (production)            │
│                      │                                  │
│  nginx (port 8088)   │  Vite static build → CDN         │
│    ├─ static files   │  api/index.py → Serverless Fn    │
│    └─ /api → FastAPI │    └─ re-exports backend/main.py │
│         └─ asyncpg   │         └─ psycopg (NullPool)    │
│            └─ PG 16  │            └─ Neon PostgreSQL     │
└──────────────────────┴──────────────────────────────────┘
```

## Quick Start (Docker)

### Without Google login (guest mode only)

```bash
docker compose up --build
```

### With Google login

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project and enable the Google Identity API
3. Create an OAuth 2.0 Client ID (Web application type)
4. Add `http://localhost:8088` to **Authorized JavaScript origins**
5. Create a `.env` file:

```bash
cp .env.example .env
# Edit .env and paste your Google Client ID + a random JWT secret
```

6. Start the stack:

```bash
docker compose up --build
```

Open [http://localhost:8088](http://localhost:8088) in your browser.

## Running Tests

```bash
# Frontend (Vitest)
npm test

# Backend (pytest)
pip install -r backend/requirements-dev.txt
cd backend && pytest -v

# E2E (Playwright)
npx playwright install chromium
npm run test:e2e
```

## Deploy to Vercel

### 1. Set up Neon PostgreSQL

Create a free project at [neon.tech](https://neon.tech) and copy the **pooled** connection string from **Connection Details**.

### 2. Configure environment variables

In your Vercel project → **Settings** → **Environment Variables**:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon pooled connection string |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth 2.0 Client ID |
| `JWT_SECRET` | Yes | Random secret (`openssl rand -hex 32`) |
| `ENCRYPTION_MASTER_KEY` | Yes | Master key for data encryption (`openssl rand -hex 32`) |
| `ADMIN_EMAIL` | Yes | Your email address (grants admin access) |
| `FRONTEND_URL` | Yes | Your Vercel production URL |
| `VITE_SENTRY_DSN` | No | Sentry DSN for error tracking |

### 3. Add your Vercel URL to Google OAuth

In [Google Cloud Console](https://console.cloud.google.com/) → **Credentials** → your OAuth Client ID, add your production URL to **Authorized JavaScript origins**.

### 4. Deploy

```bash
vercel --prod
```

Or push to your connected Git repo — Vercel deploys automatically.

### 5. Verify

Visit `https://your-app.vercel.app/api/health` — should return `{"status":"ok","database":"connected"}`

## Environment Variables Reference

| Variable | Used in | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | Backend | PostgreSQL connection string |
| `POSTGRES_URL` | Backend (fallback) | Auto-set by Vercel Neon integration |
| `GOOGLE_CLIENT_ID` | Backend + Vite | Google OAuth verification |
| `VITE_GOOGLE_CLIENT_ID` | Vite build | Auto-mapped from `GOOGLE_CLIENT_ID` in `vite.config.js` |
| `JWT_SECRET` | Backend | JWT signing key |
| `ENCRYPTION_MASTER_KEY` | Backend | Master key for encrypting user data |
| `ADMIN_EMAIL` | Backend | Email address that gets admin access |
| `FRONTEND_URL` | Backend | Allowed CORS origin |
| `VERCEL` | Backend | Auto-set by Vercel — do not set manually |
| `VITE_SENTRY_DSN` | Vite build | Sentry frontend error tracking |

## Troubleshooting

**`fe_sendauth: no password supplied`** — Your `DATABASE_URL` is missing the password. Double-check the Neon connection string.

**`init_db skipped on serverless cold start`** — Expected on the very first cold-start request. Tables should already exist in Neon.

**`Cannot assign requested address` (IPv6)** — Use Neon's **pooled** connection string (contains `-pooler` in the hostname).

**Health check returns `"database": "unreachable"`** — Verify `DATABASE_URL` in Vercel env vars and that your Neon project is active.

## Contributing

Bug reports and pull requests are welcome! Please [open an issue](https://github.com/dankadr/world-tracker/issues) first to discuss major changes.

See [SECURITY.md](.github/SECURITY.md) to report security vulnerabilities privately.

## Data Attribution

- World boundaries: [Natural Earth](https://www.naturalearthdata.com/) 1:50m Cultural Vectors
- Switzerland: [swisstopo](https://www.swisstopo.admin.ch/) via [swiss-boundaries-geojson](https://github.com/rkaravia/swiss-boundaries-geojson)
- Norway: [Kartverket](https://www.kartverket.no/) via [Kart-fylker-og-kommuner-json](https://github.com/AnalyseABO/Kart-fylker-og-kommuner-json), Svalbard from OpenStreetMap
- USA & Canada: publicly available GeoJSON boundary data
- US National Parks: NPS boundary data
- NYC Neighborhoods: NYC Planning / Pediacities
- Japan, Australia, Philippines: public administrative boundary datasets
- UNESCO points: [UNESCO World Heritage List](https://whc.unesco.org/)

## Support

If you find this project useful, consider buying me a tea ☕

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/dantracker)

## License

[MIT](LICENSE)
