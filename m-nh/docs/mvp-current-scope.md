# Tình trạng MVP hiện tại

## Đã có

- Đăng nhập/đăng ký bằng Supabase Auth.
- Tự tạo profile khi user mới được tạo trong Auth.
- Phân quyền `admin`, `manager`, `staff`.
- Admin tạo tài khoản nhân sự trực tiếp bằng email và mật khẩu tạm.
- Nhân sự tự đổi mật khẩu sau khi đăng nhập.
- Admin chỉnh role và trạng thái nhân sự.
- Admin xem workload nhanh theo nhân sự: task đang mở, task quá hạn, task đã xong.
- Admin/Manager tạo dự án.
- Admin/Manager thêm hoặc xóa thành viên khỏi dự án.
- Nhân sự tạo task cá nhân hoặc task theo dự án.
- Task có mô tả, người phụ trách, thời gian bắt đầu, deadline, độ ưu tiên.
- Checklist con trong task.
- Tick checklist và cập nhật trạng thái task.
- Bình luận trong task.
- Dashboard số liệu: tổng task, hôm nay, sắp tới hạn, quá hạn, hoàn thành, dự án rủi ro.
- Bộ lọc theo dự án, nhân sự, trạng thái, độ ưu tiên.
- Lưu Telegram chat ID trong hồ sơ.
- Gửi Telegram khi task mới, task sắp tới hạn, task quá hạn.
- Log thông báo Telegram trong app.
- Backend local Express dùng Supabase service role.
- Frontend build tĩnh bằng Vite để release GitHub Pages.
- Giao diện quản trị đã tách thành các màn: Tổng quan, Công việc, Dự án, Nhân sự, Vai trò & Quyền, Telegram, Cài đặt.
- Tạo task/user/project bằng modal thay vì nhồi form vào dashboard.
- Chi tiết task mở bằng drawer bên phải để xem checklist, trạng thái và bình luận.

## Còn để giai đoạn sau

- File đính kèm bằng Supabase Storage.
- Export Excel/PDF.
- Kanban board.
- Calendar view.
- Báo cáo KPI chi tiết theo nhân sự.
- Báo cáo cuối ngày qua Telegram cho Manager/Admin.
- Google Calendar/email integration.
- PWA/mobile app.

## Kiểm tra đã chạy

```bash
npm run lint --workspace frontend
npm run build --workspace frontend
node --check backend/src/server.js
node --check backend/src/reminders.js
```

Các bước trên đã chạy thành công trên bản cập nhật trong workspace.
