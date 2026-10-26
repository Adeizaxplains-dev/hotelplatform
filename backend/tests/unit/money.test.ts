import { describe, expect, it } from "vitest";
import { formatMinorUnits, gatewayAmountMatches, toPaystackMinorUnits } from "../../src/shared/money.js";

describe("minor-unit money handling", () => {
  it("passes an already-kobo amount to Paystack without multiplying it again", () => {
    expect(toPaystackMinorUnits(8_500_000)).toBe(8_500_000);
  });

  it("rejects zero, negative, fractional, and unsafe payment amounts", () => {
    for (const amount of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN]) {
      expect(toPaystackMinorUnits(amount)).toBeNull();
    }
  });

  it("compares Paystack minor-unit amounts exactly", () => {
    expect(gatewayAmountMatches(8_500_000, 8_500_000)).toBe(true);
    expect(gatewayAmountMatches(8_500_000, 850_000_000)).toBe(false);
    expect(gatewayAmountMatches(8_500_000, 8_500_000.5)).toBe(false);
  });

  it("formats stored kobo as naira for guest-facing messages", () => {
    const formatted = formatMinorUnits(8_500_000, "NGN");
    expect(formatted).toContain("85,000");
    expect(formatted).not.toContain("8,500,000");
  });
});
