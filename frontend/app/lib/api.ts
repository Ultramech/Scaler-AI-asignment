export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** A local API is either running or it isn't: there is no free-tier sleep to wait out, so don't wait long. */
export const IS_LOCAL_API = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(API_URL);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wakes a sleeping API (free hosting stops it when idle and the first request can take a minute) by polling
 * /health until it answers. `onSlow` fires if that takes more than a few seconds, so the UI can explain the wait.
 */
export async function wakeApi(onSlow?: () => void, maxMs = IS_LOCAL_API ? 4000 : 180_000): Promise<boolean> {
  const started = Date.now();
  const slowTimer = setTimeout(() => onSlow?.(), 3000);
  try {
    while (Date.now() - started < maxMs) {
      const controller = new AbortController();
      const abort = setTimeout(() => controller.abort(), 15_000);
      try {
        const response = await fetch(`${API_URL}/health`, { cache: "no-store", signal: controller.signal });
        if (response.ok) return true;
      } catch {
        /* still starting up */
      } finally {
        clearTimeout(abort);
      }
      await sleep(2000);
    }
    return false;
  } finally {
    clearTimeout(slowTimer);
  }
}

export class ApiError extends Error {
  status: number;
  /** Index of the offending item when a batch request is rejected. */
  index?: number;

  constructor(message: string, status: number, index?: number) {
    super(message);
    this.status = status;
    this.index = index;
  }
}

/** FastAPI reports errors as a string, a {message, index} object, or a list of validation issues. */
function describeError(detail: unknown): { message: string; index?: number } {
  if (typeof detail === "string") return { message: detail };
  if (Array.isArray(detail)) {
    const first = detail[0] as { loc?: unknown[]; msg?: string } | undefined;
    const field = first?.loc?.slice(1).join(".");
    return { message: first?.msg ? `${field ? field + ": " : ""}${first.msg}` : "The request was not valid." };
  }
  if (detail && typeof detail === "object" && "message" in detail) {
    const { message, index } = detail as { message: string; index?: number };
    return { message, index };
  }
  return { message: "Request failed" };
}

export type Api = ReturnType<typeof createApi>;

export function createApi(token: string | null, onUnauthorized: () => void) {
  /** Retries when the server is still starting (connection failure or a gateway error), up to three attempts. */
  async function raw(path: string, method = "GET", body?: unknown): Promise<Response> {
    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await fetch(API_URL + path, {
          method,
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch {
        response = null;
      }
      const starting = response === null || [502, 503, 504].includes(response.status);
      if (!starting) break;
      if (attempt < 2) await wakeApi(undefined, IS_LOCAL_API ? 2000 : 60_000);
    }
    if (!response) throw new ApiError(IS_LOCAL_API ? `Unable to reach the API at ${API_URL}. Start the backend (cd backend && uvicorn app.main:app --port 8000).` : "Unable to reach the Route 53 API. If it was idle, wait a few seconds and try again.", 0);
    if (response.status === 401) onUnauthorized();
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ detail: "Request failed" }));
      const { message, index } = describeError(payload.detail);
      throw new ApiError(message, response.status, index);
    }
    return response;
  }

  async function json<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    const response = await raw(path, method, body);
    return response.status === 204 ? (null as T) : response.json();
  }

  return {
    get: <T>(path: string) => json<T>(path),
    post: <T>(path: string, body?: unknown) => json<T>(path, "POST", body ?? {}),
    put: <T>(path: string, body?: unknown) => json<T>(path, "PUT", body ?? {}),
    patch: <T>(path: string, body?: unknown) => json<T>(path, "PATCH", body ?? {}),
    del: <T = null>(path: string, body?: unknown) => json<T>(path, "DELETE", body),
    text: async (path: string) => (await raw(path)).text(),
  };
}
