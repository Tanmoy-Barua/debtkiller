# Debt Destroyer cloud setup

## 1. Create Supabase project
1. Create a project at Supabase.
2. Open **Authentication → Providers → Anonymous Sign-Ins** and enable it.
3. Open **SQL Editor**, paste `supabase-setup.sql`, and run it.
4. Open **Project Settings → API** and copy the Project URL and anon/publishable key.

## 2. Connect the app
In this project folder:

```bash
cp .env.example .env
```

Edit `.env` and enter your two Supabase values.

Then run:

```bash
npm install
npm run dev
```

The header should show `CLOUD SAVED` after data is saved.

## 3. Deploy to Vercel
1. Push this folder to GitHub or import it directly into Vercel.
2. Add these environment variables in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy.

## No-login behavior
The app silently creates an anonymous Supabase user. Data is private to that browser profile. It survives refreshes and cloud deployments, but a different browser/device receives a different anonymous identity. Keep JSON backups for recovery.
