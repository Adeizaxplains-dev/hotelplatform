/** Calendar-date helpers for hotel-local reporting windows. */
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDate(value: string): boolean {
  if (!datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Return YYYY-MM-DD as observed in an IANA timezone (not the server's timezone). */
export function localDateString(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  if (!year || !month || !day) throw new RangeError("Unable to calculate local calendar date.");
  return `${year}-${month}-${day}`;
}

/**
 * Convert a hotel's local midnight to UTC. Iterative offset correction handles timezone offsets
 * and daylight-saving changes without assuming every day is exactly 24 hours.
 */
export function localMidnightUtc(date: string, timeZone: string): Date {
  if (!isCalendarDate(date)) throw new RangeError("Choose a valid calendar date.");
  // Validate IANA timezone early; Intl throws for invalid identifiers.
  new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(year!, month! - 1, day!);
  let candidate = target;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  for (let i = 0; i < 3; i += 1) {
    const parts = formatter.formatToParts(new Date(candidate));
    const value = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const observed = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
    const delta = target - observed;
    candidate += delta;
    if (delta === 0) break;
  }
  return new Date(candidate);
}

export function localDateRangeUtc(date: string, timeZone: string): { start: Date; end: Date } {
  const start = localMidnightUtc(date, timeZone);
  const [year, month, day] = date.split("-").map(Number);
  const nextDate = new Date(Date.UTC(year!, month! - 1, day! + 1)).toISOString().slice(0, 10);
  return { start, end: localMidnightUtc(nextDate, timeZone) };
}
