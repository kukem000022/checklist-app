create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_task_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if new.status = 'done' and old.status is distinct from 'done' then
    new.completed_at = now();
  end if;
  if new.status <> 'done' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_task_updated_at();

drop trigger if exists app_roles_set_updated_at on public.app_roles;
create trigger app_roles_set_updated_at
before update on public.app_roles
for each row execute function public.set_updated_at();

drop trigger if exists daily_task_templates_set_updated_at on public.daily_task_templates;
create trigger daily_task_templates_set_updated_at
before update on public.daily_task_templates
for each row execute function public.set_updated_at();

create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

create table if not exists public.task_members (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

alter table public.task_members enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.is_manager_for_project(project_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    join public.profiles p on p.id = pm.user_id
    where pm.project_id = project_uuid
      and pm.user_id = auth.uid()
      and pm.role_in_project = 'manager'
      and p.status = 'active'
  );
$$;

create or replace function public.is_task_member(task_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.task_members tm
    where tm.task_id = task_uuid
      and tm.user_id = auth.uid()
  );
$$;

drop policy if exists "task_members_select_task_scope" on public.task_members;
create policy "task_members_select_task_scope" on public.task_members
for select using (
  public.is_admin()
  or user_id = auth.uid()
  or exists (
    select 1 from public.tasks
    where tasks.id = task_members.task_id
      and (
        tasks.assignee_id = auth.uid()
        or tasks.creator_id = auth.uid()
        or public.is_manager_for_project(tasks.project_id)
      )
  )
);

drop policy if exists "task_members_write_task_scope" on public.task_members;
create policy "task_members_write_task_scope" on public.task_members
for all using (
  exists (
    select 1 from public.tasks
    where tasks.id = task_members.task_id
      and (
        public.is_admin()
        or tasks.assignee_id = auth.uid()
        or tasks.creator_id = auth.uid()
        or public.is_manager_for_project(tasks.project_id)
      )
  )
)
with check (
  exists (
    select 1 from public.tasks
    where tasks.id = task_members.task_id
      and (
        public.is_admin()
        or tasks.assignee_id = auth.uid()
        or tasks.creator_id = auth.uid()
        or public.is_manager_for_project(tasks.project_id)
      )
  )
);

drop policy if exists "tasks_select_scope" on public.tasks;
create policy "tasks_select_scope" on public.tasks
for select using (
  public.is_admin()
  or creator_id = auth.uid()
  or assignee_id = auth.uid()
  or public.is_task_member(id)
  or public.is_manager_for_project(project_id)
);

drop policy if exists "tasks_update_scope" on public.tasks;
create policy "tasks_update_scope" on public.tasks
for update using (
  public.is_admin()
  or assignee_id = auth.uid()
  or creator_id = auth.uid()
  or public.is_task_member(id)
  or public.is_manager_for_project(project_id)
)
with check (
  public.is_admin()
  or assignee_id = auth.uid()
  or creator_id = auth.uid()
  or public.is_task_member(id)
  or public.is_manager_for_project(project_id)
);

drop policy if exists "checklists_write_task_scope" on public.task_checklists;
create policy "checklists_write_task_scope" on public.task_checklists
for all using (
  exists (
    select 1 from public.tasks
    where tasks.id = task_checklists.task_id
      and (
        public.is_admin()
        or tasks.assignee_id = auth.uid()
        or tasks.creator_id = auth.uid()
        or public.is_task_member(tasks.id)
        or public.is_manager_for_project(tasks.project_id)
      )
  )
)
with check (
  exists (
    select 1 from public.tasks
    where tasks.id = task_checklists.task_id
      and (
        public.is_admin()
        or tasks.assignee_id = auth.uid()
        or tasks.creator_id = auth.uid()
        or public.is_task_member(tasks.id)
        or public.is_manager_for_project(tasks.project_id)
      )
  )
);
