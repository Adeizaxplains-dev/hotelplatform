import { createHmac, timingSafeEqual } from "node:crypto";
import { PaymentError, ServiceUnavailableError } from "../../shared/errors.js";

export interface PaystackTransaction {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  customer?: { email?: string };
  id?: number;
  paid_at?: string | null;
}
export interface PaystackClient {
  initialize(input: { email: string; amountKobo: number; reference: string; currency: string; callbackUrl: string }): Promise<{ authorization_url: string; access_code: string; reference: string }>;
  verify(reference: string): Promise<PaystackTransaction>;
  refund(input: { transaction: string; amountKobo: number; reason: string }): Promise<{ id?: number; status?: string; refund_reference?: string; message?: string }>;
  validWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean;
}
export function createPaystackClient(secretKey: string | undefined): PaystackClient {
  const configured = () => {
    if (!secretKey || !secretKey.startsWith("sk_")) throw new ServiceUnavailableError("Online payments are not configured for this hotel.");
    return secretKey;
  };
  async function request<T>(path: string, init: RequestInit): Promise<T> {
    let response: Response;
    try { response = await fetch(`https://api.paystack.co${path}`, { ...init, headers: { Authorization: `Bearer ${configured()}`, "Content-Type": "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(12000) }); }
    catch { throw new ServiceUnavailableError("The payment provider is temporarily unreachable. Please try again."); }
    const payload = await response.json().catch(() => null) as { status?: boolean; message?: string; data?: T } | null;
    if (!response.ok || !payload?.status || payload.data === undefined) throw new PaymentError("The payment provider could not complete this request.");
    return payload.data;
  }
  return {
    async initialize(input) {
      return request<{ authorization_url: string; access_code: string; reference: string }>("/transaction/initialize", { method: "POST", body: JSON.stringify({ email: input.email, amount: input.amountKobo, reference: input.reference, currency: input.currency, callback_url: input.callbackUrl, metadata: { payment_reference: input.reference } }) });
    },
    async verify(reference) { return request<PaystackTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`, { method: "GET" }); },
    async refund(input) { return request<{ id?: number; status?: string; refund_reference?: string; message?: string }>("/refund", { method: "POST", body: JSON.stringify({ transaction: input.transaction, amount: input.amountKobo, customer_note: input.reason, merchant_note: input.reason }) }); },
    validWebhookSignature(rawBody, signature) {
      if (!signature || !secretKey) return false;
      const expected = createHmac("sha512", secretKey).update(rawBody).digest();
      let supplied: Buffer;
      try { supplied = Buffer.from(signature, "hex"); } catch { return false; }
      return supplied.length === expected.length && timingSafeEqual(supplied, expected);
    },
  };
}
