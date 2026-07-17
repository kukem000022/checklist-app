 import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarClock,
  Check,
  Clock3,
  CircleUserRound,
  FolderKanban,
  KeyRound,
  Image as ImageIcon,
  LayoutDashboard,
  ListChecks,
  LogOut,
  LoaderCircle,
  MessageSquare,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Rows3,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Table2,
  Sun,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { api, fromLocalInputValue } from "./api";
import { supabase } from "./supabase";
import "./styles.css";

const navItems = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "projects", label: "Dự án", icon: FolderKanban },
  { id: "tasks", label: "Task của tôi", icon: ListChecks },
  { id: "people", label: "Nhân sự", icon: UsersRound, adminOnly: true },
  { id: "roles", label: "Vai trò", icon: KeyRound, adminOnly: true },
  { id: "notifications", label: "Task định kỳ", icon: Bell },
  { id: "reports", label: "Báo cáo", icon: BarChart3 },
  { id: "settings", label: "Cài đặt", icon: Settings },
];

const permissionCatalog = [
  { id: "view_all_tasks", label: "Xem toàn bộ task" },
  { id: "view_project_tasks", label: "Xem task theo dự án" },
  { id: "manage_projects", label: "Tạo/cập nhật dự án" },
  { id: "manage_project_members", label: "Thêm/xóa thành viên dự án" },
  { id: "create_personal_tasks", label: "Tạo task cá nhân" },
  { id: "assign_tasks", label: "Giao task cho người khác" },
  { id: "update_own_tasks", label: "Cập nhật task được giao" },
  { id: "approve_tasks", label: "Duyệt task hoàn thành" },
  { id: "view_reports", label: "Xem báo cáo" },
  { id: "manage_telegram", label: "Cấu hình Telegram" },
  { id: "manage_own_telegram", label: "Cấu hình Telegram cá nhân" },
  { id: "manage_project_recurring_tasks", label: "Quản lý task định kỳ dự án" },
  { id: "manage_own_recurring_tasks", label: "Tạo/sửa task định kỳ cá nhân" },
  { id: "manage_people", label: "Tạo/khóa tài khoản" },
  { id: "manage_roles", label: "Quản lý vai trò và quyền" },
];

const emptyTaskForm = {
  project_id: "",
  title: "",
  description: "",
  assignee_id: "",
  start_time: "",
  due_time: "",
  priority: "medium",
  list_id: "",
  member_ids: [],
  checklist: "",
};

const emptyUserForm = {
  full_name: "",
  email: "",
  password: "",
  department: "",
  role_ids: ["staff"],
  status: "active",
};

const emptyProjectForm = {
  name: "",
  description: "",
  manager_id: "",
  telegram_group_chat_id: "",
  avatar_url: "",
};

const weekdayOptions = [
  { value: 1, label: "T2" },
  { value: 2, label: "T3" },
  { value: 3, label: "T4" },
  { value: 4, label: "T5" },
  { value: 5, label: "T6" },
  { value: 6, label: "T7" },
  { value: 0, label: "CN" },
];
const defaultRecurringWeekdays = [1, 2, 3, 4, 5];

const avatarMaxBytes = 500 * 1024;
const avatarMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function avatarExtension(mimeType) {
  return {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[mimeType] || "jpg";
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Không đọc được ảnh, vui lòng chọn file khác."));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

async function compressAvatar(file) {
  if (!avatarMimeTypes.has(file.type)) {
    throw new Error("Ảnh đại diện chỉ nhận JPG, PNG hoặc WebP.");
  }

  if (file.size <= avatarMaxBytes) {
    return { blob: file, extension: avatarExtension(file.type), mimeType: file.type };
  }

  const image = await loadImageFromFile(file);
  const sizes = [640, 512, 384, 256];
  const qualities = [0.86, 0.78, 0.7, 0.62, 0.54];

  for (const maxSize of sizes) {
    const ratio = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of qualities) {
      const blob = await canvasToBlob(canvas, "image/webp", quality);
      if (blob && blob.size <= avatarMaxBytes) {
        return { blob, extension: "webp", mimeType: "image/webp" };
      }
    }
  }

  throw new Error("Ảnh vẫn lớn hơn 500KB sau khi nén, vui lòng chọn ảnh nhỏ hơn.");
}

const attachmentBucket = "task-attachments";
const attachmentImageMaxBytes = 450 * 1024;
const attachmentUploadMaxBytes = 10 * 1024 * 1024;
const attachmentPublicMarker = `/storage/v1/object/public/${attachmentBucket}/`;

function safeAttachmentName(name = "anh-dinh-kem") {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80) || "anh-dinh-kem";
}

function appendWithGap(current, addition) {
  return `${current || ""}${current?.trim() ? "\n\n" : ""}${addition}`;
}

async function compressAttachmentImage(file) {
  if (!file?.type?.startsWith("image/")) {
    throw new Error("Vui lòng chọn file hình ảnh.");
  }

  const image = await loadImageFromFile(file);
  const sizes = [1280, 1024, 820, 640, 520];
  const qualities = [0.82, 0.72, 0.62, 0.52, 0.44];

  for (const maxSize of sizes) {
    const ratio = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of qualities) {
      const blob = await canvasToBlob(canvas, "image/webp", quality);
      if (blob && blob.size <= attachmentImageMaxBytes) {
        return blob;
      }
    }
  }

  throw new Error("Ảnh vẫn lớn hơn 450KB sau khi nén, vui lòng chọn ảnh nhỏ hơn.");
}

function attachmentStoragePath(taskId, fileName) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const random = Math.random().toString(36).slice(2, 8);
  return `${taskId || "draft"}/${stamp}-${random}-${safeAttachmentName(fileName)}.webp`;
}

function imageMarkdown(imageUrl, fileName) {
  return `![${safeAttachmentName(fileName)}](${imageUrl})`;
}

function attachmentPathFromUrl(url) {
  if (!url || typeof url !== "string") return "";
  const markerIndex = url.indexOf(attachmentPublicMarker);
  if (markerIndex < 0) return "";
  const rawPath = url
    .slice(markerIndex + attachmentPublicMarker.length)
    .split(/[?#]/)[0];
  try {
    return decodeURIComponent(rawPath);
  } catch {
    return rawPath;
  }
}

function collectAttachmentPathsFromText(text, paths) {
  if (!text || typeof text !== "string") return;
  const markdownImageRegex = /!\[[^\]]*]\(([^)]+)\)/g;
  const urlRegex = /https?:\/\/[^\s)]+/g;
  for (const match of text.matchAll(markdownImageRegex)) {
    const path = attachmentPathFromUrl(match[1]);
    if (path) paths.add(path);
  }
  for (const match of text.matchAll(urlRegex)) {
    const path = attachmentPathFromUrl(match[0]);
    if (path) paths.add(path);
  }
}

function collectAttachmentPathsFromValue(value, paths) {
  if (!value) return;
  if (typeof value === "string") {
    collectAttachmentPathsFromText(value, paths);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectAttachmentPathsFromValue(item, paths));
    return;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) => collectAttachmentPathsFromValue(item, paths));
  }
}

