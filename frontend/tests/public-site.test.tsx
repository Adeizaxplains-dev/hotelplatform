import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/features/auth/AuthContext";
import PublicShell from "@/public-site/PublicShell";
import AboutPage from "@/public-site/pages/AboutPage";
import BookingPage from "@/public-site/pages/BookingPage";
import ContactPage from "@/public-site/pages/ContactPage";
import FacilitiesPage from "@/public-site/pages/FacilitiesPage";
import GalleryPage from "@/public-site/pages/GalleryPage";
import HomePage from "@/public-site/pages/HomePage";
import RoomDetailPage from "@/public-site/pages/RoomDetailPage";
import RoomsPage from "@/public-site/pages/RoomsPage";
import { setAccessToken } from "@/services/tokenStore";
import type { PublicSite } from "@/types/site";
import { makeSite, room } from "./siteData";
import { fail, mockApi, ok } from "./utils";

afterEach(() => vi.restoreAllMocks());

const tenantCtx = (site: PublicSite, status = "ACTIVE") => ({ scope: "tenant", hotel: { name: site.hotel.name, slug: site.hotel.slug, status, features: site.features } });

function renderSite(route: string, handlers: Record<string, () => Response | Promise<Response>> = {}, site = makeSite()) {
  setAccessToken(null);
  const calls = mockApi({
    "GET /tenants/context": () => ok(tenantCtx(site)),
    "GET /public/site": () => ok(site),
    "POST /auth/refresh": () => fail(401, "UNAUTHENTICATED"),
    "GET /public/room-types": () => ok(site.featuredRooms),
    "GET /public/room-types/deluxe-room": () => ok(site.featuredRooms[0]),
    "GET /public/facilities": () => ok(site.facilities),
    "GET /public/gallery": () => ok(site.gallery),
    ...handlers,
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route element={<PublicShell />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/rooms" element={<RoomsPage />} />
              <Route path="/rooms/:slug" element={<RoomDetailPage />} />
              <Route path="/facilities" element={<FacilitiesPage />} />
              <Route path="/gallery" element={<GalleryPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/booking" element={<BookingPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
  return { ...utils, calls };
}

describe("home page", () => {
  it("shows the hero, quick facts, rooms, facilities, gallery, testimonial and a booking action", async () => {
    renderSite("/");
    expect(await screen.findByRole("heading", { level: 1, name: "Rest well. Wake happy." })).toBeInTheDocument();
    expect(screen.getByText("Boutique stays near the lagoon.")).toBeInTheDocument();
    expect(screen.getByText("From 2:00 pm")).toBeInTheDocument();
    expect(screen.getByText("By 12:00 pm")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Deluxe Room" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Rooftop pool")).toBeInTheDocument();
    expect(screen.getByText("Spotless and peaceful.")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Book now/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("img", { name: "Photo 9" }).length).toBeGreaterThan(0);
  });

  it("formats prices from integer kobo", async () => {
    renderSite("/");
    expect((await screen.findAllByText(/85,000/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/8500000/)).toBeNull();
  });

  it("applies the hotel's own brand colours, with readable text on them", async () => {
    const { container } = renderSite("/");
    await screen.findByRole("heading", { level: 1 });
    const root = container.querySelector(".site-root") as HTMLElement;
    expect(root.style.getPropertyValue("--brand")).toBe("#7C2D12");
    expect(root.style.getPropertyValue("--on-brand")).toBe("#FFFFFF");
    expect(root.style.getPropertyValue("--site-display")).toContain("Fraunces");
  });

  it("the hero image loads at once with high priority, everything else lazily", async () => {
    const { container } = renderSite("/");
    await screen.findByRole("heading", { level: 1 });
    const hero = container.querySelector('img[src$="photo-9.jpg"]') as HTMLImageElement;
    expect(hero.getAttribute("loading")).toBe("eager");
    expect(hero.getAttribute("fetchpriority")).toBe("high");
    const lazy = container.querySelector('img[src$="photo-3.jpg"]') as HTMLImageElement;
    expect(lazy.getAttribute("loading")).toBe("lazy");
    expect(lazy.getAttribute("width")).toBe("900"); // intrinsic size: no layout jump
  });

  it("sets the page title, description, canonical and social tags", async () => {
    renderSite("/");
    await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(document.title).toBe("Palm Court Hotel: Calm in the city"));
    const meta = (sel: string) => document.head.querySelector(sel)?.getAttribute("content");
    expect(meta('meta[name="description"]')).toBe("Boutique hotel in Lagos.");
    expect(meta('meta[property="og:title"]')).toBe("Palm Court Hotel: Calm in the city");
    expect(meta('meta[property="og:site_name"]')).toBe("Palm Court Hotel");
    expect(meta('meta[name="theme-color"]')).toBe("#7C2D12");
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute("href")).toMatch(/\/$/);
    // inline scripts stay where they are rendered (React only hoists <title>, <meta>, <link>)
    const ld = JSON.parse(document.querySelector('script[type="application/ld+json"]')!.textContent!);
    expect(ld["@type"]).toBe("Hotel");
  });

  it("renders editor-supplied text as TEXT: markup is never interpreted", async () => {
    const evil = "<img src=x onerror=alert(1)>";
    const site = makeSite({ content: { ...makeSite().content, hero: { headline: evil, subheadline: "<script>alert(2)</script>", images: [] }, testimonials: [{ quote: "<b onmouseover=alert(3)>hi</b>", guestName: "</script><script>alert(4)</script>" }] } });
    const { container } = renderSite("/", {}, site);
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(evil);
    expect(container.querySelector('img[src="x"]')).toBeNull();
    expect(container.querySelectorAll('script:not([type="application/ld+json"])')).toHaveLength(0);
    expect(container.querySelector("b")).toBeNull();
    const ld = container.querySelector('script[type="application/ld+json"]')!;
    expect(ld.textContent).not.toContain("<"); // the hotel's own text inside structured data cannot close the tag
  });

  it("renders a full-screen room-and-suite slideshow with accessible controls", async () => {
    const site = makeSite({ content: { ...makeSite().content, hero: { headline: "A restful stay", subheadline: null, images: [] } } });
    const { container } = renderSite("/", {}, site);
    await screen.findByRole("heading", { level: 1, name: "A restful stay" });
    expect(screen.getByRole("region", { name: "Hotel rooms and suites" })).toHaveAttribute("aria-roledescription", "carousel");
    expect(screen.getByRole("button", { name: "Previous hotel room photo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next hotel room photo" })).toBeInTheDocument();
    expect(container.querySelectorAll('img[src^="https://images.unsplash.com/"]').length).toBeGreaterThanOrEqual(4);
  });

  it("uses real representative hotel photography when the hotel has not uploaded images", async () => {
    const site = makeSite({ content: { ...makeSite().content, hero: { headline: "Hi", subheadline: null, images: [] }, about: { heading: null, body: null, image: null, highlights: [] } }, featuredRooms: [room({ images: [] })], gallery: [] });
    const { container } = renderSite("/", {}, site);
    await screen.findByRole("heading", { level: 1, name: "Hi" });
    expect(screen.getByRole("img", { name: "Deluxe Room representative photo" })).toBeInTheDocument();
    expect(container.querySelectorAll("img").length).toBeGreaterThan(4);
    expect(screen.getByText(/Representative hotel photography/)).toBeInTheDocument();
    expect(screen.getByText("A look around")).toBeInTheDocument();
  });

  it("falls back to a WhatsApp enquiry when the plan has no online booking", async () => {
    renderSite("/", {}, makeSite({ features: ["website", "cms", "rooms", "gallery"] }));
    const link = (await screen.findAllByRole("link", { name: /Enquire on WhatsApp/ }))[0] as HTMLAnchorElement;
    expect(link.href).toContain("https://wa.me/2348012345678?text=");
    expect(link.rel).toContain("noopener");
    expect(screen.queryByRole("link", { name: "Book now" })).toBeNull();
  });
});

describe("navigation and chrome", () => {
  it("offers only the pages the hotel has", async () => {
    renderSite("/", {}, makeSite({ facilities: [], gallery: [] }));
    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Rooms" })).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Facilities" })).toBeNull();
    expect(within(nav).queryByRole("link", { name: "Gallery" })).toBeNull();
    expect(within(nav).getByRole("link", { name: "Contact" })).toBeInTheDocument();
  });

  it("has a mobile quick-action bar with WhatsApp, Call and Book", async () => {
    renderSite("/");
    const bar = await screen.findByRole("navigation", { name: "Quick actions" });
    expect(within(bar).getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", expect.stringContaining("wa.me/2348012345678"));
    expect(within(bar).getByRole("link", { name: /Call/ })).toHaveAttribute("href", "tel:+2348012345678");
    expect(within(bar).getByRole("link", { name: "Book now" })).toHaveAttribute("href", "/booking");
  });

  it("the mobile menu opens as a dialog and closes with Escape", async () => {
    renderSite("/");
    const toggle = await screen.findByRole("button", { name: "Open menu" });
    await userEvent.click(toggle);
    const dialog = screen.getByRole("dialog", { name: "Menu" });
    expect(within(dialog).getByRole("link", { name: "Rooms" })).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Menu" })).toBeNull());
  });

  it("has a skip link, landmarks and one h1", async () => {
    renderSite("/");
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("footer social links open safely in a new tab", async () => {
    renderSite("/");
    const fb = (await screen.findByRole("link", { name: "Palm Court Hotel on facebook" })) as HTMLAnchorElement;
    expect(fb.target).toBe("_blank");
    expect(fb.rel).toContain("noopener");
    expect(fb.rel).toContain("noreferrer");
  });
});

describe("photo viewer (lightbox)", () => {
  it("opens, moves with arrow keys, wraps, announces position, closes with Escape and returns focus", async () => {
    renderSite("/gallery");
    const first = await screen.findByRole("button", { name: "Open photo: Pool at dusk" });
    first.focus();
    await userEvent.click(first);
    const dialog = screen.getByRole("dialog", { name: "Photo viewer" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByText("Photo 1 of 3")).toBeInTheDocument();
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Close photo viewer" }));
    await userEvent.keyboard("{ArrowRight}");
    expect(within(dialog).getByText("Photo 2 of 3")).toBeInTheDocument();
    expect(within(dialog).getByText("Lobby")).toBeInTheDocument();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(within(dialog).getByText("Photo 1 of 3")).toBeInTheDocument(); // wraps around
    await userEvent.keyboard("{ArrowLeft}");
    expect(within(dialog).getByText("Photo 3 of 3")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Photo viewer" })).toBeNull();
    expect(document.activeElement).toBe(first);
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps keyboard focus inside while open (Tab cycles through its buttons)", async () => {
    renderSite("/gallery");
    await userEvent.click(await screen.findByRole("button", { name: "Open photo: Pool at dusk" }));
    const dialog = screen.getByRole("dialog", { name: "Photo viewer" });
    const buttons = within(dialog).getAllByRole("button");
    for (let i = 0; i < buttons.length * 2; i++) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it("the gallery filters by category", async () => {
    renderSite("/gallery");
    await screen.findByRole("button", { name: "Open photo: Pool at dusk" });
    await userEvent.click(screen.getByRole("button", { name: "Exterior", pressed: false }));
    expect(screen.getByRole("button", { name: "Exterior", pressed: true })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open photo: Pool at dusk" })).toBeNull();
    expect(screen.getByRole("button", { name: "Open photo: Lobby" })).toBeInTheDocument();
  });
});

describe("rooms", () => {
  it("lists rooms as links to their pages with prices", async () => {
    renderSite("/rooms");
    expect(await screen.findByRole("heading", { level: 1, name: "Rooms and suites" })).toBeInTheDocument();
    const link = await screen.findByRole("link", { name: "Standard Room" });
    expect(link).toHaveAttribute("href", "/rooms/standard-room");
    expect(screen.getAllByText(/50,000/).length).toBeGreaterThan(0);
  });

  it("shows a helpful empty state and a retry on failure", async () => {
    renderSite("/rooms", { "GET /public/room-types": () => ok([]) });
    expect(await screen.findByText("Rooms will appear here soon")).toBeInTheDocument();
  });

  it("explains a loading failure in plain language and offers to try again", async () => {
    renderSite("/rooms", { "GET /public/room-types": () => fail(500, "INTERNAL_ERROR") });
    expect(await screen.findByText(/couldn't load the rooms/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("room page shows details, amenities, and a booking link carrying the room", async () => {
    renderSite("/rooms/deluxe-room");
    expect(await screen.findByRole("heading", { level: 1, name: "Deluxe Room" })).toBeInTheDocument();
    expect(screen.getByText("Free Wi-Fi")).toBeInTheDocument();
    expect(screen.getByText("Air conditioning")).toBeInTheDocument();
    expect(screen.getByText("3 guests")).toBeInTheDocument();
    expect(screen.getByText("32 m²")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Book this room" })).toHaveAttribute("href", "/booking?room=deluxe-room");
    await waitFor(() => expect(document.title).toBe("Deluxe Room | Palm Court"));
  });

  it("thumbnails switch the main photo and mark the current one", async () => {
    const { container } = renderSite("/rooms/deluxe-room");
    await screen.findByRole("heading", { level: 1, name: "Deluxe Room" });
    const main = () => container.querySelector("button[aria-label='Open photo viewer'] img") as HTMLImageElement;
    expect(main().src).toContain("photo-1");
    await userEvent.click(screen.getByRole("button", { name: "Show photo 2" }));
    expect(main().src).toContain("photo-2");
    expect(screen.getByRole("button", { name: "Show photo 2" })).toHaveAttribute("aria-current", "true");
  });

  it("an unknown room is a friendly not-found, not a crash", async () => {
    renderSite("/rooms/ghost", { "GET /public/room-types/ghost": () => fail(404, "NOT_FOUND", "We couldn't find that room.") });
    expect(await screen.findByText("We couldn't find that room")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all rooms" })).toHaveAttribute("href", "/rooms");
  });

  it("without online booking the room page offers WhatsApp with the room named in the message", async () => {
    const site = makeSite({ features: ["website", "cms", "rooms", "gallery"] });
    renderSite("/rooms/deluxe-room", {}, site);
    await screen.findByRole("heading", { level: 1, name: "Deluxe Room" });
    const link = screen.getAllByRole("link", { name: /WhatsApp/ }).find((a) => decodeURIComponent((a as HTMLAnchorElement).href).includes("Deluxe"))!;
    expect(decodeURIComponent((link as HTMLAnchorElement).href)).toContain("book the Deluxe Room");
    expect(screen.queryByRole("link", { name: "Book this room" })).toBeNull();
  });
});

describe("other pages", () => {
  it("booking page is honest that online booking is coming, and links straight to WhatsApp with the room", async () => {
    renderSite("/booking?room=standard-room");
    expect(await screen.findByRole("heading", { level: 1, name: "Book your stay" })).toBeInTheDocument();
    expect(screen.getByText(/is being set up/)).toBeInTheDocument();
    const wa = screen.getByRole("link", { name: /Book on WhatsApp/ }) as HTMLAnchorElement;
    expect(decodeURIComponent(wa.href)).toContain("the Standard Room");
    expect(screen.getByText("Free cancellation up to 48 hours before.")).toBeInTheDocument();
  });

  it("contact page lists real contact links, policies and FAQs that open and close", async () => {
    renderSite("/contact");
    expect(await screen.findByRole("heading", { level: 1, name: "Contact us" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "+234 801 234 5678" })[0]).toHaveAttribute("href", "tel:+2348012345678");
    expect(screen.getAllByRole("link", { name: "hi@palm.example.com" })[0]).toHaveAttribute("href", "mailto:hi@palm.example.com");
    expect(screen.getByText("Open in Google Maps")).toHaveAttribute("href", expect.stringContaining("google.com/maps/dir"));
    const summary = screen.getByText("Is breakfast included?");
    const details = summary.closest("details")!;
    expect(details.open).toBe(false);
    await userEvent.click(summary);
    expect(details.open).toBe(true);
  });

  it("embeds the map when the hotel provides one, with an accessible title and lazy loading", async () => {
    const base = makeSite();
    const site = makeSite({ hotel: { contact: { ...base.hotel.contact, mapEmbedUrl: "https://www.google.com/maps/embed?pb=abc" } } });
    renderSite("/contact", {}, site);
    const frame = (await screen.findByTitle("Map showing the location of Palm Court Hotel")) as HTMLIFrameElement;
    expect(frame.src).toBe("https://www.google.com/maps/embed?pb=abc");
    expect(frame.getAttribute("loading")).toBe("lazy");
    expect(frame.getAttribute("referrerpolicy")).toBe("no-referrer");
  });

  it("about and facilities pages render their content", async () => {
    const a = renderSite("/about");
    expect(await screen.findByRole("heading", { level: 1, name: "Our story" })).toBeInTheDocument();
    expect(screen.getByText("Family-run since 2009.")).toBeInTheDocument();
    a.unmount();
    renderSite("/facilities");
    expect(await screen.findByRole("heading", { level: 1, name: "Facilities" })).toBeInTheDocument();
    expect(await screen.findByText("Open 7am to 9pm.")).toBeInTheDocument();
  });

  it("splits long text into paragraphs", async () => {
    const { container } = renderSite("/about");
    await screen.findByRole("heading", { level: 1 });
    expect(container.querySelectorAll("p").length).toBeGreaterThanOrEqual(2);
  });
});

describe("which site is this? (decided by the server from the address)", () => {
  it("an unknown address shows 'couldn't find this hotel'", async () => {
    renderSite("/", { "GET /tenants/context": () => ok({ scope: "unknown", hotel: null }) });
    expect(await screen.findByText("We couldn't find this hotel")).toBeInTheDocument();
  });

  it("a suspended hotel shows a notice and never loads its content", async () => {
    const site = makeSite();
    const { calls } = renderSite("/", { "GET /tenants/context": () => ok(tenantCtx(site, "SUSPENDED")) }, site);
    expect(await screen.findByText("Palm Court Hotel is temporarily unavailable")).toBeInTheDocument();
    expect(calls.some((c) => c.key === "GET /public/site")).toBe(false);
  });

  it("the platform address shows the operator status page at / and not-found elsewhere", async () => {
    mockApi({ "GET /tenants/context": () => ok({ scope: "platform", hotel: null }), "POST /auth/refresh": () => fail(401, "UNAUTHENTICATED"), "GET /health/ready": () => ok({ status: "ok", service: "hotel-platform-api", version: "0.1.0", timestamp: new Date().toISOString(), database: "connected" }) });
    const client = new QueryClient();
    const { unmount } = render(<QueryClientProvider client={client}><AuthProvider><MemoryRouter initialEntries={["/"]}><Routes><Route element={<PublicShell />}><Route path="/" element={<HomePage />} /><Route path="/rooms" element={<RoomsPage />} /></Route></Routes></MemoryRouter></AuthProvider></QueryClientProvider>);
    expect(await screen.findByRole("heading", { name: "System status" })).toBeInTheDocument();
    unmount();
  });

  it("shows a loading state, then an error with retry if the site cannot load", async () => {
    renderSite("/", { "GET /public/site": () => fail(500, "INTERNAL_ERROR") });
    expect(screen.getByLabelText("Loading the hotel website")).toBeInTheDocument();
    expect(await screen.findByText(/couldn't load this website/, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("says so plainly when the hotel's plan has the website switched off", async () => {
    renderSite("/", { "GET /public/site": () => fail(403, "FEATURE_NOT_AVAILABLE") });
    expect(await screen.findByText("This website isn't available")).toBeInTheDocument();
  });
});

void act;
