# Debt Destroyer — secure cloud + Plaid setup

Login required. Only signed-in users can read/write the live database.

## 1. Supabase
Run in SQL Editor:
1. `supabase-setup.sql` (app state + auth lock)
2. `supabase-plaid.sql` (secure Plaid token vault)

## 2. Plaid account
1. Create a free account at [dashboard.plaid.com](https://dashboard.plaid.com)
2. Copy **client_id** and **sandbox secret**
3. Enable **Liabilities** (and optionally Transactions)

## 3. Environment variables

### Local `.env` / Vercel Project Settings
```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...

PLAID_CLIENT_ID=...
PLAID_SECRET=...
PLAID_ENV=sandbox

# Needed for "Refresh balances" after the first link
SUPABASE_SERVICE_ROLE_KEY=...
```

Never put `PLAID_SECRET` or the service role key in `VITE_` vars.

## 4. Deploy
```bash
npx vercel --prod
```

Or push to GitHub and redeploy. Then add the same env vars in Vercel and redeploy again.

## 5. Use it
1. Open the app → sign in
2. **Settings → Connect with Plaid**
3. Sandbox test creds: user `user_good`, password `pass_good` (Plaid docs)
4. Credit cards/loans import into **Debts** with a PLAID badge
5. **Refresh balances** pulls latest amounts (requires service role key)

## Notes
- Personal debts (Mom, friends) stay manual — banks don’t have those
- Sandbox is free; production Plaid is paid after trial limits
- Access tokens stay on the server (`plaid_items`), never in the browser
