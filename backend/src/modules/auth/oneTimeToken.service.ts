import type { Types } from "mongoose";
import { gt, inList } from "../../shared/mongoOps.js";
import { VerificationToken, type TokenPurpose } from "./verificationToken.model.js";
import type { TokenService } from "./token.service.js";

export const TOKEN_TTL_MS: Record<TokenPurpose, number> = {
  PASSWORD_RESET: 60 * 60 * 1000,
  INVITE: 72 * 60 * 60 * 1000,
  EMAIL_VERIFY: 24 * 60 * 60 * 1000,
};

export function createOneTimeTokenService(tokens: TokenService) {
  const liveFilter = (tenantId: Types.ObjectId | null, raw: string, purposes: readonly TokenPurpose[]) => ({
    tenantId,
    tokenHash: tokens.hashOneTimeToken(raw),
    purpose: inList(purposes),
    usedAt: null,
    expiresAt: gt(new Date()),
  });

  return {
    /** Creates a token and returns the RAW value (only ever sent by email). Older unused tokens of the same kind are voided. */
    async issue(tenantId: Types.ObjectId | null, userId: Types.ObjectId, purpose: TokenPurpose): Promise<string> {
      await VerificationToken.updateMany({ tenantId, userId, purpose, usedAt: null }, { $set: { usedAt: new Date() } });
      const { raw, hash } = tokens.newOneTimeToken();
      await VerificationToken.create({ tenantId, userId, purpose, tokenHash: hash, expiresAt: new Date(Date.now() + TOKEN_TTL_MS[purpose]) });
      return raw;
    },

    /** Looks without spending it (so validation errors do not burn the link). */
    async peek(tenantId: Types.ObjectId | null, raw: string, purposes: readonly TokenPurpose[]) {
      return VerificationToken.findOne(liveFilter(tenantId, raw, purposes)).lean();
    },

    /** Atomically marks it used. Returns null if it was already used, expired, or never existed. */
    async consume(tenantId: Types.ObjectId | null, raw: string, purposes: readonly TokenPurpose[]) {
      return VerificationToken.findOneAndUpdate(liveFilter(tenantId, raw, purposes), { $set: { usedAt: new Date() } }, { returnDocument: "after" }).lean();
    },
  };
}
export type OneTimeTokenService = ReturnType<typeof createOneTimeTokenService>;
