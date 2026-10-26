/*
 * Builds a complete sample hotel ("Palm Court Hotel") through the real services, so a fresh checkout shows a full website:
 *   npm --prefix backend run seed:demo        then open http://palmcourt.localhost:5173
 * Development only. Public pages use curated representative photography until hotel owners upload their own property images.
 */
import { Types } from "mongoose";
import { bootstrapEnv } from "../src/config/bootstrap.js";
import { buildContainer } from "../src/container.js";
import { connectDatabase, disconnectDatabase } from "../src/database/connection.js";
import type { AuthContext } from "../src/shared/context.js";
import { hashPassword } from "../src/shared/password.js";
import { createLogger } from "../src/shared/logger.js";
import { Subscription, Tenant } from "../src/modules/tenants/tenant.model.js";
import { toTenantView } from "../src/modules/tenants/tenant.service.js";
import { User } from "../src/modules/users/user.model.js";

const env = bootstrapEnv();
if (env.NODE_ENV === "production") {
  console.error("Refusing to seed demo data in production.");
  process.exit(1);
}
const SLUG = "palmcourt";
const OWNER_EMAIL = "owner@palmcourt.example.com";
const OWNER_PASSWORD = process.env["DEMO_OWNER_PASSWORD"] ?? "Palm-Court-Demo-2026";

