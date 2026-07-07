import { config } from "./config.js";

export async function sendZaloPush({ groupId, flowCode, message }) {
  const targetGroupId = String(groupId || "").trim();
  const targetFlowCode = String(flowCode || "").trim();

  if (!config.zaloPushUrl) {
    return { ok: false, skipped: true, description: "Missing ZALO_PUSH_URL" };
  }

  if (!config.zaloPushApiToken) {
    return { ok: false, skipped: true, description: "Missing ZALO_PUSH_API_TOKEN" };
  }

  if (!targetGroupId && !targetFlowCode) {
    return { ok: false, skipped: true, description: "Missing Zalo groupId or flowCode" };
  }

  const response = await fetch(config.zaloPushUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.zaloPushApiToken}`,
    },
    body: JSON.stringify({
      ...(targetGroupId ? { groupId: targetGroupId } : { flowCode: targetFlowCode }),
      message,
    }),
  });

  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { description: text };
    }
  }

  return {
    ok: response.ok && data.ok !== false,
    status: response.status,
    ...data,
  };
}
