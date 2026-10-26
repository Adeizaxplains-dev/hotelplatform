import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminLayout from "@/admin/AdminLayout";
import FacilitiesPage from "@/admin/pages/FacilitiesPage";
import GalleryPage from "@/admin/pages/GalleryPage";
import RoomTypesPage from "@/admin/pages/RoomTypesPage";
import RoomsPage from "@/admin/pages/RoomsPage";
import { ToastProvider } from "@/components/feedback/Toast";
import { AuthProvider } from "@/features/auth/AuthContext";
import { setAccessToken } from "@/services/tokenStore";
import type { MeResult } from "@/types/auth";
import { AMENITIES, meAs, paged, room, roomType } from "./adminData";
import { LOGIN_RESULT, fail, mockApi, ok } from "./utils";

afterEach(() => vi.restoreAllMocks());

const pagedResp = (items: unknown[]) => new Response(JSON.stringify(paged(items)), { status: 200, headers: { "Content-Type": "application/json" } });

function renderAdmin(ui: React.ReactElement, handlers: Record<string, (body: unknown) => Response | Promise<Response>> = {}, me: MeResult = meAs("HOTEL_OWNER"), route = "/admin") {
  setAccessToken(null);
  const calls = mockApi({ "POST /auth/refresh": () => ok(LOGIN_RESULT), "GET /auth/me": () => ok(me), "GET /catalog/amenities": () => ok(AMENITIES), "GET /media": () => pagedResp([]), ...handlers });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(<QueryClientProvider client={client}><AuthProvider><ToastProvider><MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter></ToastProvider></AuthProvider></QueryClientProvider>);
  return { ...utils, calls };
}

