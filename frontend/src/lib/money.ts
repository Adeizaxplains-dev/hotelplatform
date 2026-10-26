/**
 * Hotels type prices in naira; the API stores integer kobo. Conversion works on the decimal STRING so there is
 * never a floating-point error (0.1 + 0.2 style) in a price.
 */
export function nairaToKobo(input: string): number | null {
  const cleaned = input.replace(/[₦,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".") as [string, string?];
  const kobo = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  return Number.isSafeInteger(kobo) ? kobo : null;
}

export function koboToNaira(kobo: number): string {
  const whole = Math.floor(kobo / 100);
  const frac = kobo % 100;
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, "0")}`;
}
