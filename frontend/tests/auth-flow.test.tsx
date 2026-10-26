import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import RequireAuth from "@/features/auth/RequireAuth";
import { can, hasFeature } from "@/permissions";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import LoginPage from "@/pages/LoginPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import { HOTEL_CONTEXT, LOGIN_RESULT, ME_OWNER, fail, mockApi, ok, renderApp } from "./utils";

afterEach(() => vi.restoreAllMocks());
const anonymous = { "POST /auth/refresh": () => fail(401, "UNAUTHENTICATED"), "GET /tenants/context": () => ok(HOTEL_CONTEXT) };

describe("LoginPage", () => {
  it("validates before calling the server, with messages tied to the fields", async () => {
    const calls = mockApi(anonymous);
    renderApp(<LoginPage />, { route: "/login" });
    await userEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toHaveAttribute("aria-invalid", "true");
    expect(calls.some((c) => c.key === "POST /auth/login")).toBe(false);
  });

  it("shows the hotel's name, signs in and loads the session", async () => {
    const calls = mockApi({ ...anonymous, "POST /auth/login": () => ok(LOGIN_RESULT), "GET /auth/me": () => ok(ME_OWNER) });
    renderApp(<LoginPage />, { route: "/login", extraRoutes: <Route path="/admin" element={<p>ADMIN AREA</p>} /> });
    expect((await screen.findAllByText("Palm Hotel")).length).toBeGreaterThan(0);
    await userEvent.type(screen.getByLabelText(/Email/), "ada@palm.com");
    await userEvent.type(screen.getByLabelText(/Password/), "Owner-Passphrase-2026");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(calls.map((c) => c.key)).toContain("GET /auth/me"));
    expect(calls.find((c) => c.key === "POST /auth/login")!.body).toEqual({ email: "ada@palm.com", password: "Owner-Passphrase-2026" });
    expect(await screen.findByText("ADMIN AREA")).toBeInTheDocument();
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain("tok-1");
  });

  it.each([
    ["INVALID_CREDENTIALS", 401, /don't match/],
    ["RATE_LIMITED", 429, /Too many sign-in attempts/],
    ["ACCOUNT_DISABLED", 403, /disabled/],
    ["TENANT_SUSPENDED", 403, /suspended/],
  ])("explains %s in plain language and keeps the form usable", async (code, status, text) => {
    mockApi({ ...anonymous, "POST /auth/login": () => fail(status, code) });
    renderApp(<LoginPage />, { route: "/login" });
    await userEvent.type(await screen.findByLabelText(/Email/), "ada@palm.com");
    await userEvent.type(screen.getByLabelText(/Password/), "whatever-123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(text);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("blocks double submission while signing in", async () => {
    let resolve!: (r: Response) => void;
    const calls = mockApi({ ...anonymous, "POST /auth/login": () => new Promise<Response>((r) => (resolve = r)) });
    renderApp(<LoginPage />, { route: "/login" });
    await userEvent.type(await screen.findByLabelText(/Email/), "ada@palm.com");
    await userEvent.type(screen.getByLabelText(/Password/), "whatever-123");
    const button = screen.getByRole("button", { name: "Sign in" });
    await userEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    await userEvent.click(button);
    expect(calls.filter((c) => c.key === "POST /auth/login")).toHaveLength(1);
    resolve(fail(401, "INVALID_CREDENTIALS"));
  });

  it("tells the visitor when the address is not a hotel, instead of showing a form", async () => {
    mockApi({ ...anonymous, "GET /tenants/context": () => ok({ scope: "unknown", hotel: null }) });
    renderApp(<LoginPage />, { route: "/login" });
    expect(await screen.findByText("We couldn't find this hotel")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Password/)).toBeNull();
  });

  it("tells the visitor when the hotel is suspended", async () => {
    mockApi({ ...anonymous, "GET /tenants/context": () => ok({ scope: "tenant", hotel: { ...HOTEL_CONTEXT.hotel, status: "SUSPENDED", features: [] } }) });
    renderApp(<LoginPage />, { route: "/login" });
    expect(await screen.findByText(/account is suspended/)).toBeInTheDocument();
  });
});

