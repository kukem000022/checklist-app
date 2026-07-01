# QA/QC Report - 2026-06-25

## Pham vi kiem tra

- Frontend local: `http://localhost:5173`
- Backend local: `http://localhost:3978`
- Chuc nang uu tien: tao nhan su, tao task, tao du an, phan quyen, checklist, comment, Telegram log.

## Ket qua moi truong

| Hang muc | Ket qua | Ghi chu |
|---|---:|---|
| Frontend health | Pass | `localhost:5173` tra HTTP 200 |
| Backend health | Pass | `/health` tra `{ ok: true }` |
| Backend port | Pass | Port `3978` dang listen |
| Frontend lint | Pass | `npm run lint --workspace frontend` |
| Frontend build | Pass | `npm run build --workspace frontend` |
| Backend syntax | Pass | `node --check backend/src/server.js` |

## Bug da phat hien

### QA-001 - Nut tao/lưu khong co phan hoi khi API fail

**Muc do:** High  
**Man hinh:** Tao nhan su / tao task / tao du an  
**Hien tuong:** Bam nut tao/lưu nhung UI khong bao loi ro rang.  
**Nguyen nhan:** Modal goi API bang `await`, neu backend hoac Supabase tra loi loi thi exception bi roi len console, nguoi dung khong thay thong bao.  
**Trang thai:** Fixed trong source workspace C.

Da sua:

- `frontend/src/api.js` format lai loi API ro hon.
- Modal tao task/user/project co `try/catch`.
- Khi fail, modal khong dong va hien `alert` noi dung loi.

Can sync source moi sang `D:\Codex_Project`.

## Cac nguyen nhan co the lam tao nhan su fail

Neu sau khi sync ban van tao nhan su fail, thong bao moi se cho biet ro hon. Cac kha nang hay gap:

1. Email da ton tai trong Supabase Auth.
2. Backend local chua co `SUPABASE_SERVICE_ROLE_KEY` dung.
3. User dang dang nhap khong co `role = admin` trong bang `profiles`.
4. Backend dang chay ban code cu.
5. Frontend dang tro sai `VITE_API_URL`.
6. Supabase Auth dang chan tao user do policy/cau hinh project.

## Test case can chay sau khi sync

| ID | Luong | Buoc test | Ky vong |
|---|---|---|---|
| TC-01 | Login admin | Dang nhap bang admin | Vao duoc dashboard |
| TC-02 | Tao nhan su | Tao user bang email test moi | User xuat hien trong danh sach |
| TC-03 | Tao user trung email | Tao lai cung email | UI hien loi ro rang, modal khong dong |
| TC-04 | Doi role | Doi Staff -> Manager | Role cap nhat tren bang |
| TC-05 | Khoa user | Doi status active -> locked | Status cap nhat |
| TC-06 | Tao du an | Tao du an moi | Du an xuat hien trong danh sach |
| TC-07 | Them thanh vien | Gan user vao du an | Thanh vien hien trong du an |
| TC-08 | Tao task | Tao task co checklist | Task xuat hien trong Cong viec |
| TC-09 | Chi tiet task | Bam task | Drawer mo ben phai |
| TC-10 | Checklist | Tick item checklist | Progress cap nhat |
| TC-11 | Doi trang thai | todo -> doing -> done | Trang thai cap nhat |
| TC-12 | Comment | Gui comment trong drawer | Comment xuat hien |
| TC-13 | Loc task | Loc theo du an/nhan su/status | Bang task loc dung |
| TC-14 | Telegram log | Tao task co nguoi co chat_id | Co log thong bao neu gui duoc |
| TC-15 | Doi mat khau | User vao Cai dat doi mat khau | Supabase cap nhat password |

## Gioi han chua test duoc

Chua chay full authenticated E2E trong browser noi bo vi can session/tai khoan admin test. Can dang nhap admin trong tab test hoac cung cap tai khoan test rieng de chay tiep.

## Ket luan QA tam thoi

He thong local dang chay, build pass. Loi "bam tao/lưu khong duoc" rat co kha nang do UI khong hien loi API. Source da duoc sua de bao loi ro rang. Sau khi sync sang `D:\Codex_Project`, can chay lai TC-02 va TC-03 truoc tien de xac nhan.
