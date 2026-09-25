import { describe, expect, it } from "vitest";
import { isSiteAvailability, isSiteBookingError, isSiteConfirmResponse, isSiteOtpResponse } from "./site-bookings-guard";
import { without } from "./__tests__/support";

function VALID_SLOT(): Record<string, unknown> {
  return { start: "09:00", end: "09:30", state: "free" };
}

function VALID_DAY(): Record<string, unknown> {
  return { date: "2026-09-28", closed: false, closedNote: null, slots: [VALID_SLOT()] };
}

function VALID_AVAILABILITY(): Record<string, unknown> {
  return {
    weekStart: "2026-09-28",
    today: "2026-09-25",
    slotMinutes: 30,
    previousWeek: "2026-09-21",
    nextWeek: "2026-10-05",
    days: [
      VALID_DAY(),
      { ...VALID_DAY(), date: "2026-09-29" },
      { ...VALID_DAY(), date: "2026-09-30" },
      { ...VALID_DAY(), date: "2026-10-01" },
      { ...VALID_DAY(), date: "2026-10-02" },
      { ...VALID_DAY(), date: "2026-10-03" },
      { ...VALID_DAY(), date: "2026-10-04" },
    ],
  };
}

describe("isSiteAvailability", () => {
  it("accepts a fully populated week", () => {
    expect(isSiteAvailability(VALID_AVAILABILITY())).toBe(true);
  });

  it("accepts previousWeek and nextWeek as null", () => {
    expect(isSiteAvailability({ ...VALID_AVAILABILITY(), previousWeek: null, nextWeek: null })).toBe(true);
  });

  it("accepts a closed day with an empty slots list and a note", () => {
    const availability = VALID_AVAILABILITY();
    const days = availability.days as Record<string, unknown>[];
    days[0] = { date: "2026-09-28", closed: true, closedNote: "Diwali", slots: [] };
    expect(isSiteAvailability(availability)).toBe(true);
  });

  it("rejects a non-object", () => {
    expect(isSiteAvailability(null)).toBe(false);
    expect(isSiteAvailability("hello")).toBe(false);
    expect(isSiteAvailability([])).toBe(false);
  });

  it.each([6, 8, 0])("rejects days with a length other than 7 (%d)", (length) => {
    const days = Array.from({ length }, (_, index) => ({ ...VALID_DAY(), date: `2026-09-${28 + index}` }));
    expect(isSiteAvailability({ ...VALID_AVAILABILITY(), days })).toBe(false);
  });

  it("rejects days that is missing entirely", () => {
    expect(isSiteAvailability(without(VALID_AVAILABILITY(), "days"))).toBe(false);
  });

  it.each(["2026-9-28", "2026-09-31", "2026-13-01", "28 Sep 2026", ""])(
    "rejects a malformed or non-existent weekStart %s",
    (weekStart) => {
      expect(isSiteAvailability({ ...VALID_AVAILABILITY(), weekStart })).toBe(false);
    },
  );

  it.each(["2026-9-28", "not-a-date", "2026-02-30"])("rejects a malformed day date %s", (date) => {
    const availability = VALID_AVAILABILITY();
    const days = availability.days as Record<string, unknown>[];
    days[0] = { ...VALID_DAY(), date };
    expect(isSiteAvailability(availability)).toBe(false);
  });

  it.each([0, -1, 1.5, "30", null])("rejects an invalid slotMinutes %s", (slotMinutes) => {
    expect(isSiteAvailability({ ...VALID_AVAILABILITY(), slotMinutes })).toBe(false);
  });

  it.each(["free", "taken", "past"])("accepts each valid slot state %s", (state) => {
    const availability = VALID_AVAILABILITY();
    const days = availability.days as Record<string, unknown>[];
    days[0] = { ...VALID_DAY(), slots: [{ ...VALID_SLOT(), state }] };
    expect(isSiteAvailability(availability)).toBe(true);
  });

  it.each(["closed", "booked", "unavailable", "", "FREE"])("rejects an unlisted slot state %s", (state) => {
    const availability = VALID_AVAILABILITY();
    const days = availability.days as Record<string, unknown>[];
    days[0] = { ...VALID_DAY(), slots: [{ ...VALID_SLOT(), state }] };
    expect(isSiteAvailability(availability)).toBe(false);
  });

  it.each(["9:00", "09:00:00", "0900", "9am", "24:00", "12:60", ""])(
    "rejects a slot with a malformed start time %s",
    (start) => {
      const availability = VALID_AVAILABILITY();
      const days = availability.days as Record<string, unknown>[];
      days[0] = { ...VALID_DAY(), slots: [{ ...VALID_SLOT(), start }] };
      expect(isSiteAvailability(availability)).toBe(false);
    },
  );

  it.each(["9:30", "09:30:00", "24:01", "24:1", "25:00", "12:60", ""])(
    "rejects a slot with a malformed end time %s",
    (end) => {
      const availability = VALID_AVAILABILITY();
      const days = availability.days as Record<string, unknown>[];
      days[0] = { ...VALID_DAY(), slots: [{ ...VALID_SLOT(), end }] };
      expect(isSiteAvailability(availability)).toBe(false);
    },
  );

  it("accepts the boundary times 00:00 and 23:59", () => {
    const availability = VALID_AVAILABILITY();
    const days = availability.days as Record<string, unknown>[];
    days[0] = { ...VALID_DAY(), slots: [{ start: "00:00", end: "23:59", state: "free" }] };
    expect(isSiteAvailability(availability)).toBe(true);
  });

  it("accepts a slot ending at 24:00 (a shift, or the day, running to midnight)", () => {
    const availability = VALID_AVAILABILITY();
    const days = availability.days as Record<string, unknown>[];
    days[0] = { ...VALID_DAY(), slots: [{ start: "23:30", end: "24:00", state: "free" }] };
    expect(isSiteAvailability(availability)).toBe(true);
  });

  it("still rejects 24:00 as a slot's start", () => {
    const availability = VALID_AVAILABILITY();
    const days = availability.days as Record<string, unknown>[];
    days[0] = { ...VALID_DAY(), slots: [{ start: "24:00", end: "24:30", state: "free" }] };
    expect(isSiteAvailability(availability)).toBe(false);
  });
});

