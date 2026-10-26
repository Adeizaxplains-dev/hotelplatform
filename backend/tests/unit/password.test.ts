import { describe, expect, it } from "vitest";
import { hashPassword, passwordProblemFor, passwordSchema, verifyPassword } from "../../src/shared/password.js";

describe("passwords", () => {
  it("hashes with Argon2id and verifies", async () => {
    const h = await hashPassword("a-long-enough-passphrase");
    expect(h.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(h, "a-long-enough-passphrase")).toBe(true);
    expect(await verifyPassword(h, "wrong")).toBe(false);
  });
  it("never throws on a malformed hash", async () => {
    expect(await verifyPassword("not-a-hash", "x")).toBe(false);
  });
  it("salts: the same password gives different hashes", async () => {
    expect(await hashPassword("same-password-123")).not.toBe(await hashPassword("same-password-123"));
  });
  it("policy: length and common passwords", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("password123").success).toBe(false);
    expect(passwordSchema.safeParse("x".repeat(129)).success).toBe(false);
    expect(passwordSchema.safeParse("Correct-Horse-9").success).toBe(true);
  });
  it("policy: not derived from the email", () => {
    expect(passwordProblemFor("amara.okafor-2026", "amara.okafor@hotel.com")).toMatch(/email/);
    expect(passwordProblemFor("Correct-Horse-9", "amara.okafor@hotel.com")).toBeNull();
  });
});
