/**
 * Mirrors the backend response contract (backend/src/shared/response.ts).
 * Keep in sync by hand for now; Phase 1 will evaluate a shared types package.
 */
export interface ErrorDetail {
  path?: string;
  message: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiFailure {
  success: false;
  error: { code: string; message: string; details?: ErrorDetail[]; requestId?: string };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type DatabaseStatus = "connected" | "connecting" | "disconnecting" | "disconnected";

export interface HealthReport {
  status: "ok";
  service: "hotel-platform-api";
  version: string;
  timestamp: string;
  database: DatabaseStatus;
}
