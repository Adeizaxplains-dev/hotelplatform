# Hotel website, content and media (Phase 2)

## What a hotel can manage

| Area | Where | Notes |
|---|---|---|
| Hotel details | Admin → Website → Hotel details | Tagline, contact, WhatsApp, address and map, social links, check-in/out, policies, **branding** (two colours, type style, logo, favicon), search-engine defaults |
| Website content | Admin → Website → Website content | Home banner, about story and highlights, why-choose-us, guest reviews, FAQs, per-page SEO |
| Room types | Admin → Room types | Price (₦, stored as integer kobo), capacity, bed, size, amenities, photos, featured, visible |
| Rooms | Admin → Rooms | Room number (unique per hotel), type, floor, status, in service |
| Facilities | Admin → Facilities | Name, description, icon, photo |
| Gallery | Admin → Gallery | Multi-photo upload, caption, category, visible |

## Data model (all hotel-owned, all tenant-scoped, all covered by the tenant tripwire)

`HotelProfile` and `WebsiteContent` (one document per hotel, **unique tenantId index**), `RoomType` (unique `{tenantId, slug}`), `Room` (unique `{tenantId, roomNumber}`),
`Facility`, `GalleryImage`, `MediaAsset`. Website copy is **structured plain text, never HTML or free-form pages**, so an editor can never inject markup or script.

Deviations from the original brief: amenities are a fixed catalogue in code (not a per-hotel collection); `websitePages` is the structured `WebsiteContent` document.

## Images

* Upload goes through the API (multipart, memory only). The server validates **content**: magic bytes must say JPEG, PNG or WebP (SVG, GIF, PDF, HTML, executables are refused), size ≤ `UPLOAD_MAX_BYTES`, 100–8000 px per side. The client's file name and declared type are never used or stored.
* Files live in an opaque per-hotel folder (`hotels/<hmac of tenant id>/`), so hotels cannot overwrite each other and the internal tenant id never appears in public URLs.
* An image id can only be attached to something by the hotel that owns it, and an image still in use cannot be deleted.
* Providers: **Cloudinary** (production), **local disk** (development only; refused in production), **none** (clear 503 "image uploads are not set up"). The Cloudinary adapter follows the documented Node SDK but **has not been exercised against a live Cloudinary account**; test an upload there before launch.
* Public images carry width/height (no layout shift) and, on Cloudinary, responsive `srcSet` variants (`f_auto,q_auto`).

## The public website

React routes `/`, `/about`, `/rooms`, `/rooms/:slug`, `/facilities`, `/gallery`, `/contact`, `/booking`, shown only when the hotel's address resolves to a hotel.
On the platform address the same `/` shows the operator home, and on unknown addresses a "couldn't find this hotel" notice.

* **Branding**: the hotel's two colours become CSS variables through `src/lib/color.ts`, which guarantees readable text for *any* colour: button text is white, the dark ink, or black (first to reach 4.5:1), and brand-coloured text is darkened until it passes (property-tested over 500 random colours).
* **Calls to action** follow the plan and what the hotel has filled in: Book now (plan includes booking) → WhatsApp → phone → Contact. A mobile bottom bar offers WhatsApp, Call and Book.
* **SEO**: per-page title/description/canonical/Open Graph, hotel JSON-LD with escaped content. Rendered in the browser (React 19 metadata). **Crawlers that do not run JavaScript will not see it; pre-rendering is planned for Phase 6.**
* **Performance**: pages are code-split, the first hero slide loads eagerly with high priority, other slides and page images load lazily, entry bundle ≈ 103 KB gzipped.
* **Accessibility**: skip link, landmarks, one `h1` per page, focus moved to the content on navigation, keyboard-operable menu, lightbox with focus trap and arrow keys, reduced-motion respected, status never conveyed by colour alone.

## Seeding a demo hotel

`npm --prefix backend run seed:demo` builds "Palm Court Hotel" through the real services (3 room types, 15 rooms, facilities, content, branding) using curated representative hotel photography from Unsplash as frontend fallbacks until the hotel owner uploads actual property photos. Development only. Open `http://palmcourt.localhost:5173`.

## Not implemented yet

* Booking search bar and online booking (Phase 3); the `/booking` page says so honestly and offers WhatsApp, phone and email with the chosen room.
* Offers, events and restaurant pages (Phase 5).
* Drag-and-drop ordering (the `sortOrder` field exists, the admin has no reorder controls), bulk room creation, an image-library screen with delete, image cropping, custom amenities.
* DNS-proof verification of custom domains (Phase 1 note).
* Room delete is a hard delete; Phase 3 adds the "has reservations" guard.


## Photography and the homepage slideshow

The public website uses a full-bleed, four-slide hotel-room slideshow when no hero images have been uploaded. When the hotel uploads two or more hero photos, those hotel-owned images become the slideshow. If there is only one uploaded hero photo, it is shown first with representative stock photos until more property photos are added. Missing room, about, facility, and gallery images use representative photography and are labelled in the gallery where appropriate. Replace sample photos with images you own or have permission to use before publishing a live hotel's site.

Representative fallback photography is served from Unsplash's image CDN, so visitors need an internet connection for those remote images. Uploaded hotel images continue to use the configured media-storage provider.
