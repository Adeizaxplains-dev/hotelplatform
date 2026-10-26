import type { Express, RequestHandler } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AuthenticationError, AuthorizationError, BusinessRuleError, ConflictError, FeatureNotAvailableError,
  NotFoundError, PaymentError, RateLimitError, TenantAccessError, ValidationError,
} from "../../src/shared/errors.js";
import { makeApp, makeEnv } from "../helpers.js";

const probe = (handler: RequestHandler, method: "get" | "post" = "get") => (app: Express) => {
  app[method]("/api/v1/probe", handler);
};

describe("error contract", () => {
  const cases: Array<[string, Error, number, string]> = [
    ["ValidationError", new ValidationError(), 400, "VALIDATION_ERROR"],
    ["AuthenticationError", new AuthenticationError(), 401, "UNAUTHENTICATED"],
    ["AuthorizationError", new AuthorizationError(), 403, "FORBIDDEN"],
    ["TenantAccessError", new TenantAccessError(), 403, "TENANT_ACCESS_DENIED"],
    ["FeatureNotAvailableError", new FeatureNotAvailableError(), 403, "FEATURE_NOT_AVAILABLE"],
    ["NotFoundError", new NotFoundError(), 404, "NOT_FOUND"],
    ["ConflictError", new ConflictError(), 409, "CONFLICT"],
    ["BusinessRuleError", new BusinessRuleError("Room is not available."), 422, "BUSINESS_RULE_VIOLATION"],
    ["PaymentError", new PaymentError(), 422, "PAYMENT_ERROR"],
    ["RateLimitError", new RateLimitError(), 429, "RATE_LIMITED"],
  ];

  it.each(cases)("%s maps to %i %s", async (_name, error, status, code) => {
    const app = makeApp({ mountRoutes: probe((_req, _res, next) => next(error)) });
    const res = await request(app).get("/api/v1/probe");
    expect(res.status).toBe(status);
    expect(res.body).toMatchObject({ success: false, error: { code, message: error.message } });
  });

  it("returns 404 in the contract for unknown routes", async () => {
    const res = await request(makeApp()).get("/api/v1/nothing-here");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
  });

  it("returns 400 INVALID_JSON for malformed JSON", async () => {
    const app = makeApp({ mountRoutes: probe((_q, res) => void res.json({ ok: true }), "post") });
    const res = await request(app).post("/api/v1/probe").set("Content-Type", "application/json").send("{bad json");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });

  it("returns 413 for bodies above the limit", async () => {
    const app = makeApp({ env: makeEnv({ BODY_LIMIT: "1kb" }), mountRoutes: probe((_q, res) => void res.json({ ok: true }), "post") });
    const res = await request(app).post("/api/v1/probe").send({ blob: "x".repeat(5000) });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("turns an unexpected exception into a generic 500 with no internals", async () => {
    const boom = () => {
      throw new Error("connect ECONNREFUSED mongodb://admin:hunter2@db.internal:27017");
    };
    for (const NODE_ENV of ["development", "production"]) {
      const env = makeEnv(NODE_ENV === "production" ? { NODE_ENV, CLIENT_URL: "https://hotel.example.com" } : { NODE_ENV });
      const res = await request(makeApp({ env, mountRoutes: probe(boom) })).get("/api/v1/probe").set("Host", "platform.test");
      const text = JSON.stringify(res.body);
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe("INTERNAL_ERROR");
      expect(text).not.toMatch(/hunter2|mongodb:|ECONNREFUSED|stack|at .*\.ts/i);
    }
  });

  it("handles async handler rejections (Express 5)", async () => {
    const app = makeApp({ mountRoutes: probe(async () => { throw new NotFoundError("Room not found."); }) });
    const res = await request(app).get("/api/v1/probe");
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Room not found.");
  });
});

describe("NoSQL operator rejection", () => {
  const echo = probe((req, res) => void res.json({ body: req.body }), "post");

  it("rejects $-operators in the body", async () => {
    const res = await request(makeApp({ mountRoutes: echo })).post("/api/v1/probe").send({ email: { $ne: null }, password: { $gt: "" } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects nested operators and dotted paths", async () => {
    const app = makeApp({ mountRoutes: echo });
    expect((await request(app).post("/api/v1/probe").send({ a: [{ b: { $where: "1" } }] })).status).toBe(400);
    expect((await request(app).post("/api/v1/probe").send({ "profile.role": "admin" })).status).toBe(400);
  });

  it("rejects operators in the query string", async () => {
    const app = makeApp({ mountRoutes: probe((_q, res) => void res.json({ ok: true })) });
    expect((await request(app).get("/api/v1/probe?email[$ne]=x")).status).toBe(400);
    expect((await request(app).get("/api/v1/probe?$where=1")).status).toBe(400);
  });

  it("lets ordinary payloads through", async () => {
    const res = await request(makeApp({ mountRoutes: echo })).post("/api/v1/probe").send({ name: "Deluxe Room", price: 85000, tags: ["wifi", "ac"] });
    expect(res.status).toBe(200);
    expect(res.body.body.name).toBe("Deluxe Room");
  });
});

describe("validate() middleware", () => {
  it("accepts valid data, strips unknown fields and exposes typed values", async () => {
    const { validate, getValidated } = await import("../../src/middleware/validate.js");
    const schema = z.object({ name: z.string().min(2), nights: z.number().int().positive() });
    const app = makeApp({
      mountRoutes: (a) =>
        a.post("/api/v1/probe", validate({ body: schema }), (_req, res) => {
          res.json({ received: getValidated<z.infer<typeof schema>>(res).body });
        }),
    });
    const res = await request(app).post("/api/v1/probe").send({ name: "Suite", nights: 2, role: "OWNER" });
    expect(res.status).toBe(200);
    expect(res.body.received).toEqual({ name: "Suite", nights: 2 });
  });

  it("returns field-level errors without echoing input", async () => {
    const { validate } = await import("../../src/middleware/validate.js");
    const app = makeApp({ mountRoutes: (a) => a.post("/api/v1/probe", validate({ body: z.object({ name: z.string().min(2) }).strict() }), (_q, r) => void r.json({})) });
    const res = await request(app).post("/api/v1/probe").send({ name: "x", tenantId: "other-hotel" });
    expect(res.status).toBe(400);
    expect(res.body.error.details.length).toBeGreaterThan(0);
    expect(JSON.stringify(res.body)).not.toContain("other-hotel");
  });
});
