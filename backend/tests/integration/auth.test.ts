import { SignJWT } from "jose";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Session } from "../../src/modules/auth/session.model.js";
import { User } from "../../src/modules/users/user.model.js";
import { makeEnv } from "../helpers.js";
import { Client, PASSWORD, createHotel, linkToken, platformClient, startHarness, stopHarness, type Harness, type Hotel } from "./harness.js";

let h: Harness;
let ops: Client;
let alpha: Hotel; // BOOKING plan: guests can register
let web: Hotel; // WEBSITE plan: no booking

beforeAll(async () => {
  h = await startHarness();
  ops = await platformClient(h);
  alpha = await createHotel(h, ops, "alpha", "BOOKING");
  web = await createHotel(h, ops, "webonly", "WEBSITE");
});
afterAll(stopHarness);

const fresh = (host = alpha.host) => new Client(h.app, host);

describe("login", () => {
  it("signs in and returns a short-lived token, the safe user, and an HttpOnly SameSite=Strict refresh cookie", async () => {
    const res = await fresh().login(alpha.ownerEmail);
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user).toMatchObject({ email: alpha.ownerEmail, role: "HOTEL_OWNER", isActive: true });
    expect(res.headers["cache-control"]).toBe("no-store");
    const cookie = (res.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("hp_rt="))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    expect(cookie).not.toMatch(/Domain=/i); // host-only: never sent to another hotel
    expect(cookie).not.toMatch(/Secure/i); // test env is not production
  });

  it("never returns password hashes or the refresh token in the body", async () => {
    const res = await fresh().login(alpha.ownerEmail);
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/argon2|passwordHash|refreshToken|hp_rt/i);
  });

  it("gives the same answer for a wrong password and an unknown email (no account enumeration)", async () => {
    const wrong = await fresh().post("/auth/login", { email: alpha.ownerEmail, password: "Not-The-Password-1" });
    const unknown = await fresh().post("/auth/login", { email: "nobody@alpha.example.com", password: "Not-The-Password-1" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
    expect(wrong.body.error.code).toBe(unknown.body.error.code);
  });

  it("rejects operator-injection style bodies", async () => {
    const res = await fresh().post("/auth/login", { email: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
  });

  it("rejects extra fields (strict body)", async () => {
    const res = await fresh().post("/auth/login", { email: alpha.ownerEmail, password: PASSWORD, role: "PLATFORM_SUPER_ADMIN" });
    expect(res.status).toBe(400);
  });

  it("a disabled account with the right password gets ACCOUNT_DISABLED; with a wrong one, the generic error", async () => {
    const email = "disabled@alpha.example.com";
    const { id } = await (async () => {
      const r = await alpha.owner.post("/users", { name: "Dis Abled", email, role: "STAFF" });
      return { id: r.body.data?.id as string | undefined };
    })();
    // BOOKING plan has no staff feature, so create the account directly for this check.
    expect(id).toBeUndefined();
    const u = await User.create({ tenantId: new mongoose.Types.ObjectId(await tenantIdOf("alpha")), name: "Dis Abled", email, role: "STAFF", isActive: false, passwordHash: await (await import("../../src/shared/password.js")).hashPassword(PASSWORD) });
    expect(u.isActive).toBe(false);
    const right = await fresh().post("/auth/login", { email, password: PASSWORD });
    expect(right.status).toBe(403);
    expect(right.body.error.code).toBe("ACCOUNT_DISABLED");
    const wrong = await fresh().post("/auth/login", { email, password: "Wrong-Password-1" });
    expect(wrong.status).toBe(401);
  });

  it("locks the account after 5 wrong passwords, even for the correct password, then recovers", async () => {
    const email = "lockme@alpha.example.com";
    const tid = new mongoose.Types.ObjectId(await tenantIdOf("alpha"));
    await User.create({ tenantId: tid, name: "Lock Me", email, role: "CUSTOMER", passwordHash: await (await import("../../src/shared/password.js")).hashPassword(PASSWORD) });
    for (let i = 0; i < 5; i++) expect((await fresh().post("/auth/login", { email, password: "Wrong-Password-1" })).status).toBe(401);
    const locked = await fresh().post("/auth/login", { email, password: PASSWORD });
    expect(locked.status).toBe(401);
    expect(locked.body.error.code).toBe("INVALID_CREDENTIALS"); // indistinguishable from a wrong password
    await User.updateOne({ tenantId: tid, email }, { $unset: { lockedUntil: 1 } });
    expect((await fresh().post("/auth/login", { email, password: PASSWORD })).status).toBe(200);
  });

  it("login on an unknown hotel address is a uniform 404", async () => {
    const res = await new Client(h.app, "ghost.platform.test").post("/auth/login", { email: "a@b.co", password: PASSWORD });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TENANT_NOT_FOUND");
  });

  it("a hotel owner cannot sign in on the platform host, nor a platform operator on a hotel host", async () => {
    expect((await new Client(h.app, "platform.test").post("/auth/login", { email: alpha.ownerEmail, password: PASSWORD })).status).toBe(401);
    expect((await new Client(h.app, alpha.host).post("/auth/login", { email: "ops@platform.test", password: PASSWORD })).status).toBe(401);
  });
});

describe("access tokens in requests", () => {
  it("/auth/me needs a valid bearer token", async () => {
    expect((await fresh().get("/auth/me")).status).toBe(401);
    const c = fresh(); await c.login(alpha.ownerEmail);
    const me = await c.get("/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.data.user.role).toBe("HOTEL_OWNER");
    expect(me.body.data.permissions).toContain("staff.create");
    expect(me.body.data.features).toContain("booking");
    expect(me.body.data.tenant.slug).toBe("alpha");
  });

  it.each([
    ["no Bearer prefix", (t: string) => t],
    ["Basic scheme", (t: string) => `Basic ${t}`],
    ["tampered signature", (t: string) => `Bearer ${t.slice(0, -4)}AAAA`],
    ["empty bearer", () => "Bearer "],
  ])("rejects %s", async (_n, build) => {
    const c = fresh(); await c.login(alpha.ownerEmail);
    const res = await c.get("/auth/me", { Authorization: build(c.token!) });
    expect(res.status).toBe(401);
  });

  it("rejects an expired token and a token signed with another secret", async () => {
    const c = fresh(); await c.login(alpha.ownerEmail);
    const claims = JSON.parse(Buffer.from(c.token!.split(".")[1]!, "base64url").toString());
    const sign = (secret: string, exp: string) => new SignJWT({ sid: claims.sid, tid: claims.tid }).setProtectedHeader({ alg: "HS256" }).setSubject(claims.sub).setIssuer("hotel-platform").setAudience("hotel-platform-api").setIssuedAt().setExpirationTime(exp).sign(new TextEncoder().encode(secret));
    const secret = makeEnv().ACCESS_TOKEN_SECRET;
    expect((await c.get("/auth/me", { Authorization: `Bearer ${await sign(secret, "-1m")}` })).status).toBe(401);
    expect((await c.get("/auth/me", { Authorization: `Bearer ${await sign("q".repeat(40), "5m")}` })).status).toBe(401);
    expect((await c.get("/auth/me", { Authorization: `Bearer ${await sign(secret, "5m")}` })).status).toBe(200); // control: the same forge with the right secret is the real thing
  });
});

describe("refresh tokens", () => {
  it("rotates on every use and returns a fresh access token", async () => {
    const c = fresh(); await c.login(alpha.ownerEmail);
    const before = c.cookie;
    const r = await c.post("/auth/refresh");
    expect(r.status).toBe(200);
    expect(r.body.data.accessToken).toBeTruthy();
    const after = (r.headers["set-cookie"] as unknown as string[]).find((x) => x.startsWith("hp_rt="))!.split(";")[0];
    expect(after).not.toBe(before);
  });

  it("detects reuse of an already-rotated token and revokes the whole session", async () => {
    const c = fresh(); await c.login(alpha.ownerEmail);
    const stolen = c.cookie!;
    const rotated = await c.post("/auth/refresh");
    const legit = (rotated.headers["set-cookie"] as unknown as string[]).find((x) => x.startsWith("hp_rt="))!.split(";")[0]!;

    const attacker = fresh(); attacker.cookie = stolen;
    expect((await attacker.post("/auth/refresh")).status).toBe(401); // replay

    const victim = fresh(); victim.cookie = legit;
    expect((await victim.post("/auth/refresh")).status).toBe(401); // the legit token died with the session
    const s = await Session.find({ tenantId: new mongoose.Types.ObjectId(await tenantIdOf("alpha")), revokedReason: "REUSE_DETECTED" });
    expect(s.length).toBeGreaterThan(0);
  });

  // Needs a database with real single-document atomicity (MongoDB). The FerretDB stand-in used in some sandboxes is NOT atomic
  // here (verified with the raw driver), so this test is skipped only when TEST_DB_KIND=ferretdb. CI runs it on real MongoDB.
  it.skipIf(process.env["TEST_DB_KIND"] === "ferretdb")("two simultaneous refreshes with one token: at most one succeeds", async () => {
    const c = fresh(); await c.login(alpha.ownerEmail);
    const a = fresh(); a.cookie = c.cookie;
    const b = fresh(); b.cookie = c.cookie;
    const [ra, rb] = await Promise.all([a.post("/auth/refresh"), b.post("/auth/refresh")]);
    expect([ra.status, rb.status].filter((s) => s === 200).length).toBe(1);
  });

  it("fails without a cookie, with a junk cookie, and with another hotel's cookie", async () => {
    expect((await fresh().post("/auth/refresh")).status).toBe(401);
    const junk = fresh(); junk.cookie = "hp_rt=nonsense";
    expect((await junk.post("/auth/refresh")).status).toBe(401);
    const c = fresh(); await c.login(alpha.ownerEmail);
    const other = new Client(h.app, web.host); other.cookie = c.cookie;
    expect((await other.post("/auth/refresh")).status).toBe(401);
  });

  it("an expired session cannot be refreshed", async () => {
    const c = fresh(); await c.login(alpha.ownerEmail);
    await Session.updateMany({ tenantId: new mongoose.Types.ObjectId(await tenantIdOf("alpha")), revokedAt: null }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await c.post("/auth/refresh")).status).toBe(401);
  });
});

describe("logout and session revocation", () => {
  it("logout revokes the session: the refresh cookie and the access token both stop working", async () => {
    const c = fresh(); await c.login(alpha.ownerEmail);
    expect((await c.get("/auth/me")).status).toBe(200);
    expect((await c.post("/auth/logout")).status).toBe(200);
    expect((await c.post("/auth/refresh")).status).toBe(401);
    expect((await c.get("/auth/me")).status).toBe(401); // the access token is bound to the revoked session
  });

  it("logout-all revokes every device", async () => {
    const one = fresh(); await one.login(alpha.ownerEmail);
    const two = fresh(); await two.login(alpha.ownerEmail);
    expect((await one.post("/auth/logout-all")).status).toBe(200);
    expect((await two.get("/auth/me")).status).toBe(401);
    expect((await two.post("/auth/refresh")).status).toBe(401);
  });

  it("logout is idempotent and safe without a cookie", async () => {
    expect((await fresh().post("/auth/logout")).status).toBe(200);
  });
});

describe("password reset", () => {
  const email = "resetme@alpha.example.com";
  beforeAll(async () => {
    await User.create({ tenantId: new mongoose.Types.ObjectId(await tenantIdOf("alpha")), name: "Reset Me", email, role: "CUSTOMER", passwordHash: await (await import("../../src/shared/password.js")).hashPassword(PASSWORD), isActive: true });
  });

  it("answers identically whether or not the email has an account, and only emails real accounts", async () => {
    const before = h.email.outbox.length;
    const known = await fresh().post("/auth/forgot-password", { email });
    const unknown = await fresh().post("/auth/forgot-password", { email: "ghost@alpha.example.com" });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
    expect(h.email.outbox.length).toBe(before + 1);
    expect(h.email.last(email)!.text).toContain(`http://${alpha.host}/reset-password?token=`);
  });

  it("completes: new password works, old one and every old session die, the link is single-use", async () => {
    const old = fresh(); await old.login(email);
    await fresh().post("/auth/forgot-password", { email });
    const token = linkToken(h.email.last(email)!.text);

    expect((await fresh().post("/auth/reset-password", { token, password: "short" })).status).toBe(400);
    expect((await fresh().post("/auth/reset-password", { token, password: "password123" })).status).toBe(400); // weak: link NOT burned
    const ok = await fresh().post("/auth/reset-password", { token, password: "Brand-New-Passphrase-7" });
    expect(ok.status).toBe(200);

    expect((await fresh().post("/auth/login", { email, password: PASSWORD })).status).toBe(401);
    expect((await fresh().post("/auth/login", { email, password: "Brand-New-Passphrase-7" })).status).toBe(200);
    expect((await old.get("/auth/me")).status).toBe(401);
    expect((await old.post("/auth/refresh")).status).toBe(401);
    expect((await fresh().post("/auth/reset-password", { token, password: "Another-Passphrase-8" })).status).toBe(400);
  });

  it("rejects an expired link, a link for another hotel, and a made-up token", async () => {
    await fresh().post("/auth/forgot-password", { email });
    const token = linkToken(h.email.last(email)!.text);
    expect((await new Client(h.app, web.host).post("/auth/reset-password", { token, password: "Brand-New-Passphrase-9" })).status).toBe(400);
    expect((await fresh().post("/auth/reset-password", { token: "x".repeat(43), password: "Brand-New-Passphrase-9" })).status).toBe(400);
    const { VerificationToken } = await import("../../src/modules/auth/verificationToken.model.js");
    await VerificationToken.updateMany({ tenantId: new mongoose.Types.ObjectId(await tenantIdOf("alpha")) }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await fresh().post("/auth/reset-password", { token, password: "Brand-New-Passphrase-9" })).status).toBe(400);
  });

  it("a newer reset link voids the older one", async () => {
    await fresh().post("/auth/forgot-password", { email });
    const first = linkToken(h.email.last(email)!.text);
    await fresh().post("/auth/forgot-password", { email });
    const second = linkToken(h.email.last(email)!.text);
    expect((await fresh().post("/auth/reset-password", { token: first, password: "Brand-New-Passphrase-1" })).status).toBe(400);
    expect((await fresh().post("/auth/reset-password", { token: second, password: "Brand-New-Passphrase-1" })).status).toBe(200);
  });
});

describe("guest registration", () => {
  it("creates a CUSTOMER, verifies the email, and the role cannot be chosen by the caller", async () => {
    const res = await fresh().post("/auth/register", { name: "Amara Okafor", email: "amara@guest.com", password: PASSWORD, phone: "08012345678" });
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ role: "CUSTOMER", emailVerified: false });
    const mail = h.email.last("amara@guest.com")!;
    expect((await fresh().post("/auth/verify-email", { token: linkToken(mail.text) })).status).toBe(200);
    const login = await fresh().post("/auth/login", { email: "amara@guest.com", password: PASSWORD });
    expect(login.body.data.user.emailVerified).toBe(true);
    expect((await fresh().post("/auth/verify-email", { token: linkToken(mail.text) })).status).toBe(400); // single use
  });

  it.each([
    ["role", { role: "HOTEL_OWNER" }],
    ["tenantId", { tenantId: "000000000000000000000000" }],
    ["isActive", { isActive: true }],
    ["emailVerifiedAt", { emailVerifiedAt: "2020-01-01" }],
  ])("rejects a body that tries to set %s (mass assignment)", async (_n, extra) => {
    const res = await fresh().post("/auth/register", { name: "Mallory", email: `m${Math.random().toString(36).slice(2)}@guest.com`, password: PASSWORD, ...extra });
    expect(res.status).toBe(400);
  });

  it("rejects duplicates, weak passwords and passwords built from the email", async () => {
    expect((await fresh().post("/auth/register", { name: "Amara Again", email: "amara@guest.com", password: PASSWORD })).status).toBe(409);
    expect((await fresh().post("/auth/register", { name: "Weak One", email: "weak@guest.com", password: "password123" })).status).toBe(400);
    expect((await fresh().post("/auth/register", { name: "Self Named", email: "selfnamed@guest.com", password: "selfnamed-2026" })).status).toBe(400);
  });

  it("is not available on a WEBSITE-plan hotel (feature entitlement)", async () => {
    const res = await new Client(h.app, web.host).post("/auth/register", { name: "No Booking", email: "x@guest.com", password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FEATURE_NOT_AVAILABLE");
  });

  it("the same email can be a guest at two different hotels, with independent accounts", async () => {
    const other = await createHotel(h, ops, "second", "BOOKING");
    const a = await new Client(h.app, other.host).post("/auth/register", { name: "Amara Okafor", email: "amara@guest.com", password: "Another-Good-Passphrase-3" });
    expect(a.status).toBe(201);
    expect((await new Client(h.app, other.host).post("/auth/login", { email: "amara@guest.com", password: PASSWORD })).status).toBe(401);
    expect((await new Client(h.app, other.host).post("/auth/login", { email: "amara@guest.com", password: "Another-Good-Passphrase-3" })).status).toBe(200);
  });
});

async function tenantIdOf(slug: string): Promise<string> {
  const { Tenant } = await import("../../src/modules/tenants/tenant.model.js");
  return String((await Tenant.findOne({ slug }).lean())!._id);
}
