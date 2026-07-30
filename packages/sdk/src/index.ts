import { z } from "zod";
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

const wrapOptionsSchema = z.object({
  tenetKey: z.string().trim().min(1, "tenetKey is required"),
  failover: z.boolean().optional(),
  proxyUrl: z.string().url().optional(),
  timeout: z.number().positive().optional(),
  sessionId: z.string().trim().min(1).optional(),
  sessionTags: z.array(z.string().trim().min(1)).optional(),
}).strict();

const sessionIdSchema = z.string().trim().min(1, "sessionId is required");
const sessionTagsSchema = z.array(z.string().trim().min(1));

const sessionIds = new WeakMap<object, string>();
const sessionTagsMap = new WeakMap<object, string[]>();

export function wrap<T extends object>(client: T, opts: WrapOptions): T {
  const validated = wrapOptionsSchema.parse(opts);
  const c = client as any;
  const originalFetch = c.fetch ?? c._fetch ?? globalThis.fetch;
  const originalBaseUrl = (c.baseURL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const proxyUrl = (validated.proxyUrl ?? DEFAULT_PROXY_URL).replace(/\/$/, "");

  const fallbackFetch = validated.failover !== false ? originalFetch : undefined;

  if (validated.sessionId) {
    sessionIds.set(client, validated.sessionId);
  }
  if (validated.sessionTags) {
    sessionTagsMap.set(client, validated.sessionTags);
  }

  const tenetFetch = createTenetFetch({
    innerFetch: originalFetch,
    tenetKey: validated.tenetKey,
    proxyUrl,
    originalBaseUrl,
    failover: validated.failover !== false,
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
  sessionIds.set(client, sessionIdSchema.parse(sessionId));
}

export function clearSessionId(client: object) {
  sessionIds.delete(client);
}

export function setSessionTags(client: object, sessionTags: string[]) {
  sessionTagsMap.set(client, sessionTagsSchema.parse(sessionTags));
}

export function clearSessionTags(client: object) {
  sessionTagsMap.delete(client);
}
