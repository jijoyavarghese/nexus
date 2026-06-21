-- Run in Supabase Dashboard -> SQL Editor before deploying the reminder-time upgrade.
-- Adds optional per-task timestamp reminders; existing tasks remain unchanged.

alter table public.nx_tasks
  add column if not exists reminder_at timestamptz,
  add column if not exists reminder_sent_at timestamptz;

create index if not exists nx_tasks_pending_reminders_idx
on public.nx_tasks (reminder_at)
where reminder_at is not null and reminder_sent_at is null;
