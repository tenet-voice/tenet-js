export interface TenetFetchOptions {
  innerFetch: typeof fetch;
  tenetKey: string;
  proxyUrl: string;
  originalBaseUrl: string;
  failover: boolean;
  fallbackFetch?: typeof fetch;
  getCallerId?: () => string | undefined;
}

export function createTenetFetch(opts: TenetFetchOptions): typeof fetch {
  const {
    innerFetch,
    tenetKey,
    proxyUrl,
    originalBaseUrl,
    failover,
    fallbackFetch,
    getCallerId,
  } = opts;

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const originalUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    const path = new URL(originalUrl).pathname;
    const proxyTarget = proxyUrl + path;

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
    headers["X-Provider-URL"] = originalUrl;

    const callerId = getCallerId?.();
    if (callerId) {
      headers["X-Caller-ID"] = callerId;
    }

    try {
      const response = await innerFetch(proxyTarget, { ...init, headers });

      if (response.status >= 500 && failover && fallbackFetch) {
        reportTelemetry(proxyUrl, tenetKey, `proxy returned ${response.status}`, callerId);
        return fallbackFetch(originalUrl, init);
      }

      return response;
    } catch (err) {
      if (failover && fallbackFetch) {
        reportTelemetry(proxyUrl, tenetKey, String(err), callerId);
        return fallbackFetch(originalUrl, init);
      }
      throw err;
    }
  };
}

function reportTelemetry(proxyUrl: string, tenetKey: string, error: string, callerId?: string) {
  const body = JSON.stringify({
    type: "failover",
    timestamp: new Date().toISOString(),
    caller_id: callerId ?? "",
    error,
  });

  fetch(`${proxyUrl}/v1/telemetry`, {
    method: "POST",
    headers: { "X-Tenet-Key": tenetKey, "Content-Type": "application/json" },
    body,
  }).catch(() => {});
}
