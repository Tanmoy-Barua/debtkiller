-- Secure login store: only signed-in users can read/write.
-- Run in Supabase SQL Editor after creating the owner account.

-- Keep existing data; tighten access
revoke all on table public.app_state from anon;
grant select, insert, update on table public.app_state to authenticated;

drop policy if exists "Anyone can read shared state" on public.app_state;
drop policy if exists "Anyone can insert shared state" on public.app_state;
drop policy if exists "Anyone can update shared state" on public.app_state;
drop policy if exists "Authenticated users can read shared state" on public.app_state;
drop policy if exists "Authenticated users can insert shared state" on public.app_state;
drop policy if exists "Authenticated users can update shared state" on public.app_state;

create policy "Authenticated users can read shared state"
on public.app_state for select
to authenticated
using (true);

create policy "Authenticated users can insert shared state"
on public.app_state for insert
to authenticated
with check (true);

create policy "Authenticated users can update shared state"
on public.app_state for update
to authenticated
using (true)
with check (true);

-- Ensure shared row exists
insert into public.app_state (id, state)
values ('shared', '{}'::jsonb)
on conflict (id) do nothing;

-- Realtime (safe if already added)
do $$
begin
  alter publication supabase_realtime add table public.app_state;
exception
  when duplicate_object then null;
end $$;
