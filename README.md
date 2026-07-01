# Checklist Telegram Supabase MVP

MVP cho hệ thống checklist công việc:

- Frontend: React + Vite, release tĩnh qua GitHub Pages.
- Backend: Express chạy trên máy cá nhân.
- Database/Auth: Supabase.
- Reminder: Telegram Bot API qua backend local.

## Cấu trúc

```text
frontend/   Web app cho nhân sự, manager, admin
backend/    API local, job reminder, Telegram sender
supabase/   Schema, RLS policy, seed gợi ý
docs/       Hướng dẫn triển khai
```

## Chạy local

1. Tạo project Supabase.
2. Chạy SQL trong `supabase/schema.sql`.
3. Copy file môi trường:

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

4. Điền URL/key Supabase và Telegram token.
5. Cài dependency và chạy:

```bash
npm install
npm run dev
```

Frontend mặc định chạy ở `http://localhost:5173`, backend ở `http://localhost:3978`.

## Release frontend lên GitHub Pages

Xem `docs/deployment.md`.

## Tình trạng MVP

Xem `docs/mvp-current-scope.md`.
