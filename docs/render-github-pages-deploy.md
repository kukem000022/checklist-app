# Deploy Render + GitHub Pages

## Backend Render

1. Push repo len GitHub.
2. Vao Render, tao `New` -> `Blueprint`.
3. Chon repo va file `render.yaml`.
4. Tao service `checklist-api` hoac `checklist-api-sg`.
   File `render.yaml` da dat `region: singapore` de backend gan Supabase Singapore hon.
   Neu service Render cu da tao o My/Oregon thi can tao service moi; Render khong migrate region cho service cu.
5. Dien environment variables trong Render:

```text
APP_ORIGIN=https://kukem000022.github.io
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
ZALO_PUSH_URL=https://your-zalo-bot-render-url.onrender.com/api/push/zalo
ZALO_PUSH_API_TOKEN=your-zalo-push-token
REMINDER_CRON=*/15 * * * *
OVERDUE_GRACE_MINUTES=0
```

Render se tao backend URL dang:

```text
https://checklist-api.onrender.com
```

Health check:

```text
https://checklist-api.onrender.com/health
```

## Frontend GitHub Pages

Vao GitHub repo -> `Settings` -> `Secrets and variables` -> `Actions`.

Them cac repository secrets:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_URL=https://checklist-api.onrender.com
VITE_BASE_PATH=/checklist-app/
```

Voi repo hien tai `kukem000022/checklist-app`, GitHub Pages URL se la:

```text
https://kukem000022.github.io/checklist-app/
```

Nen `VITE_BASE_PATH` phai la:

```text
/checklist-app/
```

Neu sau nay deploy vao user page/root domain thi `VITE_BASE_PATH=/`.

Sau do vao `Settings` -> `Pages`:

```text
Source: GitHub Actions
```

Push len branch `main`, workflow `.github/workflows/deploy-frontend.yml` se build va deploy frontend.

## Luu y bao mat

Khong dua len GitHub:

```text
SUPABASE_SERVICE_ROLE_KEY
TELEGRAM_BOT_TOKEN
ZALO_PUSH_API_TOKEN
backend/.env
```

Nhung bien nay chi nam trong Render Environment.

## Zalo Push

Neu muon checklist gui them Zalo ngoai Telegram, dien tren Render backend:

```text
ZALO_PUSH_URL=https://your-zalo-bot-render-url.onrender.com/api/push/zalo
ZALO_PUSH_API_TOKEN=token-bi-mat-cua-zalo-bot
```

Sau do vao app -> `Cai dat` -> `Zalo chung`:

```text
Zalo group ID mac dinh: 193463471384782864
```

Hoac dung:

```text
flowCode mac dinh: TPB
```

Neu dien ca hai, backend uu tien `group ID`. Neu chua dien Zalo chung, he thong van gui Telegram nhu cu.
