# TODO CODEX

## Rule lam viec

- Khong dung chi vi `npm.cmd run build` pass.
- Chi dung khi QA/QC cac luong chinh pass hoac co blocker ro rang can user/cau hinh ngoai.
- Sau moi buoc quan trong, cap nhat file nay voi: da lam gi, file da sua, loi con lai, lenh can chay tiep.

## Da lam trong checkpoint nay

- Checkpoint Supabase Storage cho anh ghi chu/binh luan:
  - Doi anh dinh kem trong ghi chu/binh luan tu base64 inline sang upload Supabase Storage bucket `task-attachments`.
  - Frontend nen anh thanh WebP toi da ~450KB truoc khi upload, noi dung chi luu markdown link anh.
  - Rich text renderer doc duoc ca anh cu dang `data:image/...` va anh moi dang URL Storage.
  - Them SQL `supabase/run_this_create_task_attachments_storage.sql` de tao bucket public 500KB va policy upload cho user da dang nhap.
  - Them SQL moi vao `scripts/sync-to-main.ps1` de copy sang `D:\Codex_Project`.
- Checkpoint purple glass UI repair:
  - Dung `high-end-visual-design` de dinh huong lai surface theo kieu glass-dark/purple, khong dung nen trang cho cac khung quan tri.
  - Them lop CSS override cuoi `frontend/src/styles.css` cho theme `purple`.
  - Fix cac vung con trang o Du an, Task cua toi, Nhan su, Vai tro, Bao cao: table head, empty state, report hero, report cards, permission rows, role/person/project rows, board container.
  - Giu performance: khong them backdrop blur vao cac khung cuon lon, chi dung nen trong suot, gradient nhe, border/inset highlight.
- Checkpoint project avatar / inactive / Telegram / theme:
  - Them avatar rieng cho du an, hien avatar du an trong cot `Task cua toi`; cot ca nhan fallback avatar user dang nhap.
  - Them chinh sua avatar URL, Telegram group ID va trang thai du an trong chi tiet du an.
  - Them trang thai `inactive` cho du an; du an inactive/completed khong con nam trong dropdown tao task moi.
  - Bo trang thai task `review/Cho xac nhan` khoi UI/API chinh; SQL migrate se doi task cu `review` sang `done`.
  - Sua loi luu checklist task moi bi `null value in column "id"` bang cach update row cu va insert row moi rieng.
  - Telegram reminder: doi form thong bao qua tieng Viet, mapping status sang nhan de doc, tag nhan su bang `telegram_chat_id` neu co.
  - Telegram reminder qua han lap lai moi 30 phut; van fallback group du an -> group chung -> chat ca nhan.
  - Them lua chon theme `Purple dark` theo file `Option_3_Purple_Dark_Dashboard.docx`, giu theme dark xanh/light cu.
  - Them preload background cho theme `purple` de tranh nhay nen sang khi tai web.
  - Co lai mat do UI bang `body font-size: 90%` tren desktop, mobile giu 100%.
  - Cap nhat `supabase/schema.sql` va tao SQL chay them `supabase/run_this_update_project_avatar_inactive_review_cleanup.sql`.
  - Cap nhat `scripts/sync-to-main.ps1` de sync file SQL moi sang `D:\Codex_Project`.
- Checkpoint toi uu toc do/glass/render:
  - Cap nhat `render.yaml` them `region: singapore` cho service Render moi.
  - Cap nhat docs deploy: service Render cu o My/Oregon can tao service moi Singapore, khong nen ky vong doi region truc tiep.
  - Toi uu frontend load: man hinh dau chi cho `me/profiles/projects/tasks`; `notifications` va `daily-templates` load nen sau, khong chan thao tac chinh.
  - API `/api/projects` tra them profile manager/thanh vien de UI co avatar project.
  - Project board header doi icon folder mau vang sang avatar stack; cot Ca nhan dung avatar user dang dang nhap.
  - Them glass style nhe cho sidebar/topbar/panel/card, giu task board gon de khong roi.
  - Bo gradient/blur den nang o `drawer-savebar`, giu nen solid nhe de scroll drawer muot hon.
- Checkpoint UI/task dinh ky moi nhat:
  - Doi login sang anh nen forest noi bo va glass-style panel, khong phu thuoc anh remote.
  - Chuyen nut theme thanh icon nho nam gan thong tin user/admin o sidebar.
  - Lam noi bat header tung du an tren bang task bang icon folder va accent mau.
  - Task moi tao trong 24h duoc sort len tren va co nhan `Moi`.
  - Bo sung tab loc `Dang lam` va `Da huy`.
  - Drawer task: checklist con chi hien icon chi dinh/deadline/xoa tren cung dong; bam icon moi mo popup chinh chi dinh/deadline.
  - Drawer task: nut `Luu thay doi` co spinner khi dang luu va thong bao `Da luu thanh cong` gan ngay nut.
  - Them task dinh ky `hang thang`, bấm vào mẫu trong danh sách để sửa lại.
  - Backend task dinh ky thang: neu ngay dinh ky roi vao Thu 7/CN thi tu day sang ngay lam viec tiep theo.
  - Tao SQL update rieng `supabase/run_this_update_recurring_monthly.sql`.
  - Sua lai fallback loi API bi loi font tieng Viet.
