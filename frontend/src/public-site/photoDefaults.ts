import type { PublicImage } from "@/types/site";

/**
 * Curated representative hotel photography from Unsplash's image CDN.
 * These are fallback/demo images only. Hotels should replace them with their own
 * licensed property photography in Admin → Website.
 */
export const HOTEL_PHOTOS: PublicImage[] = [
  {
    url: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=2400&q=85",
    width: 2400,
    height: 1600,
    alt: "Bright contemporary hotel bedroom with a king bed and warm natural finishes",
  },
  {
    url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=2400&q=85",
    width: 2400,
    height: 1600,
    alt: "Airy premium hotel suite with a comfortable bed and large windows",
  },
  {
    url: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=2400&q=85",
    width: 2400,
    height: 1600,
    alt: "Well-lit luxury hotel room with elegant bedding and warm bedside lighting",
  },
  {
    url: "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=2400&q=85",
    width: 2400,
    height: 1600,
    alt: "Spacious hotel room with neatly prepared beds and a bright interior",
  },
  {
    url: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1800&q=85",
    width: 1800,
    height: 1200,
    alt: "Modern guest room with a restful neutral palette and soft natural light",
  },
  {
    url: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1800&q=85",
    width: 1800,
    height: 1200,
    alt: "Elegant hotel suite bedroom with a carefully styled bed and furnishings",
  },
  {
    url: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1800&q=85",
    width: 1800,
    height: 1200,
    alt: "Resort swimming pool and outdoor relaxation area",
  },
  {
    url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1800&q=85",
    width: 1800,
    height: 1200,
    alt: "Hotel exterior and landscaped leisure facilities",
  },
  {
    url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1800&q=85",
    width: 1800,
    height: 1200,
    alt: "Welcoming restaurant interior with thoughtfully arranged dining tables",
  },
  {
    url: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1800&q=85",
    width: 1800,
    height: 1200,
    alt: "Upscale hotel exterior with inviting landscaped surroundings",
  },
];

export const HERO_PHOTOS = HOTEL_PHOTOS.slice(0, 4);


const LEGACY_DEMO_ARTWORK_ALT = /palm court hotel at dusk|palm court at dusk|arched lobby|teal headboard|warm brown tones|blue headboard|plum headboard|candle-lit tables|sun loungers beside the pool/i;

/** Detect the old Palm Court vector-art seed images so existing demo databases also get real-photo fallbacks. */
export function isLegacyDemoArtwork(image?: PublicImage | null): boolean {
  return Boolean(image && LEGACY_DEMO_ARTWORK_ALT.test(image.alt));
}

/** Select a suitable representative photo without making assumptions about the hotel's actual facilities. */
export function photoForLabel(label?: string | null, index = 0): PublicImage {
  const value = (label ?? "").toLowerCase();
  if (/suite|executive|presidential|penthouse|premium|luxury/.test(value)) return HOTEL_PHOTOS[2]!;
  if (/standard|single|twin|double|deluxe|bedroom|room/.test(value)) return HOTEL_PHOTOS[Math.abs(index) % 5]!;
  if (/pool|swim|spa|leisure/.test(value)) return HOTEL_PHOTOS[6]!;
  if (/restaurant|dining|breakfast|bar|food/.test(value)) return HOTEL_PHOTOS[8]!;
  if (/lobby|reception|entrance/.test(value)) return HOTEL_PHOTOS[1]!;
  if (/exterior|parking|garden/.test(value)) return HOTEL_PHOTOS[9]!;
  return HOTEL_PHOTOS[Math.abs(index) % HOTEL_PHOTOS.length]!;
}

export const SAMPLE_GALLERY = [
  { image: HOTEL_PHOTOS[0]!, caption: "Bright, restful room inspiration", category: "rooms" },
  { image: HOTEL_PHOTOS[2]!, caption: "Contemporary suite inspiration", category: "rooms" },
  { image: HOTEL_PHOTOS[4]!, caption: "Comfortable guest-room details", category: "rooms" },
  { image: HOTEL_PHOTOS[6]!, caption: "Leisure and resort inspiration", category: "facilities" },
  { image: HOTEL_PHOTOS[1]!, caption: "Premium suite inspiration", category: "rooms" },
  { image: HOTEL_PHOTOS[9]!, caption: "Hotel exterior inspiration", category: "exterior" },
];
