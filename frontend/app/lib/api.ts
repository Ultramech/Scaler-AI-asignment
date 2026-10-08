export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
  async function raw(path: string, method = "GET", body?: unknown): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(API_URL + path, {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError("Unable to reach the Route 53 API. Make sure the backend is running.", 0);
    }
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
