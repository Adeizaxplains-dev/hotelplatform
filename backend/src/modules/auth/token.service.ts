import { SignJWT, jwtVerify } from "jose";
import { Types } from "mongoose";
import type { Env } from "../../config/env.js";
import { AuthenticationError } from "../../shared/errors.js";
import { hashToken, randomToken } from "../../shared/crypto.js";

const ISSUER = "hotel-platform";
const AUDIENCE = "hotel-platform-api";

export interface AccessClaims {
  userId: Types.ObjectId;
  sessionId: Types.ObjectId;
  tenantId: Types.ObjectId | null;
}

const asObjectId = (v: unknown): Types.ObjectId => {
  if (typeof v !== "string" || !Types.ObjectId.isValid(v) || v.length !== 24) throw new AuthenticationError("Your session is not valid. Please sign in again.");
  return new Types.ObjectId(v);
};

export function createTokenService(env: Pick<Env, "ACCESS_TOKEN_SECRET" | "REFRESH_TOKEN_SECRET" | "ACCESS_TOKEN_TTL_SECONDS">) {
  const key = new TextEncoder().encode(env.ACCESS_TOKEN_SECRET);

  return {
    accessTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,

    /** Short-lived access token. It only NAMES the user, session and tenant; role and permissions are always read from the database. */
    signAccessToken(c: AccessClaims): Promise<string> {
      return new SignJWT({ sid: String(c.sessionId), tid: c.tenantId ? String(c.tenantId) : null })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setSubject(String(c.userId))
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(`${env.ACCESS_TOKEN_TTL_SECONDS}s`)
        .sign(key);
    },

    async verifyAccessToken(token: string): Promise<AccessClaims> {
      try {
        const { payload } = await jwtVerify(token, key, { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] });
        return {
          userId: asObjectId(payload.sub),
          sessionId: asObjectId(payload["sid"]),
          tenantId: payload["tid"] === null || payload["tid"] === undefined ? null : asObjectId(payload["tid"]),
        };
      } catch (err) {
        if (err instanceof AuthenticationError) throw err;
        throw new AuthenticationError("Your session has expired. Please sign in again.");
      }
    },

    /** Opaque refresh token + the hash we store. */
    newRefreshToken(): { raw: string; hash: string } {
      const raw = randomToken();
      return { raw, hash: hashToken(env.REFRESH_TOKEN_SECRET, raw) };
    },
    hashRefreshToken: (raw: string): string => hashToken(env.REFRESH_TOKEN_SECRET, raw),

    /** One-time email tokens (password reset, invite, verification). */
    newOneTimeToken(): { raw: string; hash: string } {
      const raw = randomToken(32);
      return { raw, hash: hashToken(env.REFRESH_TOKEN_SECRET, `ot:${raw}`) };
    },
    hashOneTimeToken: (raw: string): string => hashToken(env.REFRESH_TOKEN_SECRET, `ot:${raw}`),
  };
}
export type TokenService = ReturnType<typeof createTokenService>;
