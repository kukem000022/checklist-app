import cors from "cors";
import express from "express";
import cron from "node-cron";
import { z } from "zod";
import { requireUser } from "./auth.js";
import { assertConfig, config } from "./config.js";
import { admin, getProfile } from "./supabase.js";
import { getTelegramChatIds, getTelegramUpdates, sendTelegramMessage } from "./telegram.js";
import { runReminderSweep } from "./reminders.js";

assertConfig();

const app = express();

app.use(cors({ origin: config.appOrigin.split(",").map((origin) => origin.trim()) }));
app.use(express.json());

const SYSTEM_ROLE_ORDER = ["admin", "manager", "staff"];

function primaryRole(roleIds = []) {
  return SYSTEM_ROLE_ORDER.find((role) => roleIds.includes(role)) || roleIds[0] || "staff";
}

function normalizeRoleIds(roleIds, fallback = "staff") {
  const values = Array.isArray(roleIds) ? roleIds : [fallback];
  return [...new Set(values.filter(Boolean))];
}

async function hydrateProfileRoles(profiles) {
  const rows = Array.isArray(profiles) ? profiles : [profiles];
  const ids = rows.map((profile) => profile.id).filter(Boolean);
  if (!ids.length) return profiles;

  const { data: profileRoles, error } = await admin
    .from("profile_roles")
    .select("user_id, role_id, app_roles(id, name, description, permissions, is_system)")
    .in("user_id", ids);

  if (error) throw error;

  const byUser = new Map();
  for (const row of profileRoles || []) {
    const role = row.app_roles || { id: row.role_id, name: row.role_id };
    byUser.set(row.user_id, [...(byUser.get(row.user_id) || []), role]);
  }

  const hydrated = rows.map((profile) => ({
    ...profile,
    roles: byUser.get(profile.id) || [{ id: profile.role, name: profile.role }],
    role_ids: (byUser.get(profile.id) || [{ id: profile.role }]).map((role) => role.id),
  }));

  return Array.isArray(profiles) ? hydrated : hydrated[0];
}

async function replaceProfileRoles(userId, roleIds) {
  const normalized = normalizeRoleIds(roleIds);
  const nextPrimaryRole = primaryRole(normalized);

  const { error: profileError } = await admin
    .from("profiles")
    .update({ role: nextPrimaryRole })
    .eq("id", userId);

  if (profileError) throw profileError;

  const { error: deleteError } = await admin.from("profile_roles").delete().eq("user_id", userId);
  if (deleteError) throw deleteError;

  if (normalized.length) {
    const { error: insertError } = await admin
      .from("profile_roles")
      .insert(normalized.map((roleId) => ({ user_id: userId, role_id: roleId })));

    if (insertError) throw insertError;
  }

  return nextPrimaryRole;
}

async function getAppSetting(key) {
  const { data, error } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    if (["42P01", "PGRST205"].includes(error.code)) return null;
    throw error;
  }

  return data?.value ?? null;
}

async function setAppSetting(key, value) {
  const { data, error } = await admin
    .from("app_settings")
    .upsert({ key, value }, { onConflict: "key" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function assertTaskMemberIds(projectId, memberIds = []) {
  const normalized = [...new Set((memberIds || []).filter(Boolean))];
  if (!normalized.length) return [];

  if (!projectId) {
    const error = new Error("Task cá nhân không hỗ trợ thêm thành viên xử lý");
    error.status = 400;
    throw error;
  }

  const { data, error } = await admin
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .in("user_id", normalized);

  if (error) throw error;

  const validIds = new Set((data || []).map((item) => item.user_id));
  const invalidIds = normalized.filter((id) => !validIds.has(id));
  if (invalidIds.length) {
    const error = new Error("Thành viên xử lý phải là thành viên của dự án");
    error.status = 400;
    throw error;
  }

  return normalized;
}

async function assertTaskListBelongsToProject(db, projectId, listId) {
  if (!listId) return;

  if (!projectId) {
    const error = new Error("Task list requires a project");
    error.status = 400;
    throw error;
  }

  const { data: list, error } = await db
    .from("task_lists")
    .select("id, project_id")
    .eq("id", listId)
    .single();

  if (error) throw error;

  if (list.project_id !== projectId) {
    const mismatch = new Error("Task list does not belong to selected project");
    mismatch.status = 400;
    throw mismatch;
  }
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "checklist-mvp-backend" });
});

