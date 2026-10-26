import type { Express } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { makeApp, makeEnv } from "../helpers.js";

describe("rate limiting", () => {
  const mount = (app: Express) => app.get("/api/v1/probe", (_q, r) => void r.json({ ok: true }));

  it("returns 429 in the error contract after the limit and sends standard headers", async () => {
    const app = makeApp({ env: makeEnv({ RATE_LIMIT_MAX: "3", RATE_LIMIT_WINDOW_MS: "60000" }), mountRoutes: mount });
    for (let i = 0; i < 3; i++) expect((await request(app).get("/api/v1/probe")).status).toBe(200);
    const res = await request(app).get("/api/v1/probe");
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ success: false, error: { code: "RATE_LIMITED" } });
    expect(res.headers["retry-after"]).toBeDefined();
    expect(res.headers["ratelimit"] ?? res.headers["ratelimit-policy"]).toBeDefined();
  });

  it("never throttles the health endpoint", async () => {
    const app = makeApp({ env: makeEnv({ RATE_LIMIT_MAX: "1", RATE_LIMIT_WINDOW_MS: "60000" }), mountRoutes: mount });
    for (let i = 0; i < 5; i++) expect((await request(app).get("/api/v1/health")).status).toBe(200);
  });
});
