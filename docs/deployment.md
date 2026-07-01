# Triển khai MVP

## 1. Supabase

1. Tạo project Supabase.
2. Vào SQL Editor.
3. Chạy toàn bộ nội dung trong `supabase/schema.sql`.
4. Tạo user đầu tiên trong Authentication.
5. Vào bảng `profiles`, đổi role user đầu tiên thành `admin`.

Gợi ý: trong giai đoạn MVP, có thể tạo user qua Supabase Dashboard trước, sau đó chỉnh role bằng SQL.

## 2. Backend chạy trên máy cá nhân

Backend cần có `SUPABASE_SERVICE_ROLE_KEY`, vì vậy chỉ chạy ở máy cá nhân hoặc server riêng. Không đưa file `.env` lên GitHub.

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Backend mặc định mở cổng `3978`.

Nếu frontend release trên GitHub Pages cần gọi về máy cá nhân, bạn cần một URL public cho backend, ví dụ domain riêng, Cloudflare Tunnel hoặc ngrok. Sau đó đặt:

```text
VITE_API_URL=https://your-public-backend-url
```

## 3. Frontend GitHub Pages

```bash
cd frontend
cp .env.example .env
npm install
npm run build
```

Nếu deploy vào repo GitHub Pages dạng `https://username.github.io/repo-name/`, đặt:

```bash
npx vite build --base /repo-name/
```

Các biến được phép nằm ở frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL`
- `VITE_BASE_PATH`

Không đưa các biến này vào frontend:

- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`

## 4. Telegram

1. Tạo bot bằng BotFather.
2. Lưu token vào `backend/.env`.
3. Nhân sự chat `/start` với bot.
4. Lấy chat ID bằng endpoint:

```text
GET http://localhost:3978/api/telegram/updates
```

5. Nhập chat ID trong màn hình hồ sơ của web app.

MVP hiện hỗ trợ nhắc `due_soon_24h`, `due_soon_2h`, và `overdue`.
