alter table public.projects
add column if not exists telegram_group_chat_id text;
