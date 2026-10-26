import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPaystackClient } from "../../src/modules/payments/paystack.client.js";

describe("Paystack webhook signature validation", () => {
  const secret = "sk_test_example_secret_for_unit_tests";
  const client = createPaystackClient(secret);
  const body = Buffer.from('{"event":"charge.success","data":{"reference":"PAY-ABC-1234567890"}}', "utf8");
  const signature = createHmac("sha512", secret).update(body).digest("hex");

  it("accepts a valid HMAC signature for the exact raw body", () => {
    expect(client.validWebhookSignature(body, signature)).toBe(true);
  });

  it("rejects missing, malformed, or mismatched signatures", () => {
    expect(client.validWebhookSignature(body, undefined)).toBe(false);
    expect(client.validWebhookSignature(body, "not-a-signature")).toBe(false);
    expect(client.validWebhookSignature(Buffer.from(`${body.toString()} `), signature)).toBe(false);
  });

  it("rejects webhook signatures when no secret is configured", () => {
    expect(createPaystackClient(undefined).validWebhookSignature(body, signature)).toBe(false);
  });
});
