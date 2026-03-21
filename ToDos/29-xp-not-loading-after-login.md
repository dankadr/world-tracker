# Bug: XP Doesn't Auto-Load After Login

**Status:** Fixed — PRs #127 + #131 open

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

## Fix
- PR #127: load XP immediately from auth response on login
- PR #131: fetch XP immediately on login (follow-up fix)

## Test Plan
- [x] Log in and check XP displays immediately
- [x] Verify no console errors during login
- [x] Compare XP value before/after page refresh
