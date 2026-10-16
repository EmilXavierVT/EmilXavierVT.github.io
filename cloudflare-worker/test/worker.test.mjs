import assert from "node:assert/strict";
import test from "node:test";

import { handleRequest } from "../src/index.js";

const origin = "https://portfolio.example";
const baseEnv = {
  ALLOWED_ORIGINS: origin,
  DIFY_APP_API_KEY: "secret-test-key",
  DIFY_BASE_URL: "https://api.dify.test/v1"
};

const chatRequest = (body, requestOrigin = origin) =>
  new Request("https://worker.example/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: requestOrigin },
    body: JSON.stringify(body)
  });

test("rejects an unapproved browser origin", async () => {
  const response = await handleRequest(
    chatRequest({ message: "Hello", conversation_id: "", user: "portfolio_test-user" }, "https://bad.example"),
    baseEnv
  );
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
});

test("answers a valid CORS preflight", async () => {
  const request = new Request("https://worker.example/chat", { method: "OPTIONS", headers: { Origin: origin } });
  const response = await handleRequest(request, baseEnv);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
});

test("validates messages before contacting Dify", async () => {
  const response = await handleRequest(
    chatRequest({ message: " ", conversation_id: "", user: "portfolio_test-user" }),
    baseEnv
  );
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /1-2000/);
});

test("rejects a non-object JSON body", async () => {
  const request = new Request("https://worker.example/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: "null"
  });
  const response = await handleRequest(request, baseEnv);
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /JSON object/);
});

test("rate limits by anonymous browser user", async () => {
  const env = { ...baseEnv, CHAT_RATE_LIMITER: { limit: async () => ({ success: false }) } };
  const response = await handleRequest(
    chatRequest({ message: "Hello", conversation_id: "", user: "portfolio_test-user" }),
    env
  );
  assert.equal(response.status, 429);
});

test("streams Dify output without exposing the app key", async () => {
  const originalFetch = globalThis.fetch;
  let upstreamRequest;
  globalThis.fetch = async (url, init) => {
    upstreamRequest = { url, init };
    return new Response('data: {"event":"message","answer":"Hello"}\n\n', {
      headers: { "Content-Type": "text/event-stream" }
    });
  };

  try {
    const response = await handleRequest(
      chatRequest({ message: "Tell me about Docker", conversation_id: "abc-123", user: "portfolio_test-user" }),
      baseEnv
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
    assert.equal(await response.text(), 'data: {"event":"message","answer":"Hello"}\n\n');
    assert.equal(upstreamRequest.url, "https://api.dify.test/v1/chat-messages");
    assert.equal(upstreamRequest.init.headers.Authorization, "Bearer secret-test-key");
    assert.deepEqual(JSON.parse(upstreamRequest.init.body), {
      inputs: {},
      query: "Tell me about Docker",
      response_mode: "streaming",
      conversation_id: "abc-123",
      user: "portfolio_test-user"
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
