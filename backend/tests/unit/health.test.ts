import request from "supertest";
import { describe, expect, it } from "vitest";
import { makeApp } from "../helpers.js";

describe("GET /api/v1/health", () => {
  it("returns the success contract with service info", async () => {
    const res = await request(makeApp()).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ status: "ok", service: "hotel-platform-api", database: "connected" });
    expect(typeof res.body.data.version).toBe("string");
    expect(Number.isNaN(Date.parse(res.body.data.timestamp))).toBe(false);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("does not leak environment or secrets", async () => {
    const res = await request(makeApp()).get("/api/v1/health");
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/mongodb:|SECRET|environment/i);
  });

  it("stays alive but reports database 'disconnected' when MongoDB is down", async () => {
    const res = await request(makeApp({ health: { getDatabaseStatus: () => "disconnected" } })).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.data.database).toBe("disconnected");
  });
});

describe("GET /api/v1/health/ready", () => {
  it("is 200 when the database answers", async () => {
    const res = await request(makeApp()).get("/api/v1/health/ready");
    expect(res.status).toBe(200);
  });

  it("is 503 with the error contract when the database does not answer", async () => {
    const res = await request(makeApp({ health: { pingDatabase: async () => false } })).get("/api/v1/health/ready");
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ success: false, error: { code: "SERVICE_UNAVAILABLE" } });
  });
});
