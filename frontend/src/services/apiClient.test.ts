import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest } from "./apiClient";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => vi.restoreAllMocks());

describe("apiRequest", () => {
  it("unwraps the success contract", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ success: true, data: { hello: "world" } }));
    await expect(apiRequest("/x")).resolves.toEqual({ hello: "world" });
  });

  it("sends cookies and JSON, and never touches web storage", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ success: true, data: {} }));
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    await apiRequest("/x", { method: "POST", body: { a: 1 } });
    const [url, init] = spy.mock.calls[0]!;
    expect(String(url)).toMatch(/\/api\/v1\/x$/);
    expect(init?.credentials).toBe("include");
    expect(init?.body).toBe('{"a":1}');
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("maps the error contract to ApiError with code, status and request id", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ success: false, error: { code: "FORBIDDEN", message: "No.", requestId: "r-1" } }, 403));
    const err = await apiRequest("/x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 403, code: "FORBIDDEN", message: "No.", requestId: "r-1" });
  });

  it("reports unreachable servers as a network error with a friendly message", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    const err = (await apiRequest("/x").catch((e: unknown) => e)) as ApiError;
    expect(err.isNetworkError).toBe(true);
    expect(err.message).not.toMatch(/Failed to fetch/);
  });

  it("handles non-JSON responses (e.g. a proxy error page)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502 }));
    await expect(apiRequest("/x")).rejects.toMatchObject({ code: "INVALID_RESPONSE", status: 502 });
  });
});
