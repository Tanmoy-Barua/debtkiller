# Debt Destroyer — shared cloud setup (no login)

Anyone with the app URL can load and save the same live data. No sign-in.

## 1. Create Supabase project
1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste `supabase-setup.sql`, and run it.
3. Open **Project Settings → API** and copy:
   - Project URL
   - anon / public key

## 2. Connect the app
In this project folder:

```bash
cp .env.example .env
```

Edit `.env`:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Then:

```bash
npm install
npm run dev
```

The header should show **CLOUD SAVED** after data saves. Open the same app on another device — changes sync live.

## 3. Deploy to Vercel
1. Import this GitHub repo into Vercel.
2. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy.

## Notes
- Data is stored in one shared Supabase row (`id = shared`).
- A local backup still saves in the browser if the network is down.
- Anyone who has your deployed URL (and the public anon key in the frontend) can read/write this data — treat the URL like a private link.
