# Right World Tracker

Your world. Your journey. — An interactive travel tracker where you mark countries, explore detailed region maps, track capitals and UNESCO sites, set goals, and unlock achievements. Supports optional Google login for cross-device sync.

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

## Feature Highlights

- **World + Regional Maps** — 12 tracker views with polygon and point datasets.
- **UNESCO Overlay** — optional UNESCO World Heritage layer with **270 sites**.
- **Bucket List Planner** — add planned trips, target dates, and mark destinations complete.
- **Travel Challenges** — create personal or friend challenges with streak-friendly progress.
- **XP + Levels** — gain XP for visits, achievements, and milestones.
- **Achievements** — **131** unlockable badges spanning global and tracker-specific goals.
- **Friends + Comparison** — share progress, compare maps, and use friend overlays.
- **Stats Dashboard** — timeline, continent stats, totals, and progress summaries.
- **Year in Review** — generate annual travel summaries and sharing cards.
- **Trip Notes & Dates** — attach notes and dates to any visited destination.
- **Wishlist / Planned** — mark places to visit next and manage a global wish list.
- **Map Layer Controls** — switch base maps (clean, labels, satellite, terrain).
- **Export + Share** — export map visuals and generate share links.
- **Geography Mini Games** — Map Quiz, Flag Quiz, and Capital Quiz — test your knowledge on blank maps with scored rounds, high scores, and multiple difficulty modes. *(In Progress)*
- **Dark Mode + Mobile UX** — optimized for desktop and touch devices.
- **Google Sign-In or Guest Mode** — local-only mode or account sync.

## Geography Mini Games *(In Progress)*

An interactive games section accessible from the Explore tab that tests your geographical knowledge using the app's existing map infrastructure.

### Game Modes

| Mode | Description |
|------|-------------|
| 🗺️ **Map Quiz** | A blank world map highlights a random country — type or select its name |
| 🚩 **Flag Quiz** | Identify a country from its flag (or pick the correct flag for a country name) |
| 🏛️ **Capital Quiz** | Name the capital of a highlighted country, or identify the country from its capital |

### How It Works

- All three modes share a common game engine (`useGeographyGame` hook) that handles shuffling, scoring, timer, and state transitions
- **Score tracking:** correct / incorrect / skipped counts per session
- **High scores** saved to localStorage per mode
- **Quiz pools** can be scoped: all countries, only visited, only unvisited — integrating with your personal tracker data
- **Result screen** shows score breakdown and a replay button after each session

### Architecture

```
GamesPanel (mode selector)
├── MapQuiz      → useGeographyGame(worldPool, options)
├── FlagQuiz     → useGeographyGame(worldPool, options)
└── CapitalQuiz  → useGeographyGame(capitalPool, options)
                        └── GameResultScreen (shared)
```

**Key files:**
- `src/hooks/useGeographyGame.js` — shared game engine (shuffling, scoring, timer, state machine)
- `src/components/GamesPanel.jsx` — mode selection screen
- `src/components/MapQuiz.jsx` — blank map click-to-guess UI using Leaflet
- `src/components/FlagQuiz.jsx` — flag display + multiple choice or text input
- `src/components/CapitalQuiz.jsx` — capital city round
- `src/components/GameResultScreen.jsx` — shared end screen with score breakdown

---

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

### Frontend (Vitest)

```bash
npm test
```

### Backend (pytest)

```bash
# Install test dependencies (once)
pip install -r backend/requirements-dev.txt

# Run the test suite
cd backend && pytest -v
```

## Deploy to Vercel

### 1. Set up Neon PostgreSQL

1. Create a free project at [neon.tech](https://neon.tech)
2. Copy the **pooled** connection string from **Connection Details**:
   ```
   postgresql://user:pass@ep-xyz-pooler.region.aws.neon.tech/neondb?sslmode=require
   ```

> **Tip:** You can also add Neon as a Vercel Storage integration — it will auto-populate `POSTGRES_URL` and `PG*` env vars.

### 2. Configure Vercel environment variables

In your Vercel project → **Settings** → **Environment Variables**, add:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon pooled connection string (see above) |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth 2.0 Client ID |
| `JWT_SECRET` | Yes | Random secret for signing JWTs (`openssl rand -hex 32`) |
| `VITE_SENTRY_DSN` | No | Sentry DSN for frontend error tracking |

> **Note:** `VERCEL=1` is set automatically by Vercel — do not set it manually.

### 3. Add your Vercel URL to Google OAuth

In the [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials** → your OAuth Client ID, add your Vercel production URL to **Authorized JavaScript origins**:
```
https://your-app.vercel.app
```

### 4. Deploy

```bash
# Install Vercel CLI (if needed)
npm i -g vercel

# Deploy
vercel --prod
```

Or just push to your connected Git repo — Vercel deploys automatically.

### 5. Verify

- Visit `https://your-app.vercel.app/api/health` — should return `{"status":"ok","database":"connected"}`
- Try logging in with Google
- Check **Vercel → Logs** for structured log output from the serverless function

## Environment Variables Reference

| Variable | Used in | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | Backend | PostgreSQL connection string |
| `POSTGRES_URL` | Backend (fallback) | Auto-set by Vercel Neon integration |
| `PGHOST` / `PGUSER` / `PGPASSWORD` / `PGDATABASE` | Backend (fallback) | Individual PG vars |
| `GOOGLE_CLIENT_ID` | Backend + Vite | Google OAuth verification |
| `VITE_GOOGLE_CLIENT_ID` | Vite build | Exposed to frontend (auto-mapped from `GOOGLE_CLIENT_ID` in `vite.config.js`) |
| `JWT_SECRET` | Backend | JWT signing key |
| `VERCEL` | Backend | Auto-set by Vercel to `"1"` — do not set manually |
| `VITE_SENTRY_DSN` | Vite build | Sentry frontend error tracking |

## Troubleshooting

### `fe_sendauth: no password supplied`
Your `DATABASE_URL` is missing the password or pointing to the wrong host. Double-check the Neon connection string in Vercel env vars.

### `init_db skipped on serverless cold start`
This warning is expected on the very first request after a cold start if the database is momentarily unreachable. Tables should already exist in Neon. If it persists, check your `DATABASE_URL`.

### `Cannot assign requested address` (IPv6)
Vercel's Lambda runtime may not support IPv6. Use Neon's **pooled** connection string (contains `-pooler` in the hostname) which resolves to IPv4.

### Health check returns `"database": "unreachable"`
Verify `DATABASE_URL` is set correctly in Vercel env vars and that your Neon project is active (free-tier projects suspend after 5 minutes of inactivity — the first request wakes them up).

## Data Attribution

- World boundaries: [Natural Earth](https://www.naturalearthdata.com/) 1:50m Cultural Vectors
- Switzerland: [swisstopo](https://www.swisstopo.admin.ch/) swissBOUNDARIES3D, via [swiss-boundaries-geojson](https://github.com/rkaravia/swiss-boundaries-geojson)
- Norway: [Kartverket](https://www.kartverket.no/) via [Kart-fylker-og-kommuner-json](https://github.com/AnalyseABO/Kart-fylker-og-kommuner-json), Svalbard from OpenStreetMap
- USA & Canada: publicly available GeoJSON boundary data
- US National Parks: NPS boundary data
- NYC Neighborhoods: NYC Planning / Pediacities
- Japan, Australia, Philippines: public administrative boundary datasets
- UNESCO points: [UNESCO World Heritage List](https://whc.unesco.org/)

## License

MIT
