import { describe, expect, it } from "vitest";
import { EnvError, loadEnv } from "../../src/config/env.js";
import { VALID_RAW_ENV, makeEnv } from "../helpers.js";

describe("environment validation", () => {
  it("accepts a valid configuration and applies defaults", () => {
    const env = makeEnv({ PORT: undefined });
    expect(env.PORT).toBe(5000);
    expect(env.CLIENT_URL).toEqual(["http://localhost:5173"]);
    expect(env.TRUST_PROXY).toBe(false);
    expect(env.EMAIL_PROVIDER).toBe("console");
  });

  it("fails fast when required variables are missing", () => {
    expect(() => loadEnv({})).toThrow(EnvError);
  });

  it("rejects short secrets and identical secrets", () => {
    expect(() => makeEnv({ ACCESS_TOKEN_SECRET: "short" })).toThrow(/ACCESS_TOKEN_SECRET/);
    expect(() => makeEnv({ REFRESH_TOKEN_SECRET: "a".repeat(40) })).toThrow(/must differ/);
  });

  it("never echoes secret values in error messages", () => {
    const secret = "super-secret-value-that-is-too-short";
    try {
      makeEnv({ ACCESS_TOKEN_SECRET: "x".repeat(10), DATABASE_URL: `postgres://user:${secret}@host/db` });
      expect.unreachable();
    } catch (err) {
      expect((err as Error).message).not.toContain(secret);
      expect((err as Error).message).not.toContain("x".repeat(10));
    }
  });

  it("requires a MongoDB connection string", () => {
    expect(() => makeEnv({ DATABASE_URL: "postgres://x" })).toThrow(/DATABASE_URL/);
  });

  it("accepts several CLIENT_URL origins and rejects wildcards or paths", () => {
    expect(makeEnv({ CLIENT_URL: "http://localhost:5173, https://hotel.example.com/" }).CLIENT_URL).toEqual([
      "http://localhost:5173",
      "https://hotel.example.com",
    ]);
    expect(() => makeEnv({ CLIENT_URL: "*" })).toThrow(/CLIENT_URL/);
    expect(() => makeEnv({ CLIENT_URL: "https://hotel.example.com/app" })).toThrow(/CLIENT_URL/);
  });

  it("applies stricter rules in production", () => {
    const prod = { ...VALID_RAW_ENV, NODE_ENV: "production" };
    expect(() => loadEnv({ ...prod, CLIENT_URL: "http://hotel.example.com" })).toThrow(/https/);
    expect(() => loadEnv({ ...prod, CLIENT_URL: "https://hotel.example.com", ACCESS_TOKEN_SECRET: "change-me-".repeat(5) })).toThrow(/placeholder/);
    expect(() => loadEnv({ ...prod, CLIENT_URL: "https://hotel.example.com", PLATFORM_DOMAIN: undefined })).toThrow(/PLATFORM_DOMAIN/);
    expect(loadEnv({ ...prod, CLIENT_URL: "https://hotel.example.com" }).NODE_ENV).toBe("production");
  });

  it("parses TRUST_PROXY as boolean or hop count", () => {
    expect(makeEnv({ TRUST_PROXY: "1" }).TRUST_PROXY).toBe(1);
    expect(makeEnv({ TRUST_PROXY: "true" }).TRUST_PROXY).toBe(true);
    expect(() => makeEnv({ TRUST_PROXY: "maybe" })).toThrow(/TRUST_PROXY/);
  });
});
