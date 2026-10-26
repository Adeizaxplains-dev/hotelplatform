import { apiRequest, apiRequestPaged } from "./apiClient";
import type { Amenity } from "@/types/site";


export interface BillingPlan { key: "WEBSITE" | "BOOKING" | "MANAGEMENT"; name: string; monthlyPriceKobo: number | null; currency: string; features: string[] }
export interface BillingCurrent { plan: string; status: "NOT_STARTED" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED"; trialStartedAt: string | null; trialEndsAt: string | null; currentPeriodStart: string | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; lastPaymentAt: string | null; lastPaymentReference: string | null; plans: BillingPlan[] }
export interface BillingPayment { reference: string; plan: string; amountKobo: number; currency: string; status: string; paidAt?: string; createdAt: string }

export interface AdminImage { assetId: string; url: string; srcSet?: string; width: number; height: number; alt: string }
export interface MediaItem { id: string; url: string; srcSet?: string; width: number; height: number; alt: string; bytes: number; format: string }

export interface RoomTypeAdmin {
  id: string; name: string; slug: string; shortDescription?: string; description?: string; maxAdults: number; maxChildren: number;
  bedConfig?: string; sizeSqm?: number; basePrice: number; amenityKeys: string[]; isFeatured: boolean; isActive: boolean; sortOrder: number;
  images: AdminImage[]; roomCount?: number;
}
export type RoomTypeInput = Partial<Omit<RoomTypeAdmin, "id" | "slug" | "images" | "roomCount">> & { slug?: string; imageAssetIds?: string[] };

export interface RoomAdmin { id: string; roomNumber: string; roomTypeId: string; roomTypeName?: string; floor?: number; status: string; housekeepingStatus: string; isActive: boolean }
export interface FacilityAdmin { id: string; name: string; description?: string; icon: string; imageAssetId?: string; image?: { url: string; alt: string; width: number; height: number }; isActive: boolean; sortOrder: number }
export interface ReservationAdmin {
  id: string; reference: string; roomTypeId: string; roomId: string; checkIn: string; checkOut: string; nights: number;
  adults: number; children: number; guest: { fullName: string; email: string; phone: string }; specialRequests?: string | null;
  price: { nightlyRate: number; totalAmount: number; currency: string }; status: string; paymentStatus: string; source: string;
  createdAt?: string; updatedAt?: string;
}
export interface HousekeepingRoom { id: string; roomNumber: string; roomTypeName: string; floor?: number; roomStatus: string; housekeepingStatus: "CLEAN" | "DIRTY" | "CLEANING" | "INSPECTED"; needsAttention: boolean }
export interface OperationsReport {
  date: string;
  rooms: { total: number; available: number; reserved: number; occupied: number; maintenance: number; occupancyPercent: number };
  housekeeping: Record<string, number>;
  arrivals: Array<{ reference: string; guestName: string; checkIn: string; checkOut: string; status: string; roomId: string }>;
  departures: Array<{ reference: string; guestName: string; checkIn: string; checkOut: string; status: string; roomId: string }>;
  inHouseGuests: number; reservationsCreatedToday: number;
  paymentsCollected: Array<{ currency: string; total: number; transactions: number }>;
}
export interface InvoiceAdmin {
  id: string; invoiceNumber: string; reservationId: string; reservationReference: string;
  guest: { fullName: string; email: string; phone: string }; lineItems: Array<{ description: string; quantity: number; unitAmount: number; lineTotal: number }>;
  currency: string; subtotal: number; total: number; amountPaid: number; amountRefunded: number; balance: number;
  paymentStatus: string; status: string; issuedAt: string; voidedAt?: string;
}
export interface GuestDirectoryItem {
  email: string; guest: { fullName: string; email: string; phone: string }; lastReservationAt: string;
  reservations: number; totalBooked: number; currency: string;
  recentReservations: Array<{ reference: string; status: string; paymentStatus: string; checkIn: string; checkOut: string; totalAmount: number; currency: string }>;
}
export interface FinancialReport {
  from: string; to: string; timezone: string;
  paymentsCollected: Array<{ currency: string; amount: number; transactions: number }>;
  refundsProcessed: Array<{ currency: string; amount: number; refunds: number }>;
  invoicesIssued: Array<{ currency: string; amount: number; invoices: number }>;
  outstandingBalances: Array<{ currency: string; amount: number; invoices: number }>;
  reservationsBooked: Array<{ currency: string; amount: number; reservations: number }>;
  note: string;
}
export interface PaymentReconciliation {
  from: string; to: string; timezone: string; checked: number; total: number; page: number; limit: number; pages: number; note: string;
  items: Array<{ paymentId: string; reference: string; reservationReference: string; localStatus: string; gatewayStatus: string; amount: number; gatewayAmountMinor?: number; currency: string; paidAt?: string; result: "MATCH" | "MISMATCH" | "UNVERIFIED"; issues: string[] }>;
}
export interface RefundAdmin { id: string; paymentReference: string; reservationReference: string; gatewayRefundReference?: string; amount: number; currency: string; reason: string; status: string; requestedAt: string; processedAt?: string; providerMessage?: string }
export interface GuestNotificationAdmin { id: string; eventKey: string; recipient: string; subject: string; status: "PENDING" | "SENDING" | "SENT" | "FAILED"; attempts: number; sentAt?: string; lastError?: string; createdAt: string; updatedAt: string }
export interface GalleryAdmin { id: string; assetId: string; caption?: string; category: string; isActive: boolean; sortOrder: number; image?: { url: string; alt: string; width: number; height: number } }

export interface ProfileAdmin {
  tagline?: string; description?: string;
  contact: Record<string, string | number | undefined>; social: Record<string, string | undefined>;
  policies: { checkInTime: string; checkOutTime: string; cancellation?: string; houseRules?: string; children?: string; pets?: string };
  branding: { primaryColor: string; accentColor: string; typography: "modern" | "classic"; logoAssetId?: string; faviconAssetId?: string };
  seo: { titleTemplate?: string; defaultDescription?: string; ogImageAssetId?: string };
  assets: Record<string, { url: string; alt: string; width: number; height: number }>;
}
export interface ContentAdmin {
  hero: { headline?: string; subheadline?: string; imageAssetIds: string[] };
  about: { heading?: string; body?: string; imageAssetId?: string; highlights: Array<{ label: string; value: string }> };
  whyChooseUs: Array<{ title: string; text: string; icon: string }>;
  testimonials: Array<{ quote: string; guestName: string; source?: string; rating?: number }>;
  faqs: Array<{ question: string; answer: string }>;
  pageSeo: Record<string, { title?: string; description?: string } | undefined>;
  assets: Record<string, { url: string; alt: string; width: number; height: number }>;
}


export interface StaffAdmin {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: StaffRole;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt?: string;
  createdAt?: string;
}

export type StaffRole =
  | "HOTEL_OWNER"
  | "HOTEL_MANAGER"
  | "RECEPTIONIST"
  | "ACCOUNTANT"
  | "HOUSEKEEPER"
  | "RESTAURANT_MANAGER"
  | "STAFF";

export interface AssignableStaffRole {
  role: StaffRole;
  assignable: boolean;
  permissions: string[];
}

export interface CreateStaffInput {
  name: string;
  email: string;
  phone?: string;
  role: StaffRole;
}

export interface UpdateStaffInput {
  name?: string;
  phone?: string;
  role?: StaffRole;
}

const json = (method: "POST" | "PATCH", body: unknown) => ({ method, body });

export const adminApi = {
  billingCurrent: () => apiRequest<BillingCurrent>("/billing/current"),
  startBillingTrial: () => apiRequest<BillingCurrent>("/billing/trial", { method: "POST" }),
  checkoutBillingPlan: (plan: BillingPlan["key"]) => apiRequest<{ reference: string; authorizationUrl: string; accessCode: string; plan: string; amountKobo: number; currency: string }>("/billing/checkout", json("POST", { plan })),
  verifyBillingPayment: (reference: string) => apiRequest<{ status: string; reference: string; plan?: string; amountKobo?: number; currency?: string; currentPeriodStart?: string; currentPeriodEnd?: string; message: string }>("/billing/verify", json("POST", { reference })),
  billingHistory: () => apiRequestPaged<BillingPayment[]>("/billing/history?limit=25"),
  reservations: (q = "") => apiRequestPaged<ReservationAdmin[]>(`/reservations?limit=100${q}`),
  housekeeping: (status = "") => apiRequest<HousekeepingRoom[]>(`/housekeeping${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  updateHousekeeping: (id: string, status: HousekeepingRoom["housekeepingStatus"]) => apiRequest<HousekeepingRoom>(`/housekeeping/${id}/status`, json("PATCH", { status })),
  operationsReport: (date: string) => apiRequest<OperationsReport>(`/reports/operations?date=${encodeURIComponent(date)}`),
  invoices: (q = "") => apiRequestPaged<InvoiceAdmin[]>(`/invoices?limit=100${q}`),
  issueInvoice: (reservationId: string) => apiRequest<InvoiceAdmin & { alreadyExisted?: boolean }>("/invoices", json("POST", { reservationId })),
  guests: (q = "") => apiRequestPaged<GuestDirectoryItem[]>(`/guests?limit=100${q}`),
  financialReport: (from: string, to: string) => apiRequest<FinancialReport>(`/reports/financial?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  paymentReconciliation: (from: string, to: string) => apiRequest<PaymentReconciliation>(`/payments/reconciliation?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=25`),
  refunds: () => apiRequestPaged<RefundAdmin[]>("/payments/refunds?limit=25"),
  notifications: (status = "FAILED") => apiRequestPaged<GuestNotificationAdmin[]>(`/notifications?limit=50${status ? `&status=${encodeURIComponent(status)}` : ""}`),
  retryNotification: (id: string) => apiRequest<{ id: string; status: string; attempts: number; message: string }>(`/notifications/${id}/retry`, { method: "POST" }),
  requestRefund: (paymentId: string, reason: string) => apiRequest<RefundAdmin & { alreadyExisted?: boolean; warning?: string }>(`/payments/${paymentId}/refund`, json("POST", { reason })),
  updateReservationStatus: (id: string, status: "CONFIRMED" | "CANCELLED" | "CHECKED_IN" | "CHECKED_OUT" | "NO_SHOW") => apiRequest<ReservationAdmin>(`/reservations/${id}/status`, json("PATCH", { status })),


  staff: (q = "") =>
    apiRequestPaged<StaffAdmin[]>(`/users?limit=100${q}`),

  staffRoles: () =>
    apiRequest<AssignableStaffRole[]>("/users/roles"),

  createStaff: (body: CreateStaffInput) =>
    apiRequest<StaffAdmin>("/users", json("POST", body)),

  updateStaff: (id: string, body: UpdateStaffInput) =>
    apiRequest<StaffAdmin>(
      `/users/${encodeURIComponent(id)}`,
      json("PATCH", body)
    ),

  disableStaff: (id: string) =>
    apiRequest<StaffAdmin>(
      `/users/${encodeURIComponent(id)}/disable`,
      json("POST", {})
    ),

  enableStaff: (id: string) =>
    apiRequest<StaffAdmin>(
      `/users/${encodeURIComponent(id)}/enable`,
      json("POST", {})
    ),


  profile: () => apiRequest<ProfileAdmin>("/hotel/profile"),
  saveProfile: (body: unknown) => apiRequest<ProfileAdmin>("/hotel/profile", json("PATCH", body)),
  content: () => apiRequest<ContentAdmin>("/hotel/content"),
  saveContent: (body: unknown) => apiRequest<ContentAdmin>("/hotel/content", json("PATCH", body)),

  amenities: () => apiRequest<Array<Amenity & { group: string }>>("/catalog/amenities"),
  icons: () => apiRequest<string[]>("/catalog/icons"),

  roomTypes: (q = "") => apiRequestPaged<RoomTypeAdmin[]>(`/room-types?limit=100${q}`),
  createRoomType: (body: RoomTypeInput) => apiRequest<RoomTypeAdmin>("/room-types", json("POST", body)),
  updateRoomType: (id: string, body: RoomTypeInput) => apiRequest<RoomTypeAdmin>(`/room-types/${id}`, json("PATCH", body)),
  deleteRoomType: (id: string) => apiRequest<{ deleted: true }>(`/room-types/${id}`, { method: "DELETE" }),

  rooms: (q = "") => apiRequestPaged<RoomAdmin[]>(`/rooms?limit=100${q}`),
  createRoom: (body: Record<string, unknown>) => apiRequest<RoomAdmin>("/rooms", json("POST", body)),
  updateRoom: (id: string, body: Record<string, unknown>) => apiRequest<RoomAdmin>(`/rooms/${id}`, json("PATCH", body)),
  deleteRoom: (id: string) => apiRequest<{ deleted: true }>(`/rooms/${id}`, { method: "DELETE" }),

  facilities: () => apiRequest<FacilityAdmin[]>("/facilities"),
  createFacility: (body: Record<string, unknown>) => apiRequest<FacilityAdmin>("/facilities", json("POST", body)),
  updateFacility: (id: string, body: Record<string, unknown>) => apiRequest<FacilityAdmin>(`/facilities/${id}`, json("PATCH", body)),
  deleteFacility: (id: string) => apiRequest<{ deleted: true }>(`/facilities/${id}`, { method: "DELETE" }),

  gallery: () => apiRequestPaged<GalleryAdmin[]>("/gallery?limit=100"),
  addGallery: (body: Record<string, unknown>) => apiRequest<GalleryAdmin>("/gallery", json("POST", body)),
  updateGallery: (id: string, body: Record<string, unknown>) => apiRequest<GalleryAdmin>(`/gallery/${id}`, json("PATCH", body)),
  removeGallery: (id: string) => apiRequest<{ deleted: true }>(`/gallery/${id}`, { method: "DELETE" }),

  media: () => apiRequestPaged<MediaItem[]>("/media?limit=100"),
  upload: (file: File, alt?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (alt) form.append("alt", alt);
    return apiRequest<MediaItem>("/media", { method: "POST", body: form });
  },
};