async function listStorageAttachmentPaths(prefix = "") {
  const { data, error } = await supabase.storage.from(attachmentBucket).list(prefix, {
    limit: 1000,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error) throw error;
  const paths = [];
  for (const item of data || []) {
    if (!item?.name) continue;
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    const isFolder = !item.id && !item.metadata;
    if (isFolder) {
      paths.push(...(await listStorageAttachmentPaths(path)));
    } else {
      paths.push(path);
    }
  }
  return paths;
}

function formatDate(value) {
  if (!value) return "Chưa đặt";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function toLocalInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function personName(profile) {
  return profile?.full_name || profile?.email || "Chưa rõ";
}

function AvatarChip({ profile, className = "" }) {
  const label = personName(profile);
  return (
    <span className={`avatar-chip ${className}`}>
      {profile?.avatar_url ? <img src={profile.avatar_url} alt={label} /> : label.slice(0, 2).toUpperCase()}
    </span>
  );
}

function ProjectAvatar({ project, fallbackProfile, className = "" }) {
  const label = project?.name || personName(fallbackProfile) || "Dự án";
  const avatarUrl = project?.avatar_url || (!project ? fallbackProfile?.avatar_url : "");
  return (
    <span className={`project-avatar ${className}`}>
      {avatarUrl ? <img src={avatarUrl} alt={label} /> : <FolderKanban size={18} />}
    </span>
  );
}

function roleLabel(role) {
  return {
    admin: "Admin",
    manager: "Manager",
    staff: "Nhân sự",
  }[role] || role;
}

function statusLabel(status) {
  return {
    todo: "Chưa bắt đầu",
    doing: "Đang làm",
    done: "Hoàn thành",
    cancelled: "Đã hủy",
  }[status] || status;
}

function priorityLabel(priority) {
  return {
    high: "Cao",
    medium: "Trung bình",
    low: "Thấp",
  }[priority] || priority;
}

function isOverdue(task) {
  return task.due_time && new Date(task.due_time) < new Date() && !["done", "cancelled"].includes(task.status);
}

function isDueSoon(task) {
  if (!task.due_time || ["done", "cancelled"].includes(task.status)) return false;
  const diff = new Date(task.due_time).getTime() - Date.now();
  return diff > 0 && diff <= 24 * 60 * 60 * 1000;
}

function checklistProgress(task) {
  const items = task.task_checklists || [];
  if (!items.length) return 0;
  return Math.round((items.filter((item) => item.is_done).length / items.length) * 100);
}

function projectStatusLabel(status) {
  return {
    planning: "Lên kế hoạch",
    active: "Đang hoạt động",
    paused: "Tạm dừng",
    completed: "Hoàn thành",
    inactive: "Tạm ngưng",
  }[status] || status;
}

function taskInvolvesProfile(task, profileId) {
  return (
    task.assignee_id === profileId ||
    (task.task_members || []).some((member) => member.user_id === profileId)
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setMessage(error.message || "Không thể đăng nhập, vui lòng kiểm tra lại tài khoản.");
  }


  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="brand-lockup">
          <ListChecks size={34} />
          <div>
            <h1>Checklist App</h1>
            <p>Quản lý task, deadline và nhắc việc Telegram.</p>
          </div>
        </div>
        <form onSubmit={submit} className="stack-form">
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          </label>
          <label>
            Mật khẩu
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              minLength={6}
              required
            />
          </label>
          <button className="primary-action" disabled={loading} aria-busy={loading}>
            {loading ? <LoaderCircle size={18} className="spin-icon" /> : <ShieldCheck size={18} />}
            {loading ? "Đang đăng nhập" : "Đăng nhập"}
          </button>
        </form>
        {message && <p className="notice">{message}</p>}
      </section>
    </main>
  );
}

function StatCard({ icon: Icon, label, value, tone }) {
  return (
    <article className={`stat-card ${tone || ""}`}>
      <Icon size={19} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} title="Đóng">
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function themeLabel(theme) {
  return {
    dark: "Dark xanh",
    purple: "Purple dark",
    light: "Light mode",
  }[theme] || "Dark xanh";
}

function themeIcon(theme) {
  return theme === "light" ? Moon : Sun;
}

function getInitialSidebarCollapsed() {
  try {
    const stored = localStorage.getItem("checklist-sidebar-collapsed");
    if (stored === null) return true;
    return stored === "true";
  } catch {
    return true;
  }
}

function persistSidebarCollapsed(collapsed) {
  try {
    localStorage.setItem("checklist-sidebar-collapsed", String(collapsed));
  } catch {
    // Sidebar persistence is optional.
  }
}

function Sidebar({ activePage, setActivePage, profile, theme, toggleTheme, collapsed, toggleCollapsed }) {
  const allowedItems = navItems.filter((item) => !item.adminOnly || profile?.role === "admin");
  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-brand">
        <ListChecks size={25} />
        <div className="sidebar-brand-copy">
          <strong>Checklist</strong>
          <span>Internal Ops</span>
        </div>
        <button
          className="icon-button sidebar-collapse-button"
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? "Mở rộng menu" : "Thu nhỏ menu"}
        >
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
      </div>
      <nav className="sidebar-nav">
        {allowedItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={activePage === item.id ? "active" : ""}
              onClick={() => setActivePage(item.id)}
              title={item.label}
            >
              <Icon size={18} />
              <span className="sidebar-nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="sidebar-user">
        {profile?.avatar_url ? <AvatarChip profile={profile} className="sidebar-avatar" /> : <CircleUserRound size={19} />}
        <div className="sidebar-user-copy">
          <strong>{personName(profile)}</strong>
          <span>{roleLabel(profile?.role)}</span>
        </div>
        <button
          className="icon-button sidebar-theme-icon"
          type="button"
          onClick={toggleTheme}
          title={`Đổi theme. Hiện tại: ${themeLabel(theme)}`}
        >
          {React.createElement(themeIcon(theme), { size: 17 })}
        </button>
      </div>
    </aside>
  );
}

function Topbar({ activePage, profile, loading, onRefresh, openModal, theme, toggleTheme }) {
  const title = navItems.find((item) => item.id === activePage)?.label || "Checklist";
  const showTaskButton = ["overview", "tasks"].includes(activePage);
  return (
    <header className="topbar">
      <div>
        <h1>{title}</h1>
        <p>{personName(profile)} · {roleLabel(profile?.role)}</p>
      </div>
      <div className="topbar-actions">
        <button className="icon-button theme-icon-button" onClick={toggleTheme} title={`Đổi theme. Hiện tại: ${themeLabel(theme)}`}>
          {React.createElement(themeIcon(theme), { size: 18 })}
        </button>
        <button className={showTaskButton ? "secondary-action" : "hidden-action"} onClick={() => openModal("task")}>
          <Plus size={17} />
          Tạo task
        </button>
        <button className="icon-button" onClick={onRefresh} title="Tải lại">
          <RefreshCw size={18} className={loading ? "spin" : ""} />
        </button>
        <button className="icon-button" onClick={() => supabase.auth.signOut()} title="Đăng xuất">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}

function OverviewPage({ tasks, projects, profiles, setActivePage, openTask }) {
  const stats = useMemo(() => ({
    total: tasks.length,
    today: tasks.filter((task) => task.due_time && new Date(task.due_time).toDateString() === new Date().toDateString()).length,
    dueSoon: tasks.filter(isDueSoon).length,
    overdue: tasks.filter(isOverdue).length,
    done: tasks.filter((task) => task.status === "done").length,
    peopleOverloaded: profiles.filter((profile) => (profile.task_open || 0) >= 5 || (profile.task_overdue || 0) > 0).length,
  }), [tasks, profiles]);

  const urgentTasks = tasks
    .filter((task) => isOverdue(task) || isDueSoon(task))
    .slice(0, 8);

  return (
    <div className="page-grid">
      <section className="stats-grid">
        <StatCard icon={ListChecks} label="Tổng task" value={stats.total} />
        <StatCard icon={CalendarClock} label="Hôm nay" value={stats.today} />
        <StatCard icon={Bell} label="Sắp tới hạn" value={stats.dueSoon} tone="warning" />
        <StatCard icon={Bell} label="Quá hạn" value={stats.overdue} tone="danger" />
        <StatCard icon={UsersRound} label="Nhân sự cần chú ý" value={stats.peopleOverloaded} tone="warning" />
        <StatCard icon={Check} label="Hoàn thành" value={stats.done} tone="success" />
      </section>

      <section className="split-grid">
        <div className="panel">
          <div className="section-head">
            <div>
              <h2>Cần xử lý ngay</h2>
              <p>Task quá hạn hoặc sắp tới deadline.</p>
            </div>
            <button className="text-action" onClick={() => setActivePage("tasks")}>Xem tất cả</button>
          </div>
          <div className="compact-table">
            {urgentTasks.map((task) => (
              <button key={task.id} className="task-line" onClick={() => openTask(task)}>
                <span>
                  <strong>{task.title}</strong>
                  <small>{task.projects?.name || "Cá nhân"} · {personName(task.assignee)}</small>
                </span>
                <b className={isOverdue(task) ? "danger-text" : "warning-text"}>{formatDate(task.due_time)}</b>
              </button>
            ))}
            {!urgentTasks.length && <p className="empty-state">Chưa có task cần xử lý gấp.</p>}
          </div>
        </div>

        <div className="panel">
          <div className="section-head">
            <div>
              <h2>Dự án rủi ro</h2>
              <p>Dự án có task quá hạn.</p>
            </div>
            <button className="text-action" onClick={() => setActivePage("projects")}>Quản lý</button>
          </div>
          <div className="compact-table">
            {projects
              .filter((project) => tasks.some((task) => task.project_id === project.id && isOverdue(task)))
              .map((project) => (
                <div key={project.id} className="task-line static">
                  <span>
                    <strong>{project.name}</strong>
                    <small>{(project.project_members || []).length} thành viên</small>
                  </span>
                  <b className="danger-text">
                    {tasks.filter((task) => task.project_id === project.id && isOverdue(task)).length} quá hạn
                  </b>
                </div>
              ))}
            {!projects.some((project) => tasks.some((task) => task.project_id === project.id && isOverdue(task))) && (
              <p className="empty-state">Chưa có dự án rủi ro.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function ReportsPage({ tasks, projects, profiles, notifications }) {
  const report = useMemo(() => {
    const total = tasks.length || 1;
    const done = tasks.filter((task) => task.status === "done").length;
    const overdue = tasks.filter(isOverdue).length;
    const active = tasks.filter((task) => ["todo", "doing"].includes(task.status)).length;
    const highPriority = tasks.filter((task) => task.priority === "high").length;
    const completionRate = Math.round((done / total) * 100);
    const overdueRate = Math.round((overdue / total) * 100);

    const byStatus = ["todo", "doing", "done", "cancelled"].map((status) => ({
      label: statusLabel(status),
      value: tasks.filter((task) => task.status === status).length,
    }));

    const byProject = projects
      .map((project) => {
        const projectTasks = tasks.filter((task) => task.project_id === project.id);
        return {
          id: project.id,
          name: project.name,
          total: projectTasks.length,
          done: projectTasks.filter((task) => task.status === "done").length,
          overdue: projectTasks.filter(isOverdue).length,
        };
      })
      .filter((project) => project.total > 0)
      .sort((a, b) => b.overdue - a.overdue || b.total - a.total)
      .slice(0, 6);

    const allPeopleWithTasks = profiles
      .map((profile) => {
        const personTasks = tasks.filter((task) => taskInvolvesProfile(task, profile.id));
        return {
          id: profile.id,
          name: personName(profile),
          total: personTasks.length,
          overdue: personTasks.filter(isOverdue).length,
          open: personTasks.filter((task) => ["todo", "doing"].includes(task.status)).length,
        };
      })
      .filter((person) => person.total > 0);

    const byPerson = [...allPeopleWithTasks]
      .sort((a, b) => b.overdue - a.overdue || b.total - a.total)
      .slice(0, 6);

    return { active, completionRate, overdueRate, highPriority, peopleWithTasks: allPeopleWithTasks.length, byStatus, byProject, byPerson };
  }, [tasks, projects, profiles]);

  return (
    <section className="report-workspace">
      <div className="report-hero shell-card">
        <div className="shell-core">
          <span className="eyebrow">Báo cáo vận hành</span>
          <h2>Nhìn nhanh hiệu suất task, rủi ro deadline và tải công việc theo team.</h2>
          <p>Dữ liệu được tổng hợp từ task hiện tại, không thay đổi backend hay database.</p>
        </div>
      </div>

      <div className="task-stats-grid">
        <TaskMetric label="Tỷ lệ hoàn thành" value={`${report.completionRate}%`} tone="success" />
        <TaskMetric label="Tỷ lệ quá hạn" value={`${report.overdueRate}%`} tone="danger" />
        <TaskMetric label="Task đang mở" value={report.active} tone="active" />
        <TaskMetric label="Ưu tiên cao" value={report.highPriority} tone="warning" />
        <TaskMetric label="Nhân sự có task" value={report.peopleWithTasks} tone="neutral" />
      </div>

      <div className="report-grid">
        <ReportPanel title="Phân bổ trạng thái" description="Tỷ trọng task theo từng trạng thái.">
          {report.byStatus.map((item) => (
            <ReportBar key={item.label} label={item.label} value={item.value} max={tasks.length || 1} />
          ))}
        </ReportPanel>

        <ReportPanel title="Dự án cần chú ý" description="Ưu tiên dự án có nhiều task quá hạn.">
          {report.byProject.map((project) => (
            <ReportBar
              key={project.id}
              label={project.name}
              value={project.overdue}
              max={Math.max(...report.byProject.map((item) => item.overdue), 1)}
              note={`${project.done}/${project.total} hoàn thành`}
              danger={project.overdue > 0}
            />
          ))}
          {!report.byProject.length && <p className="empty-state">Chưa có dữ liệu dự án.</p>}
        </ReportPanel>

        <ReportPanel title="Workload nhân sự" description="Ai đang có nhiều task hoặc task quá hạn.">
          {report.byPerson.map((person) => (
            <ReportBar
              key={person.id}
              label={person.name}
              value={person.total}
              max={Math.max(...report.byPerson.map((item) => item.total), 1)}
              note={`${person.overdue} quá hạn · ${person.open} đang mở`}
              danger={person.overdue > 0}
            />
          ))}
          {!report.byPerson.length && <p className="empty-state">Chưa có dữ liệu nhân sự.</p>}
        </ReportPanel>
      </div>

      <section className="panel page-panel">
        <div className="section-head compact-section-head">
          <div>
            <h2>Lịch sử Telegram</h2>
            <p>Log gửi nhắc việc, cảnh báo quá hạn và trạng thái gửi.</p>
          </div>
        </div>
        <NotificationTable notifications={notifications} />
      </section>
    </section>
  );
}

function NotificationTable({ notifications }) {
  return (
    <div className="data-table notification-table">
      <div className="table-head">
        <span>Task</span>
        <span>Người nhận</span>
        <span>Loại</span>
        <span>Trạng thái</span>
        <span>Thời điểm</span>
      </div>
      {notifications.map((item) => (
        <div key={item.id} className="table-row static">
          <span>{item.tasks?.title || "Task"}</span>
          <span>{personName(item.profiles)}</span>
          <span>{item.type}</span>
          <span><b className="status-pill">{item.status}</b></span>
          <span>{formatDate(item.sent_at)}</span>
        </div>
      ))}
      {!notifications.length && <p className="empty-state">Chưa có log thông báo.</p>}
    </div>
  );
}

function ReportPanel({ title, description, children }) {
  return (
    <article className="report-panel shell-card">
      <div className="shell-core">
        <div className="section-head">
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
        </div>
        <div className="report-bars">{children}</div>
      </div>
    </article>
  );
}

function ReportBar({ label, value, max, note, danger }) {
  const width = Math.round((value / Math.max(max, 1)) * 100);
  return (
    <div className={`report-bar ${danger ? "danger" : ""}`}>
      <div>
        <strong>{label}</strong>
        <span>{note || `${value} task`}</span>
      </div>
      <div className="report-bar-track">
        <span style={{ width: `${width}%` }} />
      </div>
      <b>{value}</b>
    </div>
  );
}

function deadlineFilterMatch(task, filter) {
  if (!filter) return true;
  const due = task.due_time ? new Date(task.due_time) : null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  if (filter === "today") return Boolean(due && due >= today && due < tomorrow);
  if (filter === "next7") return Boolean(due && due >= today && due <= nextWeek);
  if (filter === "overdue") return isOverdue(task);
  if (filter === "noDue") return !task.due_time;
  return true;
}

function deadlineState(task) {
  if (isOverdue(task)) return { label: "Quá hạn", tone: "danger", icon: AlertTriangle };
  if (isDueSoon(task)) return { label: "Sắp hết hạn", tone: "warning", icon: Clock3 };
  if (task.status === "done") return { label: "Đã xong", tone: "success", icon: Check };
  return { label: "Đúng hạn", tone: "neutral", icon: CalendarClock };
}

function telegramState(task) {
  if (!task.due_time) return { label: "Không deadline", tone: "muted" };
  if (["done", "cancelled"].includes(task.status)) return { label: "Không nhắc", tone: "muted" };
  if (task.projects?.telegram_group_chat_id) return { label: "Group Telegram", tone: "active" };
  if (!task.assignee?.telegram_chat_id) return { label: "Thiếu chat ID", tone: "warning" };
  return { label: "Telegram sẵn sàng", tone: "active" };
}

function isFreshTask(task) {
  if (!task.created_at) return false;
  const createdAt = new Date(task.created_at).getTime();
  if (Number.isNaN(createdAt)) return false;
  return Date.now() - createdAt <= 24 * 60 * 60 * 1000;
}

function sortTasksNewestFirst(items) {
  return [...items].sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateB - dateA || String(a.title || "").localeCompare(String(b.title || ""), "vi");
  });
}

function normalizeWeekdays(value, fallback = defaultRecurringWeekdays) {
  const source = Array.isArray(value) && value.length ? value : fallback;
  const allowed = new Set(weekdayOptions.map((item) => item.value));
  const normalized = source.map(Number).filter((item) => allowed.has(item));
  return normalized.length ? weekdayOptions.map((item) => item.value).filter((item) => normalized.includes(item)) : fallback;
}

function weekdayListLabel(value) {
  const days = normalizeWeekdays(value, weekdayOptions.map((item) => item.value));
  if (days.length === 7) return "Tất cả ngày";
  if (days.join(",") === defaultRecurringWeekdays.join(",")) return "T2-T6";
  return weekdayOptions.filter((item) => days.includes(item.value)).map((item) => item.label).join(", ");
}

const boardColumns = [
  { id: "todo", title: "Chưa bắt đầu", hint: "Việc cần chuẩn bị" },
  { id: "doing", title: "Đang làm", hint: "Đang được xử lý" },
  { id: "done", title: "Hoàn thành", hint: "Đã xong" },
  { id: "cancelled", title: "Đã hủy", hint: "Không tiếp tục" },
];

function TasksPage({ tasks, projects, profiles, filters, setFilters, openTask, openModal, profile }) {
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [deadline, setDeadline] = useState("");
  const [viewMode, setViewMode] = useState("board");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const baseFilteredTasks = tasks.filter((task) => {
    const text = [
      task.title,
      task.description,
      task.projects?.name,
      personName(task.assignee),
      priorityLabel(task.priority),
      statusLabel(task.status),
    ].join(" ").toLowerCase();

    if (query && !text.includes(query.toLowerCase())) return false;
    if (!deadlineFilterMatch(task, deadline)) return false;
    return true;
  });

  const searchedTasks = baseFilteredTasks.filter((task) => {
    if (tab === "all") return !["done", "cancelled"].includes(task.status);
    if (tab === "todo") return task.status === "todo";
    if (tab === "dueSoon") return isDueSoon(task);
    if (tab === "overdue") return isOverdue(task);
    if (tab === "doing") return task.status === "doing";
    if (tab === "done") return task.status === "done";
    if (tab === "cancelled") return task.status === "cancelled";
    return true;
  });

  const stats = useMemo(() => ({
    open: tasks.filter((task) => !["done", "cancelled"].includes(task.status)).length,
    todo: tasks.filter((task) => task.status === "todo").length,
    doing: tasks.filter((task) => task.status === "doing").length,
    dueSoon: tasks.filter(isDueSoon).length,
    overdue: tasks.filter(isOverdue).length,
    done: tasks.filter((task) => task.status === "done").length,
    cancelled: tasks.filter((task) => task.status === "cancelled").length,
  }), [tasks]);

  const tabItems = [
    ["all", "Tất cả", stats.open],
    ["todo", "Chưa bắt đầu", stats.todo],
    ["dueSoon", "Sắp hết hạn", stats.dueSoon],
    ["overdue", "Quá hạn", stats.overdue],
    ["doing", "Đang làm", stats.doing],
    ["done", "Hoàn thành", stats.done],
    ["cancelled", "Đã hủy", stats.cancelled],
  ];

  const groups = groupTasksByProject(searchedTasks, projects);
  const taskToolbar = (
    <div className="board-command-panel">
      <div className="board-command-top">
        <Filters
          filters={filters}
          setFilters={setFilters}
          projects={projects}
          profiles={profiles}
          deadline={deadline}
          setDeadline={setDeadline}
          query={query}
          setQuery={setQuery}
          open={filtersOpen}
          setOpen={setFiltersOpen}
        />
        <div className="tabs task-tabs compact-filter-tabs">
          {tabItems.map(([id, label, count]) => (
            <button key={id} className={`${tab === id ? "active" : ""} tab-${id}`} onClick={() => setTab(id)}>
              {label}
              <span>{count}</span>
            </button>
          ))}
        </div>
        <div className="board-icon-actions">
          <button className="icon-button board-action-icon" onClick={() => openModal("task")} title="Tạo task">
            <Plus size={17} />
          </button>
          <div className="view-toggle icon-view-toggle" aria-label="Chọn kiểu hiển thị">
            <button className={viewMode === "board" ? "active" : ""} onClick={() => setViewMode("board")} title="Bảng">
              <Table2 size={17} />
            </button>
            <button className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")} title="Danh sách">
              <Rows3 size={17} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <section className="task-workspace compact-workspace">
      <div className="task-board shell-card compact-task-board">
        <div className="shell-core">
          {viewMode === "board" ? (
            <ProjectGroupedTaskBoards groups={groups} openTask={openTask} profile={profile} toolbar={taskToolbar} total={searchedTasks.length} />
          ) : (
            <ProjectGroupedTaskList groups={groups} openTask={openTask} toolbar={taskToolbar} total={searchedTasks.length} />
          )}
        </div>
      </div>
    </section>
  );
}

function groupTasksByProject(tasks, projects) {
  const map = new Map();
  for (const task of tasks) {
    const id = task.project_id || "personal";
    if (!map.has(id)) {
      const project = projects.find((item) => item.id === task.project_id);
      map.set(id, {
        id,
        project,
        title: project?.name || "Cá nhân",
        tasks: [],
      });
    }
    map.get(id).tasks.push(task);
  }
  return [...map.values()]
    .map((group) => ({ ...group, tasks: sortTasksNewestFirst(group.tasks) }))
    .sort((a, b) => a.title.localeCompare(b.title, "vi"));
}

function TaskMetric({ label, value, tone }) {
  return (
    <article className={`task-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Filters({ filters, setFilters, projects, profiles, deadline, setDeadline, query, setQuery, open, setOpen }) {
  return (
    <div className="filter-row premium-filters unified-filters">
      <div className="filter-primary-row">
        <label className="search-box filter-search">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm task, dự án, nhân sự..." />
        </label>
        <button className={"filter-toggle " + (open ? "active" : "")} type="button" onClick={() => setOpen(!open)}>
          <Search size={16} />
          {open ? "Ẩn bộ lọc" : "Mở rộng bộ lọc"}
        </button>
      </div>
      {open && (
        <div className="filter-expanded-grid">
          <select value={filters.project_id} onChange={(event) => setFilters({ ...filters, project_id: event.target.value })}>
            <option value="">Tất cả dự án</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <select value={filters.assignee_id} onChange={(event) => setFilters({ ...filters, assignee_id: event.target.value })}>
            <option value="">Tất cả nhân sự</option>
            {profiles.map((profile) => <option key={profile.id} value={profile.id}>{personName(profile)}</option>)}
          </select>
          <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="">Tất cả trạng thái</option>
            <option value="todo">Chưa bắt đầu</option>
            <option value="doing">Đang làm</option>
            <option value="done">Hoàn thành</option>
            <option value="cancelled">Đã hủy</option>
          </select>
          <select value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}>
            <option value="">Tất cả ưu tiên</option>
            <option value="high">Cao</option>
            <option value="medium">Trung bình</option>
            <option value="low">Thấp</option>
          </select>
          <select value={deadline} onChange={(event) => setDeadline(event.target.value)}>
            <option value="">Mọi deadline</option>
            <option value="today">Hôm nay</option>
            <option value="next7">7 ngày tới</option>
            <option value="overdue">Quá hạn</option>
            <option value="noDue">Chưa đặt deadline</option>
          </select>
        </div>
      )}
    </div>
  );
}

function ProjectGroupedTaskBoards({ groups, openTask, profile, toolbar, total }) {
  if (!groups.length) {
    return (
      <section className="project-task-group trello-project-board trello-single-board">
        <header className="project-task-group-head board-main-head">
          <div>
            <span className="eyebrow">Bảng công việc</span>
          </div>
          <span>{total} task</span>
        </header>
        {toolbar}
        <div className="empty-state task-empty">
          <ListChecks size={34} />
          <strong>Chưa có task phù hợp</strong>
          <span>Thử đổi bộ lọc hoặc tạo task mới để bắt đầu theo dõi công việc.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="project-task-group trello-project-board trello-single-board">
      <header className="project-task-group-head board-main-head">
        <div>
          <span className="eyebrow">Bảng công việc</span>
        </div>
        <span>{total} task</span>
      </header>
      {toolbar}
      <div className="tasklist-board">
        {groups.map((group) => {
          const urgentCount = group.tasks.filter((task) => isOverdue(task) || isDueSoon(task)).length;
          return (
            <section key={group.id} className="tasklist-column project-column" style={{ "--project-accent": projectAccent(group.id) }}>
              <header className="tasklist-column-head">
                <div className="project-column-title">
                  <ProjectAvatar project={group.project} fallbackProfile={profile} className="project-header-avatar" />
                  <span>
                    <strong>{group.title}</strong>
                    <small>{group.project ? "Dự án" : "Cá nhân"}</small>
                  </span>
                </div>
                <b>{group.tasks.length}</b>
              </header>
              {urgentCount > 0 && <p className="kanban-warning">{urgentCount} task cần chú ý</p>}
              <div className="kanban-card-list">
                {group.tasks.map((task) => (
                  <TaskKanbanCard key={task.id} task={task} openTask={openTask} />
                ))}
                {!group.tasks.length && <p className="kanban-empty">Chưa có task trong dự án này.</p>}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function projectAccent(id) {
  const accents = ["#39d0a0", "#f4b84f", "#62a8ff", "#f177c8", "#a7e16e", "#ff8d6b"];
  let hash = 0;
  for (const char of String(id || "personal")) {
    hash = (hash * 31 + char.charCodeAt(0)) % accents.length;
  }
  return accents[hash];
}

function TaskKanbanCard({ task, openTask }) {
  const deadline = deadlineState(task);
  const DeadlineIcon = deadline.icon;
  const members = taskMemberProfiles(task);
  const doneCount = (task.task_checklists || []).filter((item) => item.is_done).length;
  const totalChecklist = (task.task_checklists || []).length;

  return (
    <button className={`kanban-card priority-accent-${task.priority} ${deadline.tone}-card ${task.status === "done" ? "complete-card" : ""} ${isFreshTask(task) ? "fresh-card" : ""}`} onClick={() => openTask(task)}>
      <span className="card-title-row">
        <span className={`priority-dot priority-${task.priority}`} title={`Ưu tiên: ${priorityLabel(task.priority)}`} />
        <span className="task-card-title">{task.title}</span>
        {isFreshTask(task) && <b className="fresh-pill">Mới</b>}
      </span>
      {task.due_time && (
      <span className="card-compact-meta">
        <span className={`deadline-chip ${deadline.tone}`}>
          <DeadlineIcon size={13} />
          {formatDate(task.due_time)}
        </span>
      </span>
      )}
      <span className="card-footer compact-card-footer">
        <span className="avatar-stack">
          <AvatarChip profile={task.assignee} />
          {members.slice(0, 3).map((member) => (
            <AvatarChip key={member.id} profile={member} className="member-avatar" />
          ))}
          {members.length > 3 && <span className="avatar-chip more-avatar">+{members.length - 3}</span>}
        </span>
        <span className="card-check-progress">
          <span className="checklist-mini-icon"><Check size={10} /></span>
          <small>{doneCount}/{totalChecklist}</small>
        </span>
      </span>
    </button>
  );
}

function taskMemberProfiles(task) {
  return (task.task_members || [])
    .map((item) => item.profiles)
    .filter(Boolean);
}

function ProjectGroupedTaskList({ groups, openTask, toolbar, total }) {
  if (!groups.length) {
    return (
      <section className="project-task-group trello-project-board trello-single-board list-mode-board">
        <header className="project-task-group-head board-main-head">
          <div>
            <span className="eyebrow">Bảng công việc</span>
          </div>
          <span>{total} task</span>
        </header>
        {toolbar}
        <div className="empty-state task-empty">
          <ListChecks size={34} />
          <strong>Chưa có task phù hợp</strong>
          <span>Thử đổi bộ lọc hoặc tạo task mới để bắt đầu theo dõi công việc.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="project-task-group trello-project-board trello-single-board list-mode-board">
      <header className="project-task-group-head board-main-head">
        <div>
          <span className="eyebrow">Bảng công việc</span>
        </div>
        <span>{total} task</span>
      </header>
      {toolbar}
      <div className="project-list-task-view">
      {groups.map((group) => (
        <section key={group.id} className="project-list-group">
          <header className="project-list-group-head">
            <strong>{group.title}</strong>
            <span>{group.tasks.length} task</span>
          </header>
          <div className="data-table task-table premium-task-table grouped-task-table">
            <div className="table-head">
              <span>Task</span>
              <span>Phụ trách</span>
              <span>Trạng thái</span>
              <span>Deadline</span>
              <span>Checklist</span>
              <span>Telegram</span>
            </div>
            {group.tasks.map((task) => {
              const progress = checklistProgress(task);
              const deadline = deadlineState(task);
              const DeadlineIcon = deadline.icon;
              const telegram = telegramState(task);
              return (
                <button
                  key={task.id}
                  className={`table-row task-row ${deadline.tone}-row ${task.status === "done" ? "complete-row" : ""}`}
                  onClick={() => openTask(task)}
                >
                  <span className="task-title-cell">
                    <strong>{task.title}</strong>
                    <small>{task.description || "Chưa có mô tả"}</small>
                  </span>
                  <span data-label="Phụ trách">{personName(task.assignee)}</span>
                  <span data-label="Trạng thái" className="status-stack">
                    <b className={`status-pill status-${task.status}`}>{statusLabel(task.status)}</b>
                    <b className={`priority-pill priority-${task.priority}`}>{priorityLabel(task.priority)}</b>
                  </span>
                  <span data-label="Deadline" className="deadline-cell">
                    <b className={`deadline-chip ${deadline.tone}`}>
                      <DeadlineIcon size={14} />
                      {deadline.label}
                    </b>
                    <small>{formatDate(task.due_time)}</small>
                  </span>
                  <span data-label="Checklist" className="progress-cell">
                    <span className="progress-track"><span style={{ width: `${progress}%` }} /></span>
                    <small>{progress}% hoàn tất</small>
                  </span>
                  <span data-label="Telegram">
                    <b className={`telegram-pill ${telegram.tone}`}>{telegram.label}</b>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      </div>
    </section>
  );
}

function PeoplePage({ profiles, roles, openModal, updateUser }) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const people = profiles.filter((profile) => {
    const text = [profile.full_name || "", profile.email || "", profile.department || ""].join(" ").toLowerCase();
    if (query && !text.includes(query.toLowerCase())) return false;
    if (role && !(profile.role_ids || [profile.role]).includes(role)) return false;
    if (status && profile.status !== status) return false;
    return true;
  });

  const selectedProfile = profiles.find((profile) => profile.id === selectedId) || people[0];

  useEffect(() => {
    if (!selectedProfile) {
      setDraft(null);
      return;
    }
    setSelectedId(selectedProfile.id);
    setDraft({
      full_name: selectedProfile.full_name || "",
      department: selectedProfile.department || "",
      telegram_chat_id: selectedProfile.telegram_chat_id || "",
      zalo_user_id: selectedProfile.zalo_user_id || "",
      zalo_display_name: selectedProfile.zalo_display_name || "",
      status: selectedProfile.status || "active",
      role_ids: selectedProfile.role_ids?.length ? selectedProfile.role_ids : [selectedProfile.role || "staff"],
      password: "",
    });
  }, [selectedProfile]);

  function toggleRole(roleId) {
    setDraft((current) => {
      const existing = current.role_ids || [];
      const next = existing.includes(roleId)
        ? existing.filter((item) => item !== roleId)
        : [...existing, roleId];
      return { ...current, role_ids: next.length ? next : ["staff"] };
    });
  }

  async function saveSelected() {
    if (!selectedProfile || !draft) return;
    setSaving(true);
    setMessage("");
    try {
      await updateUser(selectedProfile.id, {
        full_name: draft.full_name,
        department: draft.department || null,
        telegram_chat_id: draft.telegram_chat_id || null,
        zalo_user_id: draft.zalo_user_id || null,
        zalo_display_name: draft.zalo_display_name || null,
        status: draft.status,
        role_ids: draft.role_ids,
        ...(draft.password ? { password: draft.password } : {}),
      });
      setMessage("Đã lưu thông tin nhân sự.");
    } catch (currentError) {
      setMessage(currentError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="people-layout">
      <section className="panel page-panel">
        <div className="section-head compact-section-head">
          <div>
            <h2>Danh sách nhân sự</h2>
            <p>Chọn một nhân sự để xem chi tiết và chỉnh thông tin.</p>
          </div>
          <button className="primary-action" onClick={() => openModal("user")}>
            <Plus size={17} />
            Tạo nhân sự
          </button>
        </div>
        <div className="filter-row people-filter-row">
          <div className="search-box">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên, email, bộ phận" />
          </div>
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="">Tất cả role</option>
            {roles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Tất cả trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="inactive">Tạm ngưng</option>
            <option value="locked">Khóa</option>
          </select>
        </div>
        <div className="data-table people-table people-directory-table">
          <div className="table-head">
            <span>Nhân sự</span>
            <span>Bộ phận</span>
            <span>Task mở</span>
            <span>Quá hạn</span>
            <span>Role</span>
            <span>Trạng thái</span>
          </div>
          {people.map((profile) => (
            <button
              key={profile.id}
              className={"table-row people-row-select " + (selectedProfile?.id === profile.id ? "selected" : "")}
              onClick={() => setSelectedId(profile.id)}
            >
              <span>
                <strong>{personName(profile)}</strong>
                <small>{profile.email}</small>
              </span>
              <span>{profile.department || "Chưa đặt"}</span>
              <span>{profile.task_open ?? 0}</span>
              <span className={(profile.task_overdue || 0) > 0 ? "danger-text" : ""}>{profile.task_overdue ?? 0}</span>
              <span className="role-chip-row">
                {(profile.roles || [{ id: profile.role, name: roleLabel(profile.role) }]).map((item) => (
                  <b key={item.id} className="role-chip">{item.name || roleLabel(item.id)}</b>
                ))}
              </span>
              <span><b className="status-pill">{profile.status}</b></span>
            </button>
          ))}
          {!people.length && <p className="empty-state">Không có nhân sự phù hợp bộ lọc.</p>}
        </div>
      </section>

      <section className="panel people-detail-panel">
        {selectedProfile && draft ? (
          <>
            <div className="section-head compact-section-head">
              <div>
                <span className="eyebrow">Chi tiết nhân sự</span>
                <h2>{personName(selectedProfile)}</h2>
                <p>{selectedProfile.email}</p>
              </div>
            </div>
            {message && <p className="mini-notice">{message}</p>}
            <div className="profile-detail-form">
              <label>
                Họ tên
                <input value={draft.full_name} onChange={(event) => setDraft({ ...draft, full_name: event.target.value })} />
              </label>
              <label>
                Bộ phận
                <input value={draft.department} onChange={(event) => setDraft({ ...draft, department: event.target.value })} />
              </label>
              <label>
                Telegram chat ID
                <input value={draft.telegram_chat_id} onChange={(event) => setDraft({ ...draft, telegram_chat_id: event.target.value })} />
              </label>
              <label>
                Zalo user ID
                <input value={draft.zalo_user_id} onChange={(event) => setDraft({ ...draft, zalo_user_id: event.target.value })} placeholder="ID Zalo để tag trong group" />
              </label>
              <label>
                Tên tag Zalo
                <input value={draft.zalo_display_name} onChange={(event) => setDraft({ ...draft, zalo_display_name: event.target.value })} placeholder="Ví dụ: Thành Nợn" />
              </label>
              <label>
                Trạng thái
                <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
                  <option value="active">Hoạt động</option>
                  <option value="inactive">Tạm ngưng</option>
                  <option value="locked">Khóa</option>
                </select>
              </label>
              <label>
                Đặt lại mật khẩu
                <input type="password" minLength={6} value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} placeholder="Để trống nếu không đổi" />
              </label>
            </div>
            <div className="role-checkbox-panel">
              <strong>Role của nhân sự</strong>
              <div className="role-checkbox-grid">
                {roles.map((item) => (
                  <label key={item.id} className="check-row role-check-row">
                    <input
                      type="checkbox"
                      checked={(draft.role_ids || []).includes(item.id)}
                      onChange={() => toggleRole(item.id)}
                    />
                    <span>
                      <b>{item.name}</b>
                      <small>{item.description || "Không có mô tả"}</small>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <button className="primary-action detail-save-action" disabled={saving} onClick={saveSelected}>
              <Check size={17} />
              {saving ? "Đang lưu" : "Lưu nhân sự"}
            </button>
          </>
        ) : (
          <p className="empty-state">Chọn một nhân sự để xem chi tiết.</p>
        )}
      </section>
    </div>
  );
}

function RolesPage({ roles, profiles, createRole, updateRole }) {
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [draft, setDraft] = useState(null);
  const [newRole, setNewRole] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const selectedRole = roles.find((role) => role.id === selectedRoleId) || roles[0];
  const assignedCount = selectedRole
    ? profiles.filter((profile) => (profile.role_ids || [profile.role]).includes(selectedRole.id)).length
    : 0;
  const isAdminRole = selectedRole?.id === "admin";

  useEffect(() => {
    if (!selectedRole) {
      setDraft(null);
      return;
    }
    setSelectedRoleId(selectedRole.id);
    setDraft({
      name: selectedRole.name || "",
      description: selectedRole.description || "",
      permissions: selectedRole.permissions || [],
    });
  }, [selectedRole]);

  function togglePermission(permissionId) {
    if (isAdminRole) return;
    setDraft((current) => ({
      ...current,
      permissions: current.permissions.includes(permissionId)
        ? current.permissions.filter((item) => item !== permissionId)
        : [...current.permissions, permissionId],
    }));
  }

  async function saveRole() {
    if (!selectedRole || !draft || isAdminRole) return;
    setSaving(true);
    setMessage("");
    try {
      await updateRole(selectedRole.id, draft);
      setMessage("Đã lưu quyền vai trò.");
    } catch (currentError) {
      setMessage(currentError.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitNewRole(event) {
    event.preventDefault();
    if (!newRole.name.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      await createRole({ ...newRole, permissions: [] });
      setNewRole({ name: "", description: "" });
      setMessage("Đã tạo vai trò mới.");
    } catch (currentError) {
      setMessage(currentError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="roles-layout">
      <section className="panel page-panel role-list-panel">
        <div className="section-head compact-section-head">
          <div>
            <h2>Danh sách vai trò</h2>
            <p>Chọn một vai trò để xem và điều chỉnh quyền. Admin là vai trò hệ thống, không cho chỉnh.</p>
          </div>
        </div>
        {message && <p className="mini-notice">{message}</p>}
        <div className="role-list">
          {roles.map((role) => {
            const count = profiles.filter((profile) => (profile.role_ids || [profile.role]).includes(role.id)).length;
            return (
              <button
                key={role.id}
                className={"role-list-item " + (selectedRole?.id === role.id ? "selected" : "")}
                onClick={() => setSelectedRoleId(role.id)}
              >
                <div>
                  <strong>{role.name}</strong>
                  <p>{role.description || "Chưa có mô tả."}</p>
                </div>
                <span>{role.permissions?.length || 0} quyền</span>
                <b>{count} nhân sự</b>
                {role.id === "admin" && <em>Khóa</em>}
              </button>
            );
          })}
          {!roles.length && <p className="empty-state">Chưa có dữ liệu vai trò.</p>}
        </div>
        <form onSubmit={submitNewRole} className="new-role-form">
          <strong>Tạo vai trò mới</strong>
          <input value={newRole.name} onChange={(event) => setNewRole({ ...newRole, name: event.target.value })} placeholder="Tên vai trò" />
          <textarea value={newRole.description} onChange={(event) => setNewRole({ ...newRole, description: event.target.value })} placeholder="Mô tả vai trò" />
          <button className="secondary-action" disabled={saving}>
            <Plus size={16} />
            Tạo vai trò
          </button>
        </form>
      </section>

      <section className="panel role-detail-panel">
        {selectedRole && draft ? (
          <>
            <div className="section-head compact-section-head">
              <div>
                <span className="eyebrow">Chi tiết vai trò</span>
                <h2>{selectedRole.name}</h2>
                <p>{isAdminRole ? "Vai trò hệ thống, không thể chỉnh sửa." : "Tick quyền cần cấp rồi bấm Lưu."}</p>
              </div>
              <span className="status-pill">{assignedCount} nhân sự</span>
            </div>
            <div className="profile-detail-form">
              <label>
                Tên vai trò
                <input value={draft.name} disabled={isAdminRole} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              </label>
              <label>
                Mô tả
                <textarea value={draft.description || ""} disabled={isAdminRole} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
              </label>
            </div>
            <div className="permission-picker role-detail-permissions">
              {permissionCatalog.map((permission) => (
                <label key={permission.id} className="check-row">
                  <input
                    type="checkbox"
                    disabled={isAdminRole}
                    checked={(draft.permissions || []).includes(permission.id)}
                    onChange={() => togglePermission(permission.id)}
                  />
                  <span>{permission.label}</span>
                </label>
              ))}
            </div>
            <button className="primary-action detail-save-action" disabled={isAdminRole || saving} onClick={saveRole}>
              <Check size={17} />
              {isAdminRole ? "Admin không cho chỉnh" : saving ? "Đang lưu" : "Lưu vai trò"}
            </button>
          </>
        ) : (
          <p className="empty-state">Chọn một vai trò để xem chi tiết.</p>
        )}
      </section>
    </div>
  );
}

function ProjectsPage({ projects, profiles, tasks, openModal, openTask, addMember, removeMember, updateProject }) {
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [memberForm, setMemberForm] = useState({ project_id: "", user_id: "", role_in_project: "member" });
  const [projectTelegramId, setProjectTelegramId] = useState("");
  const [projectAvatarUrl, setProjectAvatarUrl] = useState("");
  const [projectStatus, setProjectStatus] = useState("active");
  const [telegramMessage, setTelegramMessage] = useState("");
  const [memberMessage, setMemberMessage] = useState("");
  const [savingProjectTelegram, setSavingProjectTelegram] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState("");

  const activeProject = projects.find((project) => project.id === selectedProjectId) || projects[0];
  const activeProjectTasks = activeProject ? tasks.filter((task) => task.project_id === activeProject.id) : [];
  const activeMembers = activeProject?.project_members || [];

  useEffect(() => {
    if (!selectedProjectId && projects[0]) {
      setSelectedProjectId(projects[0].id);
      setMemberForm((current) => ({ ...current, project_id: projects[0].id }));
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (activeProject) setMemberForm((current) => ({ ...current, project_id: activeProject.id }));
  }, [activeProject]);

  useEffect(() => {
    setProjectTelegramId(activeProject?.telegram_group_chat_id || "");
    setProjectAvatarUrl(activeProject?.avatar_url || "");
    setProjectStatus(activeProject?.status || "active");
  }, [activeProject]);

  async function submitMember(event) {
    event.preventDefault();
    if (addingMember) return;
    setAddingMember(true);
    setMemberMessage("");
    setTelegramMessage("");
    try {
      await addMember(memberForm);
      setMemberForm({ project_id: activeProject?.id || "", user_id: "", role_in_project: "member" });
      setMemberMessage("Đã thêm thành viên dự án.");
    } catch (currentError) {
      setMemberMessage(currentError.message);
    } finally {
      setAddingMember(false);
    }
  }

  async function submitProjectSettings(event) {
    event.preventDefault();
    if (!activeProject || savingProjectTelegram) return;
    setSavingProjectTelegram(true);
    setTelegramMessage("");
    setMemberMessage("");
    try {
      await updateProject(activeProject.id, {
        telegram_group_chat_id: projectTelegramId || null,
        avatar_url: projectAvatarUrl || null,
        status: projectStatus,
      });
      setTelegramMessage("Đã lưu thông tin dự án.");
    } catch (currentError) {
      setTelegramMessage(currentError.message);
    } finally {
      setSavingProjectTelegram(false);
    }
  }

  async function handleRemoveMember(userId) {
    if (!activeProject || removingMemberId) return;
    setRemovingMemberId(userId);
    setMemberMessage("");
    setTelegramMessage("");
    try {
      await removeMember(activeProject.id, userId);
      setMemberMessage("Đã xóa thành viên khỏi dự án.");
    } catch (currentError) {
      setMemberMessage(currentError.message);
    } finally {
      setRemovingMemberId("");
    }
  }

  return (
    <div className="projects-layout">
      <section className="panel page-panel project-list-panel">
        <div className="section-head compact-section-head">
          <div>
            <h2>Danh sách dự án</h2>
            <p>Chọn một dự án để xem chi tiết, thành viên và list task.</p>
          </div>
          <button className="primary-action" onClick={() => openModal("project")}>
            <Plus size={17} />
            Tạo dự án
          </button>
        </div>
        <div className="data-table project-table project-directory-table">
          <div className="table-head">
            <span>Dự án</span>
            <span>Quản lý</span>
            <span>Thành viên</span>
            <span>Task mở</span>
            <span>Quá hạn</span>
            <span>Trạng thái</span>
          </div>
          {projects.map((project) => {
            const projectTasks = tasks.filter((task) => task.project_id === project.id);
            const manager = profiles.find((profile) => profile.id === project.manager_id);
            return (
              <button
                key={project.id}
                className={"table-row project-row-select " + (activeProject?.id === project.id ? "selected" : "")}
                onClick={() => setSelectedProjectId(project.id)}
              >
                <span>
                  <strong>{project.name}</strong>
                  <small>{project.description || "Chưa có mô tả"}</small>
                </span>
                <span>{personName(manager)}</span>
                <span>{(project.project_members || []).length}</span>
                <span>{projectTasks.filter((task) => !["done", "cancelled"].includes(task.status)).length}</span>
                <span className={projectTasks.some(isOverdue) ? "danger-text" : ""}>{projectTasks.filter(isOverdue).length}</span>
                <span><b className={`status-pill project-status-${project.status}`}>{projectStatusLabel(project.status)}</b></span>
              </button>
            );
          })}
          {!projects.length && <p className="empty-state">Chưa có dự án.</p>}
        </div>
      </section>

      {activeProject && (
        <section className="panel page-panel project-detail-panel">
          <div className="section-head compact-section-head">
            <div>
              <span className="eyebrow">Chi tiết dự án</span>
              <h2>{activeProject.name}</h2>
              <p>{activeProject.description || "Chưa có mô tả."}</p>
            </div>
            <div className="project-detail-badges">
              <b className={`status-pill project-status-${activeProject.status}`}>{projectStatusLabel(activeProject.status)}</b>
              <span>{activeProjectTasks.length} task</span>
            </div>
          </div>
          <form className="project-settings-form" onSubmit={submitProjectSettings}>
            <div className="project-avatar-editor">
              <ProjectAvatar project={{ ...activeProject, avatar_url: projectAvatarUrl }} className="project-detail-avatar" />
              <label>
                Avatar dự án
                <input
                  value={projectAvatarUrl}
                  onChange={(event) => setProjectAvatarUrl(event.target.value)}
                  placeholder="https://.../project-avatar.png"
                />
              </label>
            </div>
            <label>
              Telegram group chat ID
              <input
                value={projectTelegramId}
                onChange={(event) => setProjectTelegramId(event.target.value)}
                placeholder="-100..."
              />
            </label>
            <label>
              Trạng thái dự án
              <select value={projectStatus} onChange={(event) => setProjectStatus(event.target.value)}>
                <option value="active">Đang hoạt động</option>
                <option value="paused">Tạm dừng</option>
                <option value="completed">Hoàn thành</option>
                <option value="inactive">Tạm ngưng</option>
              </select>
            </label>
            <button className="secondary-action" disabled={savingProjectTelegram}>
              {savingProjectTelegram ? <LoaderCircle size={17} className="spin" /> : <Send size={17} />}
              {savingProjectTelegram ? "Đang lưu..." : "Lưu dự án"}
            </button>
          </form>
          {telegramMessage && <p className="mini-notice">{telegramMessage}</p>}

          <div className="project-detail-grid">
            <article className="project-info-card">
              <strong>Vai trò trong dự án</strong>
              <p><b>Quản lý dự án</b> có thể điều phối thành viên, theo dõi toàn bộ task và duyệt tiến độ.</p>
              <p><b>Thành viên</b> xử lý các task được giao và cập nhật checklist của mình.</p>
            </article>
            <article className="project-info-card">
              <strong>Trạng thái task</strong>
              <p>Task được chia theo trạng thái cố định để dễ nắm việc chưa bắt đầu, đang làm, hoàn thành hoặc đã hủy.</p>
            </article>
          </div>

          <div className="project-members-shell">
            <div className="section-head compact-section-head">
              <div>
                <h3>Thành viên dự án</h3>
                <p>Role dự án khác với role hệ thống. Một người có thể là Manager hệ thống nhưng chỉ là thành viên ở dự án cụ thể.</p>
              </div>
            </div>
            <form onSubmit={submitMember} className="inline-member-form">
              <select
                value={memberForm.user_id}
                onChange={(event) => setMemberForm({ ...memberForm, user_id: event.target.value })}
                required
              >
                <option value="">Chọn nhân sự</option>
                {profiles.map((profile) => <option key={profile.id} value={profile.id}>{personName(profile)}</option>)}
              </select>
              <select
                value={memberForm.role_in_project}
                onChange={(event) => setMemberForm({ ...memberForm, role_in_project: event.target.value })}
              >
                <option value="manager">Quản lý dự án</option>
                <option value="member">Thành viên dự án</option>
              </select>
              <button className="secondary-action" disabled={addingMember}>
                {addingMember ? <LoaderCircle size={17} className="spin" /> : <UsersRound size={17} />}
                {addingMember ? "Đang thêm..." : "Thêm thành viên"}
              </button>
            </form>
            {memberMessage && <p className="mini-notice">{memberMessage}</p>}
            <div className="member-list project-member-list">
              {activeMembers.map((member) => {
                const user = profiles.find((profile) => profile.id === member.user_id);
                return (
                  <article key={activeProject.id + "-" + member.user_id}>
                    <div>
                      <strong>{personName(user)}</strong>
                      <span>{user?.department || "Chưa đặt bộ phận"}</span>
                    </div>
                    <b className={member.role_in_project === "manager" ? "role-chip manager" : "role-chip member"}>
                      {member.role_in_project === "manager" ? "Quản lý dự án" : "Thành viên dự án"}
                    </b>
                    <button className="tag-icon" onClick={() => handleRemoveMember(member.user_id)} title="Xóa" disabled={Boolean(removingMemberId)}>
                      {removingMemberId === member.user_id ? <LoaderCircle size={12} className="spin" /> : <Trash2 size={12} />}
                    </button>
                  </article>
                );
              })}
              {!activeMembers.length && <p className="empty-state">Chưa có thành viên trong dự án.</p>}
            </div>
          </div>

          <ProjectStatusBoard projectTasks={activeProjectTasks} openTask={openTask} />
        </section>
      )}
    </div>
  );
}

function ProjectStatusBoard({ projectTasks, openTask }) {
  return (
    <section className="project-readonly-board">
      <div className="section-head compact-section-head">
        <div>
          <h3>List task theo trạng thái</h3>
          <p>Chỉ hiển thị để nắm thông tin, không chỉnh tasklist tại đây.</p>
        </div>
      </div>
      <div className="kanban-board project-status-board">
        {boardColumns.map((column) => {
          const columnTasks = projectTasks.filter((task) => task.status === column.id);
          return (
            <section key={column.id} className={"kanban-column column-" + column.id}>
              <header className="kanban-column-head">
                <div>
                  <strong>{column.title}</strong>
                  <span>{column.hint}</span>
                </div>
                <b>{columnTasks.length}</b>
              </header>
              <div className="kanban-card-list">
                {columnTasks.map((task) => <TaskKanbanCard key={task.id} task={task} openTask={openTask} />)}
                {!columnTasks.length && <p className="kanban-empty">Chưa có task ở trạng thái này.</p>}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function NotificationsPage({ dailyTemplates, projects, profiles, createDailyTemplate, updateDailyTemplate, runReminderSweepNow }) {
  const emptyTemplateDraft = {
    project_id: "",
    assignee_id: "",
    assignee_ids: [],
    title: "",
    description: "",
    due_time: "17:00",
    recurrence_type: "daily",
    monthly_day: 1,
    weekdays: defaultRecurringWeekdays,
    checklist_items: "",
    requires_note: true,
  };
  const [templateDraft, setTemplateDraft] = useState({
    ...emptyTemplateDraft,
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [message, setMessage] = useState("");
  const [runReport, setRunReport] = useState(null);
  const [running, setRunning] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [templateSavingId, setTemplateSavingId] = useState("");
  const selectedProject = projects.find((project) => project.id === templateDraft.project_id);
  const selectedProjectMemberIds = new Set((selectedProject?.project_members || []).map((member) => member.user_id));
  const assignableProfiles = selectedProject
    ? profiles.filter((profile) => selectedProjectMemberIds.has(profile.id))
    : profiles;

  function updateTemplateProject(projectId) {
    setTemplateDraft((current) => ({
      ...current,
      project_id: projectId,
      assignee_id: "",
      assignee_ids: [],
    }));
  }

  function resetTemplateDraft() {
    setSelectedTemplateId("");
    setTemplateDraft({ ...emptyTemplateDraft });
    setMessage("");
  }

  function selectTemplate(template) {
    const templateAssigneeIds = template.daily_task_template_members?.map((member) => member.user_id) || [];
    const assigneeIds = [...new Set([template.assignee_id, ...templateAssigneeIds].filter(Boolean))];
    setSelectedTemplateId(template.id);
    setTemplateDraft({
      project_id: template.project_id || "",
      assignee_id: template.assignee_id || "",
      assignee_ids: assigneeIds,
      title: template.title || "",
      description: template.description || "",
      due_time: String(template.due_time || "17:00").slice(0, 5),
      recurrence_type: template.recurrence_type || "daily",
      monthly_day: template.monthly_day || 1,
      weekdays: normalizeWeekdays(template.weekdays),
      checklist_items: (template.checklist_items || []).join("\n"),
      requires_note: Boolean(template.requires_note),
    });
    setMessage("Đang chỉnh mẫu định kỳ đã chọn.");
  }

  function toggleTemplateAssignee(profileId) {
    setTemplateDraft((current) => {
      const selectedIds = new Set(current.assignee_ids || []);
      if (selectedIds.has(profileId)) selectedIds.delete(profileId);
      else selectedIds.add(profileId);
      const assigneeIds = [...selectedIds];
      return {
        ...current,
        assignee_ids: assigneeIds,
        assignee_id: assigneeIds[0] || "",
      };
    });
  }

  function templateAssigneeNames(template) {
    const members = template.daily_task_template_members?.map((member) => member.profile).filter(Boolean) || [];
    const people = [template.assignee, ...members].filter(Boolean);
    const uniquePeople = [...new Map(people.map((person) => [person.id, person])).values()];
    return uniquePeople.map(personName).join(", ") || "Chưa chọn nhân sự";
  }

  function recurrenceLabel(template) {
    if ((template.recurrence_type || "daily") === "monthly") {
      return `Hằng tháng ngày ${template.monthly_day || 1}`;
    }
    return `Hằng ngày · ${weekdayListLabel(template.weekdays)}`;
  }

  function toggleTemplateWeekday(day) {
    setTemplateDraft((current) => {
      const currentDays = new Set(normalizeWeekdays(current.weekdays));
      if (currentDays.has(day) && currentDays.size > 1) {
        currentDays.delete(day);
      } else {
        currentDays.add(day);
      }
      return {
        ...current,
        weekdays: weekdayOptions.map((item) => item.value).filter((item) => currentDays.has(item)),
      };
    });
  }

  async function submitDailyTemplate(event) {
    event.preventDefault();
    if (creatingTemplate) return;
    setCreatingTemplate(true);
    setMessage("");
    setRunReport(null);
    try {
      if (!templateDraft.assignee_ids?.length) {
        throw new Error("Vui lòng chọn ít nhất một nhân sự phụ trách.");
      }
      if (selectedTemplateId) {
        await updateDailyTemplate(selectedTemplateId, {
          project_id: templateDraft.project_id || null,
          assignee_id: templateDraft.assignee_id,
          assignee_ids: templateDraft.assignee_ids,
          title: templateDraft.title,
          description: templateDraft.description || null,
          due_time: templateDraft.due_time,
          recurrence_type: templateDraft.recurrence_type,
          monthly_day: templateDraft.recurrence_type === "monthly" ? Number(templateDraft.monthly_day || 1) : null,
          weekdays: templateDraft.recurrence_type === "daily" ? normalizeWeekdays(templateDraft.weekdays) : null,
          checklist_items: templateDraft.checklist_items.split("\n").map((item) => item.trim()).filter(Boolean),
          requires_note: templateDraft.requires_note,
        });
        setMessage("Đã cập nhật mẫu định kỳ.");
      } else {
        await createDailyTemplate({
          project_id: templateDraft.project_id || null,
          assignee_id: templateDraft.assignee_id,
          assignee_ids: templateDraft.assignee_ids,
          title: templateDraft.title,
          description: templateDraft.description || null,
          due_time: templateDraft.due_time,
          recurrence_type: templateDraft.recurrence_type,
          monthly_day: templateDraft.recurrence_type === "monthly" ? Number(templateDraft.monthly_day || 1) : null,
          weekdays: templateDraft.recurrence_type === "daily" ? normalizeWeekdays(templateDraft.weekdays) : null,
          checklist_items: templateDraft.checklist_items.split("\n").map((item) => item.trim()).filter(Boolean),
          requires_note: templateDraft.requires_note,
          active: true,
        });
        setMessage("Đã tạo mẫu task định kỳ.");
      }
      setSelectedTemplateId("");
      setTemplateDraft({ ...emptyTemplateDraft });
    } catch (currentError) {
      setMessage(currentError.message);
    } finally {
      setCreatingTemplate(false);
    }
  }

  async function toggleTemplate(template) {
    if (templateSavingId) return;
    setTemplateSavingId(template.id);
    setMessage("");
    try {
      await updateDailyTemplate(template.id, { active: !template.active });
      setMessage(template.active ? "Đã tạm tắt mẫu định kỳ." : "Đã bật lại mẫu định kỳ.");
    } catch (currentError) {
      setMessage(currentError.message);
    } finally {
      setTemplateSavingId("");
    }
  }

  async function runToday() {
    setRunning(true);
    setMessage("");
    setRunReport(null);
    try {
      const result = await runReminderSweepNow();
      const daily = result.dailyTasks || {};
      setRunReport(daily);
      setMessage(
        `Đã chạy lại hôm nay. Tạo mới ${daily.created || 0}, tạo bù ${daily.repaired || 0}, đã có sẵn ${daily.existing || 0}. Kiểm tra ${result.checked || 0} task deadline.`,
      );
    } catch (currentError) {
      setMessage(currentError.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="notifications-layout single-panel-layout">
      <section className="panel page-panel daily-template-panel">
        <div className="section-head compact-section-head">
          <div>
            <h2>Task định kỳ</h2>
            <p>Tự tạo task theo ngày hoặc tháng khi backend chạy reminder sweep. Lịch tháng gặp T7/CN sẽ tự dời sang ngày làm việc tiếp theo.</p>
          </div>
          <button className="secondary-action" type="button" onClick={runToday} disabled={running}>
            <RefreshCw size={16} className={running ? "spin" : ""} />
            {running ? "Đang chạy" : "Chạy lại hôm nay"}
          </button>
        </div>
        {message && <p className="mini-notice">{message}</p>}
        {runReport?.details?.length > 0 && (
          <div className="daily-run-report">
            {runReport.details.map((item) => (
              <article key={`${item.template_id}-${item.task_id}`} className={`daily-run-item ${item.status}`}>
                <div>
                  <strong>{item.template_title}</strong>
                  <span>{item.task_title} · {formatDate(item.due_time)}</span>
                </div>
                <b>
                  {item.status === "created" && "Vừa tạo"}
                  {item.status === "repaired" && "Tạo bù"}
                  {item.status === "existing" && "Đã có hôm nay"}
                </b>
              </article>
            ))}
          </div>
        )}
        <form onSubmit={submitDailyTemplate} className="daily-template-form">
          <label>
            Chu kỳ
            <select value={templateDraft.recurrence_type} onChange={(event) => setTemplateDraft({ ...templateDraft, recurrence_type: event.target.value })}>
              <option value="daily">Hằng ngày</option>
              <option value="monthly">Hằng tháng</option>
            </select>
          </label>
          {templateDraft.recurrence_type === "monthly" && (
            <label>
              Ngày trong tháng
              <input
                type="number"
                min="1"
                max="31"
                value={templateDraft.monthly_day}
                onChange={(event) => setTemplateDraft({ ...templateDraft, monthly_day: event.target.value })}
                required
              />
              <small>Nếu rơi thứ 7/CN sẽ tạo vào thứ 2 kế tiếp.</small>
            </label>
          )}
          {templateDraft.recurrence_type === "daily" && (
            <label className="wide-field weekday-field">
              Lịch chạy trong tuần
              <span className="weekday-picker">
                {weekdayOptions.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    className={normalizeWeekdays(templateDraft.weekdays).includes(day.value) ? "selected" : ""}
                    onClick={() => toggleTemplateWeekday(day.value)}
                  >
                    {day.label}
                  </button>
                ))}
              </span>
              <small>Mặc định chạy T2-T6. Bỏ chọn T7/CN nếu task không cần sinh cuối tuần.</small>
            </label>
          )}
          <label>
            Dự án
            <select value={templateDraft.project_id} onChange={(event) => updateTemplateProject(event.target.value)}>
              <option value="">Không gắn dự án</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          <label className="recurring-assignees-field">
            <span>Người phụ trách <small>{templateDraft.assignee_ids.length ? `Đã chọn ${templateDraft.assignee_ids.length} người` : "Chọn ít nhất 1 người"}</small></span>
            <span className="recurring-assignees-picker">
              {assignableProfiles.map((profile) => (
                <label key={profile.id} className={templateDraft.assignee_ids.includes(profile.id) ? "selected" : ""}>
                  <input
                    type="checkbox"
                    checked={templateDraft.assignee_ids.includes(profile.id)}
                    onChange={() => toggleTemplateAssignee(profile.id)}
                  />
                  <AvatarChip profile={profile} className="recurring-assignee-avatar" />
                  <span>{personName(profile)}</span>
                </label>
              ))}
            </span>
            {selectedProject && !assignableProfiles.length && <small>Dự án này chưa có thành viên.</small>}
          </label>
          <label>
            {templateDraft.recurrence_type === "monthly" ? "Hạn trong ngày tạo" : "Hạn mỗi ngày"}
            <input type="time" value={templateDraft.due_time} onChange={(event) => setTemplateDraft({ ...templateDraft, due_time: event.target.value })} required />
          </label>
          <label className="wide-field">
            Tên task định kỳ
            <input value={templateDraft.title} onChange={(event) => setTemplateDraft({ ...templateDraft, title: event.target.value })} required />
          </label>
          <label className="wide-field">
            Mô tả
            <textarea value={templateDraft.description} onChange={(event) => setTemplateDraft({ ...templateDraft, description: event.target.value })} />
          </label>
          <label className="wide-field">
            Checklist mặc định, mỗi dòng một việc nhỏ
            <textarea value={templateDraft.checklist_items} onChange={(event) => setTemplateDraft({ ...templateDraft, checklist_items: event.target.value })} placeholder="Setup máy\nVệ sinh máy\nSửa 5 máy" />
          </label>
          <label className="check-row wide-field">
            <input type="checkbox" checked={templateDraft.requires_note} onChange={(event) => setTemplateDraft({ ...templateDraft, requires_note: event.target.checked })} />
            <span>Bắt buộc note nếu không hoàn thành</span>
          </label>
          <div className="template-form-actions wide-field">
            <button className="primary-action" disabled={creatingTemplate} aria-busy={creatingTemplate}>
              {creatingTemplate ? <LoaderCircle size={17} className="spin-icon" /> : <Plus size={17} />}
              {creatingTemplate ? "Đang lưu..." : selectedTemplateId ? "Lưu mẫu định kỳ" : "Tạo mẫu định kỳ"}
            </button>
            {selectedTemplateId && (
              <button className="secondary-action" type="button" onClick={resetTemplateDraft}>
                Tạo mẫu mới
              </button>
            )}
          </div>
        </form>
        <div className="daily-template-list">
          {dailyTemplates.length > 0 && (
            <div className="daily-template-list-head">
              <span>Mẫu định kỳ</span>
              <span>Lịch chạy</span>
              <span>Người phụ trách</span>
              <span>Trạng thái</span>
              <span>Thao tác</span>
            </div>
          )}
          {dailyTemplates.map((template) => (
            <article key={template.id} className={`daily-template-row ${selectedTemplateId === template.id ? "selected" : ""}`}>
              <button type="button" className="template-select-button daily-template-main" onClick={() => selectTemplate(template)}>
                <strong>{template.title}</strong>
                <p>{template.projects?.name || "Không gắn dự án"}</p>
              </button>
              <button type="button" className="template-select-button daily-template-cell" onClick={() => selectTemplate(template)}>
                <span>{recurrenceLabel(template)}</span>
                <small>Hạn {String(template.due_time).slice(0, 5)} · {(template.checklist_items || []).length} việc nhỏ</small>
              </button>
              <button type="button" className="template-select-button daily-template-cell" onClick={() => selectTemplate(template)}>
                <span>{templateAssigneeNames(template)}</span>
                <small>{template.requires_note ? "Bắt buộc note" : "Không bắt buộc note"}</small>
              </button>
              <b className={template.active ? "status-pill" : "status-pill muted"}>{template.active ? "Đang bật" : "Tạm tắt"}</b>
              <button className="secondary-action compact-action" disabled={Boolean(templateSavingId)} onClick={() => toggleTemplate(template)}>
                {templateSavingId === template.id ? "Đang lưu" : template.active ? "Tạm tắt" : "Bật lại"}
              </button>
            </article>
          ))}
          {!dailyTemplates.length && <p className="empty-state">Chưa có mẫu task định kỳ.</p>}
        </div>
      </section>
    </div>
  );
}

function StorageCleanupPanel({ tasks = [] }) {
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [orphans, setOrphans] = useState([]);
  const [cleanupMessage, setCleanupMessage] = useState("");
  const [cleanupError, setCleanupError] = useState("");

  async function scanOrphans() {
    if (scanning) return;
    setScanning(true);
    setCleanupMessage("");
    setCleanupError("");
    try {
      const referenced = new Set();
      const activeTasks = (tasks || []).filter((task) => task?.status !== "cancelled");
      collectAttachmentPathsFromValue(activeTasks, referenced);
      const taskIds = activeTasks.map((task) => task?.id).filter(Boolean);
      const commentLists = await Promise.all(
        taskIds.map(async (id) => {
          try {
            const result = await api(`/api/tasks/${id}/comments`);
            return Array.isArray(result) ? result : result?.comments || [];
          } catch {
            return [];
          }
        })
      );
      collectAttachmentPathsFromValue(commentLists, referenced);
      const allPaths = await listStorageAttachmentPaths("");
      const nextOrphans = allPaths
        .filter((path) => !referenced.has(path))
        .map((path) => ({
          path,
          url: supabase.storage.from(attachmentBucket).getPublicUrl(path).data.publicUrl,
        }));
      setOrphans(nextOrphans);
      setCleanupMessage(
        nextOrphans.length
          ? `Tìm thấy ${nextOrphans.length} ảnh rời, gồm ảnh không còn gắn với task đang hoạt động hoặc thuộc task đã hủy. Kiểm tra rồi hãy xóa tay khi rảnh.`
          : "Không thấy ảnh rời trong Storage."
      );
    } catch (currentError) {
      setCleanupError(currentError.message || "Không quét được ảnh rời.");
    } finally {
      setScanning(false);
    }
  }

  async function deleteOrphans() {
    if (deleting || !orphans.length) return;
    setDeleting(true);
    setCleanupMessage("");
    setCleanupError("");
    try {
      const { error } = await supabase.storage
        .from(attachmentBucket)
        .remove(orphans.map((item) => item.path));
      if (error) throw error;
      setCleanupMessage(`Đã xóa ${orphans.length} ảnh rời khỏi Storage.`);
      setOrphans([]);
    } catch (currentError) {
      setCleanupError(currentError.message || "Không xóa được ảnh rời.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="panel storage-cleanup-card">
      <div className="panel-heading-row">
        <div>
          <h2>Dọn ảnh đính kèm</h2>
          <p>Quét ảnh trong Storage không còn nằm trong task đang hoạt động, ghi chú hoặc bình luận.</p>
        </div>
        <button type="button" className="icon-button" onClick={scanOrphans} disabled={scanning}>
          {scanning ? <LoaderCircle className="spin" size={18} /> : <RefreshCw size={18} />}
        </button>
      </div>
      {(cleanupMessage || cleanupError) && (
        <p className={cleanupError ? "error" : "success"}>{cleanupError || cleanupMessage}</p>
      )}
      <div className="storage-cleanup-actions">
        <button type="button" className="secondary-button" onClick={scanOrphans} disabled={scanning}>
          {scanning ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />}
          Quét ảnh rời
        </button>
        <button type="button" className="danger-soft-button" onClick={deleteOrphans} disabled={deleting || !orphans.length}>
          {deleting ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />}
          Xóa ảnh đã lọc
        </button>
      </div>
      {orphans.length ? (
        <div className="storage-orphan-list">
          {orphans.slice(0, 12).map((item) => (
            <a key={item.path} href={item.url} target="_blank" rel="noreferrer" className="storage-orphan-item">
              <ImageIcon size={15} />
              <span>{item.path}</span>
            </a>
          ))}
          {orphans.length > 12 && (
            <span className="muted-text">Còn {orphans.length - 12} ảnh nữa. Bấm xóa nếu đã kiểm tra xong.</span>
          )}
        </div>
      ) : (
        <p className="muted-text">Bấm quét để tìm ảnh rời trước khi xóa.</p>
      )}
    </section>
  );
}

function SettingsPage({ profile, tasks = [], onSaved }) {
  const [form, setForm] = useState({
    full_name: profile?.full_name || "",
    department: profile?.department || "",
    telegram_chat_id: profile?.telegram_chat_id || "",
    zalo_user_id: profile?.zalo_user_id || "",
    zalo_display_name: profile?.zalo_display_name || "",
    avatar_url: profile?.avatar_url || "",
    avatar_path: profile?.avatar_path || "",
  });
  const [avatarDraft, setAvatarDraft] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [appSettings, setAppSettings] = useState({
    default_telegram_group_chat_id: "",
    default_zalo_group_id: "",
    default_zalo_flow_code: "",
  });
  const [passwordForm, setPasswordForm] = useState({ password: "", confirm: "" });
  const [telegramChats, setTelegramChats] = useState([]);
  const [profileMessage, setProfileMessage] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [loadingTelegramChats, setLoadingTelegramChats] = useState(false);
  const [savingAppSettings, setSavingAppSettings] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setForm({
      full_name: profile?.full_name || "",
      department: profile?.department || "",
      telegram_chat_id: profile?.telegram_chat_id || "",
      zalo_user_id: profile?.zalo_user_id || "",
      zalo_display_name: profile?.zalo_display_name || "",
      avatar_url: profile?.avatar_url || "",
      avatar_path: profile?.avatar_path || "",
    });
  }, [profile]);

  useEffect(() => {
    return () => {
      if (avatarDraft?.previewUrl) URL.revokeObjectURL(avatarDraft.previewUrl);
    };
  }, [avatarDraft]);

  function chooseAvatar(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!avatarMimeTypes.has(file.type)) {
      setProfileMessage("Ảnh đại diện chỉ nhận JPG, PNG hoặc WebP.");
      return;
    }

    if (avatarDraft?.previewUrl) URL.revokeObjectURL(avatarDraft.previewUrl);
    setAvatarDraft({
      file,
      previewUrl: URL.createObjectURL(file),
      originalSize: file.size,
    });
    setProfileMessage(file.size > avatarMaxBytes ? "Ảnh lớn hơn 500KB, hệ thống sẽ tự nén khi lưu hồ sơ." : "");
  }

  async function uploadAvatarIfNeeded() {
    if (!avatarDraft?.file) {
      return { avatar_url: form.avatar_url || null, avatar_path: form.avatar_path || null };
    }

    const compressed = await compressAvatar(avatarDraft.file);
    const path = `${profile.id}/avatar-${Date.now()}.${compressed.extension}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, compressed.blob, {
        contentType: compressed.mimeType,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    if (form.avatar_path) {
      await supabase.storage.from("avatars").remove([form.avatar_path]);
    }

    return { avatar_url: data.publicUrl, avatar_path: path };
  }

  useEffect(() => {
    api("/api/settings")
      .then((settings) => {
        setAppSettings({
          default_telegram_group_chat_id: settings.default_telegram_group_chat_id || "",
          default_zalo_group_id: settings.default_zalo_group_id || "",
          default_zalo_flow_code: settings.default_zalo_flow_code || "",
        });
      })
      .catch(() => {
        setAppSettings({
          default_telegram_group_chat_id: "",
          default_zalo_group_id: "",
          default_zalo_flow_code: "",
        });
      });
  }, []);

  async function saveProfile(event) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileMessage("");
    let uploadedPath = "";
    try {
      const avatarPayload = await uploadAvatarIfNeeded();
      uploadedPath = avatarDraft?.file ? avatarPayload.avatar_path : "";
      await api("/api/me", {
        method: "PATCH",
        body: JSON.stringify({
          full_name: form.full_name,
          department: form.department || null,
          telegram_chat_id: form.telegram_chat_id || null,
          zalo_user_id: form.zalo_user_id || null,
          zalo_display_name: form.zalo_display_name || null,
          avatar_url: avatarPayload.avatar_url,
          avatar_path: avatarPayload.avatar_path,
        }),
      });
      setAvatarDraft(null);
      setForm((current) => ({ ...current, ...avatarPayload }));
      setProfileMessage("Đã lưu hồ sơ.");
      onSaved();
    } catch (currentError) {
      if (uploadedPath) {
        await supabase.storage.from("avatars").remove([uploadedPath]);
      }
      setProfileMessage(currentError.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    if (savingPassword) return;
    if (passwordForm.password !== passwordForm.confirm) {
      setPasswordMessage("Mật khẩu xác nhận chưa khớp.");
      return;
    }
    setSavingPassword(true);
    setPasswordMessage("");
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.password });
      if (error) {
        setPasswordMessage(error.message);
        return;
      }
      setPasswordForm({ password: "", confirm: "" });
      setPasswordMessage("Đã đổi mật khẩu.");
    } finally {
      setSavingPassword(false);
    }
  }


  async function loadTelegramChatIds() {
    if (loadingTelegramChats) return;
    setLoadingTelegramChats(true);
    setProfileMessage("");
    try {
      const result = await api("/api/telegram/chat-ids");
      if (!result.ok) {
        setProfileMessage(result.description || "Không lấy được Telegram chat ID.");
        return;
      }
      setTelegramChats(result.result || []);
      if (!result.result?.length) {
        setProfileMessage("Chưa có chat ID. Hãy nhắn /start cho bot rồi bấm lấy lại.");
      }
    } catch (currentError) {
      setProfileMessage(currentError.message);
    } finally {
      setLoadingTelegramChats(false);
    }
  }

  async function saveAppSettings(event) {
    event.preventDefault();
    if (savingAppSettings) return;
    setSavingAppSettings(true);
    setSettingsMessage("");
    try {
      await api("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          default_telegram_group_chat_id: appSettings.default_telegram_group_chat_id || null,
          default_zalo_group_id: appSettings.default_zalo_group_id || null,
          default_zalo_flow_code: appSettings.default_zalo_flow_code || null,
        }),
      });
      setSettingsMessage("Đã lưu cấu hình thông báo chung.");
    } catch (currentError) {
      setSettingsMessage(currentError.message);
    } finally {
      setSavingAppSettings(false);
    }
  }

  return (
    <div className="split-grid">
      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Hồ sơ cá nhân</h2>
            <p>Cập nhật thông tin, Telegram chat ID và Zalo tag.</p>
          </div>
        </div>
        <form onSubmit={saveProfile} className="stack-form">
          <div className="avatar-uploader">
            <div className="profile-avatar-preview">
              {avatarDraft?.previewUrl || form.avatar_url ? (
                <img src={avatarDraft?.previewUrl || form.avatar_url} alt="Ảnh đại diện" />
              ) : (
                <span>{personName(profile).slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div>
              <label className="file-button">
                <ImageIcon size={17} />
                Chọn ảnh đại diện
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseAvatar} />
              </label>
              <p>JPG, PNG, WebP. Tối đa 500KB sau khi nén.</p>
              {avatarDraft && (
                <small>
                  Đã chọn {avatarDraft.file.name} · {(avatarDraft.originalSize / 1024).toFixed(0)}KB
                  {avatarDraft.originalSize > avatarMaxBytes ? " · sẽ tự nén khi lưu" : ""}
                </small>
              )}
            </div>
          </div>
          <label>Họ tên<input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></label>
          <label>Bộ phận<input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /></label>
          <label>Telegram chat ID<input value={form.telegram_chat_id} onChange={(event) => setForm({ ...form, telegram_chat_id: event.target.value })} /></label>
          <label>Zalo user ID<input value={form.zalo_user_id} onChange={(event) => setForm({ ...form, zalo_user_id: event.target.value })} placeholder="ID Zalo để bot tag trong group" /></label>
          <label>Tên tag Zalo<input value={form.zalo_display_name} onChange={(event) => setForm({ ...form, zalo_display_name: event.target.value })} placeholder="Tên hiển thị khi tag Zalo" /></label>
          <button className="secondary-action" type="button" onClick={loadTelegramChatIds} disabled={loadingTelegramChats}>
            {loadingTelegramChats ? <LoaderCircle size={17} className="spin-icon" /> : <Send size={17} />}
            {loadingTelegramChats ? "Đang lấy chat ID" : "Lấy chat ID từ bot"}
          </button>
          {!!telegramChats.length && (
            <div className="telegram-chat-list">
              {telegramChats.map((chat) => (
                <button key={chat.chat_id} type="button" className="telegram-chat-option" onClick={() => setForm({ ...form, telegram_chat_id: chat.chat_id })}>
                  <strong>{chat.name}</strong>
                  <span>{chat.chat_id}{chat.username ? ` · @${chat.username}` : ""}</span>
                </button>
              ))}
            </div>
          )}
          <button className="secondary-action" disabled={savingProfile}>
            {savingProfile ? <RefreshCw size={17} className="spin" /> : <Send size={17} />}
            {savingProfile ? "Đang lưu hồ sơ" : "Lưu hồ sơ"}
          </button>
          {profileMessage && <p className="mini-notice">{profileMessage}</p>}
        </form>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Telegram chung</h2>
            <p>Dùng cho task cá nhân hoặc dự án chưa cấu hình group riêng.</p>
          </div>
        </div>
        <form onSubmit={saveAppSettings} className="stack-form">
          <label>
            Group chat ID mặc định
            <input
              value={appSettings.default_telegram_group_chat_id}
              onChange={(event) => setAppSettings({ ...appSettings, default_telegram_group_chat_id: event.target.value })}
              placeholder="-100..."
            />
          </label>
          <button className="secondary-action" disabled={savingAppSettings} aria-busy={savingAppSettings}>
            {savingAppSettings ? <LoaderCircle size={17} className="spin-icon" /> : <Send size={17} />}
            {savingAppSettings ? "Đang lưu..." : "Lưu thông báo chung"}
          </button>
          {settingsMessage && <p className="mini-notice">{settingsMessage}</p>}
        </form>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Zalo chung</h2>
            <p>Dùng cổng Zalo push cho task mới, sắp hạn và quá hạn.</p>
          </div>
        </div>
        <form onSubmit={saveAppSettings} className="stack-form">
          <label>
            Zalo group ID mặc định
            <input
              value={appSettings.default_zalo_group_id}
              onChange={(event) => setAppSettings({ ...appSettings, default_zalo_group_id: event.target.value })}
              placeholder="193463471384782864"
            />
          </label>
          <label>
            Hoặc flowCode mặc định
            <input
              value={appSettings.default_zalo_flow_code}
              onChange={(event) => setAppSettings({ ...appSettings, default_zalo_flow_code: event.target.value })}
              placeholder="TPB"
            />
          </label>
          <button className="secondary-action" disabled={savingAppSettings} aria-busy={savingAppSettings}>
            {savingAppSettings ? <LoaderCircle size={17} className="spin-icon" /> : <Send size={17} />}
            {savingAppSettings ? "Đang lưu..." : "Lưu Zalo chung"}
          </button>
        </form>
      </section>

      <StorageCleanupPanel tasks={tasks} />

      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Đổi mật khẩu</h2>
            <p>Dùng sau khi Admin tạo tài khoản bằng mật khẩu tạm.</p>
          </div>
        </div>
        <form onSubmit={changePassword} className="stack-form">
          <label>Mật khẩu mới<input value={passwordForm.password} onChange={(event) => setPasswordForm({ ...passwordForm, password: event.target.value })} type="password" minLength={6} /></label>
          <label>Nhập lại mật khẩu<input value={passwordForm.confirm} onChange={(event) => setPasswordForm({ ...passwordForm, confirm: event.target.value })} type="password" minLength={6} /></label>
          <button className="secondary-action" disabled={savingPassword} aria-busy={savingPassword}>
            {savingPassword ? <LoaderCircle size={17} className="spin-icon" /> : <KeyRound size={17} />}
            {savingPassword ? "Đang đổi..." : "Đổi mật khẩu"}
          </button>
          {passwordMessage && <p className="mini-notice">{passwordMessage}</p>}
        </form>
      </section>
    </div>
  );
}

function RichTextWithImages({ text, onImageClick }) {
  const content = text || "";
  const imagePattern = /!\[([^\]]*)\]\((data:image\/[^)]+|https?:\/\/[^)\s]+)\)/g;
  const nodes = [];
  let lastIndex = 0;
  let match;

  while ((match = imagePattern.exec(content)) !== null) {
    const before = content.slice(lastIndex, match.index);
    if (before.trim()) {
      nodes.push(<p key={`text-${match.index}`}>{before}</p>);
    }
    const imageSrc = match[2];
    const imageAlt = match[1] || "Ảnh đính kèm";
    nodes.push(
      <button
        key={`image-${match.index}`}
        className="inline-comment-image-button"
        type="button"
        onClick={() => onImageClick?.(imageSrc, imageAlt)}
        aria-label="Mở ảnh đính kèm"
      >
        <img
          className="inline-comment-image"
          src={imageSrc}
          alt={imageAlt}
          loading="lazy"
        />
      </button>,
    );
    lastIndex = imagePattern.lastIndex;
  }

  const rest = content.slice(lastIndex);
  if (rest.trim()) {
    nodes.push(<p key="text-end">{rest}</p>);
  }

  return <div className="rich-comment-text">{nodes.length ? nodes : <p>{content}</p>}</div>;
}

