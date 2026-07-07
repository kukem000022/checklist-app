import { admin } from "./supabase.js";
import { sendTelegramMessage } from "./telegram.js";
import { sendZaloPush } from "./zalo.js";
import { config } from "./config.js";

const reminderWindows = [
  { type: "due_soon_24h", fromMinutes: 23 * 60, toMinutes: 24 * 60 },
  { type: "due_soon_2h", fromMinutes: 90, toMinutes: 120 },
];
const overdueRepeatMinutes = 30;
const defaultTemplateWeekdays = [1, 2, 3, 4, 5];
const cleanStatusLabels = {
  todo: "Chưa bắt đầu",
  doing: "Đang làm",
  done: "Hoàn thành",
  cancelled: "Đã hủy",
};
const statusLabels = {
  todo: "Chưa bắt đầu",
  doing: "Đang làm",
  done: "Hoàn thành",
  cancelled: "Đã hủy",
};

function formatDate(value) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function personLabel(profile) {
  return profile?.full_name || profile?.email || "Nhân sự";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function personMention(profile) {
  const chatId = String(profile?.telegram_chat_id || "").trim();
  const name = escapeHtml(personLabel(profile));
  if (/^-?\d+$/.test(chatId)) {
    return `<a href="tg://user?id=${chatId}">${name}</a>`;
  }
  if (/^@?[a-zA-Z0-9_]{5,32}$/.test(chatId)) {
    return escapeHtml(chatId.startsWith("@") ? chatId : `@${chatId}`);
  }
  return name;
}

function taskRecipients(task) {
  const recipients = new Map();
  if (task.assignee?.id) {
    recipients.set(task.assignee.id, task.assignee);
  }
  for (const member of task.task_members || []) {
    const profile = member.profiles;
    if (profile?.id) {
      recipients.set(profile.id, profile);
    }
  }
  return [...recipients.values()];
}

function buildMessage(type, task, recipients = []) {
  const projectName = escapeHtml(task.projects?.name || "Cá nhân");
  const assignee = recipients.length ? recipients.map(personMention).join(", ") : personMention(task.assignee);
  const title = type === "overdue" ? "⚠️ TASK QUÁ HẠN" : "⏰ TASK SẮP TỚI HẠN";

  return [
    `<b>${title}</b>`,
    `• <b>Dự án:</b> ${projectName}`,
    `• <b>Nhân sự:</b> ${assignee}`,
    `• <b>Task:</b> ${escapeHtml(task.title)}`,
    `• <b>Deadline:</b> ${formatDate(task.due_time)}`,
    `• <b>Trạng thái:</b> ${statusLabels[task.status] || task.status || "Chưa bắt đầu"}`,
    type === "overdue"
      ? "Task đã quá hạn. Vui lòng cập nhật tiến độ hoặc ghi chú lý do xử lý trễ."
      : "Vui lòng kiểm tra và hoàn thành đúng hạn.",
  ].join("\n");
}

function buildTelegramReminderMessage(type, task, recipients = []) {
  const projectName = escapeHtml(task.projects?.name || "Cá nhân");
  const assignee = recipients.length ? recipients.map(personMention).join(", ") : personMention(task.assignee);
  const title = type === "overdue" ? "⚠️ TASK QUÁ HẠN" : "⏰ TASK SẮP TỚI HẠN";

  return [
    `<b>${title}</b>`,
    `• <b>Dự án:</b> ${projectName}`,
    `• <b>Nhân sự:</b> ${assignee}`,
    `• <b>Task:</b> ${escapeHtml(task.title)}`,
    `• <b>Deadline:</b> ${formatDate(task.due_time)}`,
    `• <b>Trạng thái:</b> ${cleanStatusLabels[task.status] || task.status || "Chưa bắt đầu"}`,
    type === "overdue"
      ? "Task đã quá hạn. Vui lòng cập nhật tiến độ hoặc ghi chú lý do xử lý trễ."
      : "Vui lòng kiểm tra và hoàn thành đúng hạn.",
  ].join("\n");
}

function buildZaloReminderMessage(type, task, recipients = []) {
  const projectName = task.projects?.name || "Cá nhân";
  const assignee = recipients.length ? recipients.map(personLabel).join(", ") : personLabel(task.assignee);
  const title = type === "overdue" ? "⚠️ TASK QUÁ HẠN" : "⏰ TASK SẮP TỚI HẠN";

  return [
    title,
    `• Dự án: ${projectName}`,
    `• Nhân sự: ${assignee}`,
    `• Task: ${task.title}`,
    `• Deadline: ${formatDate(task.due_time)}`,
    `• Trạng thái: ${cleanStatusLabels[task.status] || task.status || "Chưa bắt đầu"}`,
    type === "overdue"
      ? "Task đã quá hạn. Vui lòng cập nhật tiến độ hoặc ghi chú lý do xử lý trễ."
      : "Vui lòng kiểm tra và hoàn thành đúng hạn.",
  ].join("\n");
}

async function notificationExists(taskId, userId, type) {
  const { data, error } = await admin
    .from("task_notifications")
    .select("id, sent_at")
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .eq("type", type)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) return false;
  if (type !== "overdue") return true;

  const lastSentAt = new Date(data.sent_at).getTime();
  if (Number.isNaN(lastSentAt)) return false;
  return Date.now() - lastSentAt < overdueRepeatMinutes * 60 * 1000;
}

