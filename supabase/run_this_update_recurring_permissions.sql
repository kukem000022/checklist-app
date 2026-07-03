update public.app_roles
set permissions = array(
  select distinct permission
  from unnest(permissions || array['manage_project_recurring_tasks', 'manage_own_recurring_tasks']) as permission
)
where id = 'admin';

update public.app_roles
set permissions = array(
  select distinct permission
  from unnest(permissions || array['manage_project_recurring_tasks']) as permission
)
where id = 'manager';

update public.app_roles
set permissions = array(
  select distinct permission
  from unnest(permissions || array['manage_own_recurring_tasks']) as permission
)
where id = 'staff';

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
