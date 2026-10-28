import type { ApiResponse, ErrorDetail } from "@/types/api";
import { getAccessToken } from "./tokenStore";

/**
 * API base. Default is same-origin `/api/v1` (Vite proxy in development, a host rewrite in
 * production) so refresh-token cookies are first-party. Set VITE_API_URL to call a different origin.
 * Auth tokens are never stored in localStorage/sessionStorage (Phase 1 uses HttpOnly cookies).
 */
export const API_BASE_URL: string = (import.meta.env["VITE_API_URL"] as string | undefined)?.replace(/\/+$/, "") || "/api/v1";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: ErrorDetail[],
    public readonly requestId?: string
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isNetworkError(): boolean {
    return this.code === "NETWORK_ERROR";
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  /** Internal: set by the 401 retry so we never loop. */
  retried?: boolean;
  /** Return { items, meta } so list screens get the pagination totals. */
  withMeta?: boolean;
}

/** Registered by services/session.ts: asks the server for a new access token using the refresh cookie. Resolves true on success. */
let refreshHandler: (() => Promise<boolean>) | null = null;
export const setRefreshHandler = (fn: (() => Promise<boolean>) | null): void => {
  refreshHandler = fn;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal } = options;
  const token = getAccessToken();
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: "include",
      headers: {
        Accept: "application/json",
        // For uploads the browser must set the multipart boundary itself.
        ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: isForm ? (body as FormData) : JSON.stringify(body) } : {}),
      ...(signal ? { signal } : {}),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK_ERROR", "We couldn't reach the server. Check your connection and try again.");
  }

  let payload: ApiResponse<T> | undefined;
  try {
    payload = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(res.status, "INVALID_RESPONSE", "The server sent an unexpected response.");
  }

  // An expired access token is invisible to the user: refresh once (shared across concurrent calls) and retry.
  if (res.status === 401 && token && !options.retried && !path.startsWith("/auth/") && refreshHandler && (await refreshHandler())) {
    return apiRequest<T>(path, { ...options, retried: true });
  }

  if (payload && payload.success === true) return (options.withMeta ? { items: payload.data, meta: payload.meta } : payload.data) as T;
  if (payload && payload.success === false) {
    const { code, message, details, requestId } = payload.error;
    throw new ApiError(res.status, code, message, details, requestId);
  }
  throw new ApiError(res.status, "INVALID_RESPONSE", "The server sent an unexpected response.");
}


export interface PageMeta { total: number; page: number; limit: number; pages: number }

/** Same as apiRequest but also returns the pagination `meta` object. */
export const apiRequestPaged = <T>(path: string, options: RequestOptions = {}) => apiRequest<{ items: T; meta: PageMeta }>(path, { ...options, withMeta: true });
