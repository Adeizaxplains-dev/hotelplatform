import { apiRequest } from "./apiClient";
import type { HealthReport } from "@/types/api";

/** Readiness: succeeds only if the API is up AND its database answers. */
export const fetchReadiness = (signal?: AbortSignal) => apiRequest<HealthReport>("/health/ready", signal ? { signal } : {});
