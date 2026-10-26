import { randomBytes } from "node:crypto";
import { Types, trusted } from "mongoose";
import type { TenantView, AuthContext } from "../../shared/context.js";
import { BusinessRuleError, ConflictError, NotFoundError, ValidationError } from "../../shared/errors.js";
import { pageMeta } from "../../shared/pagination.js";
import { formatMinorUnits } from "../../shared/money.js";
import type { AuditService, RequestMeta } from "../audit/audit.service.js";
import type { GuestNotificationService } from "../notifications/guestNotification.service.js";
import { Room } from "../rooms/room.model.js";
import { RoomType } from "../rooms/roomType.model.js";
import { Reservation, type IReservation } from "./reservation.model.js";
import { RoomNight } from "./roomNight.model.js";
import type { AvailabilityQuery, CreatePublicReservationBody, ListReservationsQuery } from "./reservation.schemas.js";
import { assertReservationTransition } from "./reservation.transitions.js";

const dateNights = (checkIn: string, checkOut: string): string[] => {
  const nights: string[] = [];
  const cursor = new Date(`${checkIn}T00:00:00.000Z`);
  const end = new Date(`${checkOut}T00:00:00.000Z`);
  while (cursor < end && nights.length <= 30) {
    nights.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  if (nights.length < 1 || nights.length > 30 || nights.at(-1) !== new Date(end.getTime() - 86_400_000).toISOString().slice(0, 10)) {
    throw new ValidationError("A stay must be between 1 and 30 nights.");
  }
  return nights;
};
const dto = (r: IReservation & { _id: Types.ObjectId; createdAt?: Date; updatedAt?: Date }) => ({
  id: String(r._id), reference: r.reference, roomTypeId: String(r.roomTypeId), roomId: String(r.roomId),
  checkIn: r.checkIn, checkOut: r.checkOut, nights: r.nights, adults: r.adults, children: r.children,
  guest: r.guest, specialRequests: r.specialRequests ?? null,
  price: { nightlyRate: r.nightlyRate, totalAmount: r.totalAmount, currency: r.currency },
  status: r.status, paymentStatus: r.paymentStatus, source: r.source,
  createdAt: r.createdAt, updatedAt: r.updatedAt,
});
const reference = () => `HTL-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;

export function createReservationService({ audit, notifications }: { audit: AuditService; notifications: GuestNotificationService }) {
  async function findAvailableRoomIds(tenantId: Types.ObjectId, roomTypeId: Types.ObjectId, nights: string[]) {
    const rooms = await Room.find({ tenantId, roomTypeId, isActive: true, status: "AVAILABLE", housekeepingStatus: trusted({ $in: ["CLEAN", "INSPECTED"] }) }).select("_id").sort({ roomNumber: 1 }).lean();
    if (!rooms.length) return [];
    const ids = rooms.map((r) => r._id);
    const occupied = await RoomNight.find({ tenantId, roomId: trusted({ $in: ids }), night: trusted({ $in: nights }) }).select("roomId").lean();
    const blocked = new Set(occupied.map((x) => String(x.roomId)));
    return ids.filter((id) => !blocked.has(String(id)));
  }

  async function releaseInventory(tenantId: Types.ObjectId, reservationId: Types.ObjectId) {
    await RoomNight.deleteMany({ tenantId, reservationId });
  }

  return {
    async availability(tenant: TenantView, q: AvailabilityQuery) {
      const nights = dateNights(q.checkIn, q.checkOut);
      const filter: Record<string, unknown> = { tenantId: tenant.id, isActive: true, maxAdults: trusted({ $gte: q.adults }), maxChildren: trusted({ $gte: q.children }) };
      if (q.roomTypeSlug) filter.slug = q.roomTypeSlug;
      const types = await RoomType.find(filter).sort({ sortOrder: 1, name: 1 }).lean();
      const items = await Promise.all(types.map(async (t) => {
        const availableRoomIds = await findAvailableRoomIds(tenant.id, t._id, nights);
        return { roomTypeId: String(t._id), slug: t.slug, name: t.name, availableRooms: availableRoomIds.length,
          available: availableRoomIds.length > 0, nightlyRate: t.basePrice, totalAmount: t.basePrice * nights.length, currency: tenant.currency, nights: nights.length };
      }));
      return { checkIn: q.checkIn, checkOut: q.checkOut, nights: nights.length, items };
    },

    async createPublic(tenant: TenantView, body: CreatePublicReservationBody, meta: RequestMeta) {
      const nights = dateNights(body.checkIn, body.checkOut);
      const type = await RoomType.findOne({ slug: body.roomTypeSlug, tenantId: tenant.id, isActive: true }).lean();
      if (!type) throw new NotFoundError("That room type is not available.");
      if (body.adults > type.maxAdults || body.children > type.maxChildren) throw new BusinessRuleError("This room type does not accommodate the selected number of guests.", "GUEST_CAPACITY_EXCEEDED");
      const candidates = await findAvailableRoomIds(tenant.id, type._id, nights);
      if (!candidates.length) throw new ConflictError("Sorry, this room type is no longer available for those dates. Please choose another date or room type.");

      for (const roomId of candidates) {
        const reservationId = new Types.ObjectId();
        const ref = reference();
        try {
          // Create the reservation first: a process crash must not leave orphan room-night locks.
          // The unique room/night index remains the final concurrency guard for overlapping bookings.
          const created = await Reservation.create({
            _id: reservationId, tenantId: tenant.id, reference: ref, roomTypeId: type._id, roomId,
            checkIn: body.checkIn, checkOut: body.checkOut, nights: nights.length, adults: body.adults, children: body.children,
            guest: body.guest, specialRequests: body.specialRequests, currency: tenant.currency, nightlyRate: type.basePrice,
            totalAmount: type.basePrice * nights.length, status: "PENDING", paymentStatus: "UNPAID", source: "WEBSITE",
          });
          await RoomNight.insertMany(nights.map((night) => ({ tenantId: tenant.id, roomId, reservationId, night })), { ordered: true });
          await audit.record({ tenantId: tenant.id, action: "RESERVATION_CREATED", resourceType: "Reservation", resourceId: String(created._id), after: { reference: created.reference, checkIn: created.checkIn, checkOut: created.checkOut, totalAmount: created.totalAmount, source: created.source }, meta });
          const amount = formatMinorUnits(created.totalAmount, created.currency);
          await notifications.sendOnce(tenant.id, `reservation:${created._id}:created`, {
            to: created.guest.email,
            subject: `Reservation request received — ${created.reference}`,
            text: `Hello ${created.guest.fullName},\n\n${tenant.name} has received your reservation request.\nReference: ${created.reference}\nStay: ${created.checkIn} to ${created.checkOut} (${created.nights} night${created.nights === 1 ? "" : "s"})\nEstimated total: ${amount}\nStatus: Pending hotel confirmation\n\nPlease keep this reference for your records.`,
          });
          return { ...dto(created.toObject() as IReservation & { _id: Types.ObjectId }), message: "Your reservation request has been received. The hotel will confirm it shortly." };
        } catch (err) {
          await releaseInventory(tenant.id, reservationId);
          await Reservation.deleteOne({ _id: reservationId, tenantId: tenant.id });
          if (err && typeof err === "object" && "code" in err && (err as { code?: number }).code === 11000) { continue; }
          throw err;
        }
      }
      throw new ConflictError("Those dates were just booked by another guest. Please search again.");
    },

    async list(tenantId: Types.ObjectId, q: ListReservationsQuery) {
      const filter: Record<string, unknown> = { tenantId };
      if (q.status) filter.status = q.status;
      if (q.checkInFrom || q.checkInTo) filter.checkIn = trusted({ ...(q.checkInFrom ? { $gte: q.checkInFrom } : {}), ...(q.checkInTo ? { $lte: q.checkInTo } : {}) });
      if (q.search) filter.$or = [
        { reference: trusted({ $regex: q.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" }) },
        { "guest.fullName": trusted({ $regex: q.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" }) },
        { "guest.email": trusted({ $regex: q.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" }) },
      ];
      const [rows, total] = await Promise.all([Reservation.find(filter).sort({ checkIn: 1, createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(), Reservation.countDocuments(filter)]);
      return { items: rows.map((r) => dto(r as IReservation & { _id: Types.ObjectId; createdAt?: Date; updatedAt?: Date })), meta: pageMeta(total, q.page, q.limit) };
    },

    async get(tenantId: Types.ObjectId, id: string) {
      const r = await Reservation.findOne({ _id: id, tenantId }).lean();
      if (!r) throw new NotFoundError("Reservation not found.");
      return dto(r as IReservation & { _id: Types.ObjectId; createdAt?: Date; updatedAt?: Date });
    },

    async updateStatus(actor: AuthContext, tenant: TenantView, id: string, status: "CONFIRMED" | "CANCELLED" | "CHECKED_IN" | "CHECKED_OUT" | "NO_SHOW", meta: RequestMeta) {
      const current = await Reservation.findOne({ _id: id, tenantId: tenant.id });
      if (!current) throw new NotFoundError("Reservation not found.");
      const previous = current.status;
      assertReservationTransition(previous, status);

      // Claim the physical room before changing the reservation. Conditional writes make
      // simultaneous check-ins fail safely instead of silently occupying the same room.
      let roomChanged = false;
      if (status === "CHECKED_IN") {
        const room = await Room.findOneAndUpdate(
          { _id: current.roomId, tenantId: tenant.id, isActive: true, status: "AVAILABLE", housekeepingStatus: trusted({ $in: ["CLEAN", "INSPECTED"] }) },
          { $set: { status: "OCCUPIED" } }, { new: true },
        ).lean();
        if (!room) throw new ConflictError("This room is not currently available for check-in. Confirm its status and housekeeping inspection before trying again.");
        roomChanged = true;
      } else if (status === "CHECKED_OUT") {
        const room = await Room.findOneAndUpdate(
          { _id: current.roomId, tenantId: tenant.id, isActive: true, status: "OCCUPIED" },
          { $set: { status: "AVAILABLE", housekeepingStatus: "DIRTY" } }, { new: true },
        ).lean();
        if (!room) throw new ConflictError("The assigned room is not marked occupied. Resolve the room status before completing checkout.");
        roomChanged = true;
      }

      const now = new Date();
      const changes: Record<string, unknown> = { status };
      if (status === "CANCELLED") changes.cancelledAt = now;
      if (status === "CHECKED_IN") changes.checkedInAt = now;
      if (status === "CHECKED_OUT") changes.checkedOutAt = now;
      const updated = await Reservation.findOneAndUpdate(
        { _id: current._id, tenantId: tenant.id, status: previous },
        { $set: changes }, { new: true, runValidators: true },
      );
      if (!updated) {
        // Another staff member won the reservation transition. Undo our room claim where safe.
        if (roomChanged && status === "CHECKED_IN") {
          await Room.updateOne({ _id: current.roomId, tenantId: tenant.id, status: "OCCUPIED" }, { $set: { status: "AVAILABLE" } });
        } else if (roomChanged && status === "CHECKED_OUT") {
          await Room.updateOne({ _id: current.roomId, tenantId: tenant.id, status: "AVAILABLE", housekeepingStatus: "DIRTY" }, { $set: { status: "OCCUPIED", housekeepingStatus: "DIRTY" } });
        }
        throw new ConflictError("This reservation was updated by another staff member. Refresh the reservation and try again.");
      }
      if (status === "CANCELLED" || status === "NO_SHOW" || status === "CHECKED_OUT") await releaseInventory(tenant.id, updated._id);
      await audit.record({ tenantId: tenant.id, actorUserId: actor.userId, action: `RESERVATION_${status}`, resourceType: "Reservation", resourceId: String(updated._id), before: { status: previous }, after: { status, reference: updated.reference }, meta });
      const statusMessages: Record<string, string> = {
        CONFIRMED: "Your reservation has been confirmed by the hotel.", CANCELLED: "Your reservation has been cancelled. If you believe this is an error, please contact the hotel.",
        CHECKED_IN: "Your check-in has been recorded. Welcome!", CHECKED_OUT: "Your check-out has been recorded. Thank you for staying with us.",
        NO_SHOW: "The hotel has marked this reservation as a no-show. Please contact the hotel if you need assistance.",
      };
      await notifications.sendOnce(tenant.id, `reservation:${updated._id}:status:${status}`, {
        to: updated.guest.email,
        subject: `Reservation update — ${updated.reference}`,
        text: `Hello ${updated.guest.fullName},\n\n${statusMessages[status] ?? "Your reservation has been updated."}\nHotel: ${tenant.name}\nReference: ${updated.reference}\nStay: ${updated.checkIn} to ${updated.checkOut}\nCurrent status: ${status.replace(/_/g, " ")}\n\nPlease contact the hotel directly if you have questions.`,
      });
      return dto(updated.toObject() as IReservation & { _id: Types.ObjectId; createdAt?: Date; updatedAt?: Date });
    },
  };
}
export type ReservationService = ReturnType<typeof createReservationService>;
