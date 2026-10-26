import { afterAll, describe, expect, it } from "vitest";
import { Client, createHotel, platformClient, startHarness, stopHarness } from "./harness.js";

afterAll(stopHarness);

describe("auth throttling (default limits)", () => {
  it("returns 429 after repeated sign-in attempts for the same IP + email, but not for a different email", async () => {
    const h = await startHarness({ AUTH_RATE_LIMIT_SCALE: "1" });
    const ops = await platformClient(h);
    const hotel = await createHotel(h, ops, "throttle", "BOOKING");
    const c = new Client(h.app, hotel.host);
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await c.post("/auth/login", { email: "spray@throttle.example.com", password: "Wrong-Password-1" })).status;
    expect(last).toBe(429);
    const other = await c.post("/auth/login", { email: "someone-else@throttle.example.com", password: "Wrong-Password-1" });
    expect(other.status).toBe(401);
  });

  it("limits password-reset requests per IP + email", async () => {
    const h = await startHarness({ AUTH_RATE_LIMIT_SCALE: "1" });
    const c = new Client(h.app, "platform.test");
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await c.post("/auth/forgot-password", { email: "ops@platform.test" })).status);
    expect(codes.slice(0, 5).every((s) => s === 200)).toBe(true);
    expect(codes.slice(5).every((s) => s === 429)).toBe(true);
  });
});

describe("production cookie", () => {
  it("marks the refresh cookie Secure", async () => {
    const h = await startHarness({ NODE_ENV: "production", CLIENT_URL: "https://platform.test", AUTH_RATE_LIMIT_SCALE: "1" });
    const ops = await platformClient(h);
    const hotel = await createHotel(h, ops, "prodhotel", "BOOKING");
    const res = await new Client(h.app, hotel.host).login(hotel.ownerEmail);
    expect(res.status).toBe(200);
    const cookie = (res.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("hp_rt="))!;
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });
});
