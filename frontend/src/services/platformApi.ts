
import { apiRequest } from "./apiClient";

export type PlatformPlan = "WEBSITE" | "BOOKING" | "MANAGEMENT";

export interface PlatformTenant {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED";
  plan: PlatformPlan;
}

export interface CreatePlatformTenantInput {
  name: string;
  slug: string;
  plan: PlatformPlan;
  ownerName: string;
  ownerEmail: string;
  timezone?: string;
  currency?: string;
}

export interface PlatformTenantDetail extends PlatformTenant {
  suspendedReason?: string;
  timezone: string;
  currency: string;
  createdAt?: string;
  limitOverrides?: Record<string, number | null>;
  entitlements: {
    features: string[];
    limits: Record<string, number>;
  };
  featureOverrides: Array<{
    feature: string;
    enabled: boolean;
    expiresAt?: string | null;
    reason?: string;
  }>;
  domains: Array<{
    hostname: string;
    verified: boolean;
  }>;
  ownerCount: number;
  subscriptions: Array<{
    plan: string;
    startedAt?: string;
    note?: string;
  }>;
}

export const platformApi = {
  listTenants: () =>
    apiRequest<PlatformTenant[]>("/platform/tenants?limit=50"),

  getTenant: (id: string) =>
    apiRequest<PlatformTenantDetail>(
      `/platform/tenants/${encodeURIComponent(id)}`
    ),

  createTenant: (input: CreatePlatformTenantInput) =>
  apiRequest<PlatformTenantDetail>("/platform/tenants", {
    method: "POST",
    body: input,
  }),
updateTenant: (
  id: string,
  input: {
    name: string;
    timezone: string;
    currency: string;
  },
) =>
  apiRequest<PlatformTenantDetail>(
    `/platform/tenants/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: input,
    },
  ),

};
