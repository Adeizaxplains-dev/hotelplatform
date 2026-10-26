/** "Deluxe Ocean-View Suite!" → "deluxe-ocean-view-suite". Letters are transliterated where possible. */
export function slugify(input: string): string {
  const base = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return base || "item";
}

/** First free slug: base, base-2, base-3 ... `taken` answers whether a candidate already exists. */
export async function uniqueSlug(base: string, taken: (candidate: string) => Promise<boolean>): Promise<string> {
  let candidate = base;
  for (let i = 2; await taken(candidate); i++) {
    candidate = `${base}-${i}`;
    if (i > 200) throw new Error("Could not find a free slug");
  }
  return candidate;
}