async function logNotification(taskId, userId, type, status) {
  const { error } = await admin.from("task_notifications").insert({
    task_id: taskId,
    user_id: userId,
    type,
    status,
  });

  if (error?.code === "23505" && type === "overdue") {
    const { error: updateError } = await admin
      .from("task_notifications")
      .update({ status, sent_at: new Date().toISOString() })
      .eq("task_id", taskId)
      .eq("user_id", userId)
      .eq("type", type);

    if (updateError) throw updateError;
    return;
  }

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

async function getAppSettingValue(key) {
  const { data, error } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    if (["42P01", "PGRST205"].includes(error.code)) return null;
    throw error;
  }

  return data?.value || null;
}

async function getDefaultZaloTarget() {
  const [groupId, flowCode] = await Promise.all([
    getAppSettingValue("default_zalo_group_id"),
    getAppSettingValue("default_zalo_flow_code"),
  ]);

  if (groupId) return { groupId };
  if (flowCode) return { flowCode };
  return null;
}

function notificationStatus(...results) {
  const availableResults = results.filter(Boolean);
  if (availableResults.some((result) => result.ok)) return "sent";
  if (availableResults.length && availableResults.every((result) => result.skipped)) return "skipped";
  return "failed";
}

async function sendForTask(type, task, recipient, chatId) {
  if (await notificationExists(task.id, recipient.id, type)) {
    return;
  }

  const result = await sendTelegramMessage(
    chatId || recipient.telegram_chat_id,
    buildTelegramReminderMessage(type, task, [recipient]),
  );
  await logNotification(task.id, recipient.id, type, result.ok ? "sent" : result.skipped ? "skipped" : "failed");
}

async function sendReminder(type, task, recipients, groupChatId, zaloTarget) {
  const pendingRecipients = [];
  for (const recipient of recipients) {
    if (!(await notificationExists(task.id, recipient.id, type))) {
      pendingRecipients.push(recipient);
    }
  }

  if (!pendingRecipients.length) {
    return;
  }

  if (groupChatId || zaloTarget) {
    const telegramResult = groupChatId
      ? await sendTelegramMessage(groupChatId, buildTelegramReminderMessage(type, task, pendingRecipients))
      : null;
    const zaloResult = zaloTarget
      ? await sendZaloPush({ ...zaloTarget, message: buildZaloReminderMessage(type, task, pendingRecipients) })
      : null;
    const status = notificationStatus(telegramResult, zaloResult);
    for (const recipient of pendingRecipients) {
      await logNotification(task.id, recipient.id, type, status);
    }
    return;
  }

  for (const recipient of pendingRecipients) {
    await sendForTask(type, task, recipient);
  }
}

function todayInVietnam() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseDateParts(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return { year, month, day };
}

