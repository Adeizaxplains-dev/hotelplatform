import request from "supertest";
import { describe, expect, it } from "vitest";
import { makeApp, makeEnv } from "../helpers.js";

describe("security headers", () => {
  it("sets helmet headers and hides the framework", async () => {
    const res = await request(makeApp()).get("/api/v1/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["strict-transport-security"]).toBeDefined();
    expect(res.headers["x-frame-options"]).toBeDefined();
    expect(res.headers["content-security-policy"]).toBeDefined();
  });
});

describe("request id", () => {
  it("generates an id and returns it in the header", async () => {
    const res = await request(makeApp()).get("/api/v1/health");
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
  it("accepts a well-formed upstream id", async () => {
    const res = await request(makeApp()).get("/api/v1/health").set("X-Request-Id", "proxy-req-12345");
    expect(res.headers["x-request-id"]).toBe("proxy-req-12345");
  });
  it("replaces a malformed id (log-injection guard)", async () => {
    const res = await request(makeApp()).get("/api/v1/health").set("X-Request-Id", "bad id\twith spaces");
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
  it("includes the request id in error bodies", async () => {
    const res = await request(makeApp()).get("/api/v1/does-not-exist");
    expect(res.body.error.requestId).toBe(res.headers["x-request-id"]);
  });
});

describe("CORS", () => {
  const env = makeEnv({ CLIENT_URL: "http://localhost:5173,https://hotel.example.com" });

  it("allows configured origins with credentials", async () => {
    const res = await request(makeApp({ env })).get("/api/v1/health").set("Origin", "https://hotel.example.com");
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("https://hotel.example.com");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("answers preflight for an allowed origin", async () => {
    const res = await request(makeApp({ env }))
      .options("/api/v1/health")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
  });

  it("rejects an unknown origin with 403 and no CORS headers", async () => {
    const res = await request(makeApp({ env })).get("/api/v1/health").set("Origin", "https://evil.example.com");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CORS_ORIGIN_NOT_ALLOWED");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("rejects look-alike origins", async () => {
    for (const origin of ["https://hotel.example.com.evil.com", "http://hotel.example.com", "null"]) {
      const res = await request(makeApp({ env })).get("/api/v1/health").set("Origin", origin);
      expect(res.status, origin).toBe(403);
    }
  });

  it("allows requests with no Origin (server-to-server, webhooks)", async () => {
    const res = await request(makeApp({ env })).get("/api/v1/health");
    expect(res.status).toBe(200);
  });
});
