# Hướng dẫn build backend trên Supabase trước

Tài liệu này đi theo thứ tự triển khai phần backend nền tảng trên Supabase trước khi chạy backend local và frontend.

## 1. Tạo project Supabase

1. Vào Supabase Dashboard.
2. Chọn New project.
3. Đặt tên project, ví dụ `checklist-mvp`.
4. Chọn region gần Việt Nam nhất nếu có.
5. Lưu lại database password ở nơi riêng.

Sau khi project tạo xong, lấy 3 thông tin sau:

- Project URL.
- Anon public key.
- Service role key.

Vị trí lấy key:

```text
Project Settings -> API
```

Lưu ý:

- `Anon public key` được phép dùng ở frontend.
- `Service role key` chỉ dùng ở backend local hoặc Supabase Edge Function, không đưa lên frontend hay GitHub.

## 2. Chạy database schema

1. Trong Supabase Dashboard, mở SQL Editor.
2. Tạo New query.
3. Copy toàn bộ nội dung file `supabase/schema.sql`.
4. Chạy query.

Schema này sẽ tạo các bảng:

- `profiles`
- `projects`
- `project_members`
- `tasks`
- `task_checklists`
- `task_comments`
- `task_notifications`

Ngoài ra schema cũng tạo:

- Trigger tự tạo `profiles` khi user mới đăng ký Supabase Auth.
- Trigger tự cập nhật `tasks.updated_at`.
- RLS policy cho từng bảng.
- Function kiểm tra quyền admin/manager.

## 3. Cấu hình Authentication

Vào:

```text
Authentication -> Providers
```

Bật Email provider.

Gợi ý cấu hình MVP:

```text
Enable Email provider: On
Confirm email: Off trong giai đoạn test nội bộ
```

Nếu bật xác minh email, user phải xác minh email trước khi đăng nhập được.

## 4. Tạo tài khoản admin đầu tiên

Vào:

```text
Authentication -> Users -> Add user
```

Tạo user đầu tiên, ví dụ:

```text
admin@example.com
```

Sau khi tạo user, trigger sẽ tự tạo dòng tương ứng trong bảng `profiles`.

Tiếp theo vào SQL Editor và chạy:

```sql
update public.profiles
set
  role = 'admin',
  full_name = 'Admin'
where email = 'admin@example.com';
```

Thay `admin@example.com` bằng email thật của bạn.

## 5. Kiểm tra bảng profiles

Vào:

```text
Table Editor -> profiles
```

Kiểm tra user đầu tiên có:

```text
role = admin
status = active
```

Các user đăng ký sau mặc định sẽ là:

```text
role = staff
status = active
```

Admin có thể chỉnh role thành `manager` nếu cần.

## 6. Kiểm tra RLS

Vào từng bảng trong Table Editor và kiểm tra Row Level Security đang bật.

Các bảng cần bật RLS:

- `profiles`
- `projects`
- `project_members`
- `tasks`
- `task_checklists`
- `task_comments`
- `task_notifications`

Nếu chạy `supabase/schema.sql` thành công thì RLS đã được bật sẵn.

Quyền MVP hiện tại:

- Admin xem/quản lý toàn hệ thống.
- Manager xem/quản lý dự án mình phụ trách.
- Staff xem task mình tạo hoặc được giao.
- Staff tự cập nhật task/checklist trong phạm vi quyền của mình.

## 7. Tạo dữ liệu test tối thiểu

Sau khi có admin, bạn có thể tạo thêm 1-2 user staff trong Authentication.

Sau đó dùng web app hoặc SQL để tạo thử project.

Ví dụ tạo project bằng SQL:

```sql
insert into public.projects (name, description, manager_id)
select
  'Dự án test MVP',
  'Dự án dùng để kiểm tra checklist app',
  id
from public.profiles
where email = 'admin@example.com'
returning id;
```

Thêm admin vào project:

```sql
insert into public.project_members (project_id, user_id, role_in_project)
select
  p.id,
  pr.id,
  'manager'
from public.projects p
cross join public.profiles pr
where p.name = 'Dự án test MVP'
  and pr.email = 'admin@example.com'
on conflict (project_id, user_id) do nothing;
```

## 8. Chuẩn bị key cho backend local

Sau khi Supabase backend sẵn sàng, tạo file:

```text
backend/.env
```

Dựa trên:

```text
backend/.env.example
```

Điền:

```text
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Nếu chưa có Telegram bot, có thể để trống `TELEGRAM_BOT_TOKEN` trong lúc test các chức năng task cơ bản.

## 9. Chuẩn bị key cho frontend

Tạo file:

```text
frontend/.env
```

Dựa trên:

```text
frontend/.env.example
```

Điền:

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_API_URL=http://localhost:3978
```

## 10. Thứ tự chạy sau khi Supabase xong

Sau khi hoàn thành các bước trên:

```bash
npm run dev
```

Thứ tự kiểm tra:

1. Đăng nhập bằng tài khoản admin.
2. Cập nhật hồ sơ admin.
3. Tạo project.
4. Tạo task.
5. Tick checklist.
6. Đổi trạng thái task.
7. Tạo user staff và kiểm tra staff chỉ thấy dữ liệu thuộc quyền.

## 11. Lỗi thường gặp

### Đăng ký được nhưng không vào app được

Kiểm tra bảng `profiles` có dòng tương ứng với user chưa.

Nếu chưa có, kiểm tra trigger:

```sql
select *
from information_schema.triggers
where trigger_name = 'on_auth_user_created';
```

### Không tạo được project

Kiểm tra user đang đăng nhập có role `admin` hoặc `manager`.

```sql
select email, role, status
from public.profiles;
```

### Staff không thấy project

Staff phải được thêm vào bảng `project_members`.

### Frontend báo lỗi quyền

Thường là do RLS đang chặn đúng theo policy. Kiểm tra:

- User đang đăng nhập là ai.
- Role trong `profiles`.
- User có trong `project_members` chưa.
- Task có `creator_id` hoặc `assignee_id` đúng chưa.

## 12. Mốc hoàn thành Supabase backend

Xem như phần Supabase backend đã xong khi:

- Chạy `supabase/schema.sql` không lỗi.
- Auth tạo được user.
- User mới tự sinh dòng trong `profiles`.
- Admin đầu tiên đã có `role = admin`.
- RLS bật trên toàn bộ bảng chính.
- Có thể tạo project/task thông qua app hoặc API.