function TaskDrawer({ task, comments, profiles, projects, onClose, onRefresh, saveTaskDetail, addComment }) {
  const [comment, setComment] = useState("");
  const [statusDraft, setStatusDraft] = useState(task?.status || "todo");
  const [timeDraft, setTimeDraft] = useState({ start_time: "", due_time: "" });
  const [checklistDraft, setChecklistDraft] = useState([]);
  const [memberIds, setMemberIds] = useState([]);
  const [completionNote, setCompletionNote] = useState("");
  const [deadlineChangeNote, setDeadlineChangeNote] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [deadlineNoteMissing, setDeadlineNoteMissing] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [imageBusyTarget, setImageBusyTarget] = useState("");
  const [checklistPopover, setChecklistPopover] = useState(null);
  const completionImageInputRef = React.useRef(null);
  const deadlineImageInputRef = React.useRef(null);
  const commentImageInputRef = React.useRef(null);
  const deadlineNoteRef = React.useRef(null);

  useEffect(() => {
    if (!task) return;
    setStatusDraft(task.status);
    setTimeDraft({
      start_time: toLocalInputValue(task.start_time),
      due_time: toLocalInputValue(task.due_time),
    });
    setChecklistDraft(
      (task.task_checklists || [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((item) => ({
          id: item.id,
          title: item.title || "",
          assignee_id: item.assignee_id || "",
          due_time: toLocalInputValue(item.due_time),
          note: item.note || "",
          is_done: Boolean(item.is_done),
          sort_order: item.sort_order || 0,
          deleted: false,
        })),
    );
    setMemberIds((task.task_members || []).map((item) => item.user_id));
    setCompletionNote("");
    setDeadlineChangeNote("");
    setMessage("");
    setSaveState("idle");
    setDeadlineNoteMissing(false);
    setPreviewImage(null);
    setImageBusyTarget("");
    setChecklistPopover(null);
  }, [task]);

  if (!task) return null;

  const baselineChecklist = JSON.stringify(
    (task.task_checklists || [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({
        id: item.id,
        title: item.title || "",
        assignee_id: item.assignee_id || "",
        due_time: toLocalInputValue(item.due_time),
        note: item.note || "",
        is_done: Boolean(item.is_done),
        sort_order: item.sort_order || 0,
        deleted: false,
      })),
  );
  const checklistChanged = JSON.stringify(checklistDraft) !== baselineChecklist;
  const baselineMemberIds = JSON.stringify((task.task_members || []).map((item) => item.user_id).sort());
  const membersChanged = JSON.stringify([...memberIds].sort()) !== baselineMemberIds;
  const statusChanged = statusDraft !== task.status;
  const baselineTimes = JSON.stringify({
    start_time: toLocalInputValue(task.start_time),
    due_time: toLocalInputValue(task.due_time),
  });
  const timeChanged = JSON.stringify(timeDraft) !== baselineTimes;
  const deadlineChanged = toLocalInputValue(task.due_time) !== timeDraft.due_time;
  const hasChanges = statusChanged
    || checklistChanged
    || membersChanged
    || timeChanged
    || Boolean(completionNote.trim())
    || (deadlineChanged && Boolean(deadlineChangeNote.trim()));
  const sortedComments = (comments || [])
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const activeProject = projects.find((project) => project.id === task.project_id);
  const projectMemberIds = new Set((activeProject?.project_members || []).map((item) => item.user_id));
  const projectMemberProfiles = task.project_id
    ? profiles.filter((profile) => projectMemberIds.has(profile.id))
    : [];
  const checklistAssigneeProfiles = task.project_id ? projectMemberProfiles : profiles;

  function checklistItemKey(item) {
    return item.id || item.temp_id;
  }

  function updateChecklistItem(key, patch) {
    setChecklistDraft((current) => current.map((item) => (checklistItemKey(item) === key ? { ...item, ...patch } : item)));
  }

  function addChecklistItem() {
    setChecklistDraft((current) => [
      ...current,
      {
        temp_id: `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title: "",
        assignee_id: "",
        due_time: "",
        note: "",
        is_done: false,
        sort_order: current.length,
        deleted: false,
      },
    ]);
  }

  function removeChecklistItem(key) {
    setChecklistDraft((current) =>
      current.flatMap((item) => {
        if (checklistItemKey(item) !== key) return [item];
        return item.id ? [{ ...item, deleted: true }] : [];
      }),
    );
    setChecklistPopover((current) => (current?.key === key ? null : current));
  }

  function toggleChecklistPopover(key, type) {
    setChecklistPopover((current) => (
      current?.key === key && current?.type === type ? null : { key, type }
    ));
  }

  function toggleTaskMember(userId) {
    setMemberIds((current) => (
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    ));
  }

  async function attachImageToField(file, target) {
    if (!file) return;
    if (file.size > attachmentUploadMaxBytes) {
      setMessage("Ảnh gốc tối đa 10MB. Vui lòng chọn ảnh nhỏ hơn.");
      return;
    }
    if (!file.type?.startsWith("image/")) {
      setMessage("Chỉ hỗ trợ JPG, PNG, WebP hoặc GIF.");
      return;
    }
    setImageBusyTarget(target);
    setMessage("");
    try {
      const blob = await compressAttachmentImage(file);
      const path = attachmentStoragePath(task.id, file.name);
      const { error: uploadError } = await supabase.storage
        .from(attachmentBucket)
        .upload(path, blob, {
          contentType: "image/webp",
          upsert: false,
        });

      if (uploadError) {
        const bucketHint = uploadError.message?.toLowerCase().includes("bucket")
          ? "Bucket ảnh chưa sẵn sàng. Hãy chạy file SQL tạo Supabase Storage trước."
          : uploadError.message;
        throw new Error(bucketHint);
      }

      const { data } = supabase.storage.from(attachmentBucket).getPublicUrl(path);
      if (!data?.publicUrl) {
        throw new Error("Upload ảnh xong nhưng không lấy được link ảnh.");
      }

      const snippet = imageMarkdown(data.publicUrl, file.name);
      if (target === "comment") {
        setComment((current) => appendWithGap(current, snippet));
      } else if (target === "completion") {
        setCompletionNote((current) => appendWithGap(current, snippet));
      } else if (target === "deadline") {
        setDeadlineChangeNote((current) => appendWithGap(current, snippet));
      }
    } catch (currentError) {
      setMessage(currentError.message);
    } finally {
      setImageBusyTarget("");
    }
  }

  function handleImageInput(event, target) {
    const file = event.target.files?.[0];
    event.target.value = "";
    attachImageToField(file, target);
  }

  async function handleImagePaste(event, target) {
    const file = Array.from(event.clipboardData?.files || []).find((item) => item.type?.startsWith("image/"));
    if (!file) return;
    event.preventDefault();
    await attachImageToField(file, target);
  }

  async function submitComment(event) {
    event.preventDefault();
    setMessage("");
    const trimmedComment = comment.trim();
    if (!trimmedComment) return;
    try {
      await addComment(task.id, trimmedComment);
      setComment("");
      onRefresh();
    } catch (currentError) {
      setMessage(currentError.message);
    }
  }

  async function saveAll() {
    const parentDueValue = fromLocalInputValue(timeDraft.due_time);
    const parentDue = parentDueValue ? new Date(parentDueValue).getTime() : null;
    const invalidChild = checklistDraft.find(
      (item) => !item.deleted && item.due_time && parentDue && new Date(fromLocalInputValue(item.due_time)).getTime() > parentDue,
    );
    if (invalidChild) {
      setMessage("Deadline việc nhỏ không được vượt quá deadline task chính.");
      return;
    }
    if (deadlineChanged && !deadlineChangeNote.trim()) {
      setMessage("Vui lòng nhập lý do thay đổi deadline trước khi lưu.");
      setDeadlineNoteMissing(true);
      window.setTimeout(() => {
        deadlineNoteRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        deadlineNoteRef.current?.focus({ preventScroll: true });
      }, 0);
      return;
    }
    setDeadlineNoteMissing(false);
    setSaving(true);
    setSaveState("saving");
    setMessage("");
    try {
      const visibleChecklist = checklistDraft.filter((item) => !item.deleted && item.title.trim());
      let nextStatus = statusDraft;
      const nextStartTime = fromLocalInputValue(timeDraft.start_time);
      if (nextStartTime && new Date(nextStartTime).getTime() <= Date.now() && nextStatus === "todo") {
        nextStatus = "doing";
      }
      if (
        visibleChecklist.length > 0
        && visibleChecklist.every((item) => item.is_done)
        && !["done", "cancelled"].includes(statusDraft)
      ) {
        const shouldComplete = window.confirm("Tất cả công việc nhỏ đã hoàn thành. Chuyển task này sang Hoàn thành luôn nhé?");
        if (shouldComplete) nextStatus = "done";
      }
      const detailPayload = {
        task: {
          status: nextStatus,
          start_time: nextStartTime,
          due_time: parentDueValue,
        },
        checklist: checklistDraft
          .filter((item) => item.deleted || item.title.trim())
          .map((item, index) => ({
            id: item.id,
            title: item.title.trim() || "Checklist item",
            assignee_id: item.assignee_id || null,
            due_time: fromLocalInputValue(item.due_time),
            note: item.note || null,
            is_done: item.is_done,
            sort_order: index,
            deleted: item.deleted,
        })),
        completion_note: completionNote || null,
        deadline_change_note: deadlineChanged ? deadlineChangeNote.trim() : null,
      };
      if (membersChanged) {
        detailPayload.member_ids = memberIds;
      }
      await saveTaskDetail(task.id, detailPayload);
      setStatusDraft(nextStatus);
      setDeadlineChangeNote("");
      setSaveState("saved");
      window.setTimeout(() => setSaveState((current) => (current === "saved" ? "idle" : current)), 2500);
    } catch (currentError) {
      setMessage(currentError.message);
      setSaveState("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="drawer">
      <header className="drawer-head">
        <div>
          <span>{task.projects?.name || "Cá nhân"}</span>
          <h2>{task.title}</h2>
        </div>
        <button className="icon-button" onClick={onClose} title="Đóng">
          <X size={18} />
        </button>
      </header>
      {message && <p className="mini-notice">{message}</p>}
      <div className="drawer-section">
        <p>{task.description || "Chưa có mô tả."}</p>
        <div className="detail-grid">
          <span><b>Phụ trách</b>{personName(task.assignee)}</span>
          <span><b>Ưu tiên</b>{priorityLabel(task.priority)}</span>
          <label>
            <b>Bắt đầu</b>
            <input
              type="datetime-local"
              value={timeDraft.start_time}
              onChange={(event) => setTimeDraft((current) => ({ ...current, start_time: event.target.value }))}
            />
          </label>
          <label>
            <b>Deadline</b>
            <input
              type="datetime-local"
              value={timeDraft.due_time}
              onChange={(event) => setTimeDraft((current) => ({ ...current, due_time: event.target.value }))}
            />
          </label>
          <label>
            <b>Trạng thái</b>
            <select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)}>
              <option value="todo">Chưa bắt đầu</option>
              <option value="doing">Đang làm</option>
              <option value="done">Hoàn thành</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </label>
        </div>
        {deadlineChanged && (
          <div className={`completion-note-field deadline-change-note ${deadlineNoteMissing ? "deadline-note-attention" : ""}`}>
            <div className="field-action-row">
              <span>Lý do thay đổi deadline</span>
              <button
                className="inline-file-button"
                type="button"
                onClick={() => deadlineImageInputRef.current?.click()}
                disabled={imageBusyTarget === "deadline"}
              >
                {imageBusyTarget === "deadline" ? <LoaderCircle size={15} className="spin-icon" /> : <ImageIcon size={15} />}
                {imageBusyTarget === "deadline" ? "Đang nén..." : "Thêm ảnh"}
              </button>
            </div>
            <textarea
              ref={deadlineNoteRef}
              value={deadlineChangeNote}
              onChange={(event) => {
                setDeadlineChangeNote(event.target.value);
                if (deadlineNoteMissing) setDeadlineNoteMissing(false);
              }}
              onPaste={(event) => handleImagePaste(event, "deadline")}
              placeholder="Nhập lý do đổi deadline để lưu vào bình luận và gửi thông báo..."
              required
            />
            <input
              ref={deadlineImageInputRef}
              className="hidden-file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(event) => handleImageInput(event, "deadline")}
            />
          </div>
        )}
      </div>
      <div className="drawer-section">
        <div className="drawer-section-head">
          <h3>Thành viên xử lý</h3>
          <span className="muted-count">{memberIds.length} người</span>
        </div>
        {task.project_id ? (
          <div className="task-member-picker">
            {projectMemberProfiles.map((profile) => (
              <label key={profile.id} className="member-check-row">
                <input
                  type="checkbox"
                  checked={memberIds.includes(profile.id)}
                  onChange={() => toggleTaskMember(profile.id)}
                />
                <AvatarChip profile={profile} />
                <span>{personName(profile)}</span>
              </label>
            ))}
            {!projectMemberProfiles.length && <p>Chưa có thành viên trong dự án này.</p>}
          </div>
        ) : (
          <p className="mini-notice">Task cá nhân chưa hỗ trợ thêm thành viên xử lý. Hãy gắn task vào dự án nếu cần nhiều người cùng xử lý.</p>
        )}
      </div>
      <div className="drawer-section">
        <div className="drawer-section-head">
          <h3>Checklist</h3>
          <button className="secondary-action compact-action" type="button" onClick={addChecklistItem}>
            <Plus size={15} />
            Thêm công việc
          </button>
        </div>
        <div className="checklist checklist-editor">
          {checklistDraft
            .filter((item) => !item.deleted)
            .map((item) => {
              const key = checklistItemKey(item);
              const itemOverdue = item.due_time && new Date(fromLocalInputValue(item.due_time)) < new Date() && !item.is_done;
              const assignedProfile = checklistAssigneeProfiles.find((profile) => profile.id === item.assignee_id);
              return (
                <article key={key} className={"checklist-item-editor " + (item.is_done ? "done " : "") + (itemOverdue ? "overdue" : "")}>
                  <div className="check-row checklist-title-row">
                    <input
                      type="checkbox"
                      checked={Boolean(item.is_done)}
                      onChange={(event) => updateChecklistItem(key, { is_done: event.target.checked })}
                    />
                    <input
                      value={item.title}
                      onChange={(event) => updateChecklistItem(key, { title: event.target.value })}
                      placeholder="Tên công việc"
                    />
                    <span className="checklist-action-row">
                      <button
                        className={`icon-button checklist-meta-action ${item.assignee_id ? "active" : ""}`}
                        type="button"
                        onClick={() => toggleChecklistPopover(key, "assignee")}
                        title="Chỉ định"
                      >
                        <UsersRound size={14} />
                      </button>
                      <button
                        className={`icon-button checklist-meta-action ${item.due_time ? "active" : ""}`}
                        type="button"
                        onClick={() => toggleChecklistPopover(key, "deadline")}
                        title="Thời hạn"
                      >
                        <CalendarClock size={14} />
                      </button>
                      <button className="icon-button checklist-delete" type="button" onClick={() => removeChecklistItem(key)} title="Xóa công việc">
                        <Trash2 size={15} />
                      </button>
                    </span>
                  </div>
                  {(item.assignee_id || item.due_time) && (
                    <div className="checklist-inline-meta">
                      {item.assignee_id && <span><UsersRound size={12} />{personName(assignedProfile)}</span>}
                      {item.due_time && <span><CalendarClock size={12} />{formatDate(fromLocalInputValue(item.due_time))}</span>}
                    </div>
                  )}
                  {checklistPopover?.key === key && (
                    <div className="checklist-meta-popover">
                      {checklistPopover.type === "assignee" ? (
                        <label>
                          Chỉ định công việc
                          <select value={item.assignee_id} onChange={(event) => updateChecklistItem(key, { assignee_id: event.target.value })}>
                            <option value="">Chưa chỉ định</option>
                            {checklistAssigneeProfiles.map((profile) => <option key={profile.id} value={profile.id}>{personName(profile)}</option>)}
                          </select>
                        </label>
                      ) : (
                        <label>
                          Thời hạn công việc
                          <input
                            type="datetime-local"
                            value={item.due_time}
                            max={timeDraft.due_time}
                            onChange={(event) => updateChecklistItem(key, { due_time: event.target.value })}
                          />
                        </label>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          {!checklistDraft.filter((item) => !item.deleted).length && <p>Task này chưa có checklist.</p>}
        </div>
        <div className="completion-note-field">
          <div className="field-action-row">
            <span>Note khi chưa hoàn thành / cần giải trình</span>
            <button
              className="inline-file-button"
              type="button"
              onClick={() => completionImageInputRef.current?.click()}
              disabled={imageBusyTarget === "completion"}
            >
              {imageBusyTarget === "completion" ? <LoaderCircle size={15} className="spin-icon" /> : <ImageIcon size={15} />}
              {imageBusyTarget === "completion" ? "Đang nén..." : "Thêm ảnh"}
            </button>
          </div>
          <textarea
            value={completionNote}
            onChange={(event) => setCompletionNote(event.target.value)}
            onPaste={(event) => handleImagePaste(event, "completion")}
            placeholder="Nhập lý do hoặc ghi chú nếu việc chưa hoàn thành đúng hạn..."
          />
          <input
            ref={completionImageInputRef}
            className="hidden-file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => handleImageInput(event, "completion")}
          />
        </div>
      </div>
      <div className="drawer-section">
        <h3>Bình luận</h3>
        <div className="comment-list">
          {sortedComments.map((item) => (
            <article key={item.id}>
              <div className="comment-meta">
                <strong>{personName(item.profiles)}</strong>
                <span>{formatDate(item.created_at)}</span>
              </div>
              <RichTextWithImages
                text={item.comment}
                onImageClick={(src, alt) => setPreviewImage({ src, alt })}
              />
            </article>
          ))}
          {!sortedComments.length && <p>Chưa có bình luận.</p>}
        </div>
        <form onSubmit={submitComment} className="comment-form">
          <input
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            onPaste={(event) => handleImagePaste(event, "comment")}
            placeholder="Viết cập nhật..."
          />
          <input
            ref={commentImageInputRef}
            className="hidden-file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => handleImageInput(event, "comment")}
          />
          <button
            className="secondary-action image-attach-action"
            type="button"
            onClick={() => commentImageInputRef.current?.click()}
            disabled={imageBusyTarget === "comment"}
            title="Thêm ảnh"
          >
            {imageBusyTarget === "comment" ? <LoaderCircle size={16} className="spin-icon" /> : <ImageIcon size={16} />}
            Ảnh
          </button>
          <button className="secondary-action"><MessageSquare size={16} />Gửi</button>
        </form>
      </div>
      {previewImage && (
        <div className="image-lightbox" role="dialog" aria-modal="true" onClick={() => setPreviewImage(null)}>
          <button
            type="button"
            className="image-lightbox-close"
            onClick={(event) => {
              event.stopPropagation();
              setPreviewImage(null);
            }}
            aria-label="Đóng ảnh"
          >
            <X size={20} />
          </button>
          <img
            src={previewImage.src}
            alt={previewImage.alt}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
      <div className="drawer-savebar">
        {saveState === "saved" && <span className="save-state-note success">Đã lưu thành công.</span>}
        {saveState === "error" && message && <span className="save-state-note error">{message}</span>}
        <div className="drawer-save-actions">
          <button className="secondary-action drawer-close-action" type="button" onClick={onClose}>
            <X size={16} />
            Đóng
          </button>
          <button className={`primary-action ${saveState === "saved" ? "save-success" : ""}`} type="button" disabled={!hasChanges || saving} onClick={saveAll}>
            {saving ? <LoaderCircle size={17} className="spin-icon" /> : <Check size={17} />}
            {saving ? "Đang lưu..." : saveState === "saved" ? "Đã lưu" : "Lưu thay đổi"}
          </button>
        </div>
      </div>
    </aside>
  );
}

function CreateTaskModal({ projects, profiles, profile, onCreate, onClose }) {
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyTaskForm);
  const creatableProjects = projects.filter((project) => !["inactive", "completed"].includes(project.status));
  const selectedProject = creatableProjects.find((project) => project.id === form.project_id);
  const projectMemberIds = new Set((selectedProject?.project_members || []).map((member) => member.user_id));
  const assignableProfiles = selectedProject
    ? profiles.filter((item) => projectMemberIds.has(item.id))
    : profiles;

  function updateProject(projectId) {
    setForm((current) => ({
      ...current,
      project_id: projectId,
      assignee_id: "",
      list_id: "",
      member_ids: [],
    }));
  }

  function toggleTaskMember(userId) {
    setForm((current) => {
      const existing = current.member_ids || [];
      return {
        ...current,
        member_ids: existing.includes(userId)
          ? existing.filter((item) => item !== userId)
          : [...existing, userId],
      };
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setError("");
    try {
      if (selectedProject && !form.assignee_id) {
        throw new Error("Hãy chọn người phụ trách thuộc dự án.");
      }
      const startTime = fromLocalInputValue(form.start_time);
      await onCreate({
        project_id: form.project_id || null,
        list_id: form.list_id || null,
        title: form.title,
        description: form.description || null,
        assignee_id: form.assignee_id || profile.id,
        start_time: startTime,
        due_time: fromLocalInputValue(form.due_time),
        status: startTime && new Date(startTime).getTime() <= Date.now() ? "doing" : "todo",
        priority: form.priority,
        member_ids: selectedProject ? form.member_ids : [],
        checklist: form.checklist.split("\n").map((line) => line.trim()).filter(Boolean),
      });
      onClose();
    } catch (currentError) {
      setError(currentError.message);
      setCreating(false);
    }
  }

  return (
    <Modal title="Tạo task mới" onClose={onClose}>
      <form onSubmit={submit} className="modal-form">
        <label className="wide-field">Tên task<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
        <label>Dự án<select value={form.project_id} onChange={(event) => updateProject(event.target.value)}><option value="">Cá nhân</option>{creatableProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
        <label>Phụ trách<select value={form.assignee_id} onChange={(event) => setForm({ ...form, assignee_id: event.target.value })}><option value="">{selectedProject ? "Chọn người phụ trách" : "Tôi phụ trách"}</option>{assignableProfiles.map((item) => <option key={item.id} value={item.id}>{personName(item)}</option>)}</select></label>
        <label>Bắt đầu<input type="datetime-local" value={form.start_time} onChange={(event) => setForm({ ...form, start_time: event.target.value })} /></label>
        <label>Deadline<input type="datetime-local" value={form.due_time} onChange={(event) => setForm({ ...form, due_time: event.target.value })} /></label>
        {selectedProject && (
          <div className="wide-field role-checkbox-panel compact-role-picker">
            <strong>Thành viên xử lý</strong>
            <p>Chỉ chọn được nhân sự đã được thêm vào dự án.</p>
            <div className="role-checkbox-grid">
              {assignableProfiles.map((item) => (
                <label key={item.id} className="check-row role-check-row">
                  <input
                    type="checkbox"
                    checked={(form.member_ids || []).includes(item.id)}
                    onChange={() => toggleTaskMember(item.id)}
                  />
                  <span>{personName(item)}</span>
                  <small>{item.department || item.email}</small>
                </label>
              ))}
            </div>
            {!assignableProfiles.length && <p className="empty-state">Dự án này chưa có thành viên.</p>}
          </div>
        )}
        <label className="wide-field">Mô tả<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        <label className="wide-field">Checklist, mỗi dòng là một việc nhỏ<textarea value={form.checklist} onChange={(event) => setForm({ ...form, checklist: event.target.value })} /></label>
        <label className="wide-field">Ưu tiên<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="high">Cao</option><option value="medium">Trung bình</option><option value="low">Thấp</option></select></label>
        {error && <p className="form-error wide-field">{error}</p>}

        <button className="primary-action" disabled={creating} aria-busy={creating}>
          {creating ? <LoaderCircle className="spin-icon" size={17} /> : <Check size={17} />}
          {creating ? "Đang tạo..." : "Tạo task"}
        </button>
      </form>
    </Modal>
  );
}

function CreateUserModal({ roles, onCreate, onClose }) {
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyUserForm);

  function toggleRole(roleId) {
    setForm((current) => {
      const existing = current.role_ids || [];
      const next = existing.includes(roleId)
        ? existing.filter((item) => item !== roleId)
        : [...existing, roleId];
      return { ...current, role_ids: next.length ? next : ["staff"] };
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setError("");
    try {
      await onCreate({
        ...form,
        department: form.department || null,
        role_ids: form.role_ids?.length ? form.role_ids : ["staff"],
      });
      onClose();
    } catch (currentError) {
      setError(currentError.message);
    } finally {
      setCreating(false);
    }
  }
  return (
    <Modal title="Tạo nhân sự" onClose={onClose}>
      <form onSubmit={submit} className="modal-form">
        <label>Họ tên<input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} required /></label>
        <label>Email<input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} type="email" required /></label>
        <label>Mật khẩu tạm<input value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} type="password" minLength={6} required /></label>
        <label>Bộ phận<input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /></label>
        <div className="wide-field role-checkbox-panel compact-role-picker">
          <b>Role</b>
          <div className="role-checkbox-grid">
            {roles.map((item) => (
              <label key={item.id} className="check-row role-check-row">
                <input
                  type="checkbox"
                  checked={(form.role_ids || []).includes(item.id)}
                  onChange={() => toggleRole(item.id)}
                />
                <span>
                  <b>{item.name}</b>
                  <small>{item.description || "Không có mô tả"}</small>
                </span>
              </label>
            ))}
          </div>
        </div>
        {error && <p className="form-error wide-field">{error}</p>}

        <button className="primary-action" disabled={creating} aria-busy={creating}>
          {creating ? <LoaderCircle size={17} className="spin-icon" /> : <UsersRound size={17} />}
          {creating ? "Đang tạo..." : "Tạo nhân sự"}
        </button>
      </form>
    </Modal>
  );
}

function CreateProjectModal({ profiles, profile, onCreate, onClose }) {
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ ...emptyProjectForm, manager_id: profile?.id || "" });
  async function submit(event) {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setError("");
    try {
      await onCreate({
        ...form,
        description: form.description || null,
        manager_id: form.manager_id || profile.id,
        telegram_group_chat_id: form.telegram_group_chat_id || null,
        avatar_url: form.avatar_url || null,
      });
      onClose();
    } catch (currentError) {
      setError(currentError.message);
    } finally {
      setCreating(false);
    }
  }
  return (
    <Modal title="Tạo dự án" onClose={onClose}>
      <form onSubmit={submit} className="modal-form">
        <label>Tên dự án<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
        <label>Quản lý<select value={form.manager_id} onChange={(event) => setForm({ ...form, manager_id: event.target.value })}>{profiles.map((item) => <option key={item.id} value={item.id}>{personName(item)}</option>)}</select></label>
        <label>Telegram group chat ID<input value={form.telegram_group_chat_id} onChange={(event) => setForm({ ...form, telegram_group_chat_id: event.target.value })} placeholder="-100..." /></label>
        <label>Avatar dự án<input value={form.avatar_url} onChange={(event) => setForm({ ...form, avatar_url: event.target.value })} placeholder="https://.../project-avatar.png" /></label>
        <label className="wide-field">Mô tả<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        {error && <p className="form-error wide-field">{error}</p>}

        <button className="primary-action" disabled={creating} aria-busy={creating}>
          {creating ? <LoaderCircle size={17} className="spin-icon" /> : <FolderKanban size={17} />}
          {creating ? "Đang tạo..." : "Tạo dự án"}
        </button>
      </form>
    </Modal>
  );
}

function getInitialTheme() {
  try {
    const storedTheme = localStorage.getItem("checklist-theme");
    return ["dark", "purple", "light"].includes(storedTheme) ? storedTheme : "dark";
  } catch {
    return "dark";
  }
}

function persistTheme(theme) {
  try {
    localStorage.setItem("checklist-theme", theme);
  } catch {
    // Theme persistence is optional; rendering should not depend on browser storage.
  }
}

function AppShell() {
  const [theme, setTheme] = useState(getInitialTheme);
  const [activePage, setActivePage] = useState("tasks");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getInitialSidebarCollapsed);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [roles, setRoles] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [dailyTemplates, setDailyTemplates] = useState([]);
  const [comments, setComments] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [modal, setModal] = useState(null);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ project_id: "", assignee_id: "", status: "", priority: "" });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    persistTheme(theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => {
      if (current === "dark") return "purple";
      if (current === "purple") return "light";
      return "dark";
    });
  }

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((current) => {
      const next = !current;
      persistSidebarCollapsed(next);
      return next;
    });
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => Boolean(value)));
      const me = await api("/api/me");
      const canSeeSummary = ["admin", "manager"].includes(me.profile?.role);
      const [profileRows, roleRows, projectRows, taskRows] = await Promise.all([
        api(canSeeSummary ? "/api/profiles/summary" : "/api/profiles"),
        api("/api/roles").catch(() => []),
        api("/api/projects"),
        api(`/api/tasks${params.toString() ? `?${params}` : ""}`),
      ]);
      setProfile(me.profile);
      setProfiles(profileRows);
      setRoles(roleRows);
      setProjects(projectRows);
      setTasks(taskRows);
      setLoading(false);

      Promise.all([
        api("/api/notifications").catch(() => []),
        api("/api/daily-templates").catch(() => []),
      ]).then(([notificationRows, dailyTemplateRows]) => {
        setNotifications(notificationRows);
        setDailyTemplates(dailyTemplateRows);
      }).catch(() => {
        // Secondary data should not block the first usable screen.
      });
    } catch (currentError) {
      setError(currentError.message);
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedTask) return;
    const updated = tasks.find((task) => task.id === selectedTask.id);
    if (updated && updated !== selectedTask) setSelectedTask(updated);
  }, [tasks, selectedTask]);

  async function openTask(task) {
    setSelectedTask(task);
    setComments(await api(`/api/tasks/${task.id}/comments`));
  }

  async function refreshTaskDrawer() {
    if (!selectedTask) return;
    await load();
    setComments(await api(`/api/tasks/${selectedTask.id}/comments`));
  }

  async function createTask(payload) {
    await api("/api/tasks", { method: "POST", body: JSON.stringify(payload) });
    await load();
  }

  async function createUser(payload) {
    await api("/api/profiles", { method: "POST", body: JSON.stringify(payload) });
    await load();
  }

  async function createProject(payload) {
    await api("/api/projects", { method: "POST", body: JSON.stringify(payload) });
    await load();
  }

  async function updateProject(projectId, payload) {
    await api(`/api/projects/${projectId}`, { method: "PATCH", body: JSON.stringify(payload) });
    await load();
  }

  async function updateUser(userId, patch) {
    await api(`/api/profiles/${userId}`, { method: "PATCH", body: JSON.stringify(patch) });
    await load();
  }

  async function saveTaskDetail(taskId, payload) {
    await api(`/api/tasks/${taskId}/detail`, { method: "PATCH", body: JSON.stringify(payload) });
    await refreshTaskDrawer();
  }

  async function createRole(payload) {
    await api("/api/roles", { method: "POST", body: JSON.stringify(payload) });
    await load();
  }

  async function updateRole(roleId, patch) {
    await api(`/api/roles/${roleId}`, { method: "PATCH", body: JSON.stringify(patch) });
    await load();
  }

  async function createDailyTemplate(payload) {
    await api("/api/daily-templates", { method: "POST", body: JSON.stringify(payload) });
    await load();
  }

  async function updateDailyTemplate(templateId, patch) {
    await api(`/api/daily-templates/${templateId}`, { method: "PATCH", body: JSON.stringify(patch) });
    await load();
  }

  async function runReminderSweepNow() {
    const result = await api("/api/reminders/run", { method: "POST" });
    await load();
    return result;
  }

  async function addComment(taskId, comment) {
    await api(`/api/tasks/${taskId}/comments`, { method: "POST", body: JSON.stringify({ comment }) });
  }

  async function addMember(payload) {
    await api(`/api/projects/${payload.project_id}/members`, {
      method: "POST",
      body: JSON.stringify({ user_id: payload.user_id, role_in_project: payload.role_in_project }),
    });
    await load();
  }

  async function removeMember(projectId, userId) {
    await api(`/api/projects/${projectId}/members/${userId}`, { method: "DELETE" });
    await load();
  }

  function renderPage() {
    if (activePage === "overview") {
      return <OverviewPage tasks={tasks} projects={projects} profiles={profiles} setActivePage={setActivePage} openTask={openTask} />;
    }
    if (activePage === "reports") {
      return <ReportsPage tasks={tasks} projects={projects} profiles={profiles} notifications={notifications} />;
    }
    if (activePage === "tasks") {
      return <TasksPage tasks={tasks} projects={projects} profiles={profiles} filters={filters} setFilters={setFilters} openTask={openTask} openModal={setModal} profile={profile} />;
    }
    if (activePage === "people") {
      return <PeoplePage profiles={profiles} roles={roles} openModal={setModal} updateUser={updateUser} />;
    }
    if (activePage === "roles") {
      return <RolesPage roles={roles} profiles={profiles} createRole={createRole} updateRole={updateRole} />;
    }
    if (activePage === "projects") {
      return <ProjectsPage projects={projects} profiles={profiles} tasks={tasks} openModal={setModal} openTask={openTask} addMember={addMember} removeMember={removeMember} updateProject={updateProject} />;
    }
    if (activePage === "notifications") {
      return <NotificationsPage dailyTemplates={dailyTemplates} projects={projects} profiles={profiles} createDailyTemplate={createDailyTemplate} updateDailyTemplate={updateDailyTemplate} runReminderSweepNow={runReminderSweepNow} />;
    }
    return <SettingsPage profile={profile} tasks={tasks} onSaved={load} />;
  }

  return (
    <main className={`app-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        profile={profile}
        theme={theme}
        toggleTheme={toggleTheme}
        collapsed={sidebarCollapsed}
        toggleCollapsed={toggleSidebarCollapsed}
      />
      <section className="app-main">
        {activePage !== "tasks" && <Topbar activePage={activePage} profile={profile} loading={loading} onRefresh={load} openModal={setModal} theme={theme} toggleTheme={toggleTheme} />}
        {error && <div className="error-banner">{error}</div>}
        {renderPage()}
      </section>
      <TaskDrawer
        task={selectedTask}
        comments={comments}
        profiles={profiles}
        projects={projects}
        onClose={() => setSelectedTask(null)}
        onRefresh={refreshTaskDrawer}
        saveTaskDetail={saveTaskDetail}
        addComment={addComment}
      />
      {modal === "task" && <CreateTaskModal projects={projects} profiles={profiles} profile={profile} onCreate={createTask} onClose={() => setModal(null)} />}
      {modal === "user" && <CreateUserModal roles={roles} onCreate={createUser} onClose={() => setModal(null)} />}
      {modal === "project" && <CreateProjectModal profiles={profiles} profile={profile} onCreate={createProject} onClose={() => setModal(null)} />}
    </main>
  );
}

function Root() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  if (!ready) {
    return (
      <main className="loading-screen">
        <section className="loading-card">
          <LoaderCircle size={28} className="spin-icon" />
          <strong>Đang mở Checklist App</strong>
          <span>Đang kiểm tra phiên đăng nhập và chuẩn bị dữ liệu.</span>
        </section>
      </main>
    );
  }
  return session ? <AppShell /> : <Login />;
}

createRoot(document.getElementById("root")).render(<Root />);

