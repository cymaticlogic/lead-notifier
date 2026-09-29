const FIELD_ALIASES = {
  name: ["Name"],
  email: ["Email"],
  company: ["Company / Team"],
  problem: ["What is going wrong?"],
  stack: ["Current stack"],
  urgency: ["Deadline / urgency"],
  budget: ["Budget range"],
  access: ["What access is available?"],
};

export default {
  async fetch(request, env) {
    if (request.method === "GET") {
      return new Response("Cymatic Logic Lead Notifier", { status: 200 });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { Allow: "GET, POST" },
      });
    }

    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID || !env.TALLY_WEBHOOK_SECRET) {
      console.error("Missing required Worker secrets");
      return new Response("Server configuration error", { status: 500 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get("Tally-Signature");

    if (!signature || !(await verifyTallySignature(rawBody, signature, env.TALLY_WEBHOOK_SECRET))) {
      console.warn("Rejected webhook with invalid signature");
      return new Response("Invalid signature", { status: 401 });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    if (payload?.eventType !== "FORM_RESPONSE") {
      return new Response("Ignored event", { status: 200 });
    }

    const lead = extractLead(payload);
    const message = buildTelegramMessage(lead);

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: message,
          disable_web_page_preview: true,
        }),
      },
    );

    if (!telegramResponse.ok) {
      const responseText = await telegramResponse.text();
      console.error("Telegram sendMessage failed", telegramResponse.status, responseText);
      return new Response("Telegram delivery failed", { status: 502 });
    }

    return new Response("OK", { status: 200 });
  },
};

export async function verifyTallySignature(rawBody, receivedSignature, signingSecret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const expectedSignature = bytesToBase64(new Uint8Array(digest));

  return timingSafeStringEqual(expectedSignature, receivedSignature);
}

export function extractLead(payload) {
  const fields = Array.isArray(payload?.data?.fields) ? payload.data.fields : [];
  const values = new Map();

  for (const field of fields) {
    const label = typeof field?.label === "string" ? field.label.trim() : "";
    if (!label) continue;
    values.set(label, normalizeValue(field.value));
  }

  const pick = (aliases) => {
    for (const alias of aliases) {
      const value = values.get(alias);
      if (value) return value;
    }
    return "";
  };

  return {
    responseId: payload?.data?.responseId ?? "",
    name: pick(FIELD_ALIASES.name),
    email: pick(FIELD_ALIASES.email),
    company: pick(FIELD_ALIASES.company),
    problem: pick(FIELD_ALIASES.problem),
    stack: pick(FIELD_ALIASES.stack),
    urgency: pick(FIELD_ALIASES.urgency),
    budget: pick(FIELD_ALIASES.budget),
    access: pick(FIELD_ALIASES.access),
  };
}

export function buildTelegramMessage(lead) {
  const identity = [lead.name, lead.company].filter(Boolean).join(" · ") || "Unknown contact";

  const lines = [
    "🚨 New Cymatic Logic Lead",
    "",
    identity,
  ];

  if (lead.email) lines.push(lead.email);
  if (lead.budget) lines.push(`Budget: ${lead.budget}`);
  if (lead.urgency) lines.push(`Urgency: ${lead.urgency}`);

  if (lead.problem) {
    lines.push("", "Problem:", truncate(lead.problem, 700));
  }

  if (lead.stack) {
    lines.push("", "Stack:", truncate(lead.stack, 400));
  }

  if (lead.access) {
    lines.push("", `Access: ${truncate(lead.access, 300)}`);
  }

  if (lead.responseId) {
    lines.push("", `Tally response: ${lead.responseId}`);
  }

  lines.push("", "Full details: Tally / Discord");

  return lines.join("\n");
}

export function normalizeValue(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(normalizeValue).filter(Boolean).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).trim();
}

function truncate(value, maxLength) {
  if (!value || value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function timingSafeStringEqual(a, b) {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;

  let diff = 0;
  for (let i = 0; i < aBytes.length; i += 1) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}
