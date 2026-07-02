create extension if not exists "pgcrypto";

alter table public.projects
add column if not exists avatar_url text;

alter table public.projects
add column if not exists avatar_path text;

update public.projects
set status = 'active'
where status is null;

alter table public.projects
drop constraint if exists projects_status_check;

alter table public.projects
add constraint projects_status_check
check (status in ('planning', 'active', 'paused', 'completed', 'inactive'));

update public.tasks
set
  status = 'done',
  completed_at = coalesce(completed_at, now())
where status = 'review';

alter table public.tasks
drop constraint if exists tasks_status_check;

alter table public.tasks
add constraint tasks_status_check
check (status in ('todo', 'doing', 'done', 'cancelled'));

alter table public.task_checklists
alter column id set default gen_random_uuid();
