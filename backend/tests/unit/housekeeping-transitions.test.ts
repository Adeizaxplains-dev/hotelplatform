import { describe, expect, it } from "vitest";
import { canTransitionHousekeeping, nextHousekeepingStatuses } from "../../src/modules/operations/housekeeping.transitions.js";

describe("housekeeping status transitions", () => {
  it("allows the normal dirty → cleaning → clean → inspected workflow", () => {
    expect(canTransitionHousekeeping("DIRTY", "CLEANING")).toBe(true);
    expect(canTransitionHousekeeping("CLEANING", "CLEAN")).toBe(true);
    expect(canTransitionHousekeeping("CLEAN", "INSPECTED")).toBe(true);
  });
  it("rejects skipping the cleaning step", () => {
    expect(canTransitionHousekeeping("DIRTY", "CLEAN")).toBe(false);
    expect(canTransitionHousekeeping("DIRTY", "INSPECTED")).toBe(false);
  });
  it("allows rooms to be marked dirty again and avoids duplicate actions", () => {
    expect(canTransitionHousekeeping("INSPECTED", "DIRTY")).toBe(true);
    expect(canTransitionHousekeeping("CLEAN", "DIRTY")).toBe(true);
    expect(canTransitionHousekeeping("CLEAN", "CLEAN")).toBe(true);
  });
  it("returns only the permitted next states", () => {
    expect(nextHousekeepingStatuses("DIRTY")).toEqual(["CLEANING"]);
    expect(nextHousekeepingStatuses("INSPECTED")).toEqual(["DIRTY", "CLEANING"]);
  });
});
