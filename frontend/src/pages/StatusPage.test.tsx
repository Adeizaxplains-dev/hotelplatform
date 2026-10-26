import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import StatusPage from "./StatusPage";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><StatusPage /></MemoryRouter>
    </QueryClientProvider>
  );
}

afterEach(() => vi.restoreAllMocks());

describe("StatusPage", () => {
  it("shows a loading state first, then operational", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ success: true, data: { status: "ok", service: "hotel-platform-api", version: "0.1.0", timestamp: new Date().toISOString(), database: "connected" } }));
    renderPage();
    expect(screen.getByLabelText("Checking system status")).toBeInTheDocument();
    expect(await screen.findByText("Operational")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("0.1.0")).toBeInTheDocument();
  });

  it("explains when the API is up but the database is not", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ success: false, error: { code: "SERVICE_UNAVAILABLE", message: "The database is not reachable." } }, 503));
    renderPage();
    expect(await screen.findByText(/cannot reach MongoDB/)).toBeInTheDocument();
    expect(screen.getByText("Unreachable")).toBeInTheDocument();
  });

  it("explains when the API itself is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    renderPage();
    expect(await screen.findByText("The API is not reachable")).toBeInTheDocument();
  });

  it("shows a friendly error with retry for unexpected failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ success: false, error: { code: "INTERNAL_ERROR", message: "x" } }, 500));
    renderPage();
    expect(await screen.findByText(/couldn't read the system status/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
