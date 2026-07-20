# Setup notes

Full documentation lives in **[README.md](./README.md)**.

Quick path:

1. `cp .env.example .env` and fill values (never commit `.env`)
2. Run `supabase-setup.sql` (+ `supabase-plaid.sql` if using Plaid)
3. `npm install && npm run dev`
4. Deploy with Vercel and mirror the same env vars

See README sections: **Quick start**, **Environment variables**, **Supabase setup**, **Plaid setup**, **Privacy & git hygiene**.
