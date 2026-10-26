/** Colour maths used to keep every hotel's brand colours readable, whatever they choose. */
type RGB = [number, number, number];

export const parseHex = (hex: string): RGB => {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
export const toHex = ([r, g, b]: RGB): string => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase();

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
export const luminance = (hex: string): number => {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
/** WCAG contrast ratio, 1 to 21. */
export const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

export const mix = (a: string, b: string, weightOfB: number): string => {
  const [ra, ga, ba] = parseHex(a);
  const [rb, gb, bb] = parseHex(b);
  return toHex([ra + (rb - ra) * weightOfB, ga + (gb - ga) * weightOfB, ba + (bb - ba) * weightOfB]);
};

export const INK = "#0F2230";
export const WHITE = "#FFFFFF";

const BLACK = "#000000";

/**
 * Text colour for this background: white, else the brand ink, else pure black, the first that reaches AA (4.5:1).
 * For every possible background at least one of white or black reaches 4.58:1, so this never fails; ink is
 * preferred over black only because it looks better when it passes.
 */
export const readableOn = (bg: string): string => {
  if (contrast(WHITE, bg) >= 4.5) return WHITE;
  if (contrast(INK, bg) >= 4.5) return INK;
  return BLACK;
};

/** Darkens `fg` until it reaches `min` contrast against `bg` (for brand-coloured TEXT on a light background). */
export function ensureContrastOn(fg: string, bg: string, min = 4.5): string {
  let out = fg;
  for (let i = 0; i < 20 && contrast(out, bg) < min; i++) out = mix(out, INK, 0.12);
  return out;
}

export interface BrandTheme {
  vars: Record<string, string>;
  /** The two readable pairings, exposed for tests. */
  onBrand: string;
  brandText: string;
}

/**
 * Turns a hotel's two chosen colours into a complete, accessible palette:
 * - on-brand: text/icons placed ON the brand colour (white or ink, whichever is more readable)
 * - brand-text: the brand colour used AS text on white, darkened until it passes AA (4.5:1)
 * - brand-soft: a very light tint for backgrounds
 */
export function buildBrandTheme(primary: string, accent: string, typography: "modern" | "classic"): BrandTheme {
  const hover = mix(primary, readableOn(primary) === WHITE ? INK : WHITE, 0.14);
  const onBrand = readableOn(primary);
  const brandText = ensureContrastOn(primary, WHITE, 5); // margin above AA so tinted backgrounds stay readable too
  return {
    onBrand,
    brandText,
    vars: {
      "--brand": primary,
      "--brand-hover": hover,
      "--on-brand": onBrand,
      "--on-brand-hover": readableOn(hover),
      "--brand-text": brandText,
      "--brand-soft": mix(primary, WHITE, 0.9),
      "--accent": accent,
      "--accent-text": ensureContrastOn(accent, WHITE),
      "--site-display": typography === "classic" ? '"Fraunces Variable", Georgia, serif' : '"Manrope Variable", ui-sans-serif, system-ui, sans-serif',
    },
  };
}
