import { ApiError } from "@/services/apiClient";

/** Plain-language message for any failure. Field details from the server are appended when present. */
export function describeError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof ApiError) {
    if (err.code === "NETWORK_ERROR") return err.message;
    if (err.code === "RATE_LIMITED") return "You're doing that too quickly. Please wait a moment and try again.";
    if (err.status >= 500) return fallback;
    const details = err.details?.map((d) => d.message).filter(Boolean) ?? [];
    return details.length ? `${err.message} ${details.join(" ")}` : err.message;
  }
  return fallback;
}

/** Maps server field errors ("body.name") onto form field names. */
export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || !err.details) return {};
  const out: Record<string, string> = {};
  for (const d of err.details) {
    const key = (d.path ?? "").replace(/^body\./, "");
    if (key && !out[key]) out[key] = d.message;
  }
  return out;
}
