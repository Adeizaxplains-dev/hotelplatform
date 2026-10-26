import type { Express } from "express";
import mongoose from "mongoose";
import request from "supertest";
import pino from "pino";
import { createApp } from "../../src/app.js";
import { buildContainer } from "../../src/container.js";
import { authenticate, requireFeature, requirePermission } from "../../src/middleware/authenticate.js";
import { requireActiveTenant, requireTenant } from "../../src/middleware/tenantContext.js";
import type { Permission } from "../../src/modules/rbac/permissions.js";
import type { Feature } from "../../src/modules/entitlements/features.js";
import { MemoryEmailService } from "../../src/integrations/email/memory.provider.js";
import { MemoryMediaStorage } from "../../src/integrations/media/memory.provider.js";
import { createPlatformAdmin } from "../../src/modules/tenants/platform.service.js";
import type { PlanKey } from "../../src/modules/entitlements/features.js";
import { makeEnv } from "../helpers.js";
import { TEST_DATABASE_URL } from "./globalSetup.js";

export const PLATFORM_HOST = "platform.test";
export const hostOf = (slug: string) => `${slug}.${PLATFORM_HOST}`;
export const PASSWORD = "Correct-Horse-9";

export interface Harness {
  app: Express;
  email: MemoryEmailService;
  storage: MemoryMediaStorage;
}

/** Connects, makes sure every index exists, and empties every collection (raw driver: bypasses model hooks). */
export async function startHarness(envOverrides: Record<string, string | undefined> = {}, opts: { realStorageFromEnv?: boolean } = {}): Promise<Harness> {
  await mongoose.connect(TEST_DATABASE_URL, { serverSelectionTimeoutMS: 5000 });
  await Promise.all(Object.values(mongoose.models).map((m) => m.createIndexes()));
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
  const email = new MemoryEmailService();
  const env = makeEnv({ NODE_ENV: "test", RATE_LIMIT_MAX: "1000000", AUTH_RATE_LIMIT_SCALE: "1000", ...envOverrides });
  const logger = pino({ level: process.env["TEST_LOG"] ?? "silent" });
  const storage = new MemoryMediaStorage();
  const c = buildContainer(env, logger, email, opts.realStorageFromEnv ? undefined : storage);
  // Probe routes exercise the REAL middleware chain for any permission or feature, with real sessions.
  const app = createApp({
    env, logger, email, ...(opts.realStorageFromEnv ? {} : { storage }),
    mountRoutes: (a) => {
      a.get("/api/v1/_probe/permission/:permission", requireTenant, requireActiveTenant, authenticate(c.auth), (req, res, next) => requirePermission(req.params["permission"] as Permission)(req, res, next), (_q, r) => void r.json({ success: true, data: { allowed: true } }));
      a.get("/api/v1/_probe/feature/:feature", requireTenant, requireActiveTenant, (req, res, next) => requireFeature(c.entitlements, req.params["feature"] as Feature)(req, res, next), (_q, r) => void r.json({ success: true, data: { allowed: true } }));
    },
  });
  return { app, email, storage };
}
export const stopHarness = () => mongoose.disconnect();

/** A tiny HTTP client bound to one hostname, remembering the access token and refresh cookie like a browser. */
export class Client {
  token: string | undefined;
  cookie: string | undefined;
  constructor(private readonly app: Express, public host: string) {}

  as(host: string): Client {
    const c = new Client(this.app, host);
    c.token = this.token;
    c.cookie = this.cookie;
    return c;
  }

