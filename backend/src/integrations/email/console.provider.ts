import type { Logger } from "pino";
import type { EmailMessage, EmailService } from "./email.service.js";

/**
 * Development provider: writes the message to the log instead of sending it.
 * In production it logs only the recipient and subject (never the body, which holds one-time links),
 * so real email delivery is NOT available until an SMTP/API provider is added (Phase 4).
 */
export class ConsoleEmailService implements EmailService {
  constructor(private readonly logger: Logger, private readonly production: boolean) {}

  async send(message: EmailMessage): Promise<void> {
    if (this.production) {
      this.logger.error({ to: message.to, subject: message.subject }, "Email delivery unavailable: configure a production email provider");
      throw new Error("Email delivery is not configured for production.");
    }
    this.logger.info({ to: message.to, subject: message.subject, text: message.text }, "Email (console provider)");
  }
}
