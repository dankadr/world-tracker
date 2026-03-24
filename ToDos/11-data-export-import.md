# ToDo: Data Export & Import

**Date:** 2026-02-24
**Status:** Partially complete — JSON export/import and CSV export UI are already implemented
**Priority:** Medium
**Scope:** Enable users to export all their travel data (visited regions, achievements, avatar config, bucket list, challenges, trips) as CSV/JSON, and import from other apps or backups

---

## Overview

The app now supports map image export plus a first-pass JSON/CSV export-import flow in Settings, but it still falls short of full account portability. This plan covers the remaining work for fuller CSV/JSON export, import, and privacy compliance (GDPR data portability).

## Current State

- **Map export:** `src/components/ExportButton.jsx` — exports map as PNG
- **Data export UI shipped:** `src/components/DataExport.jsx` is wired into `src/components/SettingsPanel.jsx`
- **Data import UI shipped:** `src/components/DataImport.jsx` is wired into `src/components/SettingsPanel.jsx`
- **JSON export shipped:** `src/utils/dataExport.js` exports visited data, user profile basics, wishlist, and challenges
- **CSV export shipped:** tracker CSV export and wishlist CSV export exist
- **JSON import partially shipped:** visited-world and per-tracker visited data can be merged or overwritten for guest/auth users
- **Still missing from the original scope:** backend-first export/import endpoints, CSV import, avatar/achievement/friends/full-account portability, and trip data support

## Export Formats

### JSON (full data dump)
- All user data in a single JSON file
- Structure:
```json
{
  "visited": { "world": [...], "ch": [...], ... },
  "achievements": [...],
  "avatar": { ... },
  "bucketList": [...],
  "challenges": [...],
  "trips": [...],
  "friends": [...],
  "emailPreferences": { ... }
}
```

### CSV (per tracker)
- Each tracker as a separate CSV file
- Columns: region_id, region_name, visited_date, notes, achievement_ids
- Bucket list: region_id, region_name, priority, target_date, notes
- Challenges: challenge_id, title, type, status, progress
- Trips: trip_id, name, start_date, end_date, stops, activities

### Map Image (existing)
- Export map as PNG (already implemented)

## Import

- JSON import for data migration or backup restore
- Validate imported data (region IDs, achievement IDs, avatar config)
- Conflict resolution: merge vs. overwrite
- Preview imported data before applying
- Error handling: show invalid entries, skip or fix

## Privacy & Compliance

- GDPR "right to data portability" — users can export all personal data
- Export includes email preferences, account info, friends
- Data deletion on account deletion

## Implementation Plan

### Phase 1: Backend Endpoints
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/export/json` | Export all user data as JSON |
| `GET` | `/api/export/csv/{tracker_id}` | Export tracker data as CSV |
| `POST` | `/api/import/json` | Import user data from JSON |
| `POST` | `/api/import/csv/{tracker_id}` | Import tracker data from CSV |

### Phase 2: Frontend Components
| Component | Purpose |
|-----------|---------|
| `src/components/DataExport.jsx` | Export options UI (JSON, CSV, map image) |
| `src/components/DataImport.jsx` | Import UI (file upload, preview, apply) |
| `src/components/ExportButton.jsx` | Add export options dropdown |
| `src/components/ImportButton.jsx` | Add import button to settings/profile |

### Phase 3: Guest Mode
- Export guest mode data from localStorage
- Import into guest mode (merge or overwrite)
- On login, sync imported data to server

### Phase 4: Testing Checklist
- [ ] Export all data as JSON (authenticated and guest mode)
- [ ] Export tracker data as CSV
- [ ] Import JSON backup, preview, apply
- [ ] Import CSV tracker data
- [ ] Merge imported data with existing (no duplicates)
- [ ] Overwrite option works (replace all data)
- [ ] Error handling for invalid region IDs, achievement IDs
- [ ] Map image export still works
- [ ] GDPR compliance: export includes all personal data
- [ ] Data deletion on account deletion

## Files to Create
| File | Purpose |
|------|---------|
| `src/components/DataExport.jsx` | Export UI |
| `src/components/DataImport.jsx` | Import UI |
| `backend/export_service.py` | Export/import logic |
| `backend/models.py` | Add export/import log model |

## Files to Modify
| File | Change |
|------|--------|
| `src/components/ExportButton.jsx` | Add export options |
| `src/components/ImportButton.jsx` | Add import button |
| `backend/main.py` | Add export/import endpoints |
| `backend/requirements.txt` | Add CSV/JSON libraries |

## Estimated Effort
- Backend endpoints: ~4-5 hours
- Frontend UI: ~4-5 hours
- Guest mode support: ~2-3 hours
- Testing & compliance: ~2-3 hours
- **Total: ~12-16 hours**
