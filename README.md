# Debt Destroyer

Private debt-payoff dashboard for tracking cards, loans, personal IOUs, daily Uber-style earnings, tax set-aside, gas budget, and payoff plans. Built with React + Vite, optional Supabase auth/sync, and optional Plaid liability linking.

---

## Table of contents

1. [Features](#features)
2. [Stack](#stack)
3. [Project layout](#project-layout)
4. [Quick start](#quick-start)
5. [Environment variables](#environment-variables)
6. [Supabase setup](#supabase-setup)
7. [Plaid setup](#plaid-setup)
8. [Scripts](#scripts)
9. [Deploy (Vercel)](#deploy-vercel)
10. [Themes](#themes)
11. [Privacy & git hygiene](#privacy--git-hygiene)
12. [Troubleshooting](#troubleshooting)

---

## Features

| Area | What you get |
|------|----------------|
| **Debts** | Cards, loans, personal IOUs; APR, mins, deadlines; avalanche / snowball |
| **Money** | Earnings + expenses, recurring templates, tax wallet, car buffer |
| **Home** | Daily target, catch-up, gas vs budget, payment schedule, streak |
| **Charts** | Earnings vs target, debt remaining over time |
| **Plans** | Aggressive / realistic monthly targets + what-if daily override |
| **Cloud** | Optional Supabase login + sync across devices |
| **Theme** | Dark / Light / System (Settings → Appearance) |
| **Backup** | JSON + CSV export/import |
| **Plaid** | Optional bank/card liability import (API ready; UI may show roadmap) |

---

## Stack

- **Frontend:** React 18, Vite 5, Recharts, Lucide, jsPDF  
- **Auth / DB:** Supabase (optional; local-only mode works without it)  
- **Bank link:** Plaid Liabilities API (optional; Vercel serverless routes under `api/`)  
- **Hosting:** Vercel-friendly (`vercel.json`)

---

## Project layout

```
.
├── api/                      # Vercel serverless (Plaid + auth helpers)
│   ├── _lib/                 # Shared server utilities
│   └── plaid/                # create-link-token, exchange, sync
├── scripts/                  # Node/Playwright smoke tests
├── src/
│   ├── App.jsx               # Main UI
│   ├── cloudStore.js         # Auth, load/save, realtime
│   ├── theme.js              # Light / dark palettes
│   ├── plaidApi.js           # Browser Plaid client helpers
│   └── PlaidConnect.jsx      # Plaid Link UI component
├── supabase-setup.sql        # app_state + RLS
├── supabase-plaid.sql        # plaid_items vault (service role only)
├── .env.example              # Safe template (copy → .env)
├── SETUP.md                  # Short pointer to this README
└── README.md                 # You are here
```

---

## Quick start

**Requirements:** Node.js ≥ 20.19

```bash
# 1) Install
npm install

# 2) Configure (optional for local-only; required for cloud login)
cp .env.example .env
# Edit .env — never commit this file

# 3) Dev server
npm run dev

# 4) Production build
npm run build
npm run preview
```

Without Supabase env vars, the app runs in **local-only** mode (data in `localStorage`).

---

## Environment variables

Copy [`.env.example`](./.env.example) → `.env`.

| Variable | Where | Purpose |
|----------|--------|---------|
| `VITE_SUPABASE_URL` | Browser | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Browser | Anon / publishable key |
| `VITE_OWNER_EMAIL` | Browser | Allowed owner login email (your address) |
| `PLAID_CLIENT_ID` | Server | Plaid client id |
| `PLAID_SECRET` | Server | Plaid secret (**not** `VITE_`) |
| `PLAID_ENV` | Server | `sandbox` / `development` / `production` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Persist Plaid items + refresh sync |

**Rules**

- Never put secrets in `VITE_` variables (they ship to the browser).  
- Never commit `.env`, backups, or exports that contain real balances.  
- Set `VITE_OWNER_EMAIL` to **your** email; keep it out of git (only in local/Vercel env).

---

## Supabase setup

1. Create a Supabase project and an Auth user (email/password) matching `VITE_OWNER_EMAIL`.
2. In the SQL Editor, run in order:
   1. [`supabase-setup.sql`](./supabase-setup.sql) — `app_state` table, policies, realtime  
   2. [`supabase-plaid.sql`](./supabase-plaid.sql) — `plaid_items` vault (service role only)
3. Put URL + anon key + owner email into `.env` (and Vercel).

Login is **owner-only**: the email must match `VITE_OWNER_EMAIL`.

---

## Plaid setup

1. Create an app at [dashboard.plaid.com](https://dashboard.plaid.com).  
2. Enable **Liabilities** (optional: Transactions).  
3. Set `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV=sandbox` on the server (Vercel).  
4. Add `SUPABASE_SERVICE_ROLE_KEY` so “Refresh balances” can store/read tokens.  
5. Sandbox test user (from Plaid docs): `user_good` / `pass_good`.

Access tokens live in `plaid_items` and are never sent to the browser.

Personal IOUs are not in banks — keep those debts manual.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve `dist/` locally |
| `npm test` | Theme unit checks |
| `npm run test:e2e-theme` | Browser smoke (Playwright; app must be running) |

---

## Deploy (Vercel)

```bash
npx vercel --prod
```

Or connect the GitHub repo and deploy on push.

Then set the same env vars in **Vercel → Project → Settings → Environment Variables** and redeploy.

`vercel.json` points the framework at Vite and `dist/`.

---

## Themes

**Settings → Appearance → Theme**

- **Dark** — night cockpit (default)  
- **Light** — cool steel surfaces  
- **System** — follows OS `prefers-color-scheme`

Preference is stored in app settings (local and/or cloud).

---

## Privacy & git hygiene

This repo is meant to stay free of personal finance data and personal identifiers.

**Do not commit**

- `.env` / real API keys / service role keys  
- JSON backups (`debt-destroyer-backup-*.json`)  
- Exports under `exports/`  
- Anything with real names, emails, or balances

**Already enforced**

- Broad [`.gitignore`](./.gitignore) for secrets, backups, OS/editor junk  
- Owner email via `VITE_OWNER_EMAIL` (not hardcoded)  
- Seed debts use generic labels (`Friend IOU 01`, `Family Loan 01`, …)

**If you previously committed secrets:** rotate those keys in Supabase/Plaid/Vercel and remove them from git history.

---

## Troubleshooting

| Symptom | Likely fix |
|---------|------------|
| Login says owner email not configured | Set `VITE_OWNER_EMAIL` in `.env` / Vercel |
| “Cloud auth is not configured” | Set `VITE_SUPABASE_URL` + anon/publishable key |
| Data empty after refresh (local mode) | Confirm you’re on a build that includes local persistence fixes; check `localStorage` key `debt-destroyer:v2` |
| Plaid “not configured” | Add `PLAID_CLIENT_ID` + `PLAID_SECRET` on the **server** |
| Refresh balances 503 | Add `SUPABASE_SERVICE_ROLE_KEY` and run `supabase-plaid.sql` |
| Wrong account can see seed-like debts | Non-owner rows matching seed markers are purged; confirm owner email env |

---

## License

Private project (`"private": true` in `package.json`). Do not publish secrets or personal financial data.
