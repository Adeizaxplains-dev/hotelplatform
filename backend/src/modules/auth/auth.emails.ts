import type { EmailMessage } from "../../integrations/email/email.service.js";

export const passwordResetEmail = (to: string, hotelName: string, link: string): EmailMessage => ({
  to,
  subject: `Reset your ${hotelName} password`,
  text: `We received a request to reset your password.\n\nChoose a new password: ${link}\n\nThis link works once and expires in 1 hour. If you did not ask for it, you can ignore this email.`,
});

export const inviteEmail = (to: string, hotelName: string, link: string): EmailMessage => ({
  to,
  subject: `You've been invited to ${hotelName}`,
  text: `You have been added to the ${hotelName} team.\n\nSet your password to get started: ${link}\n\nThis link works once and expires in 72 hours.`,
});

export const verifyEmailMessage = (to: string, hotelName: string, link: string): EmailMessage => ({
  to,
  subject: `Confirm your email for ${hotelName}`,
  text: `Please confirm your email address: ${link}\n\nThis link works once and expires in 24 hours.`,
});