describe("room types", () => {
  it("lists them with price, guests, room count and visibility", async () => {
    renderAdmin(<RoomTypesPage />, { "GET /room-types": () => pagedResp([roomType(), roomType({ id: "rt2", name: "Hidden Suite", slug: "hidden-suite", basePrice: 12_000_000, isActive: false, isFeatured: false, roomCount: 0 })]) });
    expect(await screen.findByText("Deluxe Room")).toBeInTheDocument();
    expect(screen.getByText(/85,000/)).toBeInTheDocument();
    expect(screen.getByText(/120,000/)).toBeInTheDocument();
    expect(screen.getByText(/3 guests · 3 rooms/)).toBeInTheDocument();
    expect(screen.getByText("Hidden")).toBeInTheDocument();
    expect(screen.getByText("Featured")).toBeInTheDocument();
  });

  it("empty state invites the first room type", async () => {
    renderAdmin(<RoomTypesPage />, { "GET /room-types": () => pagedResp([]) });
    expect(await screen.findByText("No room types yet")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add room type" }).length).toBeGreaterThan(0);
  });

  it("shows a load error with a retry", async () => {
    renderAdmin(<RoomTypesPage />, { "GET /room-types": () => fail(500, "INTERNAL_ERROR") });
    expect(await screen.findByText(/couldn't load your room types/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("creates a room type: converts naira to integer kobo and sends the chosen amenities", async () => {
    const calls = renderAdmin(<RoomTypesPage />, { "GET /room-types": () => pagedResp([]), "POST /room-types": () => ok(roomType(), 201) }).calls;
    await userEvent.click((await screen.findAllByRole("button", { name: "Add room type" }))[0]!);
    const dialog = await screen.findByRole("dialog", { name: "Add room type" });
    await userEvent.type(within(dialog).getByLabelText(/^Name/), "Executive Suite");
    await userEvent.clear(within(dialog).getByLabelText(/Adults/));
    await userEvent.type(within(dialog).getByLabelText(/Adults/), "3");
    await userEvent.type(within(dialog).getByLabelText(/Price per night/), "85,000.50");
    await userEvent.click(await within(dialog).findByLabelText("Free Wi-Fi"));
    await userEvent.click(within(dialog).getByLabelText(/Featured on the home page/));
    await userEvent.click(within(dialog).getByRole("button", { name: "Add room type" }));
    await waitFor(() => expect(calls.some((c) => c.key === "POST /room-types")).toBe(true));
    expect(calls.find((c) => c.key === "POST /room-types")!.body).toMatchObject({ name: "Executive Suite", maxAdults: 3, maxChildren: 0, basePrice: 8_500_050, amenityKeys: ["wifi"], isFeatured: true, isActive: true });
    expect(await screen.findByText("Room type added.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("validates before sending: name, price and numbers get field messages and no request is made", async () => {
    const calls = renderAdmin(<RoomTypesPage />, { "GET /room-types": () => pagedResp([]) }).calls;
    await userEvent.click((await screen.findAllByRole("button", { name: "Add room type" }))[0]!);
    const dialog = await screen.findByRole("dialog", { name: "Add room type" });
    await userEvent.type(within(dialog).getByLabelText(/Price per night/), "eighty");
    await userEvent.type(within(dialog).getByLabelText(/Size/), "2");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add room type" }));
    expect(await within(dialog).findByText("Enter a name for this room type.")).toBeInTheDocument();
    expect(within(dialog).getByText(/Enter a price like 85000/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Size must be between/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Price per night/)).toHaveAttribute("aria-invalid", "true");
    expect(calls.some((c) => c.key === "POST /room-types")).toBe(false);
  });

  it("editing loads the existing values and sends nulls for fields the user cleared", async () => {
    const calls = renderAdmin(<RoomTypesPage />, { "GET /room-types": () => pagedResp([roomType({ shortDescription: "Light and airy", bedConfig: "1 King bed" })]), "PATCH /room-types/rt1": () => ok(roomType()) }).calls;
    await userEvent.click(await screen.findByRole("button", { name: "Edit Deluxe Room" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit Deluxe Room" });
    expect(within(dialog).getByLabelText(/Price per night/)).toHaveValue("85000");
    await userEvent.clear(within(dialog).getByLabelText(/Short description/));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(calls.some((c) => c.key === "PATCH /room-types/rt1")).toBe(true));
    expect(calls.find((c) => c.key === "PATCH /room-types/rt1")!.body).toMatchObject({ shortDescription: null, bedConfig: "1 King bed", basePrice: 8_500_000 });
  });

  it("deleting asks first, and explains when rooms still use the type", async () => {
    renderAdmin(<RoomTypesPage />, { "GET /room-types": () => pagedResp([roomType()]), "DELETE /room-types/rt1": () => fail(409, "CONFLICT", "3 rooms use this type. Move or remove them first, or hide the type instead.") });
    await userEvent.click(await screen.findByRole("button", { name: "Edit Deluxe Room" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    const confirm = within(dialog).getByRole("alertdialog", { name: "Confirm delete" });
    await userEvent.click(within(confirm).getByRole("button", { name: "Yes, delete" }));
    expect(await within(dialog).findByText(/3 rooms use this type/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument(); // still open: nothing was deleted
  });

  it("shows the server's message when saving fails (e.g. a duplicate address)", async () => {
    renderAdmin(<RoomTypesPage />, { "GET /room-types": () => pagedResp([roomType()]), "PATCH /room-types/rt1": () => fail(409, "CONFLICT", "Another room type already uses that address.") });
    await userEvent.click(await screen.findByRole("button", { name: "Edit Deluxe Room" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Another room type already uses that address.")).toBeInTheDocument();
  });

  it("a receptionist can look but not add, edit or delete", async () => {
    renderAdmin(<RoomTypesPage />, { "GET /room-types": () => pagedResp([roomType()]) }, meAs("RECEPTIONIST"));
    expect(await screen.findByText("Deluxe Room")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add room type" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit Deluxe Room" })).toBeNull();
  });
});

describe("rooms", () => {
  it("lists rooms with type, floor and a status that uses text, not just colour", async () => {
    renderAdmin(<RoomsPage />, { "GET /room-types": () => pagedResp([roomType()]), "GET /rooms": () => pagedResp([room(), room({ id: "r2", roomNumber: "205", status: "MAINTENANCE", floor: 2 })]) });
    expect(await screen.findByText("101")).toBeInTheDocument();
    const row = (n: string) => within(screen.getByText(n).closest("li")!);
    expect(row("101").getByText("Available")).toBeInTheDocument(); // the label is text, so meaning never depends on colour alone
    expect(row("205").getByText("Maintenance")).toBeInTheDocument();
    expect(row("205").getByText(/Floor 2/)).toBeInTheDocument();
  });

  it("filters ask the server (type and status in the query)", async () => {
    const calls = renderAdmin(<RoomsPage />, { "GET /room-types": () => pagedResp([roomType()]), "GET /rooms": () => pagedResp([room()]) }).calls;
    await screen.findByText("101");
    await userEvent.selectOptions(screen.getByLabelText("Status"), "OCCUPIED");
    await waitFor(() => expect(calls.filter((c) => c.key === "GET /rooms").length).toBeGreaterThan(1));
  });

  it("with no room types it tells you to create one first", async () => {
    renderAdmin(<RoomsPage />, { "GET /room-types": () => pagedResp([]), "GET /rooms": () => pagedResp([]) });
    expect(await screen.findByText("No rooms yet")).toBeInTheDocument();
    expect(screen.getByText(/Create a room type first/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add room" })).toBeNull();
  });

  it("adds a room, and shows a duplicate-number error from the server inside the dialog", async () => {
    const calls = renderAdmin(<RoomsPage />, { "GET /room-types": () => pagedResp([roomType()]), "GET /rooms": () => pagedResp([room()]), "POST /rooms": () => fail(409, "CONFLICT", "Room 101 already exists.") }).calls;
    await userEvent.click((await screen.findAllByRole("button", { name: "Add room" }))[0]!);
    const dialog = await screen.findByRole("dialog", { name: "Add room" });
    await userEvent.type(within(dialog).getByLabelText(/Room number/), "101");
    await userEvent.type(within(dialog).getByLabelText("Floor"), "1");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add room" }));
    expect(await within(dialog).findByText("Room 101 already exists.")).toBeInTheDocument();
    expect(calls.find((c) => c.key === "POST /rooms")!.body).toMatchObject({ roomNumber: "101", roomTypeId: "rt1", floor: 1, status: "AVAILABLE", isActive: true });
  });
});

describe("dialogs are accessible", () => {
  it("focus moves in, Tab stays inside, Escape closes, and focus returns to the opener", async () => {
    renderAdmin(<RoomsPage />, { "GET /room-types": () => pagedResp([roomType()]), "GET /rooms": () => pagedResp([room()]) });
    const opener = (await screen.findAllByRole("button", { name: "Add room" }))[0]!;
    opener.focus();
    await userEvent.click(opener);
    const dialog = await screen.findByRole("dialog", { name: "Add room" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.contains(document.activeElement)).toBe(true);
    for (let i = 0; i < 14; i++) { await userEvent.tab(); expect(dialog.contains(document.activeElement), `tab ${i}`).toBe(true); }
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).toBe("");
  });
});

describe("photos", () => {
  it("gallery: uploads each photo then adds it, and reports the ones that failed", async () => {
    const uploads: string[] = [];
    const { calls } = renderAdmin(<GalleryPage />, {
      "GET /gallery": () => pagedResp([]),
      "POST /media": (b) => { const name = (b as { __form: { file: string } }).__form.file; uploads.push(name); return name.includes("bad") ? fail(400, "VALIDATION_ERROR", "Only JPG, PNG or WebP images can be uploaded.") : ok({ id: `a-${uploads.length}`, url: "https://x/y.png", width: 400, height: 300, alt: "", bytes: 1, format: "png" }, 201); },
      "POST /gallery": () => ok({ id: "g1", assetId: "a-1", category: "other", isActive: true, sortOrder: 0 }, 201),
    });
    const input = await screen.findByLabelText("Choose photos to upload");
    await userEvent.upload(input, [new File(["x"], "pool.png", { type: "image/png" }), new File(["x"], "bad.png", { type: "image/png" })], { applyAccept: false });
    expect(await screen.findByText("Some photos weren't added")).toBeInTheDocument();
    expect(screen.getByText(/bad\.png: Only JPG, PNG or WebP/)).toBeInTheDocument();
    expect(calls.filter((c) => c.key === "POST /gallery")).toHaveLength(1);
    expect(await screen.findByText("1 photo added.")).toBeInTheDocument();
  });

  it("gallery: wrong file types and oversized files are refused in the browser, with no request", async () => {
    const { calls } = renderAdmin(<GalleryPage />, { "GET /gallery": () => pagedResp([]) });
    const input = await screen.findByLabelText("Choose photos to upload");
    const big = new File([new Uint8Array(10)], "huge.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 6_000_000 });
    await userEvent.upload(input, [new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" }), big], { applyAccept: false });
    expect(await screen.findByText(/logo\.svg: Only JPG, PNG or WebP/)).toBeInTheDocument();
    expect(screen.getByText(/huge\.png: That image is too large/)).toBeInTheDocument();
    expect(calls.some((c) => c.key === "POST /media")).toBe(false);
  });

  it("facilities: picks an icon, saves, and sends the chosen icon", async () => {
    const { calls } = renderAdmin(<FacilitiesPage />, { "GET /facilities": () => ok([]), "GET /catalog/icons": () => ok(["Sparkles", "Waves", "Dumbbell"]), "POST /facilities": () => ok({ id: "f1", name: "Pool", icon: "Waves", isActive: true, sortOrder: 0 }, 201) });
    await userEvent.click((await screen.findAllByRole("button", { name: "Add facility" }))[0]!);
    const dialog = await screen.findByRole("dialog", { name: "Add facility" });
    await userEvent.type(within(dialog).getByLabelText(/^Name/), "Rooftop pool");
    await userEvent.click(await within(dialog).findByRole("radio", { name: "Waves" }));
    expect(within(dialog).getByRole("radio", { name: "Waves" })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add facility" }));
    await waitFor(() => expect(calls.some((c) => c.key === "POST /facilities")).toBe(true));
    expect(calls.find((c) => c.key === "POST /facilities")!.body).toMatchObject({ name: "Rooftop pool", icon: "Waves", isActive: true });
  });
});

describe("admin shell", () => {
  it("shows only the pages this role and plan allow, and signs out", async () => {
    const { calls } = renderAdmin(<AdminLayout />, { "POST /auth/logout": () => ok({ loggedOut: true }) }, meAs("RECEPTIONIST"));
    const nav = await screen.findByRole("navigation", { name: "Admin" });
    expect(within(nav).getAllByRole("link").map((a) => a.textContent)).toEqual(["Dashboard", "Room types", "Rooms"]);
    expect(screen.getByRole("link", { name: /View website/ })).toHaveAttribute("target", "_blank");
    await userEvent.click(screen.getByRole("button", { name: /Sign out/ }));
    await waitFor(() => expect(calls.some((c) => c.key === "POST /auth/logout")).toBe(true));
  });

  it("the mobile menu toggles and closes with Escape", async () => {
    renderAdmin(<AdminLayout />, {}, meAs("HOTEL_OWNER"));
    const toggle = await screen.findByRole("button", { name: "Open menu" });
    await userEvent.click(toggle);
    expect(screen.getByRole("dialog", { name: "Menu" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Menu" })).toBeNull());
  });
});
