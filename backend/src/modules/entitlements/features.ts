/**
 * Single source of truth for what each commercial plan includes.
 * Plans are code (versioned, reviewed, tested), not database rows: a tenant stores only WHICH plan
 * it is on plus per-tenant overrides. Moving WEBSITE → BOOKING → MANAGEMENT changes that one field.
 */
export const FEATURES = [
  "website", "cms", "rooms", "gallery",
  "booking", "reservations", "guests", "payments", "invoices", "reports",
  "staff", "housekeeping", "expenses", "offers", "events", "restaurant", "auditLogs",
] as const;
export type Feature = (typeof FEATURES)[number];

export const PLAN_KEYS = ["WEBSITE", "BOOKING", "MANAGEMENT"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export const LIMIT_KEYS = ["maxRooms", "maxStaff", "maxAdmins", "maxGalleryImages", "maxUsers"] as const;
export type LimitKey = (typeof LIMIT_KEYS)[number];
export type Limits = Record<LimitKey, number | null>; // null = unlimited

const WEBSITE: readonly Feature[] = ["website", "cms", "rooms", "gallery"];
const BOOKING: readonly Feature[] = [...WEBSITE, "booking", "reservations", "guests", "payments", "invoices", "reports"];
const MANAGEMENT: readonly Feature[] = [...BOOKING, "staff", "housekeeping", "expenses", "offers", "events", "restaurant", "auditLogs"];

export const PLAN_FEATURES: Record<PlanKey, readonly Feature[]> = { WEBSITE, BOOKING, MANAGEMENT };

/** SAMPLE numbers: confirm with the commercial team. They live here so nothing else hard-codes them. */
export const PLAN_LIMITS: Record<PlanKey, Limits> = {
  WEBSITE: { maxRooms: 20, maxStaff: 1, maxAdmins: 1, maxGalleryImages: 30, maxUsers: null },
  BOOKING: { maxRooms: 50, maxStaff: 1, maxAdmins: 1, maxGalleryImages: 100, maxUsers: null },
  MANAGEMENT: { maxRooms: 300, maxStaff: 50, maxAdmins: 5, maxGalleryImages: 500, maxUsers: null },
};

export interface FeatureOverrideView {
  feature: Feature;
  enabled: boolean;
  expiresAt?: Date | null | undefined;
}

export interface Entitlements {
  plan: PlanKey;
  features: Record<Feature, boolean>;
  limits: Limits;
}

/**
 * Effective entitlements = plan defaults + active tenant overrides.
 * An override may switch a feature ON (a paid add-on) or OFF; expired overrides are ignored.
 * Limit overrides replace the plan's value (null = unlimited).
 */
export function computeEntitlements(
  plan: PlanKey,
  overrides: readonly FeatureOverrideView[] = [],
  limitOverrides: Record<string, number | null> = {},
  now: Date = new Date()
): Entitlements {
  const features = Object.fromEntries(FEATURES.map((f) => [f, PLAN_FEATURES[plan].includes(f)])) as Record<Feature, boolean>;
  for (const o of overrides) {
    if (o.expiresAt && o.expiresAt.getTime() <= now.getTime()) continue;
    features[o.feature] = o.enabled;
  }
  const limits = { ...PLAN_LIMITS[plan] };
  for (const key of LIMIT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(limitOverrides, key)) {
      const v = limitOverrides[key];
      if (v === null || (typeof v === "number" && Number.isInteger(v) && v >= 0)) limits[key] = v;
    }
  }
  return { plan, features, limits };
}

export const isFeature = (v: string): v is Feature => (FEATURES as readonly string[]).includes(v);
export const enabledFeatures = (e: Entitlements): Feature[] => FEATURES.filter((f) => e.features[f]);
