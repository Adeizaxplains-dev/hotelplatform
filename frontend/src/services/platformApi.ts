import { apiRequest } from "./apiClient";

export interface PlatformTenant { id: string; name: string; slug: string; status: "ACTIVE" | "SUSPENDED"; plan: "WEBSITE" | "BOOKING" | "MANAGEMENT" }

export const platformApi = {
  listTenants: () => apiRequest<PlatformTenant[]>("/platform/tenants?limit=50"),
};
