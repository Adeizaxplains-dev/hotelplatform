import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/services/apiClient";
import { fetchReadiness } from "@/services/health";
import type { HealthReport } from "@/types/api";

export type SystemState =
  | { kind: "operational"; report: HealthReport }
  | { kind: "database-down" }
  | { kind: "unreachable" };

/**
 * One request tells us all three states:
 *  200            -> API and database are up
 *  503 SERVICE_UNAVAILABLE -> API is up, database is not
 *  network error  -> API unreachable
 * Any other failure is surfaced as a normal error.
 */
export function useHealth() {
  return useQuery<SystemState, ApiError>({
    queryKey: ["health", "ready"],
    queryFn: async ({ signal }) => {
      try {
        return { kind: "operational", report: await fetchReadiness(signal) };
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.isNetworkError) return { kind: "unreachable" };
          if (err.code === "SERVICE_UNAVAILABLE") return { kind: "database-down" };
        }
        throw err;
      }
    },
    retry: false,
    refetchInterval: (query) => (query.state.data?.kind === "operational" ? 60_000 : 10_000),
    refetchIntervalInBackground: false,
  });
}
