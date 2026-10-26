import { Types, trusted } from "mongoose";
import type { EmailMessage, EmailService } from "../../integrations/email/email.service.js";
import type { AuthContext, TenantView } from "../../shared/context.js";
import { NotFoundError, ValidationError } from "../../shared/errors.js";
import { pageMeta } from "../../shared/pagination.js";
import type { AuditService, RequestMeta } from "../audit/audit.service.js";
import { GuestNotification, GUEST_NOTIFICATION_STATUSES } from "./guestNotification.model.js";
import type { IGuestNotification } from "./guestNotification.model.js";

const MAX_ATTEMPTS = 5;
const duplicateKey = (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && (error as { code?: number }).code === 11000);

/** Tenant-scoped outbox. Provider failures are retained for controlled retries. */
export function createGuestNotificationService({ email, audit }: { email: EmailService; audit: AuditService }) {
  return {
    async sendOnce(tenantId: Types.ObjectId, eventKey: string, message: EmailMessage): Promise<void> {
      try {
        try {
          await GuestNotification.create({ tenantId, eventKey, recipient: message.to, subject: message.subject, textBody: message.text, htmlBody: message.html, status: "PENDING", attempts: 0 });
        } catch (error) {
          if (!duplicateKey(error)) return;
        }
        const now = new Date();
        const claimed = await GuestNotification.findOneAndUpdate(
          { tenantId, eventKey, $or: [
            { status: "PENDING" },
            { status: "FAILED", attempts: trusted({ $lt: MAX_ATTEMPTS }) },
            { status: "SENDING", updatedAt: trusted({ $lt: new Date(now.getTime() - 10 * 60 * 1000) }), attempts: trusted({ $lt: MAX_ATTEMPTS }) },
          ] },
          { $set: { status: "SENDING", recipient: message.to, subject: message.subject, textBody: message.text, ...(message.html ? { htmlBody: message.html } : {}), lastError: undefined }, $inc: { attempts: 1 } },
          { new: true },
        );
        if (!claimed) return;
        try {
          await email.send(message);
          await GuestNotification.updateOne({ _id: claimed._id, tenantId, status: "SENDING" }, { $set: { status: "SENT", sentAt: new Date() }, $unset: { lastError: 1 } });
        } catch (error) {
          const safeError = error instanceof Error ? error.message.slice(0, 280) : "Email provider error";
          await GuestNotification.updateOne({ _id: claimed._id, tenantId, status: "SENDING" }, { $set: { status: "FAILED", lastError: safeError } });
        }
      } catch {
        // Notification infrastructure must never make a successful booking/payment fail.
      }
    },

    async list(tenantId: Types.ObjectId, page: number, limit: number, status?: (typeof GUEST_NOTIFICATION_STATUSES)[number]) {
      const filter = { tenantId, ...(status ? { status } : {}) };
      const [rows, total] = await Promise.all([
        GuestNotification.find(filter).select("eventKey recipient subject status attempts sentAt lastError createdAt updatedAt").sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        GuestNotification.countDocuments(filter),
      ]);
      return { items: rows.map((row) => ({ id: String(row._id), eventKey: row.eventKey, recipient: row.recipient, subject: row.subject, status: row.status, attempts: row.attempts, sentAt: row.sentAt, lastError: row.lastError, createdAt: row.createdAt, updatedAt: row.updatedAt })), meta: pageMeta(total, page, limit) };
    },

    async retryFailed(actor: AuthContext, tenant: TenantView, id: string, meta: RequestMeta) {
      if (!Types.ObjectId.isValid(id)) throw new NotFoundError("Notification not found.");
      const claimed = await GuestNotification.findOneAndUpdate(
        { _id: id, tenantId: tenant.id, status: "FAILED", attempts: trusted({ $lt: MAX_ATTEMPTS }), textBody: trusted({ $exists: true, $ne: "" }) },
        { $set: { status: "SENDING", lastError: undefined }, $inc: { attempts: 1 } },
        { new: true, runValidators: true },
      ).select("+textBody +htmlBody");
      if (!claimed) {
        const existing = await GuestNotification.findOne({ _id: id, tenantId: tenant.id }).select("status attempts textBody").lean();
        if (!existing) throw new NotFoundError("Notification not found.");
        if (existing.status !== "FAILED") throw new ValidationError("Only failed notifications can be retried.");
        if (existing.attempts >= MAX_ATTEMPTS) throw new ValidationError("This notification reached the retry limit; investigate the provider before taking further action.");
        throw new ValidationError("This notification does not contain a retryable message body. It may have been created by an earlier version.");
      }
      let outcome: "SENT" | "FAILED" = "SENT";
      let errorMessage: string | undefined;
      try {
        await email.send({ to: claimed.recipient, subject: claimed.subject, text: claimed.textBody, ...(claimed.htmlBody ? { html: claimed.htmlBody } : {}) });
        await GuestNotification.updateOne({ _id: claimed._id, tenantId: tenant.id, status: "SENDING" }, { $set: { status: "SENT", sentAt: new Date() }, $unset: { lastError: 1 } });
      } catch (error) {
        outcome = "FAILED";
        errorMessage = error instanceof Error ? error.message.slice(0, 280) : "Email provider error";
        await GuestNotification.updateOne({ _id: claimed._id, tenantId: tenant.id, status: "SENDING" }, { $set: { status: "FAILED", lastError: errorMessage } });
      }
      await audit.record({ tenantId: tenant.id, actorUserId: actor.userId, action: "GUEST_NOTIFICATION_RETRY", resourceType: "GuestNotification", resourceId: String(claimed._id), before: { status: "FAILED", attempts: claimed.attempts - 1 }, after: { status: outcome, attempts: claimed.attempts, error: errorMessage }, meta });
      return { id: String(claimed._id), status: outcome, attempts: claimed.attempts, message: outcome === "SENT" ? "The email provider accepted the retry." : "The retry failed; review the error and provider logs." };
    },
  };
}
export type GuestNotificationService = ReturnType<typeof createGuestNotificationService>;
