import { createTenetFetch, type TenetFetchOptions } from "./transport.js";

export { createTenetFetch, type TenetFetchOptions };

const DEFAULT_PROXY_URL = "https://inference.trytenet.ai";

interface WrapOptions {
  tenetKey: string;
  failover?: boolean;
  proxyUrl?: string;
  timeout?: number;
}

const callerIds = new WeakMap<object, string>();

export function wrap<T extends object>(client: T, opts: WrapOptions): T {
  const c = client as any;
  const originalFetch = c._fetch ?? globalThis.fetch;
  const originalBaseUrl = (c.baseURL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const proxyUrl = (opts.proxyUrl ?? DEFAULT_PROXY_URL).replace(/\/$/, "");

  const fallbackFetch = opts.failover !== false ? originalFetch : undefined;

  const tenetFetch = createTenetFetch({
    innerFetch: originalFetch,
    tenetKey: opts.tenetKey,
    proxyUrl,
    originalBaseUrl,
    failover: opts.failover !== false,
    fallbackFetch,
    getCallerId: () => callerIds.get(client),
  });

  c._fetch = tenetFetch;
  c.baseURL = proxyUrl;

  return client;
}

export function setCallerId(client: object, callerId: string) {
  callerIds.set(client, callerId);
}

export function clearCallerId(client: object) {
  callerIds.delete(client);
}