  req(method: "get" | "post" | "put" | "patch" | "delete", path: string, body?: unknown, extraHeaders: Record<string, string> = {}) {
    let r = request(this.app)[method](`/api/v1${path}`).set("Host", this.host);
    if (this.token) r = r.set("Authorization", `Bearer ${this.token}`);
    if (this.cookie) r = r.set("Cookie", this.cookie);
    for (const [k, v] of Object.entries(extraHeaders)) r = r.set(k, v);
    return body === undefined ? r : r.send(body as object);
  }
  get = (p: string, h?: Record<string, string>) => this.req("get", p, undefined, h);
  post = (p: string, b?: unknown, h?: Record<string, string>) => this.req("post", p, b ?? {}, h);
  put = (p: string, b?: unknown) => this.req("put", p, b ?? {});
  patch = (p: string, b?: unknown) => this.req("patch", p, b ?? {});
  del = (p: string) => this.req("delete", p);

  /** Multipart upload like a browser: field name "file". */
  upload(path: string, buffer: Buffer, opts: { filename?: string; contentType?: string; field?: string; alt?: string } = {}) {
    let r = request(this.app).post(`/api/v1${path}`).set("Host", this.host);
    if (this.token) r = r.set("Authorization", `Bearer ${this.token}`);
    if (opts.alt) r = r.field("alt", opts.alt);
    return r.attach(opts.field ?? "file", buffer, { filename: opts.filename ?? "photo.png", contentType: opts.contentType ?? "image/png" });
  }

  async login(email: string, password = PASSWORD): Promise<request.Response> {
    const res = await this.post("/auth/login", { email, password });
    if (res.status === 200) {
      this.token = res.body.data.accessToken;
      const set = (res.headers["set-cookie"] as unknown as string[] | undefined) ?? [];
      this.cookie = set.find((c) => c.startsWith("hp_rt="))?.split(";")[0];
    }
    return res;
  }
}

export const linkToken = (text: string): string => text.match(/token=([A-Za-z0-9_-]+)/)![1]!;

export async function platformClient(h: Harness, email = "ops@platform.test"): Promise<Client> {
  await createPlatformAdmin({ name: "Platform Ops", email, password: PASSWORD });
  const c = new Client(h.app, PLATFORM_HOST);
  const res = await c.login(email);
  if (res.status !== 200) throw new Error(`platform login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return c;
}

export interface Hotel {
  slug: string;
  host: string;
  id: string;
  owner: Client;
  ownerEmail: string;
}

/** Creates a hotel the real way: platform API → invite email → owner sets password → owner signs in. */
export async function createHotel(h: Harness, ops: Client, slug: string, plan: PlanKey = "MANAGEMENT"): Promise<Hotel> {
  const ownerEmail = `owner@${slug}.example.com`;
  const res = await ops.post("/platform/tenants", { name: `Hotel ${slug}`, slug, plan, ownerName: `Owner ${slug}`, ownerEmail });
  if (res.status !== 201) throw new Error(`createHotel failed: ${res.status} ${JSON.stringify(res.body)}`);
  const invite = h.email.last(ownerEmail)!;
  const owner = new Client(h.app, hostOf(slug));
  const reset = await owner.post("/auth/reset-password", { token: linkToken(invite.text), password: PASSWORD });
  if (reset.status !== 200) throw new Error(`accept invite failed: ${JSON.stringify(reset.body)}`);
  const login = await owner.login(ownerEmail);
  if (login.status !== 200) throw new Error(`owner login failed: ${JSON.stringify(login.body)}`);
  return { slug, host: hostOf(slug), id: res.body.data.id, owner, ownerEmail };
}

/** Owner invites a staff member who then accepts and signs in. */
export async function addStaff(h: Harness, hotel: Hotel, role: string, name = role): Promise<{ client: Client; email: string; id: string }> {
  const email = `${role.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}@${hotel.slug}.example.com`;
  const res = await hotel.owner.post("/users", { name, email, role });
  if (res.status !== 201) throw new Error(`addStaff failed: ${res.status} ${JSON.stringify(res.body)}`);
  const client = new Client(h.app, hotel.host);
  await client.post("/auth/reset-password", { token: linkToken(h.email.last(email)!.text), password: PASSWORD });
  await client.login(email);
  return { client, email, id: res.body.data.id };
}
