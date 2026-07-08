import { createTenetFetch, type TenetFetchOptions } from "./transport.js";

export { createTenetFetch, type TenetFetchOptions };

const DEFAULT_PROXY_URL = "https://inference.trytenet.ai";

interface WrapOptions {
  tenetKey: string;
  failover?: boolean;
  proxyUrl?: string;
  timeout?: number;
  sessionId?: string;
  sessionTags?: string[];
}

const sessionIds = new WeakMap<object, string>();
const sessionTagsMap = new WeakMap<object, string[]>();

export function wrap<T extends object>(client: T, opts: WrapOptions): T {
  const c = client as any;
  const originalFetch = c.fetch ?? c._fetch ?? globalThis.fetch;
  const originalBaseUrl = (c.baseURL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const proxyUrl = (opts.proxyUrl ?? DEFAULT_PROXY_URL).replace(/\/$/, "");

  const fallbackFetch = opts.failover !== false ? originalFetch : undefined;

  if (opts.sessionId) {
    sessionIds.set(client, opts.sessionId);
  }
  if (opts.sessionTags) {
    sessionTagsMap.set(client, opts.sessionTags);
  }

  const tenetFetch = createTenetFetch({
    innerFetch: originalFetch,
    tenetKey: opts.tenetKey,
    proxyUrl,
    originalBaseUrl,
    failover: opts.failover !== false,
    fallbackFetch,
    getSessionId: () => sessionIds.get(client),
    getSessionTags: () => sessionTagsMap.get(client),
  });

  c.fetch = tenetFetch;
  // Preserve the path from the original base URL (e.g. /v1)
  const originalPath = new URL(originalBaseUrl).pathname.replace(/\/$/, "");
  c.baseURL = proxyUrl + originalPath;

  return client;
}

export function setSessionId(client: object, sessionId: string) {
  sessionIds.set(client, sessionId);
}

export function clearSessionId(client: object) {
  sessionIds.delete(client);
}

export function setSessionTags(client: object, sessionTags: string[]) {
  sessionTagsMap.set(client, sessionTags);
}

export function clearSessionTags(client: object) {
  sessionTagsMap.delete(client);
}
