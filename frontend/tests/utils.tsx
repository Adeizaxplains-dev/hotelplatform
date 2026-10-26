import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { AuthProvider } from "@/features/auth/AuthContext";
import { setAccessToken } from "@/services/tokenStore";

export const ok = <T,>(data: T, status = 200) => new Response(JSON.stringify({ success: true, data }), { status, headers: { "Content-Type": "application/json" } });
export const fail = (status: number, code: string, message = "x") => new Response(JSON.stringify({ success: false, error: { code, message } }), { status, headers: { "Content-Type": "application/json" } });

export const ME_OWNER = { user: { id: "u1", name: "Ada Nwosu", email: "ada@palm.com", role: "HOTEL_OWNER" }, permissions: ["rooms.read", "staff.create"], features: ["website", "booking"], tenant: { name: "Palm Hotel", slug: "palm" } };
export const HOTEL_CONTEXT = { scope: "tenant", hotel: { name: "Palm Hotel", slug: "palm", status: "ACTIVE", features: ["website"] } };
export const LOGIN_RESULT = { accessToken: "tok-1", expiresIn: 900, user: { id: "u1", name: "Ada Nwosu", email: "ada@palm.com", role: "HOTEL_OWNER", isActive: true, emailVerified: true } };

type Handler = (body: unknown) => Response | Promise<Response>;

/** Routes fetch calls by "METHOD /path". Unlisted calls fail the test loudly. Returns the call log. */
export function mockApi(handlers: Record<string, Handler>) {
  const calls: Array<{ key: string; body: unknown; auth: string | null }> = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();
    const key = `${method} ${url.pathname.replace(/^\/api\/v1/, "")}`;
    const body = init?.body instanceof FormData ? { __form: Object.fromEntries([...init.body.entries()].map(([k, v]) => [k, v instanceof File ? `file:${v.name}` : v])) } : init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ key, body, auth: new Headers(init?.headers).get("authorization") });
    const handler = handlers[key];
    if (!handler) throw new Error(`Unexpected request in test: ${key}`);
    return handler(body);
  });
  return calls;
}

export function renderApp(ui: ReactElement, { route = "/", extraRoutes }: { route?: string; extraRoutes?: ReactElement } = {}) {
  setAccessToken(null);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="*" element={ui} />
            {extraRoutes}
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
