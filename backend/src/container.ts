import type { Logger } from "pino";
import type { Env } from "./config/env.js";
import type { EmailService } from "./integrations/email/email.service.js";
import { ConsoleEmailService } from "./integrations/email/console.provider.js";
import { createAuditService } from "./modules/audit/audit.service.js";
import { createAuthController } from "./modules/auth/auth.controller.js";
import { createAuthService } from "./modules/auth/auth.service.js";
import { createOneTimeTokenService } from "./modules/auth/oneTimeToken.service.js";
import { createTokenService } from "./modules/auth/token.service.js";
import { createEntitlementService } from "./modules/entitlements/entitlement.service.js";
import { createPlatformService } from "./modules/tenants/platform.service.js";
import { createTenantService } from "./modules/tenants/tenant.service.js";
import { createMediaStorage } from "./integrations/media/index.js";
import type { MediaStorage } from "./integrations/media/media.storage.js";
import { createHotelService } from "./modules/hotel/hotel.service.js";
import { createMediaService } from "./modules/media/media.service.js";
import { createPublicService } from "./modules/public/public.service.js";
import { createRoomService } from "./modules/rooms/rooms.service.js";
import { createWebsiteService } from "./modules/website/website.service.js";
import { createUserController } from "./modules/users/user.controller.js";
import { createUserService } from "./modules/users/user.service.js";
import { createReservationService } from "./modules/reservations/reservation.service.js";
import { createPaystackClient } from "./modules/payments/paystack.client.js";
import { createPaymentService } from "./modules/payments/payment.service.js";
import { createOperationsService } from "./modules/operations/operations.service.js";
import { createGuestNotificationService } from "./modules/notifications/guestNotification.service.js";
import { createFinanceService } from "./modules/finance/finance.service.js";
import { createBillingService } from "./modules/billing/billing.service.js";

/** Wires services together once per app. Tests can pass their own email provider. */
export function buildContainer(env: Env, logger: Logger, emailOverride?: EmailService, storageOverride?: MediaStorage) {
  const email = emailOverride ?? new ConsoleEmailService(logger, env.NODE_ENV === "production");
  const tokens = createTokenService(env);
  const oneTime = createOneTimeTokenService(tokens);
  const audit = createAuditService(logger);
  const entitlements = createEntitlementService();
  const tenants = createTenantService(env);
  const auth = createAuthService({ env, tokens, oneTime, audit, email, entitlements });
  const users = createUserService({ audit, entitlements, oneTime, email, auth });
  const platform = createPlatformService({ tenants, audit, entitlements, oneTime, email });
  const storage = storageOverride ?? createMediaStorage(env);
  const media = createMediaService({ storage, audit, maxBytes: env.UPLOAD_MAX_BYTES, secret: env.REFRESH_TOKEN_SECRET });
  const hotel = createHotelService({ audit, media });
  const rooms = createRoomService({ audit, entitlements, media });
  const website = createWebsiteService({ audit, entitlements, media });
  const publicSite = createPublicService({ entitlements, media });
  const notifications = createGuestNotificationService({ email, audit });
  const reservations = createReservationService({ audit, notifications });
  const paystack = createPaystackClient(env.PAYSTACK_SECRET_KEY);
  const payments = createPaymentService({ paystack, audit, notifications, callbackUrl: `${env.CLIENT_URL[0]}/payment/callback` });
  const operations = createOperationsService({ audit });
  const finance = createFinanceService({ audit });
  const billing = createBillingService({ paystack, audit, prices: { WEBSITE: env.SAAS_WEBSITE_MONTHLY_KOBO, BOOKING: env.SAAS_BOOKING_MONTHLY_KOBO, MANAGEMENT: env.SAAS_MANAGEMENT_MONTHLY_KOBO }, callbackUrl: `${env.CLIENT_URL[0]}/admin/billing/callback` });
  return {
    storage, media, hotel, rooms, website, publicSite, reservations, payments, operations, finance, billing, paystack, notifications,
    email, tokens, oneTime, audit, entitlements, tenants, auth, users, platform,
    authController: createAuthController(env, auth, entitlements),
    userController: createUserController(users),
  };
}
export type Container = ReturnType<typeof buildContainer>;
