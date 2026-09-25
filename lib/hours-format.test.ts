import { describe, expect, it } from "vitest";
import { formatClosure, formatDayHours, formatWeek, WEEKDAY_LABELS } from "./hours-format";
import type { SiteInfoClosure, SiteInfoHours } from "./site-info";

function hoursRow(overrides: Partial<SiteInfoHours> & { readonly dayOfWeek: number }): SiteInfoHours {
  return { opensAt: null, closesAt: null, closed: false, openAllDay: false, ...overrides };
}

describe("formatDayHours", () => {
  it("shows an em dash for a day with no rows", () => {
    expect(formatDayHours([], 0)).toBe("—");
  });

  it("shows Closed for a closed day", () => {
    const rows = [hoursRow({ dayOfWeek: 0, closed: true })];
    expect(formatDayHours(rows, 0)).toBe("Closed");
  });

  it("shows Open 24 hours for an all-day row", () => {
    const rows = [hoursRow({ dayOfWeek: 2, openAllDay: true })];
    expect(formatDayHours(rows, 2)).toBe("Open 24 hours");
  });

  it("formats a single shift", () => {
    const rows = [hoursRow({ dayOfWeek: 1, opensAt: "09:00", closesAt: "17:00" })];
    expect(formatDayHours(rows, 1)).toBe("09:00 – 17:00");
  });

  it("joins split shifts with a comma", () => {
    const rows = [
      hoursRow({ dayOfWeek: 3, opensAt: "09:00", closesAt: "12:00" }),
      hoursRow({ dayOfWeek: 3, opensAt: "14:00", closesAt: "18:00" }),
    ];
    expect(formatDayHours(rows, 3)).toBe("09:00 – 12:00, 14:00 – 18:00");
  });

  it("marks a closing time earlier than opening as the next day", () => {
    const rows = [hoursRow({ dayOfWeek: 5, opensAt: "20:00", closesAt: "02:00" })];
    expect(formatDayHours(rows, 5)).toBe("20:00 – 02:00 (next day)");
  });

  it("only picks rows for the requested day", () => {
    const rows = [
      hoursRow({ dayOfWeek: 0, opensAt: "09:00", closesAt: "17:00" }),
      hoursRow({ dayOfWeek: 1, opensAt: "10:00", closesAt: "16:00" }),
    ];
    expect(formatDayHours(rows, 1)).toBe("10:00 – 16:00");
  });
});

describe("formatWeek", () => {
  it("lists Monday through Sunday in order with per-day text", () => {
    const rows = [hoursRow({ dayOfWeek: 0, opensAt: "09:00", closesAt: "17:00" })];
    const week = formatWeek(rows);
    expect(week.map((day) => day.label)).toEqual(WEEKDAY_LABELS);
    expect(week[0]).toEqual({ label: "Monday", text: "09:00 – 17:00" });
    expect(week[6]).toEqual({ label: "Sunday", text: "—" });
  });
});

describe("formatClosure", () => {
  const closure = (overrides: Partial<SiteInfoClosure>): SiteInfoClosure => ({
    startsOn: "2026-11-12",
    endsOn: "2026-11-12",
    note: null,
    ...overrides,
  });

  it("shows a single-day closure's date once", () => {
    expect(formatClosure(closure({}))).toBe("12 Nov");
  });

  it("shows a multi-day range", () => {
    expect(formatClosure(closure({ endsOn: "2026-11-14" }))).toBe("12 Nov – 14 Nov");
  });

  it("appends the note after a middle dot", () => {
    expect(formatClosure(closure({ endsOn: "2026-11-14", note: "Diwali" }))).toBe("12 Nov – 14 Nov · Diwali");
  });

  it("drops the separator when the note is blank", () => {
    expect(formatClosure(closure({ note: "   " }))).toBe("12 Nov");
  });

  it("never throws on a malformed date, falling back to the raw string", () => {
    // lib/site-info-guard.ts should already keep bad data out of SiteInfo, but rendering must not depend on that:
    // it must degrade gracefully rather than crash the page.
    expect(() => formatClosure(closure({ startsOn: "not-a-date", endsOn: "not-a-date" }))).not.toThrow();
    expect(formatClosure(closure({ startsOn: "not-a-date", endsOn: "not-a-date" }))).toBe("not-a-date");
  });

  it("falls back to the raw string for a non-existent calendar date", () => {
    expect(formatClosure(closure({ startsOn: "2026-02-30", endsOn: "2026-02-30" }))).toBe("2026-02-30");
  });
});
