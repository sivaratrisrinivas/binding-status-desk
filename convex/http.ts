import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { inboundMessageDedupeId } from "./lib/inboundEvent";

const http = httpRouter();

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return new Response("ok", { status: 200 });
  }),
});

http.route({
  path: "/agentmail/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const raw = await request.text();
    const secret = process.env.AGENTMAIL_WEBHOOK_SECRET?.trim();
    if (!secret) {
      return new Response("webhook secret not configured", { status: 401 });
    }
    const ok = await verifySvix(
      secret,
      request.headers.get("svix-id"),
      request.headers.get("svix-timestamp"),
      raw,
      request.headers.get("svix-signature"),
    );
    if (!ok) {
      return new Response("invalid signature", { status: 401 });
    }

    let payload: {
      event_id?: string;
      eventId?: string;
      event_type?: string;
      eventType?: string;
      message?: {
        subject?: string;
        extracted_text?: string;
        extractedText?: string;
        text?: string;
        from?: string | string[];
        message_id?: string;
        messageId?: string;
      };
    };
    try {
      payload = JSON.parse(raw) as typeof payload;
    } catch {
      return new Response("invalid json", { status: 400 });
    }

    const eventType = payload.event_type ?? payload.eventType ?? "";
    if (eventType && !eventType.startsWith("message.received")) {
      return new Response("ignored", { status: 200 });
    }

    const message = payload.message;
    const eventId = inboundMessageDedupeId({
      messageId: message?.messageId,
      message_id: message?.message_id,
      eventId: payload.eventId,
      event_id: payload.event_id,
    });
    if (!eventId) {
      return new Response("missing event id", { status: 400 });
    }

    const from = Array.isArray(message?.from) ? message?.from[0] : message?.from;
    const text =
      message?.extracted_text ?? message?.extractedText ?? message?.text ?? raw;
    const subject = message?.subject;

    await ctx.runAction(internal.mail.ingestInbound, {
      eventId,
      subject,
      text,
      fromEmail: from,
    });

    return new Response("ok", { status: 200 });
  }),
});

async function verifySvix(
  secret: string,
  id: string | null,
  timestamp: string | null,
  body: string,
  signatureHeader: string | null,
): Promise<boolean> {
  if (!id || !timestamp || !signatureHeader) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 5 * 60) return false;

  const encoded = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let keyBytes: Uint8Array;
  try {
    keyBytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  } catch {
    keyBytes = new TextEncoder().encode(encoded);
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = new TextEncoder().encode(`${id}.${timestamp}.${body}`);
  const digest = await crypto.subtle.sign("HMAC", cryptoKey, signed);
  const expected = "v1," + bytesToBase64(new Uint8Array(digest));
  const candidates = signatureHeader.split(" ").map((part) => part.trim());
  return candidates.some((candidate) => timingSafeEqual(candidate, expected));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export default http;
