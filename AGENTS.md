# AGENTS.md

## Cursor Cloud specific instructions

**Product:** "Debt Destroyer" — a single-user React + Vite SPA debt-payoff dashboard. It runs entirely in the browser and needs no backend for core functionality.

**Runs local-only by default.** With no Supabase env vars set, the app skips the login gate and stores all data in browser `localStorage` (key `debt-destroyer:v2`). This is the mode to use for development and testing — no `.env`, database, or external service is required.

**Services / commands** (all defined in `package.json`, documented in `README.md`):
- Dev server: `npm run dev` (Vite, default port 5173). This is the primary way to run the app.
- Build: `npm run build` → `dist/`. Preview: `npm run preview` (the e2e script expects it on `http://127.0.0.1:4176/`).
- Unit tests: `npm test` (theme palette checks, no browser needed).
- E2E smoke: `npm run test:e2e-theme` — requires the app already running and `E2E_BASE` pointing at it (default `http://127.0.0.1:4176/`). Uses Playwright Chromium (`npx playwright install chromium`). It fails if a Supabase login gate ("OWNER ACCESS") is present, so run it in local-only mode (no Supabase env).

**Optional / external (not needed for core dev):**
- Supabase (hosted Postgres + Auth) enables cloud login/sync; requires `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` and running `supabase-setup.sql`. There is no local Supabase — it's a hosted SaaS.
- Plaid bank-linking lives in the Vercel serverless functions under `api/`. These are NOT served by plain `vite` (only under `vercel dev` / Vercel). Note the `api/` code imports the `plaid` npm package, which is NOT in `package.json` — it must be installed separately if you work on those routes.
