# Bug: XP Doesn't Auto-Load After Login

**Date:** 2026-03-25
**Status:** Needs re-verification — XP sync logic exists now, but this specific regression is not explicitly covered
**Priority:** High

---

## Problem
After user logs in, XP shows as 0 or doesn't display correctly until page refresh. The XP value should be loaded immediately from the backend during authentication flow.

## Expected Behavior
- User logs in
- XP value loads immediately from authenticated API response
- XP displays in UI without requiring manual refresh

## Actual Behavior
- User logs in
- XP shows 0 or is missing
- XP appears after page reload

## Investigation Areas
1. Check `AuthContext.jsx` — is XP fetched during auth setup?
2. Check API response on login — does it include XP/stats?
3. Check profile loading sequence — is there a race condition?
4. Check state initialization — default XP value in auth state

## Related
- Possibly related to #87 (JWT expiry + auto-logout) if auth flow changed

## Current Repo Status

- `useXp.jsx` now fetches `/api/user/xp` after login and reconciles local vs remote XP
- That is a stronger implementation than when this bug was filed, but there is no dedicated test or bug note proving this exact issue is closed
- Keep this open until login-flow verification confirms immediate XP hydration on a fresh authenticated session

## Test Plan
- [ ] Log in and check XP displays immediately
- [ ] Verify no console errors during login
- [ ] Compare XP value before/after page refresh
