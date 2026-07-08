import { describe, it, expect, vi, beforeEach } from "vitest";
import { wrap, setSessionId, clearSessionId, setSessionTags, clearSessionTags, createTenetFetch } from "../src/index.js";

function mockFetch(status = 200, body: any = { choices: [{ message: { content: "Hi" } }] }) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  }));
}

describe("createTenetFetch", () => {
  it("rewrites URL to proxy", async () => {
    const inner = mockFetch();
    const fetch = createTenetFetch({
      innerFetch: inner,
      tenetKey: "tk_xxx",
      proxyUrl: "https://inference.trytenet.ai",
      originalBaseUrl: "https://api.openai.com/v1",
      failover: false,
    });

    // After wrap(), the OpenAI client sends to the proxy URL (baseURL was swapped)
    await fetch("https://inference.trytenet.ai/v1/chat/completions", { method: "POST", body: "{}" });

    const calledUrl = inner.mock.calls[0][0];
    expect(calledUrl).toBe("https://inference.trytenet.ai/v1/chat/completions");
  });

  it("injects X-Tenet-Key header", async () => {
    const inner = mockFetch();
    const fetch = createTenetFetch({
      innerFetch: inner,
      tenetKey: "tk_xxx",
      proxyUrl: "https://inference.trytenet.ai",
      originalBaseUrl: "https://api.openai.com/v1",
      failover: false,
    });

    await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      body: "{}",
      headers: { "Authorization": "Bearer sk_xxx" },
    });

    const headers = inner.mock.calls[0][1].headers;
    expect(headers["X-Tenet-Key"]).toBe("tk_xxx");
  });

  it("preserves Authorization header", async () => {
    const inner = mockFetch();
    const fetch = createTenetFetch({
      innerFetch: inner,
      tenetKey: "tk_xxx",
      proxyUrl: "https://inference.trytenet.ai",
      originalBaseUrl: "https://api.openai.com/v1",
      failover: false,
    });

    await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      body: "{}",
      headers: { "Authorization": "Bearer sk_provider" },
    });

    const headers = inner.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBe("Bearer sk_provider");
  });

  it("injects X-Provider-URL header", async () => {
    const inner = mockFetch();
    const fetch = createTenetFetch({
      innerFetch: inner,
      tenetKey: "tk_xxx",
      proxyUrl: "https://inference.trytenet.ai",
      originalBaseUrl: "https://api.groq.com/openai/v1",
      failover: false,
    });

    await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      body: "{}",
    });

    const headers = inner.mock.calls[0][1].headers;
    expect(headers["X-Provider-URL"]).toBe("https://api.groq.com/openai/v1/chat/completions");
  });

  it("injects X-Tenet-Session-Id when set", async () => {
    const inner = mockFetch();
    const state = { sessionId: "caller_123" };
    const fetch = createTenetFetch({
      innerFetch: inner,
      tenetKey: "tk_xxx",
      proxyUrl: "https://inference.trytenet.ai",
      originalBaseUrl: "https://api.openai.com/v1",
      failover: false,
      getSessionId: () => state.sessionId,
    });

    await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", body: "{}" });

    const headers = inner.mock.calls[0][1].headers;
    expect(headers["X-Tenet-Session-Id"]).toBe("caller_123");
  });

  it("omits X-Tenet-Session-Id when not set", async () => {
    const inner = mockFetch();
    const fetch = createTenetFetch({
      innerFetch: inner,
      tenetKey: "tk_xxx",
      proxyUrl: "https://inference.trytenet.ai",
      originalBaseUrl: "https://api.openai.com/v1",
      failover: false,
    });

    await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", body: "{}" });

    const headers = inner.mock.calls[0][1].headers;
    expect(headers["X-Tenet-Session-Id"]).toBeUndefined();
  });

  it("injects X-Tenet-Session-Tags joined by comma when set", async () => {
    const inner = mockFetch();
    const state = { sessionTags: ["beta", "internal"] };
    const fetch = createTenetFetch({
      innerFetch: inner,
      tenetKey: "tk_xxx",
      proxyUrl: "https://inference.trytenet.ai",
      originalBaseUrl: "https://api.openai.com/v1",
      failover: false,
      getSessionTags: () => state.sessionTags,
    });

    await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", body: "{}" });

    const headers = inner.mock.calls[0][1].headers;
    expect(headers["X-Tenet-Session-Tags"]).toBe("beta,internal");
  });

  it("omits X-Tenet-Session-Tags when not set", async () => {
    const inner = mockFetch();
    const fetch = createTenetFetch({
      innerFetch: inner,
      tenetKey: "tk_xxx",
      proxyUrl: "https://inference.trytenet.ai",
      originalBaseUrl: "https://api.openai.com/v1",
      failover: false,
    });

    await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", body: "{}" });

    const headers = inner.mock.calls[0][1].headers;
    expect(headers["X-Tenet-Session-Tags"]).toBeUndefined();
  });

  it("falls back on 5xx when failover enabled", async () => {
    const proxyFetch = mockFetch(502);
    const fallbackFetch = mockFetch(200);
    const fetch = createTenetFetch({
      innerFetch: proxyFetch,
      tenetKey: "tk_xxx",
      proxyUrl: "https://inference.trytenet.ai",
      originalBaseUrl: "https://api.openai.com/v1",
      failover: true,
      fallbackFetch: fallbackFetch,
    });

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      body: "{}",
      headers: { "Authorization": "Bearer sk_xxx" },
    });

    expect(resp.status).toBe(200);
    expect(fallbackFetch).toHaveBeenCalled();
    const fallbackUrl = fallbackFetch.mock.calls[0][0];
    expect(fallbackUrl).toBe("https://api.openai.com/v1/chat/completions");
  });

  it("does not fall back on 4xx", async () => {
    const proxyFetch = mockFetch(401);
    const fallbackFetch = mockFetch(200);
    const fetch = createTenetFetch({
      innerFetch: proxyFetch,
      tenetKey: "tk_xxx",
      proxyUrl: "https://inference.trytenet.ai",
      originalBaseUrl: "https://api.openai.com/v1",
      failover: true,
      fallbackFetch: fallbackFetch,
    });

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      body: "{}",
      headers: { "Authorization": "Bearer sk_xxx" },
    });

    expect(resp.status).toBe(401);
    expect(fallbackFetch).not.toHaveBeenCalled();
  });

  it("does not fall back when failover disabled", async () => {
    const proxyFetch = mockFetch(502);
    const fetch = createTenetFetch({
      innerFetch: proxyFetch,
      tenetKey: "tk_xxx",
      proxyUrl: "https://inference.trytenet.ai",
      originalBaseUrl: "https://api.openai.com/v1",
      failover: false,
    });

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      body: "{}",
    });

    expect(resp.status).toBe(502);
  });
});