- Xac nhan backend local `http://localhost:3978/health` dang OK.
- Xac nhan frontend local `http://localhost:5173` dang tra 200.
- Tao `work/qa-smoke.mjs` de login admin va goi cac endpoint chinh.
- Chay `node work\qa-smoke.mjs` nhung sandbox chan ket noi ra Supabase (`EACCES`), nen chua the QA API authenticated tu moi truong nay.
- Sua `frontend/src/api.js`: thong bao loi mac dinh khong con bi loi font tieng Viet.
- Don `frontend/src/main.jsx`: bo state/request/props tasklist cu khong con dung o UI Du an.
- Sua luong tao task:
  - Popup tao task co UI chon thanh vien xu ly khi task gan voi du an.
  - Popup tao task chi hien nguoi phu trach/thanh vien xu ly trong danh sach thanh vien du an.
  - Popup tao task bat buoc chon nguoi phu trach neu task thuoc du an.
  - Backend validate assignee va task member cua task du an phai la thanh vien cua du an.
- Sua luong drawer chi tiet task:
  - Checklist item cua task thuoc du an chi cho chi dinh thanh vien cua du an.
  - Backend validate assignee cua checklist item trong task du an phai la thanh vien du an.
- Sua luong task dinh ky:
  - Neu chon du an thi nguoi phu trach chi lay tu thanh vien du an.
  - Backend validate daily task template: assignee phai la thanh vien du an khi template gan voi du an.
- Sua workload/bao cao nhan su:
  - Backend `/api/profiles/summary` tinh ca `assignee_id` va `task_members`.
  - Frontend ReportsPage tinh workload theo nguoi phu trach va thanh vien xu ly task.
- Sua Telegram/log khi tao task:
  - Log `new_task` ap dung cho nguoi phu trach va cac thanh vien xu ly.
  - Uu tien group du an, sau do group chung, roi fallback chat ca nhan.
- Sua reminder Telegram:
  - Reminder deadline/qua han doc ca `task_members`.
  - Neu co group du an/group chung thi gui 1 tin vao group va log cho tung nhan su lien quan.
  - Neu khong co group thi fallback gui rieng cho tung nguoi lien quan.
- Sua API luu chi tiet task tra `checklist_count` theo so thuc te trong database.
- Sua SQL tasklist encoding:
  - `supabase/schema.sql` khong seed tasklist bang chuoi loi font nua.
  - `supabase/run_this_fix_tasklist_encoding.sql` co map sua ca 2 dang chuoi loi font cu ve tieng Viet dung.
  - Da verify bang Unicode codepoint cho 4 title: Viec can lam, Dang xu ly, Cho phan hoi, Hoan thanh.
  - Da verify them `supabase/run_this_update_2026_06_25.sql` co 4 title Unicode dung.
- Sua UI dark/light:
  - Sidebar desktop bam co dinh full viewport de khong lo nen trang khi noi dung dai.
  - Bo sung dark-mode coverage cho bang/danh sach/form con o Dashboard, Bao cao, Du an, Nhan su, Vai tro, Task dinh ky.
- Sua schema setup avatar:
  - `supabase/schema.sql` da tao bucket `avatars`, gioi han 500KB, chi cho JPG/PNG/WebP.
  - Them storage policies doc public va user chi upload/sua/xoa trong folder cua chinh minh.
- QA static/code review da xong:
  - Tao task co loading/disabled, chan double-click tao trung o UI.
  - Nhan su/Vai tro/Task detail chi ghi database khi bam nut Luu/Tao/Gui ro rang; cac checkbox/select trong drawer/role/people chi sua draft.
  - Task member chi cho task thuoc du an; backend chan task ca nhan co member phu.
  - Assignee/member/checklist assignee cua task du an deu bi validate phai thuoc thanh vien du an.
  - Checklist con bi chan deadline vuot qua deadline task cha o UI va backend.
  - Daily rerun co nut `Chay lai hom nay`, backend tao bu hoac bao da co instance trong ngay.
  - Telegram fallback theo thu tu group du an -> group chung -> chat ca nhan, reminder da tinh ca task members.

## File da sua

- `TODO_CODEX.md`
- `work/qa-smoke.mjs`
- `frontend/src/api.js`
- `frontend/src/main.jsx`
- `frontend/src/styles.css`
- `frontend/src/assets/login-background.jpg`
- `backend/src/server.js`
- `backend/src/reminders.js`
- `render.yaml`
- `docs/render-github-pages-deploy.md`
- `supabase/schema.sql`
- `supabase/run_this_fix_tasklist_encoding.sql`
- `supabase/run_this_update_recurring_monthly.sql`
- `scripts/sync-to-main.ps1`
- `render.yaml`
- `.github/workflows/deploy-frontend.yml`
- `docs/render-github-pages-deploy.md`

## Kiem tra da chay

- Sau checkpoint purple glass UI repair:
  - `npm.cmd run build` pass.
- Sau checkpoint project avatar / inactive / Telegram / theme:
  - `node --check backend\src\server.js` pass.
  - `node --check backend\src\reminders.js` pass.
  - `npm.cmd run build` pass.
- `npm.cmd run lint` pass.
- `node --check backend\src\server.js; node --check backend\src\reminders.js` pass.
- `npm.cmd run build` pass.
- Sau fix CSS/SQL moi nhat:
  - Frontend local `http://localhost:5173` tra 200.
  - Backend local `http://localhost:3978/health` tra OK.
  - `npm.cmd run lint` pass.
  - `node --check backend\src\server.js; node --check backend\src\reminders.js` pass.
  - `npm.cmd run build` pass.
  - Sau fix reminder Telegram moi nhat: lint pass, backend node --check pass, build pass.
- Sau fix schema avatar:
  - `npm.cmd run lint` pass.
  - `node --check backend\src\server.js; node --check backend\src\reminders.js` pass.
  - `npm.cmd run build` pass.
  - Frontend local `http://localhost:5173` tra 200.
  - Backend local `http://localhost:3978/health` tra OK.
- Sau doc lai TODO va tiep tuc checkpoint:
  - `npm.cmd run lint` pass.
  - `node --check backend\src\server.js; node --check backend\src\reminders.js` pass.
  - `npm.cmd run build` pass.
  - Frontend local `http://localhost:5173` tra 200.
  - Backend local `http://localhost:3978/health` tra OK.
