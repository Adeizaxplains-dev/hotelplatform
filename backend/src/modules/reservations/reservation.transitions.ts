import { BusinessRuleError } from "../../shared/errors.js";

export type ReservationStatus = "PENDING" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";
export type StaffReservationStatus = "CONFIRMED" | "CANCELLED" | "CHECKED_IN" | "CHECKED_OUT" | "NO_SHOW";

const transitions: Record<ReservationStatus, readonly StaffReservationStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["CANCELLED", "CHECKED_IN", "NO_SHOW"],
  CHECKED_IN: ["CHECKED_OUT"],
  CHECKED_OUT: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function assertReservationTransition(current: ReservationStatus, next: StaffReservationStatus): void {
  if (!transitions[current]?.includes(next)) {
    throw new BusinessRuleError(`A reservation cannot move from ${current} to ${next}.`, "INVALID_RESERVATION_TRANSITION");
  }
}

export function allowedReservationTransitions(current: ReservationStatus): readonly StaffReservationStatus[] {
  return transitions[current] ?? [];
}
