# Phase 16 — Frontend Photography Refresh

## Changes

- Added a full-bleed four-slide homepage carousel featuring representative, well-lit hotel rooms and suites.
- Added accessible previous/next controls, slide indicators, automatic rotation every 6.5 seconds, pause-on-hover/focus, and respect for `prefers-reduced-motion`.
- Added photographic fallbacks for missing room, room-detail, About, Facilities, and Gallery images.
- Added image-error fallback handling so a broken hotel image is replaced with a second representative photo rather than a broken-image icon.
- Added detection for the old Palm Court demo illustrations, so existing demo databases display photographs without requiring immediate database reseeding.
- Updated the demo seed script to stop uploading generated illustration assets and documented photo sources and replacement guidance.
- Added frontend tests for the slideshow controls and representative-photo fallback.

## Verification

- TypeScript/TSX syntax transpilation: passed for 259 files.
- Full TypeScript typecheck: not run; frontend dependencies/types (`vite/client`, `vitest/globals`) are unavailable in this environment.
- Frontend tests and production build: not run.
- External CDN images: not downloaded or visually verified from this environment; browser access to Unsplash's CDN is required.

## Before production

Replace representative photography with the hotel's own authorized images, ideally upload 2–5 wide hero images. Review `docs/PHOTO-CREDITS.md`. Run `npm run install:all`, then `npm run check`.
