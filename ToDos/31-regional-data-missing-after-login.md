# Bug: Regional Data Not Loaded After Login

**Status:** Fixed — `fix/regional-data-after-login`

## Problem
After user logs in, only the world map progress displays. Regional data (Swiss cantons, US states, etc.) doesn't load — it appears empty or undefined.

The data appears correctly after:
- Clicking to a specific region
- Refreshing the page
- Waiting some time

## Expected Behavior
- User logs in
- All regional data (Swiss, US states, etc.) loads immediately
- User can view progress on both world map and regional maps without additional clicks

## Actual Behavior
- User logs in
- Only world map shows progress
- Swiss cantons/US states data is missing or shows as 0/empty
- Data loads after page refresh or switching regions

## Investigation Areas
1. Check auth flow — are regional stats fetched during login?
2. Check data loading sequence — is there a timing issue?
3. Check API responses — do they include regional breakdowns?
4. Check state initialization — default values for regional data
5. Check `AuthContext.jsx` or data fetching hook — missing `await` or race condition?

## Related
- Related to bug #29 (XP not loading) — possibly same root cause
- Related to #87 if auth flow changed significantly

## Test Plan
- [ ] Log in and immediately check Swiss cantons data displays
- [ ] Log in and immediately check US states data displays
- [ ] Verify no console errors during login or data load
- [ ] Check network tab for API calls during auth flow
