## Plan: Vercel Env, Search Fix & Sentry Integration

**TL;DR:** Three changes — (1) wire up Vercel environment variables so the frontend's `VITE_GOOGLE_CLIENT_ID` works both locally and on Vercel, (2) fix the world country search by adding a scrollable content wrapper to `WorldSidebar` (the sidebar has `overflow: hidden` with no inner scroll container, so search results get clipped), and (3) add Sentry error tracking per the screenshot instructions.

**Steps**

### 1. Environment Variables for Vercel

- **Add `VITE_GOOGLE_CLIENT_ID`** to `.env` — Vite only exposes env vars with the `VITE_` prefix to the frontend. Currently only `GOOGLE_CLIENT_ID` exists (no `VITE_` prefix), so `import.meta.env.VITE_GOOGLE_CLIENT_ID` in `src/components/AuthButton.jsx:4` is `undefined` during local dev.
  - Add line: `VITE_GOOGLE_CLIENT_ID=<same value as GOOGLE_CLIENT_ID>`
- **Add `VITE_GOOGLE_CLIENT_ID` in Vercel dashboard** — you already have `GOOGLE_CLIENT_ID` set, but you also need `VITE_GOOGLE_CLIENT_ID` since Vite reads it at **build time**. Go to Vercel → Settings → Environment Variables → add `VITE_GOOGLE_CLIENT_ID` with the same Google Client ID value.
- **No backend changes needed** — `DATABASE_URL`, `JWT_SECRET`, and `GOOGLE_CLIENT_ID` are already set in Vercel and accessed via `os.getenv()` in `api/index.py` / `backend/main.py`, which works automatically on Vercel.

### 2. Fix World Country Search

The root cause: `src/App.css:63-77` sets `.sidebar` to `overflow: hidden` with `display: flex; flex-direction: column`. The regular `Sidebar` wraps its list content in a `<div className="canton-list">` which has `flex: 1; overflow-y: auto` (`App.css:512-515`), making it scrollable. But `WorldSidebar` places all content (stats, search, achievements, continents) as direct children of the sidebar — so everything past the visible area is clipped and un-scrollable.

- **In `src/components/WorldSidebar.jsx`:** Wrap everything after `</div>` (closing the `sidebar-header` div) in a `<div className="world-sidebar-content">` wrapper — from the `<AuthButton />` down through the closing `</aside>`.
- **In `src/App.css`:** Add a new CSS rule:
  ```css
  .world-sidebar-content { flex: 1; overflow-y: auto; padding-bottom: 20px; }
  ```
  Plus matching scrollbar styles similar to `.canton-list`.

### 3. Sentry SDK Integration

Per the screenshot from Vercel's Sentry integration page:

- **Install package:** `npm install --save @sentry/react`
- **Initialize in `src/main.jsx`:** Add `import * as Sentry from "@sentry/react"` and call `Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN })` before `ReactDOM.createRoot(...)`.
- **Add `VITE_SENTRY_DSN` env var:**
  - In Vercel dashboard: add `VITE_SENTRY_DSN` with the DSN string from Sentry (you'll get this from the Sentry integration panel — click "Show secret" in the screenshot).
  - In `.env`: add `VITE_SENTRY_DSN=<your DSN>` for local dev.
- **Optional source maps:** Run `npx @sentry/wizard@latest -i sourcemaps --saas --coming-from vercel` (as shown in the screenshot) to auto-configure the Vite plugin for readable stack traces. This will modify `vite.config.js` to add `@sentry/vite-plugin`.

**Verification**

1. **Env vars:** Run `npm run dev` locally → the Google Sign-In button should appear (not hidden). On Vercel, deploy and confirm auth works.
2. **Search fix:** Open the World view → type a country name → results should appear in a scrollable list below the search input, and the entire sidebar should scroll.
3. **Sentry:** Add a test button `<button onClick={() => {throw new Error("Test!")}}>Test</button>` temporarily, trigger it, and confirm the error appears in your Sentry dashboard. Remove after verification.

**Decisions**
- Chose a scrollable wrapper approach for the search fix rather than changing `.sidebar` overflow globally (to avoid side effects on the detail sidebar).
- Sentry DSN is read from a `VITE_` env var (not hardcoded) for security and consistency with the existing env var pattern.
