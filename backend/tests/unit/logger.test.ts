import { Writable } from "node:stream";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createLogger } from "../../src/shared/logger.js";
import { createHealthService } from "../../src/modules/health/health.service.js";
import { makeEnv } from "../helpers.js";

function capture() {
  const lines: string[] = [];
  const stream = new Writable({ write(chunk, _enc, cb) { lines.push(chunk.toString()); cb(); } });
  return { lines, stream };
}

describe("structured logging", () => {
  it("redacts secrets in logged objects", () => {
    const { lines, stream } = capture();
    const logger = createLogger({ NODE_ENV: "production", LOG_LEVEL: "info" }, stream);
    logger.info({ user: { password: "hunter2", token: "tok_abc" }, accessToken: "jwt.value", req: { headers: { authorization: "Bearer xyz", cookie: "sid=1" } } }, "x");
    const out = lines.join("");
    for (const secret of ["hunter2", "tok_abc", "jwt.value", "Bearer xyz", "sid=1"]) expect(out).not.toContain(secret);
    expect(out).toContain("[REDACTED]");
  });

  it("logs request id, method, path, status and response time, but not query strings or auth headers", async () => {
    const { lines, stream } = capture();
    const env = makeEnv();
    const logger = createLogger({ NODE_ENV: "production", LOG_LEVEL: "info" }, stream);
    const app = createApp({ env, logger, health: createHealthService({ getDatabaseStatus: () => "connected", pingDatabase: async () => true }) });

    await request(app).get("/api/v1/missing?resetToken=SECRETTOKEN123").set("Authorization", "Bearer SECRETJWT").set("X-Request-Id", "trace-abcdef12");
    await new Promise((r) => setTimeout(r, 20));

    const out = lines.join("");
    expect(out).not.toContain("SECRETTOKEN123");
    expect(out).not.toContain("SECRETJWT");
    const entry = JSON.parse(lines.find((l) => l.includes("/api/v1/missing")) ?? "{}");
    expect(entry.requestId).toBe("trace-abcdef12");
    expect(entry.req).toMatchObject({ method: "GET", path: "/api/v1/missing" });
    expect(entry.res.statusCode).toBe(404);
    expect(typeof entry.responseTime).toBe("number");
  });
});
