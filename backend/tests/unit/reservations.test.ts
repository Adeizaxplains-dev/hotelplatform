import { describe, expect, it } from "vitest";
import { availabilitySchema, createPublicReservationSchema } from "../../src/modules/reservations/reservation.schemas.js";

const valid = {
  checkIn: "2026-11-10", checkOut: "2026-11-12", roomTypeSlug: "deluxe-room", adults: 2, children: 0,
  guest: { fullName: "Ada Guest", email: "ADA@example.com", phone: "+234 800 000 0000" },
};

describe("reservation input validation", () => {
  it("accepts a valid public reservation and normalizes the guest email", () => {
    const parsed = createPublicReservationSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.guest.email).toBe("ada@example.com");
  });

  it("rejects checkout on or before check-in", () => {
    expect(createPublicReservationSchema.safeParse({ ...valid, checkOut: valid.checkIn }).success).toBe(false);
    expect(availabilitySchema.safeParse({ checkIn: valid.checkIn, checkOut: "2026-11-09" }).success).toBe(false);
  });

  it("rejects impossible calendar dates and unknown body properties", () => {
    expect(createPublicReservationSchema.safeParse({ ...valid, checkIn: "2026-02-30" }).success).toBe(false);
    expect(createPublicReservationSchema.safeParse({ ...valid, tenantId: "507f1f77bcf86cd799439011" }).success).toBe(false);
  });

  it("rejects malformed guest contact information", () => {
    expect(createPublicReservationSchema.safeParse({ ...valid, guest: { ...valid.guest, email: "not-an-email" } }).success).toBe(false);
    expect(createPublicReservationSchema.safeParse({ ...valid, guest: { ...valid.guest, phone: "x" } }).success).toBe(false);
  });

  it("coerces public availability query counts and defaults guest counts", () => {
    const parsed = availabilitySchema.safeParse({ checkIn: valid.checkIn, checkOut: valid.checkOut, adults: "3" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toMatchObject({ adults: 3, children: 0 });
  });
});
