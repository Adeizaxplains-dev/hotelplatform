import { afterEach, describe, expect, it, vi } from "vitest";
import { createPaystackClient } from "../../src/modules/payments/paystack.client.js";

afterEach(() => vi.unstubAllGlobals());

describe("Paystack refund request", () => {
  it("submits the transaction, minor-unit amount, and reason to the refund endpoint", async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => new Response(JSON.stringify({ status: true, message: "Refund queued", data: { id: 42, status: "pending", refund_reference: "RF-123" } }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createPaystackClient("sk_test_unit_secret");
    const result = await client.refund({ transaction: "1234567", amountKobo: 125000, reason: "Guest cancelled booking" });
    expect(result.status).toBe("pending");
    expect(result.refund_reference).toBe("RF-123");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.paystack.co/refund");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ transaction: "1234567", amount: 125000, customer_note: "Guest cancelled booking", merchant_note: "Guest cancelled booking" });
  });

  it("fails closed when the payment provider rejects the request", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: false, message: "Not allowed" }), { status: 400 })));
    const client = createPaystackClient("sk_test_unit_secret");
    await expect(client.refund({ transaction: "1234567", amountKobo: 10000, reason: "Duplicate payment" })).rejects.toThrow();
  });
});
