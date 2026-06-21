-- Nexus browser push subscriptions. Run in Supabase Dashboard -> SQL Editor.
-- The board has no login, so any browser that opts in receives shared reminders.

create table if not exists public.nx_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nx_push_subscriptions enable row level security;
grant select, insert, update, delete on public.nx_push_subscriptions to anon;

drop policy if exists "Nexus anonymous subscription read" on public.nx_push_subscriptions;
drop policy if exists "Nexus anonymous subscription create" on public.nx_push_subscriptions;
drop policy if exists "Nexus anonymous subscription update" on public.nx_push_subscriptions;
drop policy if exists "Nexus anonymous subscription delete" on public.nx_push_subscriptions;

create policy "Nexus anonymous subscription read"
on public.nx_push_subscriptions for select to anon using (true);

create policy "Nexus anonymous subscription create"
on public.nx_push_subscriptions for insert to anon with check (true);

create policy "Nexus anonymous subscription update"
on public.nx_push_subscriptions for update to anon using (true) with check (true);

create policy "Nexus anonymous subscription delete"
on public.nx_push_subscriptions for delete to anon using (true);