- `node work\qa-smoke.mjs` chua pass vi sandbox chan network Supabase (`EACCES`), khong phai loi app da xac minh duoc.
- User yeu cau test Supabase lai:
  - Da chay `node work\qa-smoke.mjs`.
  - Van fail ngay buoc Supabase Auth `signInWithPassword` do sandbox chan network (`EACCES`, `AuthRetryableFetchError: fetch failed`).
  - Chua co du lieu nao duoc tao/sua/xoa tren Supabase trong lan test nay.
- User yeu cau cap nhat ra moi truong chinh:
  - Da kiem tra `D:\Codex_Project` ton tai va co cau truc project.
  - Da thu copy truc tiep cac file da sua sang `D:\Codex_Project` nhung bi sandbox chan quyen ghi (`Access to the path ... is denied`).
  - Da verify hash: `frontend\src\api.js` da match, cac file con lai van DIFF/MISSING tren `D:\Codex_Project`.
  - Da tao `scripts\sync-to-main.ps1` de dong bo dung cac file can cap nhat sang `D:\Codex_Project` khi chay ngoai sandbox.
  - Da kiem tra cu phap script sync OK.
  - Da chay lai `npm.cmd run lint` va pass sau khi them script.
- User doi y: chay luon tren o C/current workspace, khong copy qua o D nua:
  - Workspace dang dung: `C:\Users\longhuynh\Documents\Codex\2026-06-24\m-nh`.
  - Port `3978/5173` da co backend/frontend dang chay va health OK.
  - Port `3980/5174` cung da co backend/frontend dang chay va health OK.
  - Da thu bat backend moi tren `3980` nhung port da bi dung, da dung watcher loi de khong treo tien trinh thua.
  - URL co the mo de test ban current workspace: `http://localhost:5174` hoac `http://localhost:5173`.
- Fix dark mode drawer task:
  - Bo sung dark style cho `.checklist-item-editor` de khong con nen trang trong checklist editor.
  - Bo sung dark style cho `.drawer-savebar` de thanh `Luu thay doi` khong con nen trang.
  - Bo sung mau dark cho input title checklist va nut xoa checklist.
  - Da chay `npm.cmd run lint` pass.
  - Da chay `npm.cmd run build` pass.
- Them cau hinh deploy Render + GitHub Pages:
  - Them `render.yaml` cho backend Render Web Service.
  - Them `.github/workflows/deploy-frontend.yml` de deploy frontend len GitHub Pages bang GitHub Actions.
  - Them `docs/render-github-pages-deploy.md` huong dan dien Render env va GitHub secrets.
  - Cap nhat `scripts/sync-to-main.ps1` de sync them cac file deploy moi sang `D:\Codex_Project`.
  - Da chay `node --check backend\src\server.js; node --check backend\src\reminders.js` pass.
  - Da chay `npm.cmd run lint` pass.
  - Da chay `npm.cmd run build` pass.
- Fix trang trang GitHub Pages:
  - Nguyen nhan kha nang cao: asset build ra `/assets/...` thay vi `/checklist-app/assets/...`.
  - Doi workflow sang `npm run build --workspace frontend -- --base=/checklist-app/`.
  - Xoa `frontend/vite.config.js` de tranh loi sandbox/esbuild khi doc env base path.
  - Cap nhat `scripts/sync-to-main.ps1` khong sync `frontend/vite.config.js` nua.
  - Da chay `npm.cmd run lint` pass.
  - Da chay `npm.cmd run build --workspace frontend -- --base=/checklist-app/` pass.
  - Da verify `frontend/dist/index.html` co asset `/checklist-app/assets/...`.
- Them guard cho GitHub Actions trang trang:
  - Them step `Validate frontend environment` vao `.github/workflows/deploy-frontend.yml`.
  - Neu thieu `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, hoac `VITE_API_URL` thi workflow fail ro rang thay vi deploy trang trang.
  - Da chay `npm.cmd run lint` pass.
  - Da chay `npm.cmd run build --workspace frontend -- --base=/checklist-app/` pass.
- Chuan bi deploy cho repo GitHub chinh:
  - Kiem tra `D:\Codex_Project` la git repo, branch `main`.
  - Remote hien tai: `https://github.com/kukem000022/checklist-app.git`.
  - GitHub Pages URL du kien: `https://kukem000022.github.io/checklist-app/`.
  - Cap nhat docs deploy voi `APP_ORIGIN=https://kukem000022.github.io` va `VITE_BASE_PATH=/checklist-app/`.
  - Workspace o C co `.git` rong nen khong commit/push truc tiep tu folder C duoc.
  - Can commit/push tu `D:\Codex_Project` sau khi sync file moi nhat.
- Checkpoint test deploy bang tai khoan user cung cap:
  - User cho phep test bang tai khoan `duydy@kootoro.com`.
  - Moi truong Codex hien tai bi chan truy cap network ra ngoai: mo GitHub Pages bang browser headless bi `ERR_NETWORK_ACCESS_DENIED`, fetch GitHub Pages/Render cung fail.
  - Chua the login/test toc do deployed app truc tiep tu Codex trong turn nay.
  - QA static tiep tuc va thay `frontend/src/api.js` con 1 thong bao loi API bi mojibake.
  - Da thay thong bao fallback thanh `Không thể kết nối API`.
  - Da chay `npm.cmd run lint` pass.
  - Da chay `node --check backend\src\server.js; node --check backend\src\reminders.js` pass.
  - Da chay `npm.cmd run build --workspace frontend -- --base=/checklist-app/` pass.
