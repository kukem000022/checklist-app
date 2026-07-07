insert into public.app_settings (key, value)
values
  ('default_zalo_group_id', null),
  ('default_zalo_flow_code', null)
on conflict (key) do nothing;
