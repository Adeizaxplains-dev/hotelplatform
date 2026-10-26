import { describe, expect, it } from "vitest";
import { formatMoney } from "./format";

describe("formatMoney", () => {
  it("formats integer kobo as the corresponding major currency amount", () => {
    const formatted = formatMoney(8_500_000, "NGN", "en-NG");
    expect(formatted).toContain("85,000");
    expect(formatted).not.toContain("8,500,000");
  });
});
