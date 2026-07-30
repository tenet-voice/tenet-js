import { z } from "zod";

export interface TenetFetchOptions {
  innerFetch: typeof fetch;
  tenetKey: string;
  proxyUrl: string;
  originalBaseUrl: string;
  failover: boolean;
  fallbackFetch?: typeof fetch;
  getSessionId?: () => string | undefined;
  getSessionTags?: () => string[] | undefined;
}

const fetchFunctionSchema = z.custom<typeof fetch>(
  (value) => typeof value === "function",
  "A fetch implementation is required",
);

const tenetFetchOptionsSchema = z.object({
  innerFetch: fetchFunctionSchema,
  tenetKey: z.string().trim().min(1, "tenetKey is required"),
  proxyUrl: z.string().url(),
  originalBaseUrl: z.string().url(),
  failover: z.boolean(),
  fallbackFetch: fetchFunctionSchema.optional(),
  getSessionId: z.custom<() => string | undefined>(
    (value) => typeof value === "function",
  ).optional(),
  getSessionTags: z.custom<() => string[] | undefined>(
    (value) => typeof value === "function",
  ).optional(),
}).strict();

export function createTenetFetch(opts: TenetFetchOptions): typeof fetch {
  const validated = tenetFetchOptionsSchema.parse(opts);
  const {
    innerFetch,
    tenetKey,
    proxyUrl,
    originalBaseUrl,
    failover,
    fallbackFetch,
    getSessionId,
    getSessionTags,
  } = validated;

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const originalUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    const parsedOriginal = new URL(originalUrl);
    const path = parsedOriginal.pathname;

    // The request already points at the proxy (baseURL was swapped).
    // Reconstruct the original provider URL by swapping the host back.
    const parsedOriginalBase = new URL(originalBaseUrl);
    const queryString = parsedOriginal.search;
    const providerUrl = `${parsedOriginalBase.protocol}//${parsedOriginalBase.host}${path}${queryString}`;

    const headers: Record<string, string> = {};
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v, k) => { headers[k] = v; });
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([k, v]) => { headers[k] = v; });
      } else {
        Object.assign(headers, init.headers);
      }
    }

    headers["X-Tenet-Key"] = tenetKey;
    headers["X-Provider-URL"] = providerUrl;

    const sessionId = getSessionId?.();
    if (sessionId) {
      headers["X-Tenet-Session-Id"] = sessionId;
    }

    const sessionTags = getSessionTags?.();
    if (sessionTags && sessionTags.length > 0) {
      headers["X-Tenet-Session-Tags"] = sessionTags.join(",");
    }

    try {
      const response = await innerFetch(originalUrl, { ...init, headers });

      if (response.status >= 500 && failover && fallbackFetch) {
        reportTelemetry(proxyUrl, tenetKey, `proxy returned ${response.status}`, sessionId);
        return fallbackFetch(providerUrl, init);
      }

      return response;
    } catch (err) {
      if (failover && fallbackFetch) {
        reportTelemetry(proxyUrl, tenetKey, String(err), sessionId);
        return fallbackFetch(providerUrl, init);
      }
      throw err;
    }
  };
}

function reportTelemetry(proxyUrl: string, tenetKey: string, error: string, sessionId?: string) {
  const body = JSON.stringify({
    type: "failover",
    timestamp: new Date().toISOString(),
    caller_id: sessionId ?? "",
    error,
  });

  fetch(`${proxyUrl}/v1/telemetry`, {
    method: "POST",
    headers: { "X-Tenet-Key": tenetKey, "Content-Type": "application/json" },
    body,
  }).catch(() => {});
}
