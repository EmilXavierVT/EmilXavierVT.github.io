const MAX_BODY_BYTES = 16 * 1024;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_CONVERSATION_ID_LENGTH = 128;
const USER_ID_PATTERN = /^[A-Za-z0-9._:-]{8,96}$/;
const CONVERSATION_ID_PATTERN = /^[A-Za-z0-9_-]*$/;

const securityHeaders = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff"
};

const allowedOrigins = (env) =>
  new Set(
    String(env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  );

const corsHeaders = (origin) => ({
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Max-Age": "86400",
  Vary: "Origin"
});

const jsonResponse = (payload, status, origin = "") =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...securityHeaders,
      ...(origin ? corsHeaders(origin) : {})
    }
  });

const getAllowedOrigin = (request, env) => {
  const origin = request.headers.get("Origin") || "";
  return allowedOrigins(env).has(origin) ? origin : "";
};

const normalizeBaseUrl = (value) => String(value || "https://api.dify.ai/v1").replace(/\/$/, "");

const parseChatRequest = async (request) => {
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_BODY_BYTES) throw new Error("Request body is too large.");

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    throw new Error("Request body is too large.");
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (_error) {
    throw new Error("Request body must be valid JSON.");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Request body must be a JSON object.");
  }

  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  const conversationId = typeof payload.conversation_id === "string" ? payload.conversation_id.trim() : "";
  const user = typeof payload.user === "string" ? payload.user.trim() : "";

  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message must contain 1-${MAX_MESSAGE_LENGTH} characters.`);
  }
  if (
    conversationId.length > MAX_CONVERSATION_ID_LENGTH ||
    !CONVERSATION_ID_PATTERN.test(conversationId)
  ) {
    throw new Error("Conversation ID is invalid.");
  }
  if (!USER_ID_PATTERN.test(user)) throw new Error("Anonymous user ID is invalid.");

  return { message, conversationId, user };
};

const handleChat = async (request, env, origin) => {
  let input;
  try {
    input = await parseChatRequest(request);
  } catch (error) {
    return jsonResponse({ error: error.message }, 400, origin);
  }

  if (!env.DIFY_APP_API_KEY) {
    return jsonResponse({ error: "The assistant is not configured." }, 503, origin);
  }

  if (env.CHAT_RATE_LIMITER) {
    const rateLimit = await env.CHAT_RATE_LIMITER.limit({ key: input.user });
    if (!rateLimit.success) {
      return jsonResponse({ error: "Too many questions. Please wait a moment." }, 429, origin);
    }
  }

  let upstream;
  try {
    upstream = await fetch(`${normalizeBaseUrl(env.DIFY_BASE_URL)}/chat-messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.DIFY_APP_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: {},
        query: input.message,
        response_mode: "streaming",
        conversation_id: input.conversationId,
        user: input.user
      })
    });
  } catch (_error) {
    return jsonResponse({ error: "The assistant service could not be reached." }, 502, origin);
  }

  if (!upstream.ok || !upstream.body) {
    const status = upstream.status === 429 ? 429 : 502;
    return jsonResponse({ error: "The assistant service rejected the request." }, status, origin);
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
      ...securityHeaders,
      ...corsHeaders(origin)
    }
  });
};

export const handleRequest = async (request, env) => {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/health") {
    return jsonResponse({ status: "ok", configured: Boolean(env.DIFY_APP_API_KEY) }, 200);
  }

  if (url.pathname !== "/chat") return jsonResponse({ error: "Not found." }, 404);

  const origin = getAllowedOrigin(request, env);
  if (!origin) return jsonResponse({ error: "Origin is not allowed." }, 403);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...securityHeaders, ...corsHeaders(origin) } });
  }
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405, origin);

  return handleChat(request, env, origin);
};

export default {
  fetch: handleRequest
};
