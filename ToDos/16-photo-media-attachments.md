# ToDo: Photo & Media Attachments

**Date:** 2026-03-15
**Status:** Planned
**Priority:** High
**Scope:** Allow users to attach photos and short notes with media to visited regions and countries

---

## Overview

One of the most-requested features in travel apps is the ability to attach personal photos to places you've visited. Right now, users can only mark a region as visited, add a text note, and record a date. Attaching a photo transforms the tracker from a checkmark app into a personal travel journal.

## Current State

- Regions support: `visited` (bool), `date` (YYYY-MM-DD string), `notes` (text)
- All data stored as encrypted JSONB blobs per tracker in `visited_regions` table
- No binary/media storage exists anywhere in the stack
- Notes are stored server-side but limited to text
- `ShareCard` exports a static PNG of stats — no personal photos shown

## Goals

1. Allow up to **5 photos per visited region** (country or sub-region)
2. Photos stored in **Vercel Blob** (or Cloudflare R2 as fallback) — never in the database
3. Photo references (URLs) stored encrypted in a new `region_media` JSONB column or a separate DB table
4. **Client-side compression** before upload — target <500 KB per image
5. Photos visible in region detail view, on the world map tooltip, and in Share Cards
6. Support **captions** (short text per photo, max 200 chars)
7. **Progressive upload** — don't block UI while uploading
8. Graceful offline degradation — queue uploads and sync when back online

## Non-Goals

- Video support (too expensive for storage/bandwidth)
- AI-generated captions (separate feature)
- Public photo galleries (all data is private)

## Technical Design

### Storage

```
Vercel Blob (or Cloudflare R2)
  /photos/{user_id}/{tracker_id}/{region_id}/{uuid}.webp
```

- Convert to WebP on the client before upload using `canvas.toBlob('image/webp', 0.8)`
- Max dimensions: 1920x1920 (downscale on client)
- Delete orphaned photos when a region is unmarked (soft delete → hard delete after 30 days)

### Backend Changes

New table: `region_photos`

```sql
CREATE TABLE region_photos (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  tracker_id  VARCHAR(20) NOT NULL,
  region_id   VARCHAR(50) NOT NULL,
  storage_key VARCHAR(500) NOT NULL,   -- encrypted
  caption     VARCHAR(500),            -- encrypted
  created_at  TIMESTAMPTZ DEFAULT now(),
  deleted_at  TIMESTAMPTZ              -- soft delete
);
CREATE INDEX ON region_photos(user_id, tracker_id, region_id)
  WHERE deleted_at IS NULL;
```

New endpoints:
- `POST /api/media/upload-url` — generate a pre-signed upload URL for Vercel Blob
- `POST /api/media/confirm` — after client upload, store reference in DB
- `GET /api/media/{tracker_id}/{region_id}` — list photos for a region
- `DELETE /api/media/{photo_id}` — soft-delete a photo
- `POST /api/media/cleanup` (admin) — hard-delete expired soft-deleted photos

### Frontend Changes

- `useRegionPhotos(trackerId, regionId)` hook — fetch, upload, delete
- `PhotoStrip` component — horizontal scrollable strip of thumbnails in region detail
- `PhotoUploadButton` — file picker + drag-drop + camera capture (mobile)
- `PhotoLightbox` — full-screen photo viewer with caption editing
- `PhotoQueue` context — manages offline upload queue using IndexedDB
- Add photo thumbnails to `ShareCard` export

### Encryption

Storage keys and captions are encrypted using the existing `enc(uid, value)` helper before DB insert. The Blob storage URL itself is a random UUID path (not guessable) — no auth is needed on the CDN URL since it's effectively private by obscurity + the user must be authenticated to get the URL from the API.

## Implementation Phases

### Phase 1 — Backend + Storage plumbing
- [ ] Add `region_photos` table migration
- [ ] Set up Vercel Blob bucket and env var (`BLOB_READ_WRITE_TOKEN`)
- [ ] `POST /api/media/upload-url` — returns `{ uploadUrl, publicUrl }`
- [ ] `POST /api/media/confirm` — stores encrypted reference
- [ ] `GET /api/media/{tracker_id}/{region_id}` — returns decrypted URLs
- [ ] `DELETE /api/media/{photo_id}`

### Phase 2 — Frontend core
- [ ] `useRegionPhotos` hook
- [ ] Client-side image compression utility (`utils/imageCompress.js`)
- [ ] `PhotoUploadButton` component
- [ ] `PhotoStrip` component in region detail sidebar
- [ ] `PhotoLightbox` with caption editing

### Phase 3 — Offline queue + polish
- [ ] `PhotoQueue` context — IndexedDB queue for offline uploads
- [ ] Integrate photo thumbnails into `ShareCard`
- [ ] Add photo count badge to region list items
- [ ] Skeleton loading states
- [ ] Tests: upload flow, compression, encryption round-trip

## Open Questions

- Should photos be deleted if a user unmarks a visited region? (Recommendation: ask with a confirm dialog — keep photos by default)
- Vercel Blob free tier is 500 MB — need a per-user storage quota (e.g. 50 MB per user to start)
- Consider adding `storage_bytes` column to track per-user quota usage
