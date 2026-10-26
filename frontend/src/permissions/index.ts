import type { MeResult, Permission, Feature } from "@/types/auth";

/**
 * UX helpers only. They decide what to SHOW. The API enforces permissions and plan features on every
 * request, so hiding or showing something here never grants or removes access.
 */
export const can = (me: Pick<MeResult, "permissions"> | null | undefined, permission: Permission): boolean => Boolean(me?.permissions.includes(permission));
export const hasFeature = (me: Pick<MeResult, "features"> | null | undefined, feature: Feature): boolean => Boolean(me?.features.includes(feature));
