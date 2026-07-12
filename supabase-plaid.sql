-- Plaid token vault (server-only via service role). Run in Supabase SQL Editor.

create table if not exists public.plaid_items (
  item_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_token text not null,
  institution_name text,
  updated_at timestamptz not null default now()
);

create index if not exists plaid_items_user_id_idx on public.plaid_items(user_id);

alter table public.plaid_items enable row level security;

-- No policies for anon/authenticated on purpose.
-- Only the service role (used by Vercel API routes) can read/write tokens.
revoke all on table public.plaid_items from anon, authenticated;
grant all on table public.plaid_items to service_role;
