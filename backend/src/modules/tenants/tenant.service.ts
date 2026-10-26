import type { HydratedDocument } from "mongoose";
import { platformDomainOf, type Env } from "../../config/env.js";
import type { TenantView } from "../../shared/context.js";
import { SLUG_PATTERN, Tenant, TenantDomain, type ITenant } from "./tenant.model.js";

export type HostResolution =
  | { scope: "platform"; tenant: null }
  | { scope: "tenant"; tenant: TenantView }
  | { scope: "unknown"; tenant: null };

const HOST_PATTERN = /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/;

export function toTenantView(doc: HydratedDocument<ITenant> | (ITenant & { _id: unknown })): TenantView {
  return {
    id: doc._id as TenantView["id"],
    slug: doc.slug,
    name: doc.name,
    status: doc.status,
    plan: doc.plan,
    currency: doc.currency,
    timezone: doc.timezone,
    limitOverrides: (doc.limitOverrides ?? {}) as Record<string, number | null>,
  };
}

export function createTenantService(env: Pick<Env, "PLATFORM_DOMAIN" | "NODE_ENV">) {
  const platformDomain = platformDomainOf(env);
  const platformHosts = new Set<string>([platformDomain, ...(env.NODE_ENV === "production" ? [] : ["localhost", "127.0.0.1"])]);

  return {
    platformDomain,

    /**
     * hostname → tenant. This is the ONLY way a request gets a tenant:
     *   platform host                       → platform scope (no tenant)
     *   <slug>.<platformDomain>             → that hotel
     *   a VERIFIED custom domain            → the hotel it is mapped to
     *   anything else                       → unknown
     * Client-supplied ids, headers and query parameters are never consulted.
     */
    async resolveHost(rawHost: string): Promise<HostResolution> {
      const host = rawHost.toLowerCase().replace(/\.$/, "");
      if (!HOST_PATTERN.test(host)) return { scope: "unknown", tenant: null };
      if (platformHosts.has(host) || host === `www.${platformDomain}`) return { scope: "platform", tenant: null };

      if (host.endsWith(`.${platformDomain}`)) {
        const label = host.slice(0, -(platformDomain.length + 1));
        if (label.includes(".") || !SLUG_PATTERN.test(label)) return { scope: "unknown", tenant: null };
        const tenant = await Tenant.findOne({ slug: label }).lean();
        return tenant ? { scope: "tenant", tenant: toTenantView(tenant) } : { scope: "unknown", tenant: null };
      }

      const domain = await TenantDomain.findOne({ hostname: host, verified: true }).lean();
      if (!domain) return { scope: "unknown", tenant: null };
      const tenant = await Tenant.findById(domain.tenantId).lean();
      return tenant ? { scope: "tenant", tenant: toTenantView(tenant) } : { scope: "unknown", tenant: null };
    },

    /** Is this browser Origin a platform page or an (active) hotel's own site? Used by the CORS guard. */
    async isKnownOrigin(origin: string): Promise<boolean> {
      let hostname: string;
      try {
        hostname = new URL(origin).hostname;
      } catch {
        return false;
      }
      const r = await this.resolveHost(hostname);
      return r.scope === "platform" || (r.scope === "tenant" && r.tenant.status === "ACTIVE");
    },
  };
}
export type TenantService = ReturnType<typeof createTenantService>;
