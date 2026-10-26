import { Schema, model, type Types } from "mongoose";
import { tenantScope } from "../../database/plugins/tenantScope.js";

/** One allocation per room per occupied night. The unique index is the final concurrency guard. */
export interface IRoomNight {
  tenantId: Types.ObjectId;
  roomId: Types.ObjectId;
  reservationId: Types.ObjectId;
  night: string;
}
const schema = new Schema<IRoomNight>({
  roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true },
  reservationId: { type: Schema.Types.ObjectId, ref: "Reservation", required: true },
  night: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
}, { timestamps: true });
tenantScope(schema, { indexed: false });
schema.index({ tenantId: 1, roomId: 1, night: 1 }, { unique: true });
schema.index({ tenantId: 1, reservationId: 1 });
export const RoomNight = model<IRoomNight>("RoomNight", schema);
