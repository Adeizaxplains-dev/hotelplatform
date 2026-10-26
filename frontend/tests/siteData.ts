import type { PublicImage, PublicRoomType, PublicSite } from "@/types/site";

export const img = (n = 1, w = 1600, h = 900): PublicImage => ({ url: `https://media.test/photo-${n}.jpg`, width: w, height: h, alt: `Photo ${n}` });

export const room = (over: Partial<PublicRoomType> = {}): PublicRoomType => ({
  slug: "deluxe-room", name: "Deluxe Room", shortDescription: "Light and airy", description: "A calm room.\n\nWith a view.", maxAdults: 2, maxChildren: 1,
  bedConfig: "1 King bed", sizeSqm: 32, price: { amount: 8_500_000, currency: "NGN" }, isFeatured: true,
  amenities: [{ key: "wifi", label: "Free Wi-Fi", icon: "Wifi" }, { key: "ac", label: "Air conditioning", icon: "Snowflake" }],
  images: [img(1, 800, 600), img(2, 800, 600)], seo: { title: null, description: null }, ...over,
});

export function makeSite(over: { hotel?: Partial<PublicSite["hotel"]>; content?: Partial<PublicSite["content"]>; features?: string[]; featuredRooms?: PublicRoomType[]; facilities?: PublicSite["facilities"]; gallery?: PublicSite["gallery"] } = {}): PublicSite {
  const base: PublicSite = {
    hotel: {
      name: "Palm Court Hotel", slug: "palmcourt", currency: "NGN", timezone: "Africa/Lagos", tagline: "Calm in the city", description: "A quiet hotel near the lagoon.",
      contact: { phone: "+234 801 234 5678", whatsapp: "2348012345678", email: "hi@palm.example.com", address: "12 Marina Road", city: "Lagos", state: null, country: "Nigeria", mapEmbedUrl: null, latitude: 6.45, longitude: 3.4 },
      social: { facebook: "https://facebook.com/palm", instagram: null, x: null, tiktok: null, youtube: null },
      policies: { checkInTime: "14:00", checkOutTime: "12:00", cancellation: "Free cancellation up to 48 hours before.", houseRules: null, children: null, pets: null },
      branding: { primaryColor: "#7C2D12", accentColor: "#B8863B", typography: "classic", logo: null, favicon: null },
      seo: { titleTemplate: "%s | Palm Court", defaultDescription: "Boutique hotel in Lagos.", ogImage: null },
    },
    features: ["website", "cms", "rooms", "gallery", "booking"],
    content: {
      hero: { headline: "Rest well. Wake happy.", subheadline: "Boutique stays near the lagoon.", images: [img(9)] },
      about: { heading: "Our story", body: "Family-run since 2009.\n\nEvery guest is family.", image: img(8, 800, 1000), highlights: [{ label: "Since", value: "2009" }] },
      whyChooseUs: [{ title: "Quiet rooms", text: "Triple-glazed windows.", icon: "Sparkles" }],
      testimonials: [{ quote: "Spotless and peaceful.", guestName: "Tolu A.", source: "Google", rating: 5 }],
      faqs: [{ question: "Is breakfast included?", answer: "Yes, on most rates." }],
      pageSeo: {},
    },
    featuredRooms: [room(), room({ slug: "standard-room", name: "Standard Room", price: { amount: 5_000_000, currency: "NGN" }, images: [] })],
    facilities: [{ name: "Rooftop pool", description: "Open 7am to 9pm.", icon: "Waves", image: null }],
    gallery: [
      { caption: "Pool at dusk", category: "facilities", image: img(3, 900, 600) },
      { caption: "Lobby", category: "exterior", image: img(4, 600, 900) },
      { caption: null, category: "rooms", image: img(5, 900, 900) },
    ],
  };
  return { ...base, hotel: { ...base.hotel, ...over.hotel }, content: { ...base.content, ...over.content }, features: over.features ?? base.features, featuredRooms: over.featuredRooms ?? base.featuredRooms, facilities: over.facilities ?? base.facilities, gallery: over.gallery ?? base.gallery };
}
