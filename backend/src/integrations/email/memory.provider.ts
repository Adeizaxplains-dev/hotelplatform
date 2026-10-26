import type { EmailMessage, EmailService } from "./email.service.js";

/** Captures messages in memory. Used by tests to read one-time links. */
export class MemoryEmailService implements EmailService {
  readonly outbox: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.outbox.push(message);
  }
  last(to?: string): EmailMessage | undefined {
    return [...this.outbox].reverse().find((m) => !to || m.to === to);
  }
}
