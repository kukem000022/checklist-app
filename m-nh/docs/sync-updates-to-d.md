# Dong bo ban cap nhat sang D:\Codex_Project

Codex hien khong co quyen ghi truc tiep vao o D, nen ban cap nhat duoc chuan bi tai:

```text
C:\Users\longhuynh\Documents\Codex\2026-06-24\m-nh
```

Chay lenh nay trong PowerShell de dong bo source sang project chinh o o D:

```powershell
robocopy "C:\Users\longhuynh\Documents\Codex\2026-06-24\m-nh" "D:\Codex_Project" /E /COPY:DAT /DCOPY:DAT /R:2 /W:2 /XD node_modules work dist .git .agents .codex outputs /XF .env
```

Lenh nay:

- Copy source frontend/backend/supabase/docs moi.
- Khong copy `node_modules`.
- Khong copy `work` hoac `dist`.
- Khong ghi de file `.env` dang chua key that cua ban o o D.

Sau khi dong bo, chay tai D:

```powershell
cd "D:\Codex_Project"
npm.cmd install --cache ".\work\npm-cache"
npm.cmd run build --workspace frontend
npm.cmd run dev
```
