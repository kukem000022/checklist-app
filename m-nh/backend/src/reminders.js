import { admin } from "./supabase.js";
import { sendTelegramMessage } from "./telegram.js";
import { config } from "./config.js";

const reminderWindows = [
  { type: "due_soon_24h", fromMinutes: 23 * 60, toMinutes: 24 * 60 },
  { type: "due_soon_2h", fromMinutes: 90, toMinutes: 120 },
];

function formatDate(value) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function buildMessage(type, task) {
  const projectName = task.projects?.name || "Ca nhan";
  const assignee = task.assignee?.full_name || task.assignee?.email || "Nhan su";
  const title = type === "overdue" ? "TASK QUA HAN" : "TASK SAP TOI HAN";

  return [
    title,
    `Du an: ${projectName}`,
    `Nhan su: ${assignee}`,
    `Task: ${task.title}`,
    `Deadline: ${formatDate(task.due_time)}`,
    `Trang thai: ${task.status}`,
    type === "overdue"
      ? "Can cap nhat tien do trong he thong."
      : "Vui long kiem tra va hoan thanh dung han.",
  ].join("\n");
}

async function notificationExists(taskId, userId, type) {
  const { data, error } = await admin
    .from("task_notifications")
    .select("id")
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .eq("type", type)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function logNotification(taskId, userId, type, status) {
  const { error } = await admin.from("task_notifications").insert({
    task_id: taskId,
    user_id: userId,
    type,
    status,
  });

  if (error && error.code !== "23505") {
    throw error;
  }
}

function projectGroupChatId(task) {
  return task.projects?.telegram_group_chat_id || null;
}

async function getDefaultTelegramGroupChatId() {
  const { data, error } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "default_telegram_group_chat_id")
    .maybeSingle();

  if (error) {
    if (["42P01", "PGRST205"].includes(error.code)) return null;
    throw error;
  }

  return data?.value || null;
}

async function sendForTask(type, task, recipient, chatId) {
  if (await notificationExists(task.id, recipient.id, type)) {
    return;
  }

  const result = await sendTelegramMessage(chatId || recipient.telegram_chat_id, buildMessage(type, task));
  await logNotification(task.id, recipient.id, type, result.ok ? "sent" : result.skipped ? "skipped" : "failed");
}

function todayInVietnam() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function ensureDailyTasks() {
  const runDate = todayInVietnam();
  const { data: templates, error } = await admin
    .from("daily_task_templates")
    .select("*")
    .eq("active", true);

  if (error) throw error;

  let created = 0;
  for (const template of templates || []) {
    const { data: existing, error: existingError } = await admin
      .from("daily_task_instances")
      .select("task_id")
      .eq("template_id", template.id)
      .eq("run_date", runDate)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) continue;

    const dueTime = String(template.due_time || "17:00:00").slice(0, 8);
    const { data: task, error: taskError } = await admin
      .from("tasks")
      .insert({
        project_id: template.project_id || null,
        title: template.title,
        description: template.description || "Task dinh ky hang ngay.",
        creator_id: template.assignee_id,
        assignee_id: template.assignee_id,
        due_time: `${runDate}T${dueTime}+07:00`,
        priority: "medium",
        status: "todo",
      })
      .select()
      .single();

    if (taskError) throw taskError;

    if (template.checklist_items?.length) {
      const { error: checklistError } = await admin.from("task_checklists").insert(
        template.checklist_items.map((title, index) => ({
          task_id: task.id,
          title,
          assignee_id: template.assignee_id,
          due_time: `${runDate}T${dueTime}+07:00`,
          sort_order: index,
        })),
      );

      if (checklistError) throw checklistError;
    }

    const { error: instanceError } = await admin.from("daily_task_instances").insert({
      template_id: template.id,
      run_date: runDate,
      task_id: task.id,
    });

    if (instanceError && instanceError.code !== "23505") throw instanceError;
    created += 1;
  }

  return created;
}

export async function runReminderSweep() {
  const now = new Date();
  const maxDue = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const createdDailyTasks = await ensureDailyTasks();

  const { data: tasks, error } = await admin
    .from("tasks")
    .select(`
      *,
      projects(name, manager_id, telegram_group_chat_id),
      assignee:profiles!tasks_assignee_id_fkey(id, full_name, email, telegram_chat_id)
    `)
    .not("due_time", "is", null)
    .not("status", "in", '("done","cancelled")')
    .lte("due_time", maxDue.toISOString());

  if (error) {
    throw error;
  }

  const defaultGroupChatId = await getDefaultTelegramGroupChatId();

  for (const task of tasks || []) {
    const due = new Date(task.due_time);
    const minutesUntilDue = (due.getTime() - now.getTime()) / 60000;
    const groupChatId = projectGroupChatId(task) || defaultGroupChatId;

    for (const window of reminderWindows) {
      if (minutesUntilDue >= window.fromMinutes && minutesUntilDue <= window.toMinutes) {
        await sendForTask(window.type, task, task.assignee, groupChatId);
      }
    }

    if (minutesUntilDue < -config.overdueGraceMinutes) {
      await sendForTask("overdue", task, task.assignee, groupChatId);

      if (!groupChatId && task.projects?.manager_id && task.projects.manager_id !== task.assignee_id) {
        const { data: manager } = await admin
          .from("profiles")
          .select("id, full_name, email, telegram_chat_id")
          .eq("id", task.projects.manager_id)
          .maybeSingle();

        if (manager) {
          await sendForTask("overdue", task, manager);
        }
      }
    }
  }

  return { checked: tasks?.length || 0, createdDailyTasks };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runReminderSweep()
    .then((result) => {
      console.log(`Reminder sweep complete: ${result.checked} task(s) checked`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
