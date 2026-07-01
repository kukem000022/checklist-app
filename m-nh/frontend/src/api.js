import { supabase } from "./supabase";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3978";

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
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(formatApiError(payload));
  }

  return payload;
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
