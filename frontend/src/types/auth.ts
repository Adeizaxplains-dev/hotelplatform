export type Role =
  | "PLATFORM_SUPER_ADMIN" | "HOTEL_OWNER" | "HOTEL_MANAGER" | "RECEPTIONIST" | "ACCOUNTANT"
  | "HOUSEKEEPER" | "RESTAURANT_MANAGER" | "STAFF" | "CUSTOMER";

/** Permission and feature names mirror the backend; the server remains the only real enforcement. */
export type Permission = string;
export type Feature = string;

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface LoginResult {
  accessToken: string;
  expiresIn: number;
  user: { id: string; name: string; email: string; role: Role; isActive: boolean; emailVerified: boolean };
}

export interface MeResult {
  user: SessionUser;
  permissions: Permission[];
  features: Feature[];
  tenant: { name: string; slug: string } | null;
}

export interface TenantInfo {
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED";
  features: Feature[];
}
