import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/services/authApi";
import type { TenantInfo } from "@/types/auth";

export type TenantState =
  | { kind: "loading" }
  | { kind: "hotel"; info: TenantInfo }
  | { kind: "platform" }
  | { kind: "unknown" };

/**
 * Which site is this? The server decides from the address (never from anything we send):
 * a hotel's own address returns its public info; the platform address answers "no hotel".
 */
export function useTenantInfo(): TenantState {
  const q = useQuery({ queryKey: ["tenant", "context"], staleTime: 5 * 60_000, retry: false, queryFn: authApi.context });
  if (q.isPending) return { kind: "loading" };
  if (q.isError) return { kind: "unknown" };
  if (q.data.scope === "platform") return { kind: "platform" };
  if (q.data.scope === "tenant" && q.data.hotel) return { kind: "hotel", info: q.data.hotel };
  return { kind: "unknown" };
}
