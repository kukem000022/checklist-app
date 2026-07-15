insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-attachments',
  'task-attachments',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "task_attachments_read" on storage.objects;
create policy "task_attachments_read"
on storage.objects
for select
using (bucket_id = 'task-attachments');

drop policy if exists "task_attachments_insert" on storage.objects;
create policy "task_attachments_insert"
on storage.objects
for insert
with check (
  bucket_id = 'task-attachments'
  and auth.role() = 'authenticated'
);

drop policy if exists "task_attachments_update_own" on storage.objects;
create policy "task_attachments_update_own"
on storage.objects
for update
using (
  bucket_id = 'task-attachments'
  and owner = auth.uid()
)
with check (
  bucket_id = 'task-attachments'
  and owner = auth.uid()
);

drop policy if exists "task_attachments_delete_own" on storage.objects;
create policy "task_attachments_delete_own"
on storage.objects
for delete
using (
  bucket_id = 'task-attachments'
  and owner = auth.uid()
);

drop policy if exists "task_attachments_delete_admin" on storage.objects;
create policy "task_attachments_delete_admin"
on storage.objects
for delete
using (
  bucket_id = 'task-attachments'
  and public.is_admin()
);