describe("session restore and route guards", () => {
  it("a reload restores the session silently from the cookie", async () => {
    mockApi({ "POST /auth/refresh": () => ok(LOGIN_RESULT), "GET /auth/me": () => ok(ME_OWNER) });
    renderApp(<RequireAuth />, { route: "/admin", extraRoutes: <Route element={<RequireAuth />}><Route path="/admin" element={<p>SECRET AREA</p>} /></Route> });
    expect(await screen.findByText("SECRET AREA")).toBeInTheDocument();
  });

  it("anonymous visitors are sent to sign in", async () => {
    mockApi(anonymous);
    renderApp(<p>never</p>, { route: "/admin", extraRoutes: <><Route element={<RequireAuth />}><Route path="/admin" element={<p>SECRET AREA</p>} /></Route><Route path="/login" element={<p>LOGIN SCREEN</p>} /></> });
    expect(await screen.findByText("LOGIN SCREEN")).toBeInTheDocument();
    expect(screen.queryByText("SECRET AREA")).toBeNull();
  });

  it("a signed-in user without the role is sent to the 403 page (the API says no as well)", async () => {
    mockApi({ "POST /auth/refresh": () => ok(LOGIN_RESULT), "GET /auth/me": () => ok(ME_OWNER) });
    renderApp(<p>never</p>, { route: "/platform", extraRoutes: <><Route element={<RequireAuth roles={["PLATFORM_SUPER_ADMIN"]} />}><Route path="/platform" element={<p>OPERATOR AREA</p>} /></Route><Route path="/403" element={<p>NO ACCESS</p>} /></> });
    expect(await screen.findByText("NO ACCESS")).toBeInTheDocument();
    expect(screen.queryByText("OPERATOR AREA")).toBeNull();
  });

  it("permission-gated routes check the permission list", async () => {
    mockApi({ "POST /auth/refresh": () => ok(LOGIN_RESULT), "GET /auth/me": () => ok(ME_OWNER) });
    renderApp(<p>never</p>, { route: "/pay", extraRoutes: <><Route element={<RequireAuth permission="payments.refund" />}><Route path="/pay" element={<p>REFUNDS</p>} /></Route><Route path="/403" element={<p>NO ACCESS</p>} /></> });
    expect(await screen.findByText("NO ACCESS")).toBeInTheDocument();
  });

  it("the permission helpers read exactly what the server granted", () => {
    expect(can(ME_OWNER, "staff.create")).toBe(true);
    expect(can(ME_OWNER, "payments.refund")).toBe(false);
    expect(can(null, "staff.create")).toBe(false);
    expect(hasFeature(ME_OWNER, "booking")).toBe(true);
    expect(hasFeature(ME_OWNER, "staff")).toBe(false);
  });
});

describe("ForgotPasswordPage", () => {
  it("shows the same confirmation for any email (no account hints)", async () => {
    const calls = mockApi({ ...anonymous, "POST /auth/forgot-password": () => ok({ message: "ok" }) });
    renderApp(<ForgotPasswordPage />, { route: "/forgot-password" });
    await userEvent.type(await screen.findByLabelText(/Email/), "anyone@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByText("Check your inbox")).toBeInTheDocument();
    expect(calls.find((c) => c.key === "POST /auth/forgot-password")!.body).toEqual({ email: "anyone@example.com" });
  });
});

describe("ResetPasswordPage", () => {
  it("takes the token from the link, removes it from the address bar, and sets the password", async () => {
    window.history.pushState(null, "", "/reset-password?token=abc123abc123abc123abc123&invite=1");
    const calls = mockApi({ ...anonymous, "POST /auth/reset-password": () => ok({ message: "ok" }) });
    renderApp(<ResetPasswordPage />, { route: "/reset-password?token=abc123abc123abc123abc123&invite=1" });
    expect(await screen.findByRole("heading", { name: "Set your password" })).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe(""));
    await userEvent.type(screen.getByLabelText(/^New password/), "Brand-New-Passphrase-1");
    await userEvent.type(screen.getByLabelText(/Confirm/), "Brand-New-Passphrase-1");
    await userEvent.click(screen.getByRole("button", { name: "Save password" }));
    expect(await screen.findByText("Password saved")).toBeInTheDocument();
    expect(calls.find((c) => c.key === "POST /auth/reset-password")!.body).toEqual({ token: "abc123abc123abc123abc123", password: "Brand-New-Passphrase-1" });
  });

  it("checks length and matching before calling the server", async () => {
    const calls = mockApi(anonymous);
    renderApp(<ResetPasswordPage />, { route: "/reset-password?token=abc123abc123abc123abc123" });
    await userEvent.type(await screen.findByLabelText(/^New password/), "short");
    await userEvent.type(screen.getByLabelText(/Confirm/), "different");
    await userEvent.click(screen.getByRole("button", { name: "Save password" }));
    expect(await screen.findByText("Use at least 10 characters.")).toBeInTheDocument();
    expect(calls.some((c) => c.key === "POST /auth/reset-password")).toBe(false);
  });

  it("shows the server's reason (expired or used link) and offers a new link", async () => {
    mockApi({ ...anonymous, "POST /auth/reset-password": () => fail(400, "VALIDATION_ERROR", "This link is invalid or has expired. Please request a new one.") });
    renderApp(<ResetPasswordPage />, { route: "/reset-password?token=abc123abc123abc123abc123" });
    await userEvent.type(await screen.findByLabelText(/^New password/), "Brand-New-Passphrase-1");
    await userEvent.type(screen.getByLabelText(/Confirm/), "Brand-New-Passphrase-1");
    await userEvent.click(screen.getByRole("button", { name: "Save password" }));
    expect(await screen.findByText(/invalid or has expired/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Request a new link" })).toBeInTheDocument();
  });

  it("without a token it explains and links to the request page", async () => {
    mockApi(anonymous);
    renderApp(<ResetPasswordPage />, { route: "/reset-password" });
    expect(await screen.findByText("This link is incomplete")).toBeInTheDocument();
  });
});