- Fix them UI dark mode sau checkpoint:
  - Audit CSS cac surface tung bi trang: task drawer checklist, drawer savebar, report bars, task-line, project/role/people rows.
  - Them lop `Production dark polish` cuoi `frontend/src/styles.css` de ep cac card/form con dung nen dark, text sang, border nhe.
  - Da chay `npm.cmd run lint` pass.
  - Da chay `node --check backend\src\server.js; node --check backend\src\reminders.js` pass.
  - Da chay `npm.cmd run build --workspace frontend -- --base=/checklist-app/` pass.
- Fix UI drawer/checklist sau audit CSS build:
  - Phat hien `frontend/src/styles.css` co 2 rule `.drawer`; rule sau ghi de mat `padding-bottom: 112px`, co the lam nut sticky `Luu thay doi` che form binh luan.
  - Sua `.drawer` thanh `padding: 18px 18px 112px`.
  - Sua checklist item da hoan thanh khong con gach ngang ca khung/select/textarea; chi gach ten cong viec.
  - Them dark border cho `.drawer-section` de khong con duong vien sang trong dark mode.
  - Da chay `npm.cmd run lint` pass.
  - Da chay `node --check backend\src\server.js; node --check backend\src\reminders.js` pass.
  - Da chay `npm.cmd run build --workspace frontend -- --base=/checklist-app/` pass.
  - Thu truy cap `https://kukem000022.github.io/checklist-app/` bang Node runtime van fail `fetch failed` do network sandbox, chua the login/test online trong Codex.
- Fix first paint dark mode:
  - Them script nho vao `frontend/index.html` de set `data-theme` va background ngay trong head truoc khi React bundle tai, giam nguy co nhay nen trang tren GitHub Pages.
  - Boc doc/ghi `localStorage` theme trong `frontend/src/main.jsx` bang helper an toan, tranh loi neu browser chan storage.
  - Da chay `npm.cmd run lint` pass.
  - Da chay `node --check backend\src\server.js; node --check backend\src\reminders.js` pass.
  - Da chay `npm.cmd run build --workspace frontend -- --base=/checklist-app/` pass.
  - Da verify `frontend/dist/index.html` co script theme trong head va asset `/checklist-app/assets/...`.
  - Thu truy cap GitHub Pages bang Node runtime van fail `fetch failed` do network sandbox.
- Sau checkpoint UI/task dinh ky moi nhat:
  - `npm.cmd run lint` pass.
  - `node --check backend\src\server.js; node --check backend\src\reminders.js` pass.
  - `npm.cmd run build --workspace frontend -- --base=/checklist-app/` pass.
  - `npm.cmd run build` pass.
- Sau checkpoint toi uu toc do/glass/render:
  - `npm.cmd run lint` pass.
  - `node --check backend\src\server.js; node --check backend\src\reminders.js` pass.
  - `npm.cmd run build --workspace frontend -- --base=/checklist-app/` pass.
  - `npm.cmd run build` pass.
- Sau checkpoint UI task tabs / drawer / Telegram mention:
  - Bo cum thong ke tren dau trang `Task cua toi` vi tab ben duoi da du thong tin.
  - Sua logic tab task: `Tat ca` chi hien task chua ket thuc, khong gom `Hoan thanh` va `Da huy`; them tab `Chua bat dau` va `Sap het han`.
  - `Sap het han` la bo loc deadline dong, khong tinh nhu status luu DB de tranh dup task.
  - Sua form tao task: `Bat dau` song song `Deadline`, dua `Uu tien` xuong duoi cung.
  - Them nut `Dong` o thanh duoi drawer chi tiet task, bo nen/khung nang quanh nut `Luu thay doi`.
  - Sua Telegram mention: ho tro `@username` va mention an bang numeric Telegram user ID.
  - Sua encoding tieng Viet trong `backend/src/reminders.js` cho thong bao nhac viec/qua han.
  - Them quyen `manage_project_recurring_tasks` va `manage_own_recurring_tasks` vao UI role, schema, va SQL update.
  - Them SQL `supabase/run_this_update_recurring_permissions.sql` de cap nhat role/RLS task dinh ky tren Supabase hien huu.
  - Da chay `node --check backend\src\server.js` pass.
  - Da chay `node --check backend\src\reminders.js` pass.
  - Da chay `npm.cmd run lint` pass.
  - Da chay `npm.cmd run build` pass.
- Sau checkpoint sidebar/board co dinh/auto start:
  - Mac dinh vao app o tab `Task cua toi` thay vi Dashboard.
  - Them nut thu gon/mo rong sidebar, mac dinh lan dau la thu gon va luu trang thai vao localStorage.
  - Bo header `Cong viec theo du an`/so task dung rieng phia tren trong `Task cua toi`.
  - Dua search, mo rong bo loc, tab trang thai, nut tao task va chuyen che do bang/danh sach vao trong khung bang cong viec.
  - Doi nut `Tao task/Bang/Danh sach` trong board thanh icon compact.
  - Sua khung board de co chieu cao co dinh, task/project chi cuon trong khung board thay vi keo ca trang.
  - Backend reminder sweep tu chuyen task `todo` co `start_time <= now()` sang `doing`.
  - Da chay `node --check backend\src\reminders.js` pass.
  - Da chay `npm.cmd run lint` pass.
  - Da chay `npm.cmd run build` pass.
- Sau checkpoint compact task card / board toolbar:
  - Bo chu `Theo du an` trong header board/list tren trang `Task cua toi`.
  - Thu gon toolbar trong khung bang: search/filter nho hon, icon tao task/chuyen view compact hon, tab trang thai gon hon.
  - Sua task card: title nhe hon, priority doi thanh cham mau nho, khong co deadline thi khong hien chip deadline, bo thanh progress.
  - Dua checklist count ve dang icon checkbox + `done/total` + `%` o chan card.
  - Da chay `npm.cmd run lint` pass.
  - Da chay `npm.cmd run build` pass.
