import { Schema, model, type Types } from "mongoose";
import { tenantScope } from "../../database/plugins/tenantScope.js";

export const ROOM_STATUSES = ["AVAILABLE", "RESERVED", "OCCUPIED", "MAINTENANCE", "OUT_OF_SERVICE"] as const;
export const HOUSEKEEPING_STATUSES = ["CLEAN", "DIRTY", "CLEANING", "INSPECTED"] as const;

export interface IRoom {
  tenantId: Types.ObjectId;
  roomNumber: string;
  roomTypeId: Types.ObjectId;
  floor?: number | undefined;
  status: (typeof ROOM_STATUSES)[number];
  housekeepingStatus: (typeof HOUSEKEEPING_STATUSES)[number];
  isActive: boolean;
}

const schema = new Schema<IRoom>(
  {
    roomNumber: { type: String, required: true, trim: true, maxlength: 20 },
    roomTypeId: { type: Schema.Types.ObjectId, ref: "RoomType", required: true },
    floor: { type: Number, min: -5, max: 200 },
    status: { type: String, enum: ROOM_STATUSES, default: "AVAILABLE" },
    housekeepingStatus: { type: String, enum: HOUSEKEEPING_STATUSES, default: "CLEAN" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
tenantScope(schema);
// A room number is unique within ONE hotel; two hotels can both have a room 101.
schema.index({ tenantId: 1, roomNumber: 1 }, { unique: true });
schema.index({ tenantId: 1, roomTypeId: 1 });
export const Room = model<IRoom>("Room", schema);
