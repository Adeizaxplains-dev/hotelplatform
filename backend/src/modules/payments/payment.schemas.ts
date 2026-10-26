import { z } from "zod";
export const initializePaymentSchema = z.object({ reservationReference: z.string().trim().toUpperCase().regex(/^HTL-[A-Z0-9]+-[A-F0-9]+$/) }).strict();
export const verifyPaymentSchema = z.object({ reference: z.string().trim().min(12).max(120).regex(/^[A-Za-z0-9_-]+$/) }).strict();
export type InitializePaymentBody = z.infer<typeof initializePaymentSchema>;
export type VerifyPaymentQuery = z.infer<typeof verifyPaymentSchema>;
