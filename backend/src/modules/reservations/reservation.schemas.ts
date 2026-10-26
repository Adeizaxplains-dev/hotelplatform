import { z } from "zod";
import { objectIdSchema, paginationSchema } from "../../shared/pagination.js";
import { plainText } from "../../shared/validation.js";
import { RESERVATION_STATUSES } from "./reservation.model.js";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in YYYY-MM-DD format.").refine((v) => {
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}, "Enter a valid calendar date.");
const stay = { checkIn: dateOnly, checkOut: dateOnly };
export const availabilitySchema = z.object({
  ...stay, adults: z.coerce.number().int().min(1).max(20).default(1), children: z.coerce.number().int().min(0).max(10).default(0),
  roomTypeSlug: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/).optional(),
}).strict().refine((v) => v.checkOut > v.checkIn, { message: "Check-out must be after check-in.", path: ["checkOut"] });
export const createPublicReservationSchema = z.object({
  ...stay, roomTypeSlug: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/), adults: z.number().int().min(1).max(20), children: z.number().int().min(0).max(10).default(0),
  guest: z.object({
    fullName: plainText(120, 2), email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()),
    phone: z.string().trim().min(7).max(30).regex(/^[+0-9() .-]+$/, "Enter a valid phone number."),
  }).strict(), specialRequests: plainText(1000).optional(),
}).strict().refine((v) => v.checkOut > v.checkIn, { message: "Check-out must be after check-in.", path: ["checkOut"] });
export const listReservationsSchema = paginationSchema.extend({
  status: z.enum(RESERVATION_STATUSES).optional(), search: plainText(100, 1).optional(), checkInFrom: dateOnly.optional(), checkInTo: dateOnly.optional(),
}).strict();
export const reservationIdParams = z.object({ id: objectIdSchema }).strict();
export const updateReservationStatusSchema = z.object({ status: z.enum(["CONFIRMED", "CANCELLED", "CHECKED_IN", "CHECKED_OUT", "NO_SHOW"]) }).strict();
export type AvailabilityQuery = z.infer<typeof availabilitySchema>;
export type CreatePublicReservationBody = z.infer<typeof createPublicReservationSchema>;
export type ListReservationsQuery = z.infer<typeof listReservationsSchema>;
