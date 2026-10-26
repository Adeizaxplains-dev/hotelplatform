import { apiRequest } from "./apiClient";
import type { LoginResult, MeResult, TenantInfo } from "@/types/auth";

export const authApi = {
  login: (email: string, password: string) => apiRequest<LoginResult>("/auth/login", { method: "POST", body: { email, password } }),
  refresh: () => apiRequest<LoginResult>("/auth/refresh", { method: "POST" }),
  logout: () => apiRequest<{ loggedOut: boolean }>("/auth/logout", { method: "POST" }),
  logoutAll: () => apiRequest<{ loggedOut: boolean }>("/auth/logout-all", { method: "POST" }),
  me: () => apiRequest<MeResult>("/auth/me"),
  forgotPassword: (email: string) => apiRequest<{ message: string }>("/auth/forgot-password", { method: "POST", body: { email } }),
  resetPassword: (token: string, password: string) => apiRequest<{ message: string }>("/auth/reset-password", { method: "POST", body: { token, password } }),
  verifyEmail: (token: string) => apiRequest<{ message: string }>("/auth/verify-email", { method: "POST", body: { token } }),
  context: () => apiRequest<{ scope: "platform" | "tenant" | "unknown"; hotel: TenantInfo | null }>("/tenants/context"),
};
