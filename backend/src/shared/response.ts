import type { Response } from "express";
import type { ErrorDetail } from "./errors.js";

/** The API response contract: every response is one of these two shapes. */
export interface SuccessBody<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}
export interface ErrorBody {
  success: false;
  error: { code: string; message: string; details?: ErrorDetail[]; requestId?: string };
}

export function sendSuccess<T>(res: Response, data: T, status = 200, meta?: Record<string, unknown>): void {
  const body: SuccessBody<T> = { success: true, data, ...(meta ? { meta } : {}) };
  res.status(status).json(body);
}

export function sendError(res: Response, status: number, code: string, message: string, details?: ErrorDetail[]): void {
  const requestId = res.locals["requestId"] as string | undefined;
  const body: ErrorBody = {
    success: false,
    error: { code, message, ...(details ? { details } : {}), ...(requestId ? { requestId } : {}) },
  };
  res.status(status).json(body);
}
