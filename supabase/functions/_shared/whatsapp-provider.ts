// supabase/functions/_shared/whatsapp-provider.ts
// T022 — provider abstraction: Meta Cloud API (default) or Twilio (fallback)

export type WhatsAppProvider = "meta_cloud" | "twilio";

export type SendTextArgs = {
  to_phone_e164: string;
  body: string;
};

export type SendTemplateArgs = {
  to_phone_e164: string;
  template_name: string;
  language_code: string;
  body_variables: string[];
  button_variables?: Record<string, string>;
};

export type SendResult =
  | { ok: true; provider_message_id: string }
  | { ok: false; error: string; permanent: boolean };

function getProvider(): WhatsAppProvider {
  return (Deno.env.get("WHATSAPP_PROVIDER") ?? "meta_cloud") as WhatsAppProvider;
}

async function sendViaMeta(args: SendTemplateArgs): Promise<SendResult> {
  const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  if (!phoneId || !token) {
    return { ok: false, error: "Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN", permanent: true };
  }
  const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to: args.to_phone_e164.replace(/^\+/, ""),
    type: "template",
    template: {
      name: args.template_name,
      language: { code: args.language_code },
      components: [
        {
          type: "body",
          parameters: args.body_variables.map((text) => ({ type: "text", text })),
        },
      ],
    },
  };
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    return {
      ok: false,
      error: `Meta ${resp.status}: ${text}`,
      permanent: resp.status === 400 || resp.status === 401 || resp.status === 403,
    };
  }
  const json = await resp.json() as { messages?: Array<{ id: string }> };
  return { ok: true, provider_message_id: json.messages?.[0]?.id ?? "unknown" };
}

async function sendViaTwilio(args: SendTemplateArgs): Promise<SendResult> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const auth = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_WHATSAPP_FROM");
  if (!sid || !auth || !from) {
    return { ok: false, error: "Missing Twilio env vars", permanent: true };
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const form = new URLSearchParams();
  form.set("To", `whatsapp:${args.to_phone_e164}`);
  form.set("From", `whatsapp:${from}`);
  form.set("Body", `${args.template_name} ${args.body_variables.join(" ")}`);
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${auth}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  if (!resp.ok) {
    return { ok: false, error: `Twilio ${resp.status}`, permanent: false };
  }
  const json = await resp.json() as { sid?: string };
  return { ok: true, provider_message_id: json.sid ?? "unknown" };
}

export async function sendTemplate(args: SendTemplateArgs): Promise<SendResult> {
  if (getProvider() === "twilio") return sendViaTwilio(args);
  return sendViaMeta(args);
}

export async function sendText(args: SendTextArgs): Promise<SendResult> {
  // For non-template replies only; the AI Coach only sends templates by default.
  return sendTemplate({
    to_phone_e164: args.to_phone_e164,
    template_name: "fallback_text",
    language_code: "en",
    body_variables: [args.body],
  });
}

export function verifyWebhookMeta(mode: string, token: string, challenge: string): string | null {
  if (mode !== "subscribe") return null;
  if (token !== Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN")) return null;
  return challenge;
}
