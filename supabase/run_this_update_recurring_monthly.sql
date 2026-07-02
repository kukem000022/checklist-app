alter table if exists public.daily_task_templates
  add column if not exists recurrence_type text not null default 'daily';

alter table if exists public.daily_task_templates
  add column if not exists monthly_day int;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'daily_task_templates_recurrence_type_check'
  ) then
    alter table public.daily_task_templates
      add constraint daily_task_templates_recurrence_type_check
      check (recurrence_type in ('daily', 'monthly'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'daily_task_templates_monthly_day_check'
  ) then
    alter table public.daily_task_templates
      add constraint daily_task_templates_monthly_day_check
      check (monthly_day is null or monthly_day between 1 and 31);
  end if;
end $$;

update public.daily_task_templates
set recurrence_type = 'daily'
where recurrence_type is null;
