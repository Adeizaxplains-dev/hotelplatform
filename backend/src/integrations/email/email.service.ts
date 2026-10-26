/**
 * Email abstraction. Business code depends on this interface only, so the provider (SMTP, Resend,
 * SendGrid...) can change without touching auth or booking logic.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailService {
  send(message: EmailMessage): Promise<void>;
}
