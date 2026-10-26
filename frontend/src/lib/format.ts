/** Prices are integers in the smallest unit (kobo). Never format floats from the server. */
export function formatMoney(minorUnits: number, currency: string, locale = "en-NG"): string {
  const major = minorUnits / 100;
  const whole = Number.isInteger(major);
  return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(major);
}

/** "14:00" → "2:00 pm" */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  const suffix = h >= 12 ? "pm" : "am";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export const whatsappLink = (digits: string, message?: string): string => `https://wa.me/${digits.replace(/\D/g, "")}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
export const telLink = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, "")}`;
export const mailLink = (email: string, subject?: string): string => `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;

/** Google Maps directions without an API key. Prefers exact coordinates, falls back to the address. */
export function directionsUrl(c: { latitude: number | null; longitude: number | null; address: string | null; city: string | null }, name: string): string | null {
  const destination = c.latitude !== null && c.longitude !== null ? `${c.latitude},${c.longitude}` : [name, c.address, c.city].filter(Boolean).join(", ");
  if (!destination) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export const addressLine = (c: { address: string | null; city: string | null; state: string | null; country: string | null }): string => [c.address, c.city, c.state, c.country].filter(Boolean).join(", ");

export const pageTitle = (template: string | null, name: string, page?: string): string => {
  if (!page) return template ? template.replace("%s", name) : name;
  return template ? template.replace("%s", page) : `${page} | ${name}`;
};
