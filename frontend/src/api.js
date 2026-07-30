import { supabase } from "./supabase";

const primaryApiUrl = normalizeApiUrl(import.meta.env.VITE_API_URL || "http://localhost:3978");
const backupApiUrl = normalizeApiUrl(import.meta.env.VITE_API_BACKUP_URL);
const failoverStatuses = new Set([502, 503, 504]);
const backupPreferenceMs = 5 * 60 * 1000;
let preferBackupUntil = 0;

function normalizeApiUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function apiCandidates() {
  if (!backupApiUrl || backupApiUrl === primaryApiUrl) return [primaryApiUrl];
  return Date.now() < preferBackupUntil
    ? [backupApiUrl, primaryApiUrl]
    : [primaryApiUrl, backupApiUrl];
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

function formatApiError(payload) {
  const base = payload?.error || "Không thể kết nối API";
  const details = payload?.details;

  if (!details) return base;

  if (Array.isArray(details)) {
    return `${base}: ${details.map((item) => item.message || item.code || JSON.stringify(item)).join(", ")}`;
  }

  if (typeof details === "string") {
    return `${base}: ${details}`;
  }

  return `${base}: ${JSON.stringify(details)}`;
}

export async function api(path, options = {}) {
  const token = await getAccessToken();
  const method = String(options.method || "GET").toUpperCase();
  const candidates = apiCandidates();
  let lastNetworkError = null;

  for (let index = 0; index < candidates.length; index += 1) {
    const currentApiUrl = candidates[index];
    const hasFallback = index < candidates.length - 1;
    let response;

    try {
      response = await fetch(`${currentApiUrl}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch (currentError) {
      lastNetworkError = currentError;
      if (hasFallback && ["GET", "HEAD"].includes(method)) {
        if (currentApiUrl === primaryApiUrl) preferBackupUntil = Date.now() + backupPreferenceMs;
        continue;
      }
      throw currentError;
    }

    const payload = await response.json().catch(() => null);
    if (response.ok) {
      if (currentApiUrl === primaryApiUrl) preferBackupUntil = 0;
      return payload;
    }

    if (hasFallback && failoverStatuses.has(response.status)) {
      if (currentApiUrl === primaryApiUrl) preferBackupUntil = Date.now() + backupPreferenceMs;
      continue;
    }

    throw new Error(formatApiError(payload));
  }

  throw lastNetworkError || new Error("KhÃ´ng thá»ƒ káº¿t ná»‘i API");
}

export function toLocalInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

export function fromLocalInputValue(value) {
  return value ? new Date(value).toISOString() : null;
}
