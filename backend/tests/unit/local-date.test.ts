import { describe, expect, it } from "vitest";
import { isCalendarDate, localDateRangeUtc, localDateString, localMidnightUtc } from "../../src/shared/localDate.js";

describe("hotel-local date ranges", () => {
  it("rejects invalid calendar dates", () => {
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("2026-10-14")).toBe(true);
  });

  it("uses the hotel's timezone to determine today's date", () => {
    const instant = new Date("2026-10-14T23:30:00.000Z");
    expect(localDateString(instant, "Africa/Lagos")).toBe("2026-10-15");
    expect(localDateString(instant, "America/New_York")).toBe("2026-10-14");
  });

  it("converts local midnight to the correct UTC instant", () => {
    expect(localMidnightUtc("2026-10-15", "Africa/Lagos").toISOString()).toBe("2026-10-14T23:00:00.000Z");
    const range = localDateRangeUtc("2026-10-15", "Africa/Lagos");
    expect(range.start.toISOString()).toBe("2026-10-14T23:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-10-15T23:00:00.000Z");
  });

  it("uses 23-hour local days when daylight saving time starts", () => {
    const range = localDateRangeUtc("2026-03-08", "America/New_York");
    expect(range.start.toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-03-09T04:00:00.000Z");
  });
});
