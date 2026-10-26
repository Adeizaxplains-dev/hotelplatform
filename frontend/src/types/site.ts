/** Shapes of the PUBLIC API (/api/v1/public/*). Mirrors backend/src/modules/public/public.service.ts. */
export interface PublicImage { url: string; srcSet?: string; width: number; height: number; alt: string }

export interface Amenity { key: string; label: string; icon: string }

export interface PublicRoomType {
  slug: string; name: string; shortDescription: string | null; description: string | null;
  maxAdults: number; maxChildren: number; bedConfig: string | null; sizeSqm: number | null;
  price: { amount: number; currency: string }; isFeatured: boolean;
  amenities: Amenity[]; images: PublicImage[]; seo: { title: string | null; description: string | null };
}

export interface PublicFacility { name: string; description: string | null; icon: string; image: PublicImage | null }
export interface PublicGalleryImage { caption: string | null; category: string; image: PublicImage }

export interface PublicSite {
  hotel: {
    name: string; slug: string; currency: string; timezone: string; tagline: string | null; description: string | null;
    contact: { phone: string | null; whatsapp: string | null; email: string | null; address: string | null; city: string | null; state: string | null; country: string | null; mapEmbedUrl: string | null; latitude: number | null; longitude: number | null };
    social: { facebook: string | null; instagram: string | null; x: string | null; tiktok: string | null; youtube: string | null };
    policies: { checkInTime: string; checkOutTime: string; cancellation: string | null; houseRules: string | null; children: string | null; pets: string | null };
    branding: { primaryColor: string; accentColor: string; typography: "modern" | "classic"; logo: PublicImage | null; favicon: PublicImage | null };
    seo: { titleTemplate: string | null; defaultDescription: string | null; ogImage: PublicImage | null };
  };
  features: string[];
  content: {
    hero: { headline: string | null; subheadline: string | null; images: PublicImage[] };
    about: { heading: string | null; body: string | null; image: PublicImage | null; highlights: Array<{ label: string; value: string }> };
    whyChooseUs: Array<{ title: string; text: string; icon: string }>;
    testimonials: Array<{ quote: string; guestName: string; source?: string; rating?: number }>;
    faqs: Array<{ question: string; answer: string }>;
    pageSeo: Partial<Record<"home" | "about" | "rooms" | "facilities" | "gallery" | "contact", { title?: string; description?: string }>>;
  };
  featuredRooms: PublicRoomType[];
  facilities: PublicFacility[];
  gallery: PublicGalleryImage[];
}
