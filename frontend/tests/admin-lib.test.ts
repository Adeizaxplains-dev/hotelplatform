import { describe, expect, it } from "vitest";
import { checkImageFile } from "@/admin/imageRules";
import { visibleNav } from "@/admin/nav";
import { koboToNaira, nairaToKobo } from "@/lib/money";
import { describeError, fieldErrors } from "@/lib/errors";
import { ApiError } from "@/services/apiClient";
import { ROLE_PERMS } from "./adminData";

describe("naira ↔ kobo", () => {
  it.each([
    ["85000", 8_500_000], ["85,000.50", 8_500_050], ["₦1,250", 125_000], ["0.1", 10], ["0.10", 10], ["0.05", 5], ["1250.5", 125_050], ["0", 0], [" 99 ", 9900],
  ])("%s → %i kobo", (input, kobo) => expect(nairaToKobo(input)).toBe(kobo));

  it.each(["", "abc", "-5", "12.345", "1.2.3", "₦", "1e5", "9007199254740993"])("rejects %j", (input) => expect(nairaToKobo(input)).toBeNull());

  it("never loses a kobo to floating point: round-trips 5000 values exactly", () => {
    let seed = 7;
    const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    for (let i = 0; i < 5000; i++) {
      const kobo = Math.floor(rand() * 100_000_000_00);
      expect(nairaToKobo(koboToNaira(kobo)), String(kobo)).toBe(kobo);
    }
  });
  it("formats whole naira without decimals", () => {
    expect(koboToNaira(8_500_000)).toBe("85000");
    expect(koboToNaira(8_500_050)).toBe("85000.50");
    expect(koboToNaira(5)).toBe("0.05");
  });
});

describe("what the menu shows", () => {
  const names = (role: keyof typeof ROLE_PERMS, features?: string[]) => visibleNav({ permissions: ROLE_PERMS[role], features: features ?? ["website", "cms", "rooms", "gallery"] }).map((n) => n.label);

  it("owner and manager see everything; receptionist and housekeeper only rooms; accountant only the dashboard", () => {
    expect(names("HOTEL_OWNER")).toEqual(["Dashboard", "Website", "Room types", "Rooms", "Facilities", "Gallery"]);
    expect(names("HOTEL_MANAGER")).toEqual(["Dashboard", "Website", "Room types", "Rooms", "Facilities", "Gallery"]);
    expect(names("RECEPTIONIST")).toEqual(["Dashboard", "Room types", "Rooms"]);
    expect(names("HOUSEKEEPER")).toEqual(["Dashboard", "Room types", "Rooms"]);
    expect(names("ACCOUNTANT")).toEqual(["Dashboard"]);
  });
  it("hides what the hotel's plan has switched off", () => {
    expect(names("HOTEL_OWNER", ["website", "cms", "rooms"])).not.toContain("Gallery");
    expect(names("HOTEL_OWNER", ["website"])).toEqual(["Dashboard", "Website"]);
    expect(names("HOTEL_OWNER", [])).toEqual(["Dashboard"]);
  });
});

describe("upload pre-check", () => {
  it("accepts JPG/PNG/WebP under 5 MB and explains everything else", () => {
    expect(checkImageFile({ type: "image/png", size: 1000 })).toBeNull();
    expect(checkImageFile({ type: "image/webp", size: 4_999_999 })).toBeNull();
    expect(checkImageFile({ type: "image/svg+xml", size: 1000 })).toMatch(/JPG, PNG or WebP/);
    expect(checkImageFile({ type: "image/gif", size: 1000 })).toMatch(/JPG, PNG or WebP/);
    expect(checkImageFile({ type: "application/pdf", size: 1000 })).toMatch(/JPG, PNG or WebP/);
    expect(checkImageFile({ type: "image/jpeg", size: 5_000_001 })).toMatch(/too large/);
  });
});

describe("error wording", () => {
  it("shows the server's clear message plus field details, but never internals for 5xx", () => {
    expect(describeError(new ApiError(409, "CONFLICT", "Room 101 already exists."))).toBe("Room 101 already exists.");
    expect(describeError(new ApiError(400, "VALIDATION_ERROR", "Invalid.", [{ path: "body.name", message: "Too long." }]))).toBe("Invalid. Too long.");
    expect(describeError(new ApiError(500, "INTERNAL_ERROR", "stack trace here"))).not.toContain("stack");
    expect(describeError(new ApiError(0, "NETWORK_ERROR", "We couldn't reach the server."))).toBe("We couldn't reach the server.");
    expect(describeError(new ApiError(429, "RATE_LIMITED", "x"))).toMatch(/too quickly/);
    expect(describeError(new Error("boom"))).toBe("Something went wrong. Please try again.");
  });
  it("maps server field paths to form fields", () => {
    const err = new ApiError(400, "VALIDATION_ERROR", "Invalid.", [{ path: "body.name", message: "Too long." }, { path: "body.name", message: "second" }, { path: "query.x", message: "ignored?" }]);
    expect(fieldErrors(err)).toEqual({ name: "Too long.", "query.x": "ignored?" });
  });
});
