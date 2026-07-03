create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  role text not null default 'staff' check (role in ('admin', 'manager', 'staff')),
  department text,
  telegram_chat_id text,
  avatar_url text,
  avatar_path text,
  status text not null default 'active' check (status in ('active', 'inactive', 'locked')),
  created_at timestamptz not null default now()
);

create table if not exists public.app_roles (
  id text primary key,
  name text not null,
  description text,
  permissions text[] not null default '{}',
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id text not null references public.app_roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  manager_id uuid references public.profiles(id),
  telegram_group_chat_id text,
  avatar_url text,
  avatar_path text,
  start_date date,
  end_date date,
  status text not null default 'active' check (status in ('planning', 'active', 'paused', 'completed', 'inactive')),
  created_at timestamptz not null default now()
);

alter table public.projects
add column if not exists telegram_group_chat_id text;

alter table public.projects
add column if not exists avatar_url text;

alter table public.projects
add column if not exists avatar_path text;

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_in_project text not null default 'member' check (role_in_project in ('manager', 'member')),
  unique(project_id, user_id)
);

create table if not exists public.task_lists (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique(project_id, title)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  list_id uuid references public.task_lists(id) on delete set null,
  title text not null,
  description text,
  creator_id uuid not null references public.profiles(id),
  assignee_id uuid not null references public.profiles(id),
  start_time timestamptz,
  due_time timestamptz,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  status text not null default 'todo' check (status in ('todo', 'doing', 'done', 'cancelled')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks
add column if not exists list_id uuid references public.task_lists(id) on delete set null;

alter table public.tasks
add column if not exists sort_order int not null default 0;

insert into public.task_lists (project_id, title, sort_order)
select projects.id, defaults.title, defaults.sort_order
from public.projects
cross join (
  values
    ('Việc cần làm', 0),
    ('Đang xử lý', 1),
    ('Chờ phản hồi', 2),
    ('Hoàn thành', 3)
) as defaults(title, sort_order)
on conflict (project_id, title) do nothing;

with title_map(bad_title, good_title) as (
  values
    ('Viá»c cáº§n lÃ m', 'Việc cần làm'),
    ('ViÃ¡Â»Âc cÃ¡ÂºÂ§n lÃÂ m', 'Việc cần làm'),
    ('Äang xá»­ lÃ½', 'Đang xử lý'),
    ('ÃÂang xÃ¡Â»Â­ lÃÂ½', 'Đang xử lý'),
    ('Chá» pháº£n há»i', 'Chờ phản hồi'),
    ('ChÃ¡Â»Â phÃ¡ÂºÂ£n hÃ¡Â»Âi', 'Chờ phản hồi'),
    ('HoÃ n thÃ nh', 'Hoàn thành'),
    ('HoÃÂ n thÃÂ nh', 'Hoàn thành')
)
delete from public.task_lists bad
using title_map
where bad.title = title_map.bad_title
  and exists (
    select 1
    from public.task_lists good
    where good.project_id = bad.project_id
      and good.title = title_map.good_title
  );

update public.task_lists
set title = title_map.good_title
from title_map
where public.task_lists.title = title_map.bad_title;

create table if not exists public.task_checklists (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  assignee_id uuid references public.profiles(id),
  due_time timestamptz,
  note text,
  is_done boolean not null default false,
  sort_order int not null default 0
);

alter table public.task_checklists
add column if not exists assignee_id uuid references public.profiles(id);

alter table public.task_checklists
add column if not exists due_time timestamptz;

alter table public.task_checklists
add column if not exists note text;

alter table public.task_checklists
alter column id set default gen_random_uuid();

create table if not exists public.task_members (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  comment text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.task_notifications (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  type text not null check (type in ('new_task', 'due_soon_24h', 'due_soon_2h', 'overdue', 'daily_summary')),
  channel text not null default 'telegram',
  sent_at timestamptz not null default now(),
  status text not null default 'sent' check (status in ('sent', 'failed', 'skipped')),
  unique(task_id, user_id, type)
);

create table if not exists public.daily_task_templates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  assignee_id uuid not null references public.profiles(id),
  title text not null,
  description text,
  due_time time not null default '17:00',
  recurrence_type text not null default 'daily' check (recurrence_type in ('daily', 'monthly')),
  monthly_day int check (monthly_day is null or monthly_day between 1 and 31),
  checklist_items text[] not null default '{}',
  requires_note boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_task_instances (
  template_id uuid not null references public.daily_task_templates(id) on delete cascade,
  run_date date not null,
  task_id uuid not null references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (template_id, run_date)
);

create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  512000,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
for select using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own_folder" on storage.objects;
create policy "avatars_insert_own_folder" on storage.objects
for insert with check (
  bucket_id = 'avatars'
  and auth.role() = 'authenticated'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "avatars_update_own_folder" on storage.objects;
create policy "avatars_update_own_folder" on storage.objects
for update using (
  bucket_id = 'avatars'
  and auth.role() = 'authenticated'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'avatars'
  and auth.role() = 'authenticated'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "avatars_delete_own_folder" on storage.objects;
create policy "avatars_delete_own_folder" on storage.objects
for delete using (
  bucket_id = 'avatars'
  and auth.role() = 'authenticated'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.email, ''),
    'staff'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.app_roles (id, name, description, permissions, is_system)
values
  ('admin', 'Admin', 'Toan quyen he thong', array[
    'view_all_tasks',
    'manage_projects',
    'manage_project_members',
    'manage_people',
    'manage_roles',
    'manage_telegram',
    'manage_project_recurring_tasks',
    'manage_own_recurring_tasks',
    'view_reports',
    'approve_tasks'
  ], true),
  ('manager', 'Manager', 'Quan ly du an va nhan su trong du an', array[
    'view_project_tasks',
    'manage_projects',
    'manage_project_members',
    'assign_tasks',
    'manage_project_recurring_tasks',
    'view_reports',
    'approve_tasks'
  ], true),
  ('staff', 'Nhan su', 'Xu ly task duoc giao va task ca nhan', array[
    'create_personal_tasks',
    'update_own_tasks',
    'manage_own_recurring_tasks',
    'manage_own_telegram'
  ], true)
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  permissions = excluded.permissions,
  is_system = excluded.is_system;

insert into public.profile_roles (user_id, role_id)
select id, role
from public.profiles
where role in ('admin', 'manager', 'staff')
on conflict (user_id, role_id) do nothing;

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

alter table public.profiles enable row level security;
alter table public.app_roles enable row level security;
alter table public.profile_roles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.task_lists enable row level security;
alter table public.tasks enable row level security;
alter table public.task_checklists enable row level security;
alter table public.task_members enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_notifications enable row level security;
alter table public.daily_task_templates enable row level security;
alter table public.daily_task_instances enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "profiles_select_scope" on public.profiles;
create policy "profiles_select_scope" on public.profiles
for select using (
  id = auth.uid()
  or public.is_admin()
  or exists (
    select 1
    from public.project_members mine
    join public.project_members theirs on theirs.project_id = mine.project_id
    where mine.user_id = auth.uid()
      and mine.role_in_project = 'manager'
      and theirs.user_id = profiles.id
  )
);

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin" on public.profiles
for update using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists "app_roles_select_authenticated" on public.app_roles;
create policy "app_roles_select_authenticated" on public.app_roles
for select using (auth.uid() is not null);

drop policy if exists "app_roles_write_admin" on public.app_roles;
create policy "app_roles_write_admin" on public.app_roles
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "profile_roles_select_scope" on public.profile_roles;
create policy "profile_roles_select_scope" on public.profile_roles
for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "profile_roles_write_admin" on public.profile_roles;
create policy "profile_roles_write_admin" on public.profile_roles
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "projects_select_members" on public.projects;
create policy "projects_select_members" on public.projects
for select using (
  public.is_admin()
  or exists (
    select 1 from public.project_members
    where project_id = projects.id and user_id = auth.uid()
  )
);

drop policy if exists "projects_write_admin_manager" on public.projects;
create policy "projects_write_admin_manager" on public.projects
for all using (public.is_admin() or manager_id = auth.uid())
with check (public.is_admin() or manager_id = auth.uid());

drop policy if exists "project_members_select_scope" on public.project_members;
create policy "project_members_select_scope" on public.project_members
for select using (
  public.is_admin()
  or user_id = auth.uid()
  or public.is_manager_for_project(project_id)
);

drop policy if exists "project_members_write_admin_project_manager" on public.project_members;
create policy "project_members_write_admin_project_manager" on public.project_members
for all using (public.is_admin() or public.is_manager_for_project(project_id))
with check (public.is_admin() or public.is_manager_for_project(project_id));

drop policy if exists "task_lists_select_project_scope" on public.task_lists;
create policy "task_lists_select_project_scope" on public.task_lists
for select using (
  public.is_admin()
  or exists (
    select 1 from public.project_members
    where project_id = task_lists.project_id and user_id = auth.uid()
  )
);

drop policy if exists "task_lists_write_admin_project_manager" on public.task_lists;
create policy "task_lists_write_admin_project_manager" on public.task_lists
for all using (public.is_admin() or public.is_manager_for_project(project_id))
with check (public.is_admin() or public.is_manager_for_project(project_id));

drop policy if exists "tasks_select_scope" on public.tasks;
create policy "tasks_select_scope" on public.tasks
for select using (
  public.is_admin()
  or creator_id = auth.uid()
  or assignee_id = auth.uid()
  or public.is_task_member(id)
  or public.is_manager_for_project(project_id)
);

drop policy if exists "tasks_insert_scope" on public.tasks;
create policy "tasks_insert_scope" on public.tasks
for insert with check (
  public.is_admin()
  or creator_id = auth.uid()
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

drop policy if exists "checklists_select_task_scope" on public.task_checklists;
create policy "checklists_select_task_scope" on public.task_checklists
for select using (
  exists (select 1 from public.tasks where tasks.id = task_checklists.task_id)
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

drop policy if exists "comments_select_task_scope" on public.task_comments;
create policy "comments_select_task_scope" on public.task_comments
for select using (
  exists (select 1 from public.tasks where tasks.id = task_comments.task_id)
);

drop policy if exists "comments_insert_task_scope" on public.task_comments;
create policy "comments_insert_task_scope" on public.task_comments
for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.tasks where tasks.id = task_comments.task_id)
);

drop policy if exists "notifications_select_scope" on public.task_notifications;
create policy "notifications_select_scope" on public.task_notifications
for select using (
  public.is_admin()
  or user_id = auth.uid()
  or exists (
    select 1 from public.tasks
    where tasks.id = task_notifications.task_id
      and public.is_manager_for_project(tasks.project_id)
  )
);

drop policy if exists "daily_templates_select_scope" on public.daily_task_templates;
create policy "daily_templates_select_scope" on public.daily_task_templates
for select using (
  public.is_admin()
  or assignee_id = auth.uid()
  or public.is_manager_for_project(project_id)
  or exists (
    select 1 from public.project_members
    where project_members.project_id = daily_task_templates.project_id
      and project_members.user_id = auth.uid()
  )
);

drop policy if exists "daily_templates_write_scope" on public.daily_task_templates;
create policy "daily_templates_write_scope" on public.daily_task_templates
for all using (
  public.is_admin()
  or public.is_manager_for_project(project_id)
  or assignee_id = auth.uid()
)
with check (
  public.is_admin()
  or public.is_manager_for_project(project_id)
  or (
    assignee_id = auth.uid()
    and (
      project_id is null
      or exists (
        select 1 from public.project_members
        where project_members.project_id = daily_task_templates.project_id
          and project_members.user_id = auth.uid()
      )
    )
  )
);

drop policy if exists "daily_instances_select_scope" on public.daily_task_instances;
create policy "daily_instances_select_scope" on public.daily_task_instances
for select using (
  exists (
    select 1 from public.daily_task_templates
    where daily_task_templates.id = daily_task_instances.template_id
      and (
        public.is_admin()
        or daily_task_templates.assignee_id = auth.uid()
        or public.is_manager_for_project(daily_task_templates.project_id)
      )
  )
);