- Sau checkpoint task dinh ky weekday / card cleanup / auto status:
  - Them lich chay theo ngay trong tuan cho task dinh ky hang ngay, mac dinh T2-T6.
  - Task dinh ky hang thang van tu day qua ngay lam viec tiep theo neu dinh T7/CN.
  - Cho phep bam vao mau task dinh ky da tao de sua, danh sach mau hien theo dang row/table gon hon.
  - Backend API `/api/daily-templates` nhan/luu `weekdays`; reminder sweep chi tao task neu ngay hien tai nam trong lich chay.
  - Them SQL `supabase/run_this_update_recurring_weekdays.sql` de cap nhat database hien huu.
  - Tao task moi co `start_time <= now` se tu vao `Dang lam`; backend cung tu bao ve neu frontend gui thieu status.
  - Khi sua task va start time da toi, neu task dang `Chua bat dau` thi luu se tu doi sang `Dang lam`.
  - Khi bam `Luu thay doi`, neu tat ca checklist con da tick xong thi hien confirm de chuyen task sang `Hoan thanh`.
  - Card task: bo chip `Group Telegram`, bo hien thi `%`, khong co deadline thi khong hien chip deadline, title nhe hon, checklist con hien icon + `done/total`.
  - Tab `Hoan thanh` chuyen tone xanh la, tab `Da huy` chuyen tone do.
  - Da chay `node --check backend\src\server.js` pass.
  - Da chay `node --check backend\src\reminders.js` pass.
  - Da chay `npm.cmd run lint` pass.
  - Da chay `npm.cmd run build` pass.
- Sau checkpoint task board tabs len header:
  - Dua cum tab loc trang thai vao cung hang tren cua toolbar bang cong viec.
  - Nen search/filter va cum icon tao task/chuyen view de giam chieu cao toolbar.
  - Giu nguyen logic loc task hien tai, chi sua layout UI.
  - Da chay `node --check backend\src\server.js` pass.
  - Da chay `npm.cmd run build` pass.
- Sau checkpoint mobile usability:
  - Toi uu layout mobile cho app dung bang tay: sidebar thanh bottom nav co dinh, nut dieu huong gon, noi dung chinh tranh bi che boi safe-area.
  - Task board tren mobile thanh khung lam viec co dinh theo chieu cao man hinh; project/task chi cuon ben trong khung, khong keo ngang/keo doc ca trang.
  - Search/filter/tab/nut tao task trong `Task cua toi` duoc thu gon cho man hinh nho; tab trang thai cuon ngang, filter mo dang overlay gon.
  - Task card tren mobile giam padding/font-size, cot project co width theo viewport, list task trong tung cot cuon doc rieng.
  - Modal tao task chuyen thanh bottom sheet; drawer chi tiet task full-screen tren mobile, header va thanh luu sticky de thao tac de hon.
  - File da sua: `frontend/src/styles.css`.
  - Loi con lai: chua QA truc tiep tren Chrome device toolbar/mobile that trong sandbox nay.
  - Da chay `npm.cmd run build` pass.
  - Da chay `npm.cmd run lint` pass.
- Sau checkpoint mobile shell override:
  - Sua lop CSS mobile cuoi file de app dung `100dvh` that su, tranh keo/mat noi dung khi trinh duyet mobile co thanh dia chi.
  - `app-main` tren mobile thanh flex column co cuon doc rieng cho cac trang form/settings, trong khi `Task cua toi` van giu board la khung lam viec co dinh.
  - `task-workspace`/`compact-workspace` khong con ep `min-height` lon gay tran man hinh nho; board va tung cot task cuon noi bo bang `-webkit-overflow-scrolling: touch`.
  - Modal tao task va drawer chi tiet tiep tuc cuon muot hon tren mobile.
  - File da sua: `frontend/src/styles.css`.
  - Loi con lai: chua QA truc tiep tren Chrome device toolbar/mobile that trong sandbox nay vi preview/browser runtime bi chan/khong on dinh.
  - Da chay `node --check backend\src\server.js; node --check backend\src\reminders.js` pass.
  - Da chay `npm.cmd run lint` pass.
  - Da chay `npm.cmd run build` pass.
- Sau checkpoint mobile bottom nav QA:
  - Kiem tra lai CSS mobile bottom nav: doi sang hang ngang co cuon noi bo, khong lam tran ngang body.
  - QA Chrome headless viewport 390x844 voi session/API mock: `document/body` van 390px, `Task cua toi` khong bi horizontal overflow ca trang.
  - Detail drawer mobile full viewport, co scroll noi bo va thanh nut luu/close sticky o day.
  - Modal tao task mobile mo thanh panel trong viewport, cuon noi bo, khong lam tran ngang body.
  - File da sua: `frontend/src/styles.css`.
  - Ghi chu deploy GitHub Pages: local lint/build pass; loi hien tai nam o buoc `actions/deploy-pages@v4` khi tao Pages deployment.
  - Da chay `npm.cmd run lint` pass.
  - Da chay `npm.cmd run build` pass.
