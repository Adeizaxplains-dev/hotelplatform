import type { RoomAdmin, RoomTypeAdmin } from "@/services/adminApi";
import type { MeResult } from "@/types/auth";

// Same permission sets the server grants (see backend/src/modules/rbac/roles.ts).
export const ROLE_PERMS: Record<"HOTEL_OWNER" | "HOTEL_MANAGER" | "RECEPTIONIST" | "HOUSEKEEPER" | "ACCOUNTANT", string[]> = {
  HOTEL_OWNER: ["rooms.read", "rooms.create", "rooms.update", "rooms.delete", "cms.read", "cms.update", "settings.read", "settings.update", "staff.read"],
  HOTEL_MANAGER: ["rooms.read", "rooms.create", "rooms.update", "rooms.delete", "cms.read", "cms.update", "settings.read"],
  RECEPTIONIST: ["rooms.read"],
  HOUSEKEEPER: ["rooms.read"],
  ACCOUNTANT: ["payments.read", "reports.read"],
};

export const meAs = (role: keyof typeof ROLE_PERMS, features = ["website", "cms", "rooms", "gallery"]): MeResult => ({
  user: { id: "u1", name: "Ada Nwosu", email: "ada@palm.com", role: role as never },
  permissions: ROLE_PERMS[role], features, tenant: { name: "Palm Hotel", slug: "palm" },
});

export const roomType = (over: Partial<RoomTypeAdmin> = {}): RoomTypeAdmin => ({
  id: "rt1", name: "Deluxe Room", slug: "deluxe-room", maxAdults: 2, maxChildren: 1, basePrice: 8_500_000, amenityKeys: ["wifi"], isFeatured: true, isActive: true, sortOrder: 0, images: [], roomCount: 3, ...over,
});
export const room = (over: Partial<RoomAdmin> = {}): RoomAdmin => ({ id: "r1", roomNumber: "101", roomTypeId: "rt1", roomTypeName: "Deluxe Room", floor: 1, status: "AVAILABLE", housekeepingStatus: "CLEAN", isActive: true, ...over });

export const AMENITIES = [
  { key: "wifi", label: "Free Wi-Fi", icon: "Wifi", group: "Connectivity" },
  { key: "ac", label: "Air conditioning", icon: "Snowflake", group: "Comfort" },
];
export const paged = <T,>(items: T[]) => ({ success: true, data: items, meta: { total: items.length, page: 1, limit: 100, pages: 1 } });
