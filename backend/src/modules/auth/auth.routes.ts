import { Router } from "express";
import { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { createRateLimiter } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import type { AuthService } from "./auth.service.js";
import type { createAuthController } from "./auth.controller.js";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, verifyEmailSchema } from "./auth.schemas.js";

const MIN = 60 * 1000;
/** Throttle per client IP AND per target email, so one attacker cannot hammer one account from many IPs without also being slowed per IP. */
const byIpAndEmail = (req: Request) => `${ipKeyGenerator(req.ip ?? "")}|${String((req.body as { email?: unknown } | undefined)?.email ?? "").toLowerCase()}`;

export function createAuthRouter(auth: AuthService, controller: ReturnType<typeof createAuthController>, scale = 1): Router {
  const router = Router();
  const limit = (n: number) => Math.max(1, Math.round(n * scale));

  router.post("/register", createRateLimiter({ windowMs: 60 * MIN, max: limit(10) }), validate({ body: registerSchema }), controller.register);
  router.post("/login", createRateLimiter({ windowMs: 15 * MIN, max: limit(10), keyGenerator: byIpAndEmail, message: "Too many sign-in attempts. Please wait a few minutes." }), validate({ body: loginSchema }), controller.login);
  router.post("/refresh", createRateLimiter({ windowMs: 15 * MIN, max: limit(60) }), controller.refresh);
  router.post("/logout", controller.logout);
  router.post("/logout-all", authenticate(auth), controller.logoutAll);
  router.post("/forgot-password", createRateLimiter({ windowMs: 60 * MIN, max: limit(5), keyGenerator: byIpAndEmail }), validate({ body: forgotPasswordSchema }), controller.forgotPassword);
  router.post("/reset-password", createRateLimiter({ windowMs: 15 * MIN, max: limit(10) }), validate({ body: resetPasswordSchema }), controller.resetPassword);
  router.post("/verify-email", createRateLimiter({ windowMs: 15 * MIN, max: limit(20) }), validate({ body: verifyEmailSchema }), controller.verifyEmail);
  router.get("/me", authenticate(auth), controller.me);

  return router;
}