- Sau checkpoint Zalo Push notification:
  - Them client goi Zalo Push API bang `ZALO_PUSH_URL` va `ZALO_PUSH_API_TOKEN`.
  - Reminder sweep gui them Zalo cho task sap toi han/qua han neu da cau hinh Zalo chung; Telegram van giu nguyen.
  - Tao task moi gui them Zalo neu co Zalo chung; tranh gui lap nhieu tin Zalo cho tung thanh vien trong cung task.
  - Sua message reminder moi sang tieng Viet sach cho luong gui moi, tranh noi dung mojibake cu.
  - Trang `Cai dat` co them khu vuc `Zalo chung` de nhap `default_zalo_group_id` hoac `default_zalo_flow_code`.
  - Cap nhat `backend/.env.example`, `render.yaml`, `docs/render-github-pages-deploy.md`.
  - Them SQL tuy chon `supabase/run_this_update_zalo_settings.sql`.
  - Da chay `node --check backend\src\zalo.js`, `node --check backend\src\reminders.js`, `node --check backend\src\server.js` pass.
  - Da chay `npm.cmd run lint` pass.
  - Da chay `npm.cmd run build` pass.
- Sau checkpoint mobile create task modal:
  - Sua modal tao task tren dien thoai de khong bi bottom nav che nut `Tao task`.
  - Modal mobile chua day cho bottom nav, gioi han chieu cao bang `100dvh`, form cuon noi bo va nut submit sticky trong sheet.
  - File da sua: `frontend/src/styles.css`.
  - Da chay `npm.cmd run build` pass.

## Loi con lai / viec chua xong

- Chua QA API authenticated/runtime bang tai khoan admin vi sandbox chan ket noi Supabase.
- Chua QA UI bang trinh duyet that trong moi truong nay vi khong co browser-control tool kha dung trong turn nay.
- Chua QA deployed app bang tai khoan `duydy@kootoro.com` vi sandbox chan network ra GitHub Pages/Render.
- Note moi can tiep tuc QA tay sau khi user chay:
  - Kiem tra lai spacing thuc te cua tab trang thai trong `Task cua toi` sau khi co nhieu task.
  - Kiem tra luong sua task: doi start/deadline, tick het checklist, confirm chuyen `Hoan thanh`.
  - Kiem tra luong task dinh ky: daily T2-T6, monthly ngay 15/3/5, bam row de sua va luu lai.
- Can chay SQL `supabase/run_this_update_recurring_monthly.sql` tren Supabase truoc khi dung task dinh ky thang o moi truong da co database cu.
- Can chay SQL `supabase/run_this_update_project_avatar_inactive_review_cleanup.sql` tren Supabase de them avatar du an, inactive project, bo `review`, va sua default ID checklist.
- Can chay SQL `supabase/run_this_update_recurring_permissions.sql` tren Supabase de them quyen task dinh ky va RLS cho nhan su tao/sua mau dinh ky hop le.
- Can chay SQL `supabase/run_this_update_recurring_weekdays.sql` tren Supabase de them cot lich chay theo thu cho task dinh ky.
- Co the chay SQL `supabase/run_this_update_zalo_settings.sql` tren Supabase de tao san 2 key Zalo chung; neu khong chay, app van tu tao key khi admin bam luu trong Cai dat.
- Render service hien tai o My/Oregon khong tu doi sang Singapore sau khi sua `render.yaml`; can tao service moi tu Blueprint hoac Web Service moi voi region Singapore, copy env vars, test `/health`, roi doi `VITE_API_URL`.
- Chua chuyen CRUD task sang Supabase direct; viec nay can audit/si chat RLS truoc de tranh lo data.
- Cac luong da QA tinh/code review:
  - Dashboard / Reports voi task members.
  - Nhan su / role / project members.
  - Settings avatar, Telegram chung, dark/light mode.
  - SQL schema/update scripts.

## Lenh can chay tiep

- Neu moi truong cho phep network Supabase: `node work\qa-smoke.mjs`.
- Tiep tuc QA tinh/code review cac luong con lai.
- Sau moi fix: `npm.cmd run lint`, `node --check backend\src\server.js; node --check backend\src\reminders.js`, `npm.cmd run build`.
- De cap nhat moi truong chinh ngoai sandbox: `powershell -ExecutionPolicy Bypass -File C:\Users\longhuynh\Documents\Codex\2026-06-24\m-nh\scripts\sync-to-main.ps1`.
- Sau do vao `D:\Codex_Project` va chay lint/check/build.

- Sau checkpoint safe glass style merge:
  - Khong thay nguyen `styles.css` bang ban moi o D vi ban do thieu nhieu layout hien tai va co nguy co lam trang trong/vang UI.
  - Da them font `Outfit` / `Plus Jakarta Sans` vao CSS hien tai.
  - Da them lop glass an toan: gradient sheen, border/surface highlight, shadow mem cho panel/card/table/task.
  - Da tat blur tren cac container cuon lon de tranh lag mobile; chi giu blur cho modal/drawer/topbar/bottom nav/sidebar.
  - Da bo sung override dark/purple cho table head, permission row, role row, report bar, project info de han che cac mang trang con sot.
  - File da sua: `frontend/src/styles.css`.
  - Loi con lai: can QA bang mat tren GitHub Pages/local sau khi deploy vi sandbox khong mo duoc browser that.
  - Da chay `npm.cmd run build` pass.
- Sau checkpoint chuan hoa typography Inter:
  - Chuyen font frontend sang `Inter` va dung day weight 400/500/600/700.
  - Them bien typography theo rule: Title 24/700, H1 20/700, H2 18/600, table/input/button 14px dung weight theo yeu cau.
  - Them lop override cuoi file de giam cac title/card dang qua dam ve dung scale, giu tieng Viet de doc hon.
  - File da sua: `frontend/src/styles.css`.
  - Loi con lai: can user refresh hard cache tren GitHub Pages sau release de thay font moi.
  - Da chay `npm.cmd run build` pass.
## Checkpoint - fix mobile drawer, comments, task_members save flow

