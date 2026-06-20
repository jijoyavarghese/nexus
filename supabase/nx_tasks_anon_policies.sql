-- Nexus direct browser access (no login).
-- This makes every task reachable by anyone who can open the deployed app.
-- Run in Supabase Dashboard -> SQL Editor for project gkugozrvqaifnpngwkqj.

begin;

alter table public.nx_tasks enable row level security;
grant select, insert, update, delete on public.nx_tasks to anon;

drop policy if exists "Nexus anonymous task read" on public.nx_tasks;
drop policy if exists "Nexus anonymous task create" on public.nx_tasks;
drop policy if exists "Nexus anonymous task update" on public.nx_tasks;
drop policy if exists "Nexus anonymous task delete" on public.nx_tasks;

create policy "Nexus anonymous task read"
on public.nx_tasks for select to anon using (true);

create policy "Nexus anonymous task create"
on public.nx_tasks for insert to anon with check (true);

create policy "Nexus anonymous task update"
on public.nx_tasks for update to anon using (true) with check (true);

create policy "Nexus anonymous task delete"
on public.nx_tasks for delete to anon using (true);

commit;
