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
