import { describe, expect, it } from "vitest";
import { BusinessRuleError } from "../../src/shared/errors.js";
import { allowedReservationTransitions, assertReservationTransition } from "../../src/modules/reservations/reservation.transitions.js";

describe("reservation operational transitions", () => {
  it("allows only valid forward staff transitions", () => {
    expect(allowedReservationTransitions("PENDING")).toEqual(["CONFIRMED", "CANCELLED", "NO_SHOW"]);
    expect(() => assertReservationTransition("CONFIRMED", "CHECKED_IN")).not.toThrow();
    expect(() => assertReservationTransition("CHECKED_IN", "CHECKED_OUT")).not.toThrow();
  });

  it("rejects skipping check-in, reopening closed reservations, and repeat check-in", () => {
    for (const [from, to] of [["PENDING", "CHECKED_IN"], ["CHECKED_IN", "CHECKED_IN"], ["CHECKED_OUT", "CHECKED_IN"], ["CANCELLED", "CONFIRMED"], ["NO_SHOW", "CHECKED_IN"]] as const) {
      expect(() => assertReservationTransition(from, to)).toThrow(BusinessRuleError);
    }
  });

  it("does not permit checkout from a reservation that was never checked in", () => {
    expect(() => assertReservationTransition("CONFIRMED", "CHECKED_OUT")).toThrow(/cannot move/);
  });
});
