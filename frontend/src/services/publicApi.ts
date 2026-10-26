import { apiRequest } from "./apiClient";
import type { PublicFacility, PublicGalleryImage, PublicRoomType, PublicSite } from "@/types/site";

export interface AvailabilityItem {
  roomTypeId: string; slug: string; name: string; availableRooms: number; available: boolean;
  nightlyRate: number; totalAmount: number; currency: string; nights: number;
}
export interface AvailabilityResult { checkIn: string; checkOut: string; nights: number; items: AvailabilityItem[] }
export interface ReservationResult {
  id: string; reference: string; roomTypeId: string; roomId: string; checkIn: string; checkOut: string; nights: number;
  adults: number; children: number; guest: { fullName: string; email: string; phone: string };
  price: { nightlyRate: number; totalAmount: number; currency: string };
  status: string; paymentStatus: string; message: string;
}
export interface PaymentInitialization { reference: string; authorizationUrl: string; accessCode: string; amount: number; currency: string; reservationReference: string }
export interface PaymentVerification { status: string; reference: string; reservationReference: string; amount?: number; currency?: string; message: string }
export const publicApi = {
  site: () => apiRequest<PublicSite>("/public/site"),
  roomTypes: () => apiRequest<PublicRoomType[]>("/public/room-types"),
  roomType: (slug: string) => apiRequest<PublicRoomType>(`/public/room-types/${encodeURIComponent(slug)}`),
  facilities: () => apiRequest<PublicFacility[]>("/public/facilities"),
  gallery: (category?: string) => apiRequest<PublicGalleryImage[]>(`/public/gallery${category ? `?category=${encodeURIComponent(category)}` : ""}`),
  availability: (params: { checkIn: string; checkOut: string; adults: number; children: number; roomTypeSlug?: string }) => {
    const q = new URLSearchParams({ checkIn: params.checkIn, checkOut: params.checkOut, adults: String(params.adults), children: String(params.children) });
    if (params.roomTypeSlug) q.set("roomTypeSlug", params.roomTypeSlug);
    return apiRequest<AvailabilityResult>(`/reservations/availability?${q.toString()}`);
  },
  initializePayment: (reservationReference: string) => apiRequest<PaymentInitialization>("/payments/initialize", { method: "POST", body: { reservationReference } }),
  verifyPayment: (reference: string) => apiRequest<PaymentVerification>(`/payments/verify?reference=${encodeURIComponent(reference)}`),
  createReservation: (body: { checkIn: string; checkOut: string; roomTypeSlug: string; adults: number; children: number; guest: { fullName: string; email: string; phone: string }; specialRequests?: string }) =>
    apiRequest<ReservationResult>("/reservations", { method: "POST", body }),
};
