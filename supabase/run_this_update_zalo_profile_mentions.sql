alter table if exists public.profiles
  add column if not exists zalo_user_id text,
  add column if not exists zalo_display_name text;

comment on column public.profiles.zalo_user_id is 'Zalo user ID used for Zalo group mention payloads.';
comment on column public.profiles.zalo_display_name is 'Display name used when mentioning this user in Zalo groups.';
