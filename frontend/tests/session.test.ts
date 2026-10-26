import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest, ApiError } from "@/services/apiClient";
import { refreshSession } from "@/services/session";
import { getAccessToken, setAccessToken } from "@/services/tokenStore";
import { fail, mockApi, ok, LOGIN_RESULT } from "./utils";

beforeEach(() => setAccessToken("expired-token"));
afterEach(() => {
  vi.restoreAllMocks();
  setAccessToken(null);
});

describe("silent refresh", () => {
  it("retries a request once with a fresh token after a 401", async () => {
    let first = true;
    const calls = mockApi({
      "GET /things": () => (first ? ((first = false), fail(401, "UNAUTHENTICATED")) : ok({ items: 1 })),
      "POST /auth/refresh": () => ok({ ...LOGIN_RESULT, accessToken: "fresh-token" }),
    });
    await expect(apiRequest("/things")).resolves.toEqual({ items: 1 });
    expect(calls.map((c) => c.key)).toEqual(["GET /things", "POST /auth/refresh", "GET /things"]);
    expect(calls[0]!.auth).toBe("Bearer expired-token");
    expect(calls[2]!.auth).toBe("Bearer fresh-token");
    expect(getAccessToken()).toBe("fresh-token");
  });

  it("shares ONE refresh between simultaneous requests (the server rotates tokens, parallel refreshes look like theft)", async () => {
    const seen = new Map<string, number>();
    const calls = mockApi({
      "GET /a": () => (getAccessToken() === "fresh-token" ? ok("a") : fail(401, "UNAUTHENTICATED")),
      "GET /b": () => (getAccessToken() === "fresh-token" ? ok("b") : fail(401, "UNAUTHENTICATED")),
      "GET /c": () => (getAccessToken() === "fresh-token" ? ok("c") : fail(401, "UNAUTHENTICATED")),
      "POST /auth/refresh": async () => {
        seen.set("refresh", (seen.get("refresh") ?? 0) + 1);
        await new Promise((r) => setTimeout(r, 20));
        return ok({ ...LOGIN_RESULT, accessToken: "fresh-token" });
      },
    });
    const results = await Promise.all([apiRequest("/a"), apiRequest("/b"), apiRequest("/c")]);
    expect(results).toEqual(["a", "b", "c"]);
    expect(calls.filter((c) => c.key === "POST /auth/refresh")).toHaveLength(1);
  });

  it("gives up (and clears the token) if the refresh fails, without looping", async () => {
    const calls = mockApi({ "GET /things": () => fail(401, "UNAUTHENTICATED"), "POST /auth/refresh": () => fail(401, "UNAUTHENTICATED") });
    await expect(apiRequest("/things")).rejects.toMatchObject({ status: 401 });
    expect(calls.map((c) => c.key)).toEqual(["GET /things", "POST /auth/refresh"]);
    expect(getAccessToken()).toBeNull();
  });

  it("does not retry more than once if the retried request is still 401", async () => {
    const calls = mockApi({ "GET /things": () => fail(401, "UNAUTHENTICATED"), "POST /auth/refresh": () => ok({ ...LOGIN_RESULT, accessToken: "fresh-token" }) });
    await expect(apiRequest("/things")).rejects.toBeInstanceOf(ApiError);
    expect(calls.map((c) => c.key)).toEqual(["GET /things", "POST /auth/refresh", "GET /things"]);
  });

  it("never tries to refresh for auth endpoints themselves (a wrong password is not an expired token)", async () => {
    const calls = mockApi({ "POST /auth/login": () => fail(401, "INVALID_CREDENTIALS") });
    await expect(apiRequest("/auth/login", { method: "POST", body: {} })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(calls).toHaveLength(1);
  });

  it("does nothing special for non-401 errors", async () => {
    const calls = mockApi({ "GET /things": () => fail(403, "FORBIDDEN") });
    await expect(apiRequest("/things")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(calls).toHaveLength(1);
  });

  it("refreshSession() resolves false and clears the token when there is no valid cookie", async () => {
    mockApi({ "POST /auth/refresh": () => fail(401, "UNAUTHENTICATED") });
    expect(await refreshSession()).toBe(false);
    expect(getAccessToken()).toBeNull();
  });
});

describe("token storage", () => {
  it("keeps the access token out of web storage entirely", async () => {
    const set = vi.spyOn(Storage.prototype, "setItem");
    mockApi({ "POST /auth/refresh": () => ok({ ...LOGIN_RESULT, accessToken: "secret-token" }) });
    await refreshSession();
    expect(getAccessToken()).toBe("secret-token");
    expect(set).not.toHaveBeenCalled();
    expect(JSON.stringify({ ...localStorage })).not.toContain("secret-token");
    expect(JSON.stringify({ ...sessionStorage })).not.toContain("secret-token");
    expect(document.cookie).not.toContain("secret-token");
  });
});
