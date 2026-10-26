import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import WebsitePage from "@/admin/pages/WebsitePage";
import { ToastProvider } from "@/components/feedback/Toast";
import { AuthProvider } from "@/features/auth/AuthContext";
import type { ContentAdmin, ProfileAdmin } from "@/services/adminApi";
import { setAccessToken } from "@/services/tokenStore";
import type { MeResult } from "@/types/auth";
import { meAs, paged } from "./adminData";
import { LOGIN_RESULT, fail, mockApi, ok } from "./utils";

afterEach(() => vi.restoreAllMocks());

const profile = (): ProfileAdmin => ({
  tagline: "Calm in the city", description: "A quiet hotel.", contact: { phone: "+234 801 234 5678", whatsapp: "2348012345678", city: "Lagos" }, social: {},
  policies: { checkInTime: "14:00", checkOutTime: "12:00" }, branding: { primaryColor: "#0B6E6E", accentColor: "#B8863B", typography: "modern" }, seo: {}, assets: {},
});
const content = (): ContentAdmin => ({ hero: { headline: "Rest well", imageAssetIds: [] }, about: { highlights: [] }, whyChooseUs: [], testimonials: [], faqs: [], pageSeo: {}, assets: {} });

function renderPage(me: MeResult, handlers: Record<string, (b: unknown) => Response | Promise<Response>> = {}) {
  setAccessToken(null);
  const calls = mockApi({
    "POST /auth/refresh": () => ok(LOGIN_RESULT), "GET /auth/me": () => ok(me), "GET /hotel/profile": () => ok(profile()), "GET /hotel/content": () => ok(content()),
    "GET /catalog/icons": () => ok(["Sparkles", "Waves"]), "GET /media": () => new Response(JSON.stringify(paged([])), { status: 200, headers: { "Content-Type": "application/json" } }), ...handlers,
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><AuthProvider><ToastProvider><MemoryRouter><WebsitePage /></MemoryRouter></ToastProvider></AuthProvider></QueryClientProvider>);
  return calls;
}

describe("hotel details form", () => {
  it("loads the saved values", async () => {
    renderPage(meAs("HOTEL_OWNER"));
    expect(await screen.findByLabelText("Tagline")).toHaveValue("Calm in the city");
    expect(screen.getByLabelText("Phone")).toHaveValue("+234 801 234 5678");
    expect(screen.getByLabelText(/Check-in from/)).toHaveValue("14:00");
    expect(screen.getByRole("button", { name: "Save hotel details" })).toBeDisabled(); // nothing changed yet
    expect(screen.getByText("All changes saved.")).toBeInTheDocument();
  });

  it("saving sends cleared fields as null (so they are removed) and keeps the rest", async () => {
    const calls = renderPage(meAs("HOTEL_OWNER"), { "PATCH /hotel/profile": () => ok({ ...profile(), tagline: "New line" }) });
    const tagline = await screen.findByLabelText("Tagline");
    await userEvent.clear(tagline);
    await userEvent.type(tagline, "New line");
    await userEvent.clear(screen.getByLabelText("Phone"));
    expect(screen.getByText("You have unsaved changes.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save hotel details" }));
    await waitFor(() => expect(calls.some((c) => c.key === "PATCH /hotel/profile")).toBe(true));
    const body = calls.find((c) => c.key === "PATCH /hotel/profile")!.body as { tagline: string; contact: Record<string, unknown>; branding: Record<string, unknown> };
    expect(body.tagline).toBe("New line");
    expect(body.contact.phone).toBeNull();
    expect(body.contact.whatsapp).toBe("2348012345678");
    expect(body.contact.latitude).toBeNull();
    expect(body.branding).toMatchObject({ primaryColor: "#0B6E6E", logoAssetId: null });
    expect(await screen.findByText("Hotel details saved.")).toBeInTheDocument();
  });

  it.each([
    ["WhatsApp number", "0801234", /Include the country code/],
    ["Facebook", "http://facebook.com/x", /secure https link on facebook\.com/],
    ["Instagram", "https://instagram.com.evil.com/x", /instagram\.com/],
    ["Google Maps embed link", "https://evil.com/maps/embed", /Paste the Google Maps embed link/],
    ["Latitude", "123", /between -90 and 90/],
    ["Main colour", "teal", /colour like #0B6E6E/],
    ["Page title format", "My hotel", /Include %s/],
  ])("%s: shows a clear message and sends nothing", async (label, bad, message) => {
    const calls = renderPage(meAs("HOTEL_OWNER"));
    const field = await screen.findByLabelText(new RegExp(`^${label}`));
    await userEvent.clear(field);
    await userEvent.type(field, bad);
    await userEvent.click(screen.getByRole("button", { name: "Save hotel details" }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(calls.some((c) => c.key === "PATCH /hotel/profile")).toBe(false);
  });

  it("shows the server's message if saving fails", async () => {
    renderPage(meAs("HOTEL_OWNER"), { "PATCH /hotel/profile": () => fail(400, "VALIDATION_ERROR", "One of the chosen images could not be found.") });
    const tagline = await screen.findByLabelText("Tagline");
    await userEvent.type(tagline, "!");
    await userEvent.click(screen.getByRole("button", { name: "Save hotel details" }));
    expect(await screen.findByText(/chosen images could not be found/)).toBeInTheDocument();
  });

  it("previews the brand with readable button text, even for a hard colour like pink", async () => {
    renderPage(meAs("HOTEL_OWNER"));
    const colour = await screen.findByLabelText("Main colour");
    await userEvent.clear(colour);
    await userEvent.type(colour, "#F712B3");
    const preview = await screen.findByLabelText("Brand preview");
    expect(preview.style.getPropertyValue("--on-brand")).toBe("#000000");
    expect(within(preview).getByText(/Button text contrast: \d+\.\d:1/)).toBeInTheDocument();
  });

  it("a manager can read the details but not change them", async () => {
    renderPage(meAs("HOTEL_MANAGER"));
    expect(await screen.findByText("View only")).toBeInTheDocument();
    expect(await screen.findByLabelText("Tagline")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save hotel details" })).toBeDisabled();
  });
});

describe("website content form", () => {
  it("adds a question and a review, validates them, and saves", async () => {
    const calls = renderPage(meAs("HOTEL_OWNER"), { "PATCH /hotel/content": () => ok(content()) });
    await userEvent.click(await screen.findByRole("tab", { name: "Website content" }));
    await userEvent.click(await screen.findByRole("button", { name: "Add a question" }));
    await userEvent.click(screen.getByRole("button", { name: "Save website content" }));
    expect(await screen.findByText("Enter the question.")).toBeInTheDocument();
    expect(calls.some((c) => c.key === "PATCH /hotel/content")).toBe(false);

    await userEvent.type(screen.getByLabelText("Question"), "Is parking free?");
    await userEvent.type(screen.getByLabelText("Answer"), "Yes, for guests.");
    await userEvent.click(screen.getByRole("button", { name: "Add a review" }));
    await userEvent.type(screen.getByLabelText("Quote"), "Lovely stay.");
    await userEvent.type(screen.getByLabelText("Guest name"), "Tolu A.");
    await userEvent.selectOptions(screen.getByLabelText("Rating"), "5");
    await userEvent.click(screen.getByRole("button", { name: "Save website content" }));
    await waitFor(() => expect(calls.some((c) => c.key === "PATCH /hotel/content")).toBe(true));
    const body = calls.find((c) => c.key === "PATCH /hotel/content")!.body as { faqs: unknown; testimonials: unknown; hero: { headline: string }; about: { highlights: unknown } };
    expect(body.faqs).toEqual([{ question: "Is parking free?", answer: "Yes, for guests." }]);
    expect(body.testimonials).toEqual([{ quote: "Lovely stay.", guestName: "Tolu A.", rating: 5 }]);
    expect(body.hero.headline).toBe("Rest well");
    expect(body.about.highlights).toEqual([]);
  });

  it("limits repeaters to what the server allows and lets you remove entries", async () => {
    renderPage(meAs("HOTEL_OWNER"));
    await userEvent.click(await screen.findByRole("tab", { name: "Website content" }));
    for (let i = 0; i < 6; i++) await userEvent.click(await screen.findByRole("button", { name: "Add highlight" }));
    expect(screen.getByRole("button", { name: "Add highlight" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Remove highlight 6" }));
    expect(screen.getByRole("button", { name: "Add highlight" })).toBeEnabled();
  });

  it("a receptionist sees neither tab (and the API would refuse them anyway)", async () => {
    renderPage(meAs("RECEPTIONIST"));
    expect(await screen.findByText("Nothing to show")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).toBeNull();
  });
});