### Đã làm
- Đổi bình luận trong chi tiết task sang thứ tự mới nhất ở trên.
- Tách tên người bình luận và thời gian bằng lớp `comment-meta` để không bị dính chữ.
- Chỉnh tab lọc trên mobile thành một hàng cuộn ngang, giảm chiều cao để đỡ chiếm màn hình.
- Chỉnh thanh Lưu/Đóng trong task drawer trên mobile luôn nằm gần đáy nhưng bớt khối nền nặng.
- Sửa luồng lưu chi tiết task: chỉ gửi `member_ids` về backend khi danh sách thành viên xử lý thật sự thay đổi, tránh lỗi RLS `task_members` khi chỉ lưu checklist/note.
- Bổ sung màu hiển thị ổn định cho input `datetime-local` trên mobile/dark mode.

### File đã sửa
- `frontend/src/main.jsx`
- `frontend/src/styles.css`

### Lỗi còn lại / cần kiểm tra
- Cần test thật trên mobile: mở chi tiết task, kéo xuống cuối, kiểm tra nút `Đóng` và `Lưu thay đổi` có hiện không.
- Nếu Supabase vẫn báo RLS `task_members`, chạy lại file SQL: `supabase/run_this_update_task_members_daily_rerun.sql`.

### Lệnh cần chạy tiếp
- `npm.cmd run build`

### Kết quả kiểm tra
- `node --check backend/src/server.js`: pass.
- `npm.cmd run build`: pass.
## Checkpoint - fix task status filter layout

### Da lam
- Giu cum tab trang thai trong `Task cua toi` tren desktop thanh mot hang, khong de nut `Da huy` bi rot xuong dong rieng.
- An cum tab trang thai tren mobile de khung bang task rong hon va khong bi thu hep chieu cao.

### File da sua
- `frontend/src/styles.css`

### Loi con lai / can kiem tra
- Can user refresh trang local/deploy va xem lai tren dien thoai that vi sandbox khong mo duoc Chrome mobile.

### Lenh can chay tiep
- `npm.cmd run build`

### Ket qua kiem tra
- `npm.cmd run build`: pass.

## Checkpoint - Zalo mention profile mapping

### Da lam
- Them truong Zalo cho ho so nhan su: `zalo_user_id`, `zalo_display_name`.
- API nhan su/ho so ca nhan doc va luu duoc 2 truong Zalo moi.
- Zalo push khi tao task va reminder se gui them `mentions` gom `{ userId, name }` neu nhan su da co Zalo user ID.
- Noi dung Zalo hien thi ten nhan su dang `@Ten Zalo` khi co Zalo user ID, fallback ve ten/email neu chua map.
- Tao file SQL update rieng cho Supabase production.

### File da sua
- `backend/src/zalo.js`
- `backend/src/server.js`
- `backend/src/reminders.js`
- `frontend/src/main.jsx`
- `supabase/schema.sql`
- `supabase/run_this_update_zalo_profile_mentions.sql`
- `TODO_CODEX.md`

### Loi con lai / can kiem tra
- Can chay SQL `supabase/run_this_update_zalo_profile_mentions.sql` tren Supabase truoc khi luu Zalo user ID.
- Can test that voi bot Zalo sau khi dien dung Zalo user ID cho nhan su; neu bot dung ten field khac `mentions` thi can map lai theo spec bot.

### Lenh can chay tiep
- Da pass: `node --check backend\src\zalo.js`
- Da pass: `node --check backend\src\server.js`
- Da pass: `node --check backend\src\reminders.js`
- Da pass: `npm.cmd run build`

## Checkpoint - deadline/status change notifications

### Da lam
- Backend bat buoc nhap ly do khi doi deadline task.
- Ly do doi deadline duoc luu thanh binh luan cua task.
- Backend gui thong bao Telegram va Zalo khi doi deadline, khi task chuyen sang Hoan thanh, hoac khi task chuyen sang Da huy.
- Thong bao dung group Telegram cua du an, fallback ve group Telegram chung neu du an chua cau hinh.
- Thong bao Zalo dung cau hinh push chung va kem mentions theo Zalo user ID cua nhan su neu da map.
- Frontend hien o "Ly do thay doi deadline" khi deadline bi thay doi va chan luu neu chua nhap ly do.

### File da sua
- `backend/src/server.js`
- `frontend/src/main.jsx`
- `TODO_CODEX.md`

### Loi con lai / can kiem tra
- Can test that: doi deadline tren task co nhan su da map Telegram/Zalo, xem binh luan moi va thong bao tren group.
- Can test that: doi trang thai sang Hoan thanh/Da huy, xem Telegram/Zalo co nhan thong bao dung noi dung khong.

### Lenh can chay tiep
- Da pass: `node --check backend\src\server.js`
- Da pass: `npm.cmd run build`

### Ket qua kiem tra
- Backend syntax check pass.
- Frontend production build pass.
## Checkpoint - mobile image attachment button

### Da lam
- Them nut chon anh cho binh luan va cac o note trong chi tiet task.
- Anh duoc nen ve WebP toi da 450KB roi chen vao noi dung dang markdown image.
- Binh luan co the render lai anh inline.
- Van giu logic API/Supabase hien tai, khong doi schema.

### File da sua
- frontend/src/main.jsx
- frontend/src/styles.css
- TODO_CODEX.md

### Loi con lai / can kiem tra
- Can test tren dien thoai that: bam nut Anh, chon anh tu thu vien, gui binh luan/luu task.
- Neu sau nay can luu nhieu anh lon, nen tach sang Supabase Storage thay vi luu inline trong text.

### Lenh can chay tiep
- npm.cmd run build

## 2026-07-15 - Upload UI va don anh roi

### Da lam
- Lam lai UI nut them anh trong ghi chu va binh luan, an input file mac dinh cua trinh duyet.
- Chan anh goc lon hon 10MB truoc khi nen va upload.
- Chi cho chon cac dinh dang anh JPG, PNG, WebP, GIF.
- Them khu "Don anh dinh kem" trong Cai dat de quet anh tren Storage khong con duoc tham chieu trong task/comment/checklist va xoa thu cong.

