# Debt Destroyer — secure cloud setup

Login required. Only signed-in users can read/write the live database.

## Credentials
Use the owner email/password created for this project (saved outside git).

## App connection
`.env` (local) and Vercel env vars:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
```

## Database lock
Run `supabase-setup.sql` in the Supabase SQL Editor. It:
- revokes public `anon` access to `app_state`
- allows only the `authenticated` role
- keeps the shared live row for sync across your devices after login

## Deploy
Push to GitHub → Vercel auto-deploys, or:

```bash
npx vercel --prod
```

## Security notes
- Passwords are hashed by Supabase Auth (not stored in the app)
- Sessions use secure tokens with auto-refresh
- Wrong password attempts are rate-limited
- No public signup UI in the app — only login
- Keep your password private; rotate it in Supabase Auth if leaked
