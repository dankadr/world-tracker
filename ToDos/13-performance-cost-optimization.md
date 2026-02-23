# ToDo: Performance & Cost Optimization

**Date:** 2026-02-24
**Status:** Not Started
**Priority:** High
**Scope:** Improve app performance and reduce backend/database costs through frontend offloading, caching, batching, and advanced algorithms

---

## Overview

The app currently relies heavily on backend API calls and database queries for most operations (visited regions, achievements, friends, challenges, bucket list, etc.). This plan aims to:
- Move more logic and data processing to the frontend
- Add caching layers to reduce database load
- Batch/queue requests to minimize API calls
- Redesign database tables for cost efficiency
- Use advanced algorithms for faster and cheaper operations

## Current State

- **Frontend:** React 18, Vite, localStorage for guest mode, all state managed in App.jsx
- **Backend:** FastAPI, PostgreSQL (Neon serverless), no Redis/memcache, no batching, no advanced caching
- **API:** CRUD endpoints for all features, no rate limiting, no cache headers
- **Database:** All user data stored in PostgreSQL, no denormalization, no partitioning

## Optimization Strategies

### 1. Move More Logic to Frontend
- Compute achievement progress, XP, and level locally (already partially done)
- Precompute map overlays, region stats, and friend comparisons in the browser
- Use localStorage/sessionStorage for temporary data (e.g., challenge progress, bucket list edits)
- Only sync to backend when necessary (on login, logout, or explicit save)
- Use Web Workers for heavy computations (e.g., map overlays, clustering)

### 2. Add Caching Layers
- **Frontend:**
  - Cache API responses in localStorage or IndexedDB (e.g., visited regions, achievements, friends)
  - Use stale-while-revalidate pattern for data fetching
  - Cache map tiles and GeoJSON files (already planned in `09-pwa-offline-support.md`)
- **Backend:**
  - Add Redis or Memcached for hot data (user profiles, achievement rules, region metadata)
  - Cache expensive queries (leaderboard, friend overlays)
  - Use cache headers for API responses (e.g., `Cache-Control: max-age=3600`)

### 3. Batch/Queue API Requests
- Collect multiple changes (e.g., marking regions, updating bucket list, challenge progress) in a queue
- Send batched requests to backend (e.g., `/api/batch` endpoint)
- Reduce number of API calls per user session
- Use background sync (already planned in `09-pwa-offline-support.md`)
- Debounce rapid changes (e.g., marking multiple regions quickly)

### 4. Database Cost Efficiency
- Analyze query patterns and optimize indexes
- Denormalize tables where needed (e.g., store achievement progress as a JSONB field)
- Partition large tables (e.g., visited regions by user)
- Use upsert instead of insert/update for region visits
- Archive old data (e.g., completed challenges, old activity feed)
- Use read replicas for analytics queries
- Consider using Neon serverless features (auto-pausing, scaling)

### 5. Advanced Algorithms
- Use spatial indexing for map queries (PostGIS, R-tree)
- Optimize friend overlay rendering with bitmask operations
- Use clustering algorithms (e.g., DBSCAN) for map overlays
- Use LZ-string or similar for compressing share URLs and stored data
- Use memoization for expensive computations (e.g., achievement progress)
- Use virtualized lists for large data sets (already planned in `12-architecture-refactor.md`)

### 6. Additional Ideas
- Add rate limiting to API endpoints to prevent abuse and reduce load
- Use CDN for static assets and GeoJSON files (already on Vercel)
- Precompute leaderboard and stats during off-peak hours (scheduled jobs)
- Use lazy loading for heavy components (already planned)
- Monitor and optimize Core Web Vitals (LCP, FID, CLS)
- Add Sentry performance monitoring for slow API calls
- Use edge functions for simple data processing (Vercel Edge)
- Consider using GraphQL for more efficient data fetching

## Implementation Plan

### Phase 1: Frontend Offloading
- Identify all logic that can be moved to frontend
- Refactor achievement, XP, and progress calculations
- Add Web Worker for map overlays
- Implement local caching for API responses

### Phase 2: Caching
- Add Redis/Memcached to backend
- Implement cache headers for API
- Add frontend stale-while-revalidate logic

### Phase 3: Batching/Queueing
- Implement API batch endpoint
- Add frontend queue for region/achievement updates
- Debounce rapid changes

### Phase 4: Database Redesign
- Analyze query logs
- Optimize indexes and partition tables
- Denormalize where needed
- Archive old data

### Phase 5: Advanced Algorithms
- Add spatial indexing
- Optimize overlay rendering
- Compress share URLs

### Phase 6: Monitoring & Testing
- Add Sentry performance monitoring
- Monitor Core Web Vitals
- Test all optimizations for regression

## Files to Create/Modify
| File | Change |
|------|--------|
| `src/utils/cache.js` | Frontend caching logic |
| `src/utils/batchQueue.js` | Frontend batching/queueing |
| `src/hooks/useAchievements.js` | Move progress logic to frontend |
| `src/hooks/useVisitedData.js` | Move region logic to frontend |
| `backend/cache.py` | Redis/Memcached integration |
| `backend/batch.py` | Batch endpoint logic |
| `backend/main.py` | Add caching, batch, and optimized queries |
| `backend/models.py` | Table redesign, partitioning |
| `backend/requirements.txt` | Add Redis/Memcached, spatial libraries |
| `vercel.json` | Add scheduled jobs for stats/leaderboard |

## Estimated Effort
- Frontend offloading: ~6-8 hours
- Caching: ~4-6 hours
- Batching/queueing: ~3-5 hours
- Database redesign: ~6-8 hours
- Advanced algorithms: ~4-6 hours
- Monitoring/testing: ~3-4 hours
- **Total: ~26-37 hours**
