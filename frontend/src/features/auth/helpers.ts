import { ApiError } from "@/services/apiClient";
import type { Role } from "@/types/auth";

/** Where each kind of account lands after signing in. */
export const homeFor = (role: Role): string => {
  switch (role) {
    case "PLATFORM_SUPER_ADMIN":
      return "/platform";

    case "CUSTOMER":
      return "/";

    case "RECEPTIONIST":
      return "/admin/reservations";

    case "ACCOUNTANT":
      return "/admin/invoices";

    case "HOUSEKEEPER":
      return "/admin/housekeeping";

    case "RESTAURANT_MANAGER":
      return "/admin";

    case "HOTEL_OWNER":
    case "HOTEL_MANAGER":
    case "STAFF":
    default:
      return "/admin";
  }
};

/** Plain-language sign-in errors. The server's wording never reveals whether an email exists. */
export function describeLoginError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "INVALID_CREDENTIALS":
        return "That email and password don't match. Check them and try again.";

      case "ACCOUNT_DISABLED":
        return "This account has been disabled. Please contact the hotel.";

      case "TENANT_SUSPENDED":
        return "This hotel's account is suspended. Please contact the hotel directly.";

      case "TENANT_NOT_FOUND":
        return "We couldn't find this hotel. Check the address you were given.";

      case "RATE_LIMITED":
        return "Too many sign-in attempts. Please wait a few minutes and try again.";

      case "NETWORK_ERROR":
        return err.message;
    }
  }

  return "We couldn't sign you in. Please try again.";
}
