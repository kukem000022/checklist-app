alter table if exists public.daily_task_templates
  add column if not exists weekdays int[] default array[1,2,3,4,5];

update public.daily_task_templates
set weekdays = array[1,2,3,4,5]
where recurrence_type = 'daily'
  and (weekdays is null or array_length(weekdays, 1) is null);

update public.daily_task_templates
set weekdays = null
where recurrence_type = 'monthly';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'daily_task_templates_weekdays_check'
      and conrelid = 'public.daily_task_templates'::regclass
  ) then
    alter table public.daily_task_templates
      add constraint daily_task_templates_weekdays_check
      check (
        weekdays is null
        or (
          array_length(weekdays, 1) between 1 and 7
          and weekdays <@ array[0,1,2,3,4,5,6]
        )
      );
  end if;
end $$;
