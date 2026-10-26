import type { HOUSEKEEPING_STATUSES } from "../rooms/room.model.js";
export type HousekeepingStatus = (typeof HOUSEKEEPING_STATUSES)[number];

const TRANSITIONS: Record<HousekeepingStatus, readonly HousekeepingStatus[]> = {
  DIRTY: ["CLEANING"],
  CLEANING: ["DIRTY", "CLEAN"],
  CLEAN: ["DIRTY", "CLEANING", "INSPECTED"],
  INSPECTED: ["DIRTY", "CLEANING"],
};

export const canTransitionHousekeeping = (from: HousekeepingStatus, to: HousekeepingStatus): boolean => from === to || TRANSITIONS[from].includes(to);
export const nextHousekeepingStatuses = (status: HousekeepingStatus): readonly HousekeepingStatus[] => TRANSITIONS[status];
