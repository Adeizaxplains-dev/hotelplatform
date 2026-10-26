import { SignJWT } from "jose";
import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { createTokenService } from "../../src/modules/auth/token.service.js";
import { makeEnv } from "../helpers.js";

const env = makeEnv();
const svc = createTokenService(env);
const ids = { userId: new Types.ObjectId(), sessionId: new Types.ObjectId(), tenantId: new Types.ObjectId() };
const key = (secret: string) => new TextEncoder().encode(secret);

async function forge(opts: { secret?: string; aud?: string; iss?: string; exp?: string; tid?: string | null; alg?: string }) {
  return new SignJWT({ sid: String(ids.sessionId), tid: opts.tid === undefined ? String(ids.tenantId) : opts.tid })
    .setProtectedHeader({ alg: (opts.alg ?? "HS256") as "HS256" })
    .setSubject(String(ids.userId)).setIssuer(opts.iss ?? "hotel-platform").setAudience(opts.aud ?? "hotel-platform-api")
    .setIssuedAt().setExpirationTime(opts.exp ?? "5m").sign(key(opts.secret ?? env.ACCESS_TOKEN_SECRET));
}

describe("access tokens", () => {
  it("round-trips the three ids and nothing about role or permissions", async () => {
    const token = await svc.signAccessToken(ids);
    const claims = await svc.verifyAccessToken(token);
    expect(String(claims.userId)).toBe(String(ids.userId));
    expect(String(claims.tenantId)).toBe(String(ids.tenantId));
    const payload = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString());
    expect(Object.keys(payload).sort()).toEqual(["aud", "exp", "iat", "iss", "sid", "sub", "tid"]);
  });

  it("platform tokens carry a null tenant", async () => {
    expect((await svc.verifyAccessToken(await svc.signAccessToken({ ...ids, tenantId: null }))).tenantId).toBeNull();
  });

  it.each([
    ["wrong signing secret", () => forge({ secret: "z".repeat(40) })],
    ["expired", () => forge({ exp: "-10s" })],
    ["wrong audience", () => forge({ aud: "someone-else" })],
    ["wrong issuer", () => forge({ iss: "evil" })],
    ["non-ObjectId tenant claim", () => forge({ tid: "not-an-id" })],
    ["alg none", async () => `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: String(ids.userId), sid: String(ids.sessionId), tid: null, iss: "hotel-platform", aud: "hotel-platform-api", exp: 9999999999 })).toString("base64url")}.`],
    ["a different HMAC algorithm", () => forge({ alg: "HS512" })],
    ["garbage", async () => "not.a.jwt"],
    ["empty", async () => ""],
  ])("rejects %s", async (_name, make) => {
    await expect(svc.verifyAccessToken(await make())).rejects.toMatchObject({ code: "UNAUTHENTICATED", statusCode: 401 });
  });

  it("rejects a tampered payload", async () => {
    const [h, , s] = (await svc.signAccessToken(ids)).split(".");
    const evil = Buffer.from(JSON.stringify({ sub: String(new Types.ObjectId()), sid: String(ids.sessionId), tid: null, iss: "hotel-platform", aud: "hotel-platform-api", exp: 9999999999 })).toString("base64url");
    await expect(svc.verifyAccessToken(`${h}.${evil}.${s}`)).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe("opaque tokens", () => {
  it("are unique, long, and stored only as an HMAC", () => {
    const a = svc.newRefreshToken();
    const b = svc.newRefreshToken();
    expect(a.raw).not.toBe(b.raw);
    expect(a.raw.length).toBeGreaterThanOrEqual(60);
    expect(a.hash).not.toContain(a.raw);
    expect(svc.hashRefreshToken(a.raw)).toBe(a.hash);
  });
  it("refresh and one-time token hashes never collide for the same raw value", () => {
    expect(svc.hashRefreshToken("same")).not.toBe(svc.hashOneTimeToken("same"));
  });
});