function toDateString(year, month, day) {
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function shiftWeekendToNextWorkday(value) {
  const { year, month, day } = parseDateParts(value);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  if (weekday === 6) date.setUTCDate(date.getUTCDate() + 2);
  if (weekday === 0) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function weekdayForDate(value) {
  const { year, month, day } = parseDateParts(value);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function templateRunsOnDate(template, currentDate) {
  const weekdays = Array.isArray(template.weekdays) && template.weekdays.length
    ? template.weekdays.map(Number)
    : defaultTemplateWeekdays;
  return weekdays.includes(weekdayForDate(currentDate));
}

function scheduledRunDateForTemplate(template, currentDate) {
  if ((template.recurrence_type || "daily") === "daily") {
    return templateRunsOnDate(template, currentDate) ? currentDate : null;
  }

  const { year, month } = parseDateParts(currentDate);
  const requestedDay = Math.min(Number(template.monthly_day || 1), daysInMonth(year, month));
  const scheduledDate = shiftWeekendToNextWorkday(toDateString(year, month, requestedDay));
  return scheduledDate === currentDate ? scheduledDate : null;
}

async function ensureDailyTasks() {
  const runDate = todayInVietnam();
  const { data: templates, error } = await admin
    .from("daily_task_templates")
    .select("*")
    .eq("active", true);

  if (error) throw error;

  const result = {
    runDate,
    totalTemplates: templates?.length || 0,
    created: 0,
    existing: 0,
    repaired: 0,
    details: [],
  };

  async function createTaskFromTemplate(template, mode, targetDate) {
    const dueTime = String(template.due_time || "17:00:00").slice(0, 8);
    const recurrenceLabel = (template.recurrence_type || "daily") === "monthly" ? "hằng tháng" : "hằng ngày";
    const { data: task, error: taskError } = await admin
      .from("tasks")
      .insert({
        project_id: template.project_id || null,
        title: template.title,
        description: template.description || `Task định kỳ ${recurrenceLabel}.`,
        creator_id: template.assignee_id,
        assignee_id: template.assignee_id,
        due_time: `${targetDate}T${dueTime}+07:00`,
        priority: "medium",
        status: "todo",
      })
      .select("id, title, due_time, status")
      .single();

    if (taskError) throw taskError;

    if (template.checklist_items?.length) {
      const { error: checklistError } = await admin.from("task_checklists").insert(
        template.checklist_items.map((title, index) => ({
          task_id: task.id,
          title,
          assignee_id: template.assignee_id,
          due_time: `${targetDate}T${dueTime}+07:00`,
          sort_order: index,
        })),
      );

      if (checklistError) throw checklistError;
    }

    const { error: instanceError } = await admin.from("daily_task_instances").insert({
      template_id: template.id,
      run_date: targetDate,
      task_id: task.id,
    });

    if (instanceError && instanceError.code !== "23505") throw instanceError;

    result[mode] += 1;
    result.details.push({
      template_id: template.id,
      template_title: template.title,
      task_id: task.id,
      task_title: task.title,
      due_time: task.due_time,
      status: mode === "repaired" ? "repaired" : "created",
    });
  }

  for (const template of templates || []) {
    const targetDate = scheduledRunDateForTemplate(template, runDate);
    if (!targetDate) {
      continue;
    }

    const { data: existing, error: existingError } = await admin
      .from("daily_task_instances")
      .select("task_id")
      .eq("template_id", template.id)
      .eq("run_date", targetDate)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) {
      const { data: task, error: taskLookupError } = await admin
        .from("tasks")
        .select("id, title, due_time, status")
        .eq("id", existing.task_id)
        .maybeSingle();

      if (taskLookupError) throw taskLookupError;

      if (task) {
        result.existing += 1;
        result.details.push({
          template_id: template.id,
          template_title: template.title,
          task_id: task.id,
          task_title: task.title,
          due_time: task.due_time,
          task_status: task.status,
          status: "existing",
        });
        continue;
      }

      await admin
        .from("daily_task_instances")
        .delete()
        .eq("template_id", template.id)
        .eq("run_date", targetDate);
      await createTaskFromTemplate(template, "repaired", targetDate);
      continue;
    }

    await createTaskFromTemplate(template, "created", targetDate);
  }

  return result;
}

async function promoteStartedTasks(now) {
  const { data, error } = await admin
    .from("tasks")
    .update({ status: "doing", updated_at: now.toISOString() })
    .eq("status", "todo")
    .not("start_time", "is", null)
    .lte("start_time", now.toISOString())
    .select("id");

  if (error) {
    throw error;
  }

  return data?.length || 0;
}

export async function runReminderSweep() {
  const now = new Date();
  const maxDue = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dailyTasks = await ensureDailyTasks();
  const promotedStartedTasks = await promoteStartedTasks(now);

  const { data: tasks, error } = await admin
    .from("tasks")
    .select(`
      *,
      projects(name, manager_id, telegram_group_chat_id),
      assignee:profiles!tasks_assignee_id_fkey(id, full_name, email, telegram_chat_id),
      task_members(user_id, profiles(id, full_name, email, telegram_chat_id))
    `)
    .not("due_time", "is", null)
    .not("status", "in", '("done","cancelled")')
    .lte("due_time", maxDue.toISOString());

  if (error) {
    throw error;
  }

  const defaultGroupChatId = await getDefaultTelegramGroupChatId();
  const defaultZaloTarget = await getDefaultZaloTarget();

  for (const task of tasks || []) {
    const due = new Date(task.due_time);
    const minutesUntilDue = (due.getTime() - now.getTime()) / 60000;
    const groupChatId = projectGroupChatId(task) || defaultGroupChatId;
    const recipients = taskRecipients(task);

    for (const window of reminderWindows) {
      if (minutesUntilDue >= window.fromMinutes && minutesUntilDue <= window.toMinutes) {
        await sendReminder(window.type, task, recipients, groupChatId, defaultZaloTarget);
      }
    }

    if (minutesUntilDue < -config.overdueGraceMinutes) {
      await sendReminder("overdue", task, recipients, groupChatId, defaultZaloTarget);

      if (
        !groupChatId &&
        task.projects?.manager_id &&
        !recipients.some((recipient) => recipient.id === task.projects.manager_id)
      ) {
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

  return {
    checked: tasks?.length || 0,
    createdDailyTasks: dailyTasks.created + dailyTasks.repaired,
    promotedStartedTasks,
    dailyTasks,
  };
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
