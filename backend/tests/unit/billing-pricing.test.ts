import { describe, expect, it } from "vitest";
import { addOneCalendarMonthUtc, parseMonthlyPriceKobo } from "../../src/modules/billing/billing.service.js";

describe("SaaS subscription pricing configuration", () => {
  it("accepts only positive safe integer kobo values", () => {
    expect(parseMonthlyPriceKobo("1500000")).toBe(1_500_000);
    expect(parseMonthlyPriceKobo("1")).toBe(1);
  });
  it("keeps checkout disabled when pricing is absent or invalid", () => {
    expect(parseMonthlyPriceKobo(undefined)).toBeNull();
    expect(parseMonthlyPriceKobo("")).toBeNull();
    expect(parseMonthlyPriceKobo("0")).toBeNull();
    expect(parseMonthlyPriceKobo("15000.00")).toBeNull();
    expect(parseMonthlyPriceKobo("-100")).toBeNull();
    expect(parseMonthlyPriceKobo("9007199254740992")).toBeNull();
  });
});

describe("subscription billing period boundaries", () => {
  it("clamps month-end dates instead of overflowing into the following month", () => {
    expect(addOneCalendarMonthUtc(new Date("2026-01-31T12:00:00.000Z")).toISOString()).toBe("2026-02-28T12:00:00.000Z");
    expect(addOneCalendarMonthUtc(new Date("2028-01-31T12:00:00.000Z")).toISOString()).toBe("2028-02-29T12:00:00.000Z");
  });
  it("preserves time and calendar day when the next month has that day", () => {
    expect(addOneCalendarMonthUtc(new Date("2026-03-15T09:45:00.000Z")).toISOString()).toBe("2026-04-15T09:45:00.000Z");
  });
  it("rejects invalid dates", () => {
    expect(() => addOneCalendarMonthUtc(new Date("invalid"))).toThrow(RangeError);
  });
});
