import { Types, trusted } from "mongoose";
import type { AuthContext, TenantView } from "../../shared/context.js";
import { NotFoundError, ValidationError } from "../../shared/errors.js";
import type { AuditService, RequestMeta } from "../audit/audit.service.js";
import { Reservation } from "../reservations/reservation.model.js";
import { Room, HOUSEKEEPING_STATUSES } from "../rooms/room.model.js";
import type { IRoom } from "../rooms/room.model.js";
import { RoomType } from "../rooms/roomType.model.js";
import { Payment } from "../payments/payment.model.js";
import { localDateRangeUtc } from "../../shared/localDate.js";
import { canTransitionHousekeeping, type HousekeepingStatus } from "./housekeeping.transitions.js";

interface Deps { audit: AuditService }

export function createOperationsService({ audit }: Deps) {
  return {
    async listHousekeeping(tenantId: Types.ObjectId, status?: (typeof HOUSEKEEPING_STATUSES)[number]) {
      const filter = { tenantId, isActive: true, ...(status ? { housekeepingStatus: status } : {}) };
      const [rooms, types] = await Promise.all([
        Room.find(filter).sort({ housekeepingStatus: 1, roomNumber: 1 }).lean(),
        RoomType.find({ tenantId }).select("name").lean(),
      ]);
      const typeNames = new Map(types.map((t) => [String(t._id), t.name]));
      return rooms.map((r) => ({
        id: String(r._id), roomNumber: r.roomNumber, roomTypeId: String(r.roomTypeId),
        roomTypeName: typeNames.get(String(r.roomTypeId)) ?? "Unknown room type", floor: r.floor,
        roomStatus: r.status, housekeepingStatus: r.housekeepingStatus,
        needsAttention: r.housekeepingStatus === "DIRTY" || r.housekeepingStatus === "CLEANING",
      }));
    },

    async updateHousekeeping(actor: AuthContext, tenant: TenantView, roomId: string, status: string, meta: RequestMeta) {
      if (!(HOUSEKEEPING_STATUSES as readonly string[]).includes(status)) throw new ValidationError("Choose a valid housekeeping status.");
      const room = await Room.findOne({ _id: roomId, tenantId: tenant.id });
      if (!room) throw new NotFoundError("Room not found.");
      if (!room.isActive) throw new ValidationError("Inactive rooms cannot be updated through housekeeping.");
      const before = room.housekeepingStatus;
      if (before === status) return { id: String(room._id), roomNumber: room.roomNumber, housekeepingStatus: room.housekeepingStatus, unchanged: true };
      if (!canTransitionHousekeeping(before, status as HousekeepingStatus)) throw new ValidationError(`Housekeeping status cannot move from ${before} to ${status}.`);
      room.housekeepingStatus = status as typeof room.housekeepingStatus;
      await room.save();
      await audit.record({ tenantId: tenant.id, actorUserId: actor.userId, action: "HOUSEKEEPING_STATUS_UPDATED", resourceType: "Room", resourceId: String(room._id), before: { housekeepingStatus: before }, after: { housekeepingStatus: status }, meta });
      return { id: String(room._id), roomNumber: room.roomNumber, housekeepingStatus: room.housekeepingStatus };
    },

    async operationsReport(tenantId: Types.ObjectId, date: string, timeZone = "Africa/Lagos") {
      let range: { start: Date; end: Date };
      try { range = localDateRangeUtc(date, timeZone); }
      catch { throw new ValidationError("Choose a valid calendar date and hotel timezone."); }
      const dayStart = range.start;
      const dayEnd = range.end;
      const [roomTotals, arrivals, departures, inHouse, reservationsToday, paymentRows] = await Promise.all([
        Room.aggregate([{ $match: { tenantId, isActive: true } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
        Reservation.find({ tenantId, checkIn: date, status: trusted({ $in: ["PENDING", "CONFIRMED"] }) }).select("reference guest checkIn checkOut status roomId").sort({ checkIn: 1 }).lean(),
        Reservation.find({ tenantId, checkOut: date, status: "CHECKED_IN" }).select("reference guest checkIn checkOut status roomId").sort({ checkOut: 1 }).lean(),
        Reservation.countDocuments({ tenantId, status: "CHECKED_IN" }),
        Reservation.countDocuments({ tenantId, createdAt: trusted({ $gte: dayStart, $lt: dayEnd }), status: trusted({ $nin: ["CANCELLED", "NO_SHOW"] }) }),
        Payment.aggregate([{ $match: { tenantId, status: "SUCCESS", paidAt: { $gte: dayStart, $lt: dayEnd } } }, { $group: { _id: "$currency", total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
      ]);
      const rooms = Object.fromEntries(roomTotals.map((x: { _id: string; count: number }) => [x._id, x.count]));
      const totalRooms = Object.values(rooms).reduce((sum: number, n) => sum + Number(n), 0);
      const occupiedRooms = Number(rooms["OCCUPIED"] ?? 0);
      const housekeeping = await Room.aggregate([{ $match: { tenantId, isActive: true } }, { $group: { _id: "$housekeepingStatus", count: { $sum: 1 } } }]);
      return {
        date, rooms: { total: totalRooms, available: Number(rooms["AVAILABLE"] ?? 0), reserved: Number(rooms["RESERVED"] ?? 0), occupied: occupiedRooms, maintenance: Number(rooms["MAINTENANCE"] ?? 0) + Number(rooms["OUT_OF_SERVICE"] ?? 0), occupancyPercent: totalRooms ? Math.round((occupiedRooms / totalRooms) * 1000) / 10 : 0 },
        housekeeping: Object.fromEntries(housekeeping.map((x: { _id: string; count: number }) => [x._id, x.count])),
        arrivals: arrivals.map((r) => ({ reference: r.reference, guestName: r.guest.fullName, checkIn: r.checkIn, checkOut: r.checkOut, status: r.status, roomId: String(r.roomId) })),
        departures: departures.map((r) => ({ reference: r.reference, guestName: r.guest.fullName, checkIn: r.checkIn, checkOut: r.checkOut, status: r.status, roomId: String(r.roomId) })),
        inHouseGuests: inHouse, reservationsCreatedToday: reservationsToday,
        paymentsCollected: paymentRows.map((p: { _id: string; total: number; count: number }) => ({ currency: p._id, total: p.total, transactions: p.count })),
      };
    },
  };
}
export type OperationsService = ReturnType<typeof createOperationsService>;
