# Travel Tracker

An interactive web app to track which regions you've visited across multiple countries. Click regions on the map or check them off in the sidebar. Supports optional Google login for cross-device sync.

## Supported Countries

- Switzerland (26 cantons)
- United States (50 states + DC + PR)
- Norway (15 counties + Svalbard)
- Canada (13 provinces & territories)

## Features

- Interactive maps with clickable region polygons
- Color-coded visited/unvisited regions per country
- Sidebar with progress stats, progress bar, and checklist
- Hover tooltips showing region names
- Optional Google Sign-In for cross-device data sync
- Guest mode uses browser localStorage (no account needed)
- Responsive layout -- works on desktop and mobile
- Runs in Docker

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
5. Create a `.env` file (see `.env.example`):

```bash
cp .env.example .env
# Edit .env and paste your Google Client ID
```

6. Start the stack:

```bash
docker compose up --build
```

Open [http://localhost:8088](http://localhost:8088) in your browser.

## Tech Stack

- **Frontend:** React 18 + Vite, Leaflet + react-leaflet
- **Backend:** Python FastAPI, SQLAlchemy (async), PostgreSQL
- **Auth:** Google Identity Services + JWT
- **Docker:** Multi-container (nginx + FastAPI + PostgreSQL)

## Data Attribution

- Switzerland: [swisstopo](https://www.swisstopo.admin.ch/) swissBOUNDARIES3D, via [swiss-boundaries-geojson](https://github.com/rkaravia/swiss-boundaries-geojson)
- Norway: [Kartverket](https://www.kartverket.no/) via [Kart-fylker-og-kommuner-json](https://github.com/AnalyseABO/Kart-fylker-og-kommuner-json), Svalbard from OpenStreetMap
- USA & Canada: publicly available GeoJSON boundary data
