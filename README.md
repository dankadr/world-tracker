# Travel Tracker

An interactive web app to track your travels across the world. Mark countries on the world map, explore detailed region trackers, visit world capitals, and unlock achievements along the way. Supports optional Google login for cross-device sync.

## Supported Trackers

| Tracker | Regions | Mode |
|---------|---------|------|
| 🌍 World Map | 238 countries | Polygon |
| 🏛️ World Capitals | 192 capitals | Point |
| 🇨🇭 Switzerland | 26 cantons | Polygon |
| 🇺🇸 United States | 50 states + DC + PR | Polygon |
| 🏞️ US National Parks | 63 parks | Point |
| 🗽 NYC | 188 neighborhoods | Polygon |
| 🇳🇴 Norway | 15 counties + Svalbard | Polygon |
| 🇨🇦 Canada | 13 provinces & territories | Polygon |

## Features

- **World Map** — interactive choropleth with 238 countries (Natural Earth 50m)
- **Region Trackers** — drill into 8 sub-trackers with detailed maps
- **World Capitals** — track 192 capital cities as points on a global map
- **Achievements** — 80+ unlockable badges across General, World, Capitals, and per-tracker categories
- **Stats Dashboard** — detailed statistics with continent breakdown, travel timeline, and distance metrics
- **Avatar Editor** — customizable travel avatar
- **Trip Notes & Dates** — add visit dates and notes to each region
- **Wishlist / Planned** — mark regions you want to visit next
- **Export** — export your map as an image
- **Share** — generate a shareable link of your progress
- **Dark Mode** — toggle between light and dark themes
- **Keyboard Shortcuts** — quick navigation between trackers
- **Google Sign-In** — optional cross-device sync via Google OAuth
- **Guest Mode** — uses browser localStorage, no account needed
- **Responsive** — works on desktop and mobile
- **Dockerized** — runs with Docker Compose (nginx + FastAPI + PostgreSQL)

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

- **Frontend:** React 18 + Vite 6, Leaflet + react-leaflet
- **Backend:** Python FastAPI, SQLAlchemy (async), PostgreSQL
- **Auth:** Google Identity Services + JWT
- **Docker:** Multi-container (nginx + FastAPI + PostgreSQL)

## Data Attribution

- World boundaries: [Natural Earth](https://www.naturalearthdata.com/) 1:50m Cultural Vectors
- Switzerland: [swisstopo](https://www.swisstopo.admin.ch/) swissBOUNDARIES3D, via [swiss-boundaries-geojson](https://github.com/rkaravia/swiss-boundaries-geojson)
- Norway: [Kartverket](https://www.kartverket.no/) via [Kart-fylker-og-kommuner-json](https://github.com/AnalyseABO/Kart-fylker-og-kommuner-json), Svalbard from OpenStreetMap
- USA & Canada: publicly available GeoJSON boundary data
- US National Parks: NPS boundary data
- NYC Neighborhoods: NYC Planning / Pediacities