describe("isSiteBookingError", () => {
  const CODES = ["invalid", "taken", "paused", "unavailable", "limited", "failed", "wrong_code", "expired", "too_many_attempts"];

  it.each(CODES)("accepts each listed error code %s", (code) => {
    expect(isSiteBookingError({ status: "error", code, message: "Nope", field: null })).toBe(true);
  });

  it.each(["unknown", "", "Invalid", "TAKEN"])("rejects an unlisted error code %s", (code) => {
    expect(isSiteBookingError({ status: "error", code, message: "Nope", field: null })).toBe(false);
  });

  it("accepts a string field", () => {
    expect(isSiteBookingError({ status: "error", code: "invalid", message: "Nope", field: "phone" })).toBe(true);
  });

  it("rejects a non-error status", () => {
    expect(isSiteBookingError({ status: "ok", code: "invalid", message: "Nope", field: null })).toBe(false);
  });

  it("rejects a missing message", () => {
    expect(isSiteBookingError(without({ status: "error", code: "invalid", message: "Nope", field: null }, "message"))).toBe(
      false,
    );
  });
});

describe("isSiteOtpResponse", () => {
  it("accepts a well-formed otp_sent response", () => {
    expect(isSiteOtpResponse({ status: "otp_sent", otpId: "abc-123", expiresInSeconds: 600, phoneHint: "•••• 3210" })).toBe(
      true,
    );
  });

  it("rejects an otp_sent response missing a field", () => {
    expect(isSiteOtpResponse({ status: "otp_sent", otpId: "abc-123", expiresInSeconds: 600 })).toBe(false);
  });

  it("rejects an otp_sent response with a blank otpId", () => {
    expect(isSiteOtpResponse({ status: "otp_sent", otpId: "", expiresInSeconds: 600, phoneHint: "•••• 3210" })).toBe(false);
  });

  it("rejects an otp_sent response with a non-numeric expiresInSeconds", () => {
    expect(
      isSiteOtpResponse({ status: "otp_sent", otpId: "abc-123", expiresInSeconds: "600", phoneHint: "•••• 3210" }),
    ).toBe(false);
  });

  it("accepts a wrapped SiteBookingError", () => {
    expect(isSiteOtpResponse({ status: "error", code: "taken", message: "Someone just booked that slot.", field: null })).toBe(
      true,
    );
  });

  it("rejects an error with an unknown code", () => {
    expect(isSiteOtpResponse({ status: "error", code: "mystery", message: "x", field: null })).toBe(false);
  });

  it("rejects a non-object", () => {
    expect(isSiteOtpResponse(null)).toBe(false);
    expect(isSiteOtpResponse("otp_sent")).toBe(false);
  });
});

describe("isSiteConfirmResponse", () => {
  it("accepts a well-formed booked response", () => {
    expect(isSiteConfirmResponse({ status: "booked", date: "2026-09-28", start: "09:00", end: "09:30" })).toBe(true);
  });

  it.each(["date", "start", "end"])("rejects a booked response missing %s", (field) => {
    expect(isSiteConfirmResponse(without({ status: "booked", date: "2026-09-28", start: "09:00", end: "09:30" }, field))).toBe(
      false,
    );
  });

  it("rejects a booked response with a malformed date", () => {
    expect(isSiteConfirmResponse({ status: "booked", date: "28-09-2026", start: "09:00", end: "09:30" })).toBe(false);
  });

  it("rejects a booked response with a malformed time", () => {
    expect(isSiteConfirmResponse({ status: "booked", date: "2026-09-28", start: "9:00", end: "09:30" })).toBe(false);
  });

  it("accepts a booked response ending at 24:00 (a booking running to midnight)", () => {
    expect(isSiteConfirmResponse({ status: "booked", date: "2026-09-28", start: "23:30", end: "24:00" })).toBe(true);
  });

  it("still rejects 24:00 as a booked response's start", () => {
    expect(isSiteConfirmResponse({ status: "booked", date: "2026-09-28", start: "24:00", end: "24:30" })).toBe(false);
  });

  it("accepts a wrapped SiteBookingError", () => {
    expect(isSiteConfirmResponse({ status: "error", code: "wrong_code", message: "Nope", field: null })).toBe(true);
  });

  it("rejects an error with an unknown code", () => {
    expect(isSiteConfirmResponse({ status: "error", code: "mystery", message: "x", field: null })).toBe(false);
  });
});
