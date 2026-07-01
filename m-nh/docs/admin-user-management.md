# Quản lý nhân sự trong Admin

## Luồng đề xuất

1. Admin tạo tài khoản cho nhân sự trong màn hình `Nhân sự`.
2. Admin nhập:
   - Họ tên
   - Email
   - Mật khẩu tạm
   - Bộ phận
   - Vai trò: Admin, Manager hoặc Nhân sự
3. Hệ thống tạo user trong Supabase Auth bằng backend local.
4. Hệ thống tạo/cập nhật dòng `profiles`.
5. Nhân sự đăng nhập bằng email và mật khẩu tạm.
6. Nhân sự vào `Hồ sơ` và đổi mật khẩu.

## Lưu ý bảo mật

- API tạo user dùng `SUPABASE_SERVICE_ROLE_KEY`, nên chỉ nằm ở backend local.
- Frontend không được giữ service role key.
- Chỉ user có `role = admin` mới gọi được API tạo user.

## Thông tin quản lý hiện có

Màn hình Admin đang hiển thị:

- Họ tên
- Email
- Bộ phận
- Role
- Trạng thái tài khoản
- Số task đang mở
- Số task quá hạn
- Số task đã hoàn thành

## Sau khi tạo user

Nếu cần gắn nhân sự vào dự án:

1. Vào panel `Dự án & thành viên`.
2. Chọn dự án.
3. Chọn nhân sự.
4. Chọn vai trò dự án: Quản lý hoặc Thành viên.
5. Bấm `Thêm thành viên`.
