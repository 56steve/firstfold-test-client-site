import { describe, expect, it } from "vitest";
import { isSiteInfo } from "./site-info-guard";
import { without } from "./__tests__/support";

const VALID: Record<string, unknown> = {
  business: "TEST 2 – Firstfold QA",
  timeZone: "Asia/Kolkata",
  today: "2026-09-25",
  hours: [{ dayOfWeek: 0, opensAt: "09:00", closesAt: "17:00", closed: false, openAllDay: false }],
  closures: [{ startsOn: "2026-11-12", endsOn: "2026-11-14", note: "Diwali" }],
  announcement: { message: "Closed for a private event on Friday", endsOn: "2026-09-26" },
  booking: {
    accepting: true,
    pausedMessage: null,
    services: [{ id: "svc-1", name: "Consultation" }],
    slotMinutes: 30,
  },
};

describe("isSiteInfo", () => {
  it("accepts a fully populated body", () => {
    expect(isSiteInfo(VALID)).toBe(true);
  });

  it("accepts announcement and booking as null", () => {
    expect(isSiteInfo({ ...VALID, announcement: null, booking: null })).toBe(true);
  });

  it("accepts an empty hours and closures list", () => {
    expect(isSiteInfo({ ...VALID, hours: [], closures: [] })).toBe(true);
  });

  it("accepts booking with no services", () => {
    expect(isSiteInfo({ ...VALID, booking: { ...VALID_BOOKING(), services: [] } })).toBe(true);
  });

  it("rejects a non-object", () => {
    expect(isSiteInfo(null)).toBe(false);
    expect(isSiteInfo("hello")).toBe(false);
    expect(isSiteInfo([])).toBe(false);
  });

  it("rejects a missing required field", () => {
    expect(isSiteInfo(without(VALID, "business"))).toBe(false);
  });

  it("rejects an hours row with an out-of-range dayOfWeek", () => {
    expect(isSiteInfo({ ...VALID, hours: [{ ...HOURS_ROW(), dayOfWeek: 7 }] })).toBe(false);
    expect(isSiteInfo({ ...VALID, hours: [{ ...HOURS_ROW(), dayOfWeek: -1 }] })).toBe(false);
  });

  it("rejects an hours row missing a boolean flag", () => {
    expect(isSiteInfo({ ...VALID, hours: [without(HOURS_ROW(), "closed")] })).toBe(false);
  });

  it.each(["9:00", "09:00:00", "0900", "9am", ""])("rejects an hours row with a malformed opensAt %s", (opensAt) => {
    expect(isSiteInfo({ ...VALID, hours: [{ ...HOURS_ROW(), opensAt }] })).toBe(false);
  });

  it.each(["9:00", "09:00:00", "0900", "9am", ""])(
    "rejects an hours row with a malformed closesAt %s",
    (closesAt) => {
      expect(isSiteInfo({ ...VALID, hours: [{ ...HOURS_ROW(), closesAt }] })).toBe(false);
    },
  );

  it("accepts an hours row with opensAt/closesAt as null (closed or open all day)", () => {
    expect(
      isSiteInfo({ ...VALID, hours: [{ ...HOURS_ROW(), opensAt: null, closesAt: null, closed: true }] }),
    ).toBe(true);
  });

  it("rejects a closure missing a date", () => {
    expect(isSiteInfo({ ...VALID, closures: [{ startsOn: "2026-11-12", note: null }] })).toBe(false);
  });

  it.each(["2026-11-31", "2026-02-30", "2026-13-01", "2026-9-5", "12 Nov 2026", "not-a-date"])(
    "rejects a closure with a malformed or non-existent startsOn %s",
    (startsOn) => {
      expect(isSiteInfo({ ...VALID, closures: [{ startsOn, endsOn: "2026-11-14", note: null }] })).toBe(false);
    },
  );

  it.each([0, -1, 1.5, "30", null])("rejects a booking with an invalid slotMinutes %s", (slotMinutes) => {
    expect(isSiteInfo({ ...VALID, booking: { ...VALID_BOOKING(), slotMinutes } })).toBe(false);
  });

  it("rejects a booking missing slotMinutes", () => {
    expect(isSiteInfo({ ...VALID, booking: without(VALID_BOOKING(), "slotMinutes") })).toBe(false);
  });

  it("rejects a body with a malformed today", () => {
    expect(isSiteInfo({ ...VALID, today: "25-09-2026" })).toBe(false);
  });

  it("rejects an announcement missing endsOn", () => {
    expect(isSiteInfo({ ...VALID, announcement: { message: "Hi" } })).toBe(false);
  });

  it("rejects an announcement with a malformed endsOn", () => {
    expect(isSiteInfo({ ...VALID, announcement: { message: "Hi", endsOn: "next Friday" } })).toBe(false);
  });

  it("rejects a booking with a non-array services list", () => {
    expect(isSiteInfo({ ...VALID, booking: { ...VALID_BOOKING(), services: "none" } })).toBe(false);
  });

  it("rejects a booking service missing a name", () => {
    expect(isSiteInfo({ ...VALID, booking: { ...VALID_BOOKING(), services: [{ id: "svc-1" }] } })).toBe(false);
  });

  it("rejects a booking with the wrong type for accepting", () => {
    expect(isSiteInfo({ ...VALID, booking: { ...VALID_BOOKING(), accepting: "yes" } })).toBe(false);
  });

  it("accepts a booking without practitioners (a platform older than 2026-09-28)", () => {
    expect(isSiteInfo({ ...VALID, booking: VALID_BOOKING() })).toBe(true);
  });

  it("accepts a booking with an empty or fully populated practitioners list", () => {
    expect(isSiteInfo({ ...VALID, booking: { ...VALID_BOOKING(), practitioners: [] } })).toBe(true);
    expect(
      isSiteInfo({
        ...VALID,
        booking: {
          ...VALID_BOOKING(),
          practitioners: [PRACTITIONER(), { ...PRACTITIONER(), id: "doc-2", title: null, photoUrl: null }],
        },
      }),
    ).toBe(true);
  });

  it.each([null, "none", {}, 3])("rejects a booking whose practitioners is not an array: %s", (practitioners) => {
    expect(isSiteInfo({ ...VALID, booking: { ...VALID_BOOKING(), practitioners } })).toBe(false);
  });

  it.each(["id", "name", "title", "photoUrl"])("rejects a practitioner missing %s", (field) => {
    expect(isSiteInfo({ ...VALID, booking: { ...VALID_BOOKING(), practitioners: [without(PRACTITIONER(), field)] } })).toBe(
      false,
    );
  });

  it.each([
    ["an empty id", { id: "" }],
    ["a numeric id", { id: 7 }],
    ["a blank name", { name: "  " }],
    ["a numeric title", { title: 1 }],
    ["a relative photoUrl", { photoUrl: "/photos/rahul.jpg" }],
    ["a javascript: photoUrl", { photoUrl: "javascript:alert(1)" }],
    ["a data: photoUrl", { photoUrl: "data:image/png;base64,AAAA" }],
    ["a numeric photoUrl", { photoUrl: 5 }],
  ])("rejects a practitioner with %s", (_label, override) => {
    expect(
      isSiteInfo({ ...VALID, booking: { ...VALID_BOOKING(), practitioners: [{ ...PRACTITIONER(), ...override }] } }),
    ).toBe(false);
  });

  it("rejects the whole list when one practitioner among valid ones is malformed", () => {
    expect(
      isSiteInfo({ ...VALID, booking: { ...VALID_BOOKING(), practitioners: [PRACTITIONER(), "Dr Who"] } }),
    ).toBe(false);
  });
});

function HOURS_ROW(): Record<string, unknown> {
  return { dayOfWeek: 0, opensAt: "09:00", closesAt: "17:00", closed: false, openAllDay: false };
}

function VALID_BOOKING(): Record<string, unknown> {
  return {
    accepting: true,
    pausedMessage: null,
    services: [{ id: "svc-1", name: "Consultation" }],
    slotMinutes: 30,
  };
}

function PRACTITIONER(): Record<string, unknown> {
  return {
    id: "5b0c3f9e-2c1a-4d7e-9f3a-1b2c3d4e5f60",
    name: "Dr Rahul Menon",
    title: "Sports physiotherapist",
    photoUrl: "https://cdn.example.com/rahul.jpg",
  };
}
