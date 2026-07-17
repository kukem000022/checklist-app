begin;

create table if not exists public.daily_task_template_members (
  template_id uuid not null references public.daily_task_templates(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (template_id, user_id)
);

create index if not exists daily_task_template_members_user_id_idx
  on public.daily_task_template_members(user_id);

insert into public.daily_task_template_members (template_id, user_id)
select id, assignee_id
from public.daily_task_templates
where assignee_id is not null
on conflict (template_id, user_id) do nothing;

create or replace function public.is_daily_template_member(target_template_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.daily_task_template_members member
    where member.template_id = target_template_id
      and member.user_id = auth.uid()
  );
$$;

create or replace function public.can_manage_daily_template(target_template_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.daily_task_templates template
    where template.id = target_template_id
      and (
        public.is_admin()
        or template.assignee_id = auth.uid()
        or public.is_manager_for_project(template.project_id)
      )
  );
$$;

grant execute on function public.is_daily_template_member(uuid) to authenticated;
grant execute on function public.can_manage_daily_template(uuid) to authenticated;

alter table public.daily_task_template_members enable row level security;

drop policy if exists "daily_template_members_select_scope" on public.daily_task_template_members;
create policy "daily_template_members_select_scope" on public.daily_task_template_members
for select using (
  auth.uid() is not null
  and (
    public.is_daily_template_member(template_id)
    or public.can_manage_daily_template(template_id)
  )
);

drop policy if exists "daily_template_members_write_scope" on public.daily_task_template_members;
create policy "daily_template_members_write_scope" on public.daily_task_template_members
for all using (public.can_manage_daily_template(template_id))
with check (public.can_manage_daily_template(template_id));

drop policy if exists "daily_templates_select_scope" on public.daily_task_templates;
create policy "daily_templates_select_scope" on public.daily_task_templates
for select using (
  public.is_admin()
  or assignee_id = auth.uid()
  or public.is_daily_template_member(id)
  or public.is_manager_for_project(project_id)
  or exists (
    select 1
    from public.project_members
    where project_members.project_id = daily_task_templates.project_id
      and project_members.user_id = auth.uid()
  )
);

drop policy if exists "daily_instances_select_scope" on public.daily_task_instances;
create policy "daily_instances_select_scope" on public.daily_task_instances
for select using (
  exists (
    select 1
    from public.daily_task_templates
    where daily_task_templates.id = daily_task_instances.template_id
      and (
        public.is_admin()
        or daily_task_templates.assignee_id = auth.uid()
        or public.is_daily_template_member(daily_task_instances.template_id)
        or public.is_manager_for_project(daily_task_templates.project_id)
      )
  )
);

commit;
