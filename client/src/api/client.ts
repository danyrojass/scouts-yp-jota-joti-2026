import { ApiRequestError } from "./types";
import type * as T from "./types";

const baseUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

let csrfToken: string | null = null;

async function fetchCsrf(): Promise<string> {
  const res = await fetch(`${baseUrl}/api/v1/auth/csrf`, {
    credentials: "include",
  });
  const data = (await res.json()) as { csrfToken: string };
  csrfToken = data.csrfToken;
  return csrfToken;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  retryOnCsrf = true
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (csrfToken && method !== "GET") headers["x-csrf-token"] = csrfToken;

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = data as T.ApiErrorBody;
    const message = err.error?.message ?? "Error del servidor";
    const code = err.error?.code ?? "UNKNOWN";
    if (code === "FORBIDDEN" && retryOnCsrf && !csrfToken) {
      await fetchCsrf();
      return request<T>(method, path, body, false);
    }
    throw new ApiRequestError(res.status, code, message, err.error?.details);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),

  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),

  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),

  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),

  del: <T>(path: string) => request<T>("DELETE", path),

  /** Fetches/refreshes the CSRF token after a login (session id is rotated). */
  refreshCsrf: fetchCsrf,
};

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

export async function login(username: string, password: string) {
  const result = await api.post<T.AuthResult>("/api/v1/auth/login", {
    username,
    password,
  });
  if (result.csrfToken) csrfToken = result.csrfToken;
  else await fetchCsrf();
  return result.principal;
}

export async function logout() {
  await api.post<{ ok: boolean }>("/api/v1/auth/logout");
  csrfToken = null;
}

export async function mePrincipal() {
  const result = await api.get<{ principal: T.Principal }>("/api/v1/auth/me");
  return result.principal;
}