app.use("/api", requireUser);

app.get("/api/me", async (req, res, next) => {
  try {
    const profile = await getProfile(req.user.id);
    res.json({ user: req.user, profile });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/me", async (req, res, next) => {
  try {
    const body = z
      .object({
        full_name: z.string().min(1).optional(),
        department: z.string().nullable().optional(),
        telegram_chat_id: z.string().nullable().optional(),
        avatar_url: z.string().url().nullable().optional(),
        avatar_path: z.string().nullable().optional(),
      })
      .parse(req.body);

    const { data, error } = await req.db
      .from("profiles")
      .update(body)
      .eq("id", req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.get("/api/settings", async (_req, res, next) => {
  try {
    res.json({
      default_telegram_group_chat_id: await getAppSetting("default_telegram_group_chat_id"),
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/settings", async (req, res, next) => {
  try {
    const actor = await getProfile(req.user.id);
    if (actor.role !== "admin") {
      return res.status(403).json({ error: "Only admin can update app settings" });
    }

    const body = z
      .object({
        default_telegram_group_chat_id: z.string().nullable().optional(),
      })
      .parse(req.body);

    await setAppSetting("default_telegram_group_chat_id", body.default_telegram_group_chat_id || null);

    res.json({
      default_telegram_group_chat_id: body.default_telegram_group_chat_id || null,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/profiles", async (req, res, next) => {
  try {
    const { data, error } = await req.db
      .from("profiles")
      .select("id, full_name, email, role, department, telegram_chat_id, avatar_url, avatar_path, status")
      .order("full_name");

    if (error) throw error;
    res.json(await hydrateProfileRoles(data));
  } catch (error) {
    next(error);
  }
});

app.get("/api/profiles/summary", async (req, res, next) => {
  try {
    const actor = await getProfile(req.user.id);
    if (!["admin", "manager"].includes(actor.role)) {
      return res.status(403).json({ error: "Only admin or manager can view user summaries" });
    }

    const { data: profiles, error: profileError } = await req.db
      .from("profiles")
      .select("id, full_name, email, role, department, telegram_chat_id, avatar_url, avatar_path, status")
      .order("full_name");

    if (profileError) throw profileError;

    const { data: tasks, error: taskError } = await req.db
      .from("tasks")
      .select("id, assignee_id, status, due_time, task_members(user_id)");

    if (taskError) throw taskError;

    const now = Date.now();
    const hydratedProfiles = await hydrateProfileRoles(profiles);

    const summary = hydratedProfiles.map((profile) => {
      const assigned = tasks.filter(
        (task) =>
          task.assignee_id === profile.id ||
          (task.task_members || []).some((member) => member.user_id === profile.id),
      );
      return {
        ...profile,
        task_total: assigned.length,
        task_open: assigned.filter((task) => !["done", "cancelled"].includes(task.status)).length,
        task_done: assigned.filter((task) => task.status === "done").length,
        task_overdue: assigned.filter(
          (task) =>
            task.due_time &&
            new Date(task.due_time).getTime() < now &&
            !["done", "cancelled"].includes(task.status),
        ).length,
      };
    });

    res.json(summary);
  } catch (error) {
    next(error);
  }
});

app.post("/api/profiles", async (req, res, next) => {
  try {
    const actor = await getProfile(req.user.id);
    if (actor.role !== "admin") {
      return res.status(403).json({ error: "Only admin can create users" });
    }

    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(6),
        full_name: z.string().min(1),
        department: z.string().nullable().optional(),
        role: z.enum(["admin", "manager", "staff"]).default("staff"),
        role_ids: z.array(z.string().min(1)).optional(),
        status: z.enum(["active", "inactive", "locked"]).default("active"),
      })
      .parse(req.body);

    const roleIds = normalizeRoleIds(body.role_ids, body.role);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        full_name: body.full_name,
      },
    });

    if (createError) throw createError;

    const { data, error } = await admin
      .from("profiles")
      .upsert({
        id: created.user.id,
        email: body.email,
        full_name: body.full_name,
        department: body.department || null,
        role: primaryRole(roleIds),
        status: body.status,
      })
      .select("id, full_name, email, role, department, telegram_chat_id, avatar_url, avatar_path, status")
      .single();

    if (error) throw error;
    await replaceProfileRoles(created.user.id, roleIds);
    res.status(201).json(await hydrateProfileRoles(data));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/profiles/:userId", async (req, res, next) => {
  try {
    const actor = await getProfile(req.user.id);
    if (actor.role !== "admin") {
      return res.status(403).json({ error: "Only admin can update user roles" });
    }

    const body = z
      .object({
        full_name: z.string().optional(),
        department: z.string().nullable().optional(),
        telegram_chat_id: z.string().nullable().optional(),
        avatar_url: z.string().url().nullable().optional(),
        avatar_path: z.string().nullable().optional(),
        role: z.enum(["admin", "manager", "staff"]).optional(),
        role_ids: z.array(z.string().min(1)).optional(),
        status: z.enum(["active", "inactive", "locked"]).optional(),
        password: z.string().min(6).optional(),
      })
      .parse(req.body);

    const { role_ids: roleIds, password, ...profilePatch } = body;

    if (roleIds) {
      profilePatch.role = await replaceProfileRoles(req.params.userId, roleIds);
    }

    if (password) {
      const { error: passwordError } = await admin.auth.admin.updateUserById(req.params.userId, { password });
      if (passwordError) throw passwordError;
    }

    const { data, error } = await admin
      .from("profiles")
      .update(profilePatch)
      .eq("id", req.params.userId)
      .select("id, full_name, email, role, department, telegram_chat_id, avatar_url, avatar_path, status")
      .single();

    if (error) throw error;
    res.json(await hydrateProfileRoles(data));
  } catch (error) {
    next(error);
  }
});

app.get("/api/roles", async (req, res, next) => {
  try {
    const { data, error } = await req.db
      .from("app_roles")
      .select("*")
      .order("is_system", { ascending: false })
      .order("name", { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.post("/api/roles", async (req, res, next) => {
  try {
    const actor = await getProfile(req.user.id);
    if (actor.role !== "admin") {
      return res.status(403).json({ error: "Only admin can create roles" });
    }

    const body = z
      .object({
        id: z.string().min(2).optional(),
        name: z.string().min(2),
        description: z.string().nullable().optional(),
        permissions: z.array(z.string()).default([]),
      })
      .parse(req.body);

    const roleId = body.id || body.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

    const { data, error } = await admin
      .from("app_roles")
      .insert({
        id: roleId,
        name: body.name,
        description: body.description || null,
        permissions: body.permissions,
        is_system: false,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/roles/:roleId", async (req, res, next) => {
  try {
    const actor = await getProfile(req.user.id);
    if (actor.role !== "admin") {
      return res.status(403).json({ error: "Only admin can update roles" });
    }

    if (req.params.roleId === "admin") {
      return res.status(403).json({ error: "Admin role cannot be changed" });
    }

    const body = z
      .object({
        name: z.string().min(2).optional(),
        description: z.string().nullable().optional(),
        permissions: z.array(z.string()).optional(),
      })
      .parse(req.body);

    const { data, error } = await admin
      .from("app_roles")
      .update(body)
      .eq("id", req.params.roleId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.get("/api/projects", async (req, res, next) => {
  try {
    const { data, error } = await req.db
      .from("projects")
      .select("*, project_members(user_id, role_in_project)")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects", async (req, res, next) => {
  try {
    const body = z
      .object({
        name: z.string().min(2),
        description: z.string().optional().nullable(),
        manager_id: z.string().uuid().optional().nullable(),
        telegram_group_chat_id: z.string().optional().nullable(),
        start_date: z.string().optional().nullable(),
        end_date: z.string().optional().nullable(),
      })
      .parse(req.body);

    const profile = await getProfile(req.user.id);
    const managerId = body.manager_id || req.user.id;

    if (!["admin", "manager"].includes(profile.role)) {
      return res.status(403).json({ error: "Only admin or manager can create projects" });
    }

    const { data: project, error } = await admin
      .from("projects")
      .insert({ ...body, manager_id: managerId })
      .select()
      .single();

    if (error) throw error;

    await admin.from("project_members").upsert({
      project_id: project.id,
      user_id: managerId,
      role_in_project: "manager",
    });

    await admin.from("task_lists").insert(
      ["Việc cần làm", "Đang xử lý", "Chờ phản hồi", "Hoàn thành"].map((title, index) => ({
        project_id: project.id,
        title,
        sort_order: index,
      })),
    );

    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/projects/:projectId", async (req, res, next) => {
  try {
    const body = z
      .object({
        name: z.string().min(2).optional(),
        description: z.string().optional().nullable(),
        manager_id: z.string().uuid().optional().nullable(),
        telegram_group_chat_id: z.string().optional().nullable(),
        start_date: z.string().optional().nullable(),
        end_date: z.string().optional().nullable(),
        status: z.enum(["planning", "active", "paused", "completed"]).optional(),
      })
      .parse(req.body);

    const { data, error } = await admin
      .from("projects")
      .update(body)
      .eq("id", req.params.projectId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.get("/api/task-lists", async (req, res, next) => {
  try {
    let query = req.db.from("task_lists").select("*").order("sort_order", { ascending: true });
    if (req.query.project_id) query = query.eq("project_id", req.query.project_id);

    const { data, error } = await query;

    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.post("/api/task-lists", async (req, res, next) => {
  try {
    const body = z
      .object({
        project_id: z.string().uuid(),
        title: z.string().min(2),
        sort_order: z.number().int().optional(),
      })
      .parse(req.body);

    const { data, error } = await req.db
      .from("task_lists")
      .insert(body)
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/task-lists/:listId", async (req, res, next) => {
  try {
    const body = z
      .object({
        title: z.string().min(2).optional(),
        sort_order: z.number().int().optional(),
      })
      .parse(req.body);

    const { data, error } = await req.db
      .from("task_lists")
      .update(body)
      .eq("id", req.params.listId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/task-lists/:listId", async (req, res, next) => {
  try {
    const { error } = await req.db.from("task_lists").delete().eq("id", req.params.listId);

    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects/:projectId/members", async (req, res, next) => {
  try {
    const body = z
      .object({
        user_id: z.string().uuid(),
        role_in_project: z.enum(["manager", "member"]).default("member"),
      })
      .parse(req.body);

    const { data, error } = await req.db
      .from("project_members")
      .upsert({ project_id: req.params.projectId, ...body })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/projects/:projectId/members/:userId", async (req, res, next) => {
  try {
    const { error } = await req.db
      .from("project_members")
      .delete()
      .eq("project_id", req.params.projectId)
      .eq("user_id", req.params.userId);

    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/tasks", async (req, res, next) => {
  try {
    let query = req.db
      .from("tasks")
      .select(`
        *,
        projects(id, name, telegram_group_chat_id),
        task_lists(id, title),
        assignee:profiles!tasks_assignee_id_fkey(id, full_name, email, avatar_url, avatar_path),
        creator:profiles!tasks_creator_id_fkey(id, full_name, email, avatar_url, avatar_path),
        task_members(user_id, profiles(id, full_name, email, avatar_url, avatar_path)),
        task_checklists(id, title, assignee_id, due_time, note, is_done, sort_order)
      `)
      .order("due_time", { ascending: true, nullsFirst: false });

    if (req.query.project_id) query = query.eq("project_id", req.query.project_id);
    if (req.query.assignee_id) query = query.eq("assignee_id", req.query.assignee_id);
    if (req.query.status) query = query.eq("status", req.query.status);
    if (req.query.priority) query = query.eq("priority", req.query.priority);

    const { data, error } = await query;

    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.get("/api/tasks/:taskId/comments", async (req, res, next) => {
  try {
    const { data, error } = await req.db
      .from("task_comments")
      .select("*, profiles(id, full_name, email, avatar_url, avatar_path)")
      .eq("task_id", req.params.taskId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.post("/api/tasks/:taskId/comments", async (req, res, next) => {
  try {
    const body = z.object({ comment: z.string().min(1) }).parse(req.body);

    const { data, error } = await req.db
      .from("task_comments")
      .insert({
        task_id: req.params.taskId,
        user_id: req.user.id,
        comment: body.comment,
      })
      .select("*, profiles(id, full_name, email, avatar_url, avatar_path)")
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

app.get("/api/notifications", async (req, res, next) => {
  try {
    const { data, error } = await req.db
      .from("task_notifications")
      .select("*, tasks(id, title, due_time, projects(id, name)), profiles(id, full_name, email, avatar_url, avatar_path)")
      .order("sent_at", { ascending: false })
      .limit(80);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.get("/api/daily-templates", async (req, res, next) => {
  try {
    const { data, error } = await req.db
      .from("daily_task_templates")
      .select("*, projects(id, name), assignee:profiles!daily_task_templates_assignee_id_fkey(id, full_name, email, avatar_url, avatar_path)")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.post("/api/daily-templates", async (req, res, next) => {
  try {
    const body = z
      .object({
        project_id: z.string().uuid().nullable().optional(),
        assignee_id: z.string().uuid(),
        title: z.string().min(2),
        description: z.string().nullable().optional(),
        due_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).default("17:00"),
        recurrence_type: z.enum(["daily", "monthly"]).default("daily"),
        monthly_day: z.number().int().min(1).max(31).nullable().optional(),
        checklist_items: z.array(z.string().min(1)).default([]),
        requires_note: z.boolean().default(true),
        active: z.boolean().default(true),
      })
      .parse(req.body);

    if (body.project_id) {
      await assertTaskMemberIds(body.project_id, [body.assignee_id]);
    }

    const { data, error } = await req.db
      .from("daily_task_templates")
      .insert({
        ...body,
        monthly_day: body.recurrence_type === "monthly" ? body.monthly_day || 1 : null,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/daily-templates/:templateId", async (req, res, next) => {
  try {
    const body = z
      .object({
        project_id: z.string().uuid().nullable().optional(),
        assignee_id: z.string().uuid().optional(),
        title: z.string().min(2).optional(),
        description: z.string().nullable().optional(),
        due_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
        recurrence_type: z.enum(["daily", "monthly"]).optional(),
        monthly_day: z.number().int().min(1).max(31).nullable().optional(),
        checklist_items: z.array(z.string().min(1)).optional(),
        requires_note: z.boolean().optional(),
        active: z.boolean().optional(),
      })
      .parse(req.body);

    const { data: currentTemplate, error: templateFetchError } = await req.db
      .from("daily_task_templates")
      .select("project_id, assignee_id, recurrence_type")
      .eq("id", req.params.templateId)
      .single();

    if (templateFetchError) throw templateFetchError;

    const nextProjectId = Object.prototype.hasOwnProperty.call(body, "project_id")
      ? body.project_id
      : currentTemplate.project_id;
    const nextAssigneeId = body.assignee_id || currentTemplate.assignee_id;

    if (nextProjectId) {
      await assertTaskMemberIds(nextProjectId, [nextAssigneeId]);
    }

    const patch = { ...body };
    const nextRecurrenceType = patch.recurrence_type || currentTemplate.recurrence_type || "daily";
    if (Object.prototype.hasOwnProperty.call(patch, "recurrence_type") || Object.prototype.hasOwnProperty.call(patch, "monthly_day")) {
      patch.monthly_day = nextRecurrenceType === "monthly" ? patch.monthly_day || 1 : null;
    }

    const { data, error } = await req.db
      .from("daily_task_templates")
      .update(patch)
      .eq("id", req.params.templateId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.post("/api/tasks", async (req, res, next) => {
  try {
    const body = z
      .object({
        project_id: z.string().uuid().optional().nullable(),
        list_id: z.string().uuid().optional().nullable(),
        title: z.string().min(2),
        description: z.string().optional().nullable(),
        assignee_id: z.string().uuid().optional(),
        start_time: z.string().optional().nullable(),
        due_time: z.string().optional().nullable(),
        priority: z.enum(["high", "medium", "low"]).default("medium"),
        checklist: z.array(z.string().min(1)).default([]),
        member_ids: z.array(z.string().uuid()).default([]),
      })
      .parse(req.body);

    const assigneeId = body.assignee_id || req.user.id;
    const { checklist, member_ids: memberIds, ...taskPayload } = body;
    if (body.project_id) {
      await assertTaskMemberIds(body.project_id, [assigneeId]);
    }
    const normalizedMemberIds = await assertTaskMemberIds(body.project_id, memberIds);
    await assertTaskListBelongsToProject(req.db, body.project_id, body.list_id);

    const { data: task, error } = await req.db
      .from("tasks")
      .insert({
        ...taskPayload,
        creator_id: req.user.id,
        assignee_id: assigneeId,
        status: "todo",
      })
      .select()
      .single();

    if (error) throw error;

    if (checklist.length) {
      const { error: checklistError } = await req.db.from("task_checklists").insert(
        checklist.map((title, index) => ({
          task_id: task.id,
          title,
          sort_order: index,
        })),
      );

      if (checklistError) throw checklistError;
    }

    if (normalizedMemberIds.length) {
      const { error: memberError } = await req.db.from("task_members").insert(
        normalizedMemberIds.map((userId) => ({
          task_id: task.id,
          user_id: userId,
        })),
      );

      if (memberError) throw memberError;
    }

    const { data: assignee } = await admin
      .from("profiles")
      .select("full_name, email, telegram_chat_id")
      .eq("id", assigneeId)
      .maybeSingle();

    const { data: taskMembers } = normalizedMemberIds.length
      ? await admin
          .from("profiles")
          .select("id, full_name, email, telegram_chat_id")
          .in("id", normalizedMemberIds)
      : { data: [] };

    const { data: project } = body.project_id
      ? await admin
          .from("projects")
          .select("name, telegram_group_chat_id")
          .eq("id", body.project_id)
          .maybeSingle()
      : { data: null };

    const defaultGroupChatId = await getAppSetting("default_telegram_group_chat_id");
    const targetGroupChatId = project?.telegram_group_chat_id || defaultGroupChatId;
    const recipients = [
      { id: assigneeId, ...assignee },
      ...(taskMembers || []).filter((member) => member.id !== assigneeId),
    ].filter((recipient) => recipient.id);
    const recipientNames = recipients
      .map((recipient) => recipient.full_name || recipient.email)
      .filter(Boolean)
      .join(", ");

    if (targetGroupChatId) {
      const result = await sendTelegramMessage(
        targetGroupChatId,
        [
          "TASK MOI",
          `Du an: ${project?.name || "Ca nhan"}`,
          `Nhan su: ${recipientNames || assignee?.full_name || assignee?.email || "Nhan su"}`,
          `Task: ${task.title}`,
          task.due_time ? `Deadline: ${task.due_time}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      );
      if (recipients.length) {
        await admin.from("task_notifications").insert(
          recipients.map((recipient) => ({
            task_id: task.id,
            user_id: recipient.id,
            type: "new_task",
            status: result.ok ? "sent" : "skipped",
          })),
        );
      }
    } else if (recipients.length) {
      for (const recipient of recipients) {
        const result = await sendTelegramMessage(
          recipient.telegram_chat_id,
          [
            "TASK MOI",
            `Du an: ${project?.name || "Ca nhan"}`,
            `Nhan su: ${recipient.full_name || recipient.email || "Nhan su"}`,
            `Task: ${task.title}`,
            task.due_time ? `Deadline: ${task.due_time}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        );
        await admin.from("task_notifications").insert({
          task_id: task.id,
          user_id: recipient.id,
          type: "new_task",
          status: result.ok ? "sent" : "skipped",
        });
      }
    }

    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/tasks/:taskId", async (req, res, next) => {
  try {
    const body = z
      .object({
        title: z.string().min(2).optional(),
        description: z.string().nullable().optional(),
        assignee_id: z.string().uuid().optional(),
        list_id: z.string().uuid().nullable().optional(),
        start_time: z.string().nullable().optional(),
        due_time: z.string().nullable().optional(),
        priority: z.enum(["high", "medium", "low"]).optional(),
        status: z.enum(["todo", "doing", "review", "done", "cancelled"]).optional(),
      })
      .parse(req.body);

    if (Object.prototype.hasOwnProperty.call(body, "list_id")) {
      const { data: currentTask, error: fetchError } = await req.db
        .from("tasks")
        .select("project_id")
        .eq("id", req.params.taskId)
        .single();

      if (fetchError) throw fetchError;
      await assertTaskListBelongsToProject(req.db, currentTask.project_id, body.list_id);
    }

    if (body.assignee_id) {
      const { data: currentTask, error: fetchError } = await req.db
        .from("tasks")
        .select("project_id")
        .eq("id", req.params.taskId)
        .single();

      if (fetchError) throw fetchError;
      if (currentTask.project_id) {
        await assertTaskMemberIds(currentTask.project_id, [body.assignee_id]);
      }
    }

    const { data, error } = await req.db
      .from("tasks")
      .update(body)
      .eq("id", req.params.taskId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/tasks/:taskId/detail", async (req, res, next) => {
  try {
    const body = z
      .object({
        task: z
          .object({
            title: z.string().min(2).optional(),
            description: z.string().nullable().optional(),
            assignee_id: z.string().uuid().optional(),
            start_time: z.string().nullable().optional(),
            due_time: z.string().nullable().optional(),
            priority: z.enum(["high", "medium", "low"]).optional(),
            status: z.enum(["todo", "doing", "review", "done", "cancelled"]).optional(),
          })
          .default({}),
        member_ids: z.array(z.string().uuid()).optional(),
        checklist: z
          .array(
            z.object({
              id: z.string().uuid().optional(),
              title: z.string().min(1),
              assignee_id: z.string().uuid().nullable().optional(),
              due_time: z.string().nullable().optional(),
              note: z.string().nullable().optional(),
              is_done: z.boolean().default(false),
              sort_order: z.number().int().default(0),
              deleted: z.boolean().optional(),
            }),
          )
          .default([]),
        completion_note: z.string().nullable().optional(),
      })
      .parse(req.body);

    const { data: currentTask, error: taskFetchError } = await req.db
      .from("tasks")
      .select("id, project_id, due_time, status")
      .eq("id", req.params.taskId)
      .single();

    if (taskFetchError) throw taskFetchError;

    if (body.task.assignee_id && currentTask.project_id) {
      await assertTaskMemberIds(currentTask.project_id, [body.task.assignee_id]);
    }

    if (currentTask.project_id) {
      const checklistAssigneeIds = body.checklist
        .filter((item) => !item.deleted && item.assignee_id)
        .map((item) => item.assignee_id);
      await assertTaskMemberIds(currentTask.project_id, checklistAssigneeIds);
    }

    const parentDue = body.task.due_time ?? currentTask.due_time;
    if (parentDue) {
      const parentDueTime = new Date(parentDue).getTime();
      const invalidChild = body.checklist.find(
        (item) => item.due_time && new Date(item.due_time).getTime() > parentDueTime,
      );
      if (invalidChild) {
        return res.status(400).json({ error: "Checklist deadline cannot be later than task deadline" });
      }
    }

    if (body.task.status === "cancelled" && !body.completion_note?.trim()) {
      return res.status(400).json({ error: "A note is required when cancelling an unfinished task" });
    }

    const taskPatch = { ...body.task };
    if (taskPatch.status === "done") taskPatch.completed_at = new Date().toISOString();
    if (taskPatch.status && taskPatch.status !== "done") taskPatch.completed_at = null;

    if (Object.keys(taskPatch).length) {
      const { error: taskError } = await req.db
        .from("tasks")
        .update(taskPatch)
        .eq("id", req.params.taskId);

      if (taskError) throw taskError;
    }

    if (body.member_ids) {
      const nextMemberIds = await assertTaskMemberIds(currentTask.project_id, body.member_ids);
      const { error: deleteMembersError } = await req.db
        .from("task_members")
        .delete()
        .eq("task_id", req.params.taskId);

      if (deleteMembersError) throw deleteMembersError;

      if (nextMemberIds.length) {
        const { error: insertMembersError } = await req.db.from("task_members").insert(
          nextMemberIds.map((userId) => ({
            task_id: req.params.taskId,
            user_id: userId,
          })),
        );

        if (insertMembersError) throw insertMembersError;
      }
    }

    const existingIds = body.checklist.filter((item) => item.id).map((item) => item.id);
    const deletedIds = body.checklist.filter((item) => item.id && item.deleted).map((item) => item.id);
    if (deletedIds.length) {
      const { error: deleteError } = await req.db.from("task_checklists").delete().in("id", deletedIds);
      if (deleteError) throw deleteError;
    }

    const upserts = body.checklist
      .filter((item) => !item.deleted)
      .map((item, index) => ({
        id: item.id,
        task_id: req.params.taskId,
        title: item.title,
        assignee_id: item.assignee_id || null,
        due_time: item.due_time || null,
        note: item.note || null,
        is_done: item.is_done,
        sort_order: item.sort_order ?? index,
      }));

    if (upserts.length) {
      const { error: upsertError } = await req.db
        .from("task_checklists")
        .upsert(upserts, { onConflict: "id" });

      if (upsertError) throw upsertError;
    }

    if (body.completion_note?.trim()) {
      const { error: noteError } = await req.db.from("task_comments").insert({
        task_id: req.params.taskId,
        user_id: req.user.id,
        comment: body.completion_note.trim(),
      });

      if (noteError) throw noteError;
    }

    const { count: checklistCount, error: countError } = await req.db
      .from("task_checklists")
      .select("id", { count: "exact", head: true })
      .eq("task_id", req.params.taskId);

    if (countError) throw countError;

    res.json({ ok: true, checklist_count: checklistCount || 0 });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/checklists/:itemId", async (req, res, next) => {
  try {
    const body = z
      .object({
        title: z.string().min(1).optional(),
        assignee_id: z.string().uuid().nullable().optional(),
        due_time: z.string().nullable().optional(),
        note: z.string().nullable().optional(),
        is_done: z.boolean().optional(),
      })
      .parse(req.body);

    const { data, error } = await req.db
      .from("task_checklists")
      .update(body)
      .eq("id", req.params.itemId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.post("/api/reminders/run", async (_req, res, next) => {
  try {
    const result = await runReminderSweep();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/telegram/updates", async (_req, res, next) => {
  try {
    res.json(await getTelegramUpdates());
  } catch (error) {
    next(error);
  }
});

app.get("/api/telegram/chat-ids", async (_req, res, next) => {
  try {
    res.json(await getTelegramChatIds());
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({
    error: error.message || "Internal server error",
    details: error.details,
  });
});

cron.schedule(config.reminderCron, () => {
  runReminderSweep().catch((error) => console.error("Reminder sweep failed", error));
});

app.listen(config.port, () => {
  console.log(`Checklist MVP backend running on http://localhost:${config.port}`);
});