await connectDatabase(env, createLogger({ NODE_ENV: "production", LOG_LEVEL: "warn" }));
try {
  if (await Tenant.exists({ slug: SLUG })) {
    console.log(`The demo hotel already exists. Delete the "${SLUG}" tenant (or use a fresh database) to recreate it.`);
    process.exit(0);
  }
  const c = buildContainer(env, createLogger({ NODE_ENV: "production", LOG_LEVEL: "warn" }));
  const tenant = await Tenant.create({ name: "Palm Court Hotel", slug: SLUG, plan: "MANAGEMENT", timezone: "Africa/Lagos", currency: "NGN" });
  await Subscription.create({ tenantId: tenant._id, plan: "MANAGEMENT", note: "Demo hotel" });
  const owner = await User.create({ tenantId: tenant._id, name: "Ada Nwosu", email: OWNER_EMAIL, role: "HOTEL_OWNER", isActive: true, passwordHash: await hashPassword(OWNER_PASSWORD), emailVerifiedAt: new Date() });
  const view = toTenantView(tenant);
  const actor: AuthContext = { userId: owner._id, sessionId: new Types.ObjectId(), role: "HOTEL_OWNER", tenantId: tenant._id, name: owner.name, email: owner.email };
  const meta = { requestId: "seed-demo" };

  await c.hotel.updateProfile(actor, view, {
    tagline: "Calm in the heart of Lagos",
    description: "A quiet, family-run hotel a short walk from the lagoon, with a rooftop pool, a restaurant and rooms designed for a proper night's sleep.",
    contact: { phone: "+234 801 234 5678", whatsapp: "2348012345678", email: "hello@palmcourt.example.com", address: "12 Marina Road", city: "Lagos", state: "Lagos State", country: "Nigeria", latitude: 6.4531, longitude: 3.3958 },
    social: { instagram: "https://www.instagram.com/palmcourtdemo", facebook: "https://www.facebook.com/palmcourtdemo" },
    policies: { checkInTime: "14:00", checkOutTime: "12:00", cancellation: "Free cancellation up to 48 hours before arrival. After that the first night is charged.", houseRules: "Quiet hours from 10pm. No smoking in rooms.", children: "Children of all ages are welcome. Cots are free on request." },
    branding: { primaryColor: "#0B6E6E", accentColor: "#B8863B", typography: "classic" },
    seo: { titleTemplate: "%s | Palm Court Hotel", defaultDescription: "Boutique hotel in Lagos with a rooftop pool, restaurant and quiet, comfortable rooms." },
  }, meta);

  await c.hotel.updateContent(actor, view, {
    hero: { headline: "Rest well. Wake happy.", subheadline: "Boutique stays beside the lagoon, with a rooftop pool and breakfast made fresh every morning.", imageAssetIds: [] },
    about: {
      heading: "A family-run hotel with a quiet heart",
      body: "Palm Court opened in 2009 with 12 rooms and a simple idea: a hotel should feel like being looked after by people who care.\n\nToday we have 48 rooms, a rooftop pool and a restaurant that locals book for weekends. Our team has grown, but the welcome hasn't changed.",
      highlights: [{ label: "Welcoming guests since", value: "2009" }, { label: "Rooms", value: "48" }, { label: "Average guest rating", value: "4.8" }],
    },
    whyChooseUs: [
      { title: "Genuinely quiet rooms", text: "Triple-glazed windows and thick walls, so you sleep through the city.", icon: "Bed" },
      { title: "24-hour power and Wi-Fi", text: "Backup power and fast fibre, so work and rest are never interrupted.", icon: "Zap" },
      { title: "Breakfast made fresh", text: "Local favourites and a full continental spread, served until 11am.", icon: "Coffee" },
    ],
    testimonials: [{ quote: "Spotless, peaceful, and the staff remembered our names by day two. We've already booked again.", guestName: "Tolu A.", source: "Google", rating: 5 }, { quote: "The rooftop pool at sunset is worth the trip alone.", guestName: "Chidi O.", source: "TripAdvisor", rating: 5 }],
    faqs: [{ question: "Is breakfast included?", answer: "Yes, on most rates. Check your booking confirmation." }, { question: "Is parking available?", answer: "Free secure parking for all guests." }, { question: "Do you offer airport pickup?", answer: "Yes. Message us on WhatsApp with your flight details." }],
  }, meta);

  const type = async (body: Parameters<typeof c.rooms.createType>[2]) => (await c.rooms.createType(actor, view, body, meta)).id;
  const standard = await type({ name: "Standard Room", maxAdults: 2, maxChildren: 1, basePrice: 5_500_000, bedConfig: "1 Queen bed", sizeSqm: 22, shortDescription: "A calm, comfortable room for one or two.", description: "Everything you need for a restful stay: a supremely comfortable bed, fast Wi-Fi, a work desk and a bright private bathroom.", amenityKeys: ["wifi", "ac", "tv", "desk", "ensuite", "generator"], imageAssetIds: [] });
  const deluxe = await type({ name: "Deluxe Room", maxAdults: 2, maxChildren: 2, basePrice: 8_500_000, bedConfig: "1 King bed", sizeSqm: 32, isFeatured: true, shortDescription: "Space to spread out, with a seating area and city views.", description: "Our most popular room. A king bed, a sofa by the window and a rain shower. Breakfast is included.", amenityKeys: ["wifi", "ac", "tv", "breakfast", "minibar", "seating", "shower", "safe", "cityview"], imageAssetIds: [] });
  const suite = await type({ name: "Executive Suite", maxAdults: 3, maxChildren: 2, basePrice: 15_000_000, bedConfig: "1 King bed + sofa bed", sizeSqm: 54, isFeatured: true, shortDescription: "A separate living room, a bathtub and the best view in the hotel.", description: "Our top floor suite has a private lounge, a deep bathtub and a balcony over the pool.", amenityKeys: ["wifi", "ac", "tv", "breakfast", "minibar", "kitchenette", "bathtub", "balcony", "roomservice", "airport", "seaview"], imageAssetIds: [] });
  let n = 0;
  for (const [id, floors] of [[standard, [1, 2]], [deluxe, [3, 4]], [suite, [5]]] as const) {
    for (const floor of floors) {
      for (let i = 1; i <= 3; i++) {
        await c.rooms.createRoom(actor, view, { roomNumber: `${floor}0${i}`, roomTypeId: id, floor }, meta);
        n++;
      }
    }
  }

  const fac = [["Rooftop pool", "Waves", "Open daily 7am to 9pm, with sun loungers and a bar."], ["Palm Court Restaurant", "Utensils", "Breakfast, lunch and dinner. Reserve a table for weekends."], ["Fitness room", "Dumbbell", "Open 24 hours for guests."], ["Free secure parking", "Car", "Attended parking for every guest."], ["Concierge", "ConciergeBell", "Tours, airport pickups and restaurant bookings."], ["Fast Wi-Fi", "Wifi", "Fibre throughout the hotel, including the pool deck."]] as const;
  for (const [name, icon, description] of fac) await c.website.createFacility(actor, view, { name, icon, description }, meta);

  console.log(`Demo hotel created: 3 room types, ${n} rooms, ${fac.length} facilities. Representative photography is shown until the hotel uploads its own images.`);
  console.log(`  Website:  http://${SLUG}.${env.PLATFORM_DOMAIN ?? "localhost"}:5173`);
  console.log(`  Admin:    http://${SLUG}.${env.PLATFORM_DOMAIN ?? "localhost"}:5173/login   (${OWNER_EMAIL} / ${OWNER_PASSWORD})`);
} catch (err) {
  console.error("Seeding failed:", (err as Error).message);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
