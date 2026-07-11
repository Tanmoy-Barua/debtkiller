-- Run this once in Supabase: SQL Editor -> New query -> Run
-- Shared no-login store: one row that any device can read/write with the anon key.

drop table if exists public.app_state;

create table public.app_state (
  id text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

grant select, insert, update on table public.app_state to anon, authenticated;

drop policy if exists "Anyone can read shared state" on public.app_state;
drop policy if exists "Anyone can insert shared state" on public.app_state;
drop policy if exists "Anyone can update shared state" on public.app_state;

create policy "Anyone can read shared state"
on public.app_state for select
to anon, authenticated
using (true);

create policy "Anyone can insert shared state"
on public.app_state for insert
to anon, authenticated
with check (true);

create policy "Anyone can update shared state"
on public.app_state for update
to anon, authenticated
using (true)
with check (true);

insert into public.app_state (id, state)
values ('shared', '{}'::jsonb)
on conflict (id) do nothing;

-- Live updates across devices (Realtime)
do $$
begin
  alter publication supabase_realtime add table public.app_state;
exception
  when duplicate_object then null;
end $$;