### File da sua
- `frontend/src/main.jsx`
- `frontend/src/styles.css`
- `supabase/run_this_create_task_attachments_storage.sql`
- `TODO_CODEX.md`

### Loi con lai / can kiem tra
- Can chay SQL `supabase/run_this_create_task_attachments_storage.sql` tren Supabase production de nang bucket len 10MB va cap quyen admin xoa anh roi.
- Can test upload anh tu desktop va mobile, sau do vao Cai dat de quet anh roi.

### Lenh can chay tiep
- `npm.cmd run build`
- Supabase SQL: chay `supabase/run_this_create_task_attachments_storage.sql`

## 2026-07-15 - Anh dinh kem, mobile drawer va ly do deadline

### Da lam
- Anh trong ghi chu/binh luan hien dang thumbnail, bam vao se mo popup xem anh lon.
- Khi doi deadline ma chua nhap ly do, man hinh tu cuon/focus ve o ly do va highlight de de thay.
- Don anh roi trong Cai dat gio bo qua task da huy, vi task huy duoc xem nhu khong con dung anh nua.
- An cum tab trang thai tren mobile de khong chiem chieu cao man hinh.
- Giam khoang trong/khung sticky cua nut Luu thay doi trong drawer mobile.

### File da sua
- `frontend/src/main.jsx`
- `frontend/src/styles.css`
- `TODO_CODEX.md`

### Loi con lai / can kiem tra
- Can test truc tiep tren dien thoai: mo chi tiet task, bam anh, luu khi thieu ly do deadline, va xem footer co con khoang trong la hay khong.

### Lenh can chay tiep
- `npm.cmd run build` da pass.

## 2026-07-16 - Nhieu nhan su cho task dinh ky

### Da lam
- Cho phep chon va chinh sua nhieu nhan su trong mot mau task dinh ky.
- Giu nguoi dau tien lam nguoi phu trach chinh de tuong thich voi du lieu va thong bao cu.
- Luu toan bo nguoi duoc chon vao bang `daily_task_template_members`.
- Khi sinh task tu mau dinh ky, tu dong gan day du nhan su vao `task_members`.
- Tu dong backfill mau cu: dua `assignee_id` hien tai vao danh sach thanh vien cua mau.
- Doi luong cap nhat thanh vien sang upsert truoc, chi xoa nhung nguoi bi bo chon sau de tranh mat danh sach neu co loi giua chung.
- Mo rong RLS de thanh vien cua mau co the xem mau va lich su task dinh ky lien quan.

### File da sua
- `backend/src/server.js`
- `backend/src/reminders.js`
- `frontend/src/main.jsx`
- `frontend/src/styles.css`
- `supabase/schema.sql`
- `supabase/run_this_update_recurring_multiple_assignees.sql`
- `TODO_CODEX.md`

### Loi con lai / can kiem tra
- Can chay `supabase/run_this_update_recurring_multiple_assignees.sql` tren Supabase production truoc khi dung tinh nang moi.
- Can test that: tao mot mau co tu 2 nhan su, bam Chay lai hom nay, sau do kiem tra task sinh ra co du thanh vien xu ly.
- Khong con loi tinh trong bo kiem tra tu dong. Kiem thu tren Supabase production can thuc hien sau khi chay migration.

### Lenh can chay tiep
- Da pass: `npm.cmd run lint`.
- Da pass: `npm.cmd run build` (Vite, 1614 modules).
- Da pass: `node --check backend\src\server.js`.
- Da pass: `node --check backend\src\reminders.js`.
- Tiep theo: chay `supabase/run_this_update_recurring_multiple_assignees.sql` trong Supabase SQL Editor.

## 2026-07-16 - Chuan hoa mau giao dien toi

### Da lam
- Gom bang mau dark ve mot he token chung: nen OLED xanh-den, 4 cap be mat, vien mong, text chinh/phu/muted va mau accent emerald.
- Dong bo mau cho sidebar, bottom navigation, topbar, dashboard, bang task, cot du an, the task, drawer, modal, form, bang du lieu, bao cao, nhan su, vai tro va cai dat.
- Loai bo cam giac cac khoi den/trang bi tach roi; tang do tuong phan noi dung ma van giu giao dien diu mat.
- Chuan hoa mau nghia cho sap het han, qua han, dang lam, hoan thanh, da huy va task moi.
- Giu blur chi o lop modal/drawer co dinh; khong them blur vao bang task cuon de tranh giam hieu nang.
- Giu nguyen cac rule responsive hien co, bao gom an cum tab trang thai tren mobile va footer drawer khong co khoi nen thua.

### File da sua
- `frontend/src/styles.css`
- `TODO_CODEX.md`

### QA/QC
- CSS can bang dau ngoac: 951 mo / 951 dong.
- `npm.cmd run lint` da pass.
- `npm.cmd run build` da pass (Vite, 1614 modules; CSS 122.42 kB, JS 471.98 kB).
- Da kiem tra thu tu cascade: lop dark chuan nam cuoi file va khong ghi de rule mobile can thiet.
- Phien nay khong co Playwright/trinh duyet tu dong de chup anh responsive; can xem lai nhanh tren dien thoai that sau khi dong bo sang may chay.

### Loi con lai / can kiem tra
- Khong con loi build/lint/CSS tinh.
- Can kiem tra cam quan tren du lieu production that, nhat la cac man hinh co noi dung dai va anh dinh kem.

### Lenh can chay tiep
- Khong co lenh bat buoc. Khi can dong bo/release, chay lai `npm.cmd run lint` va `npm.cmd run build` tai ban se deploy.
