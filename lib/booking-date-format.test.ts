import { describe, expect, it } from "vitest";
import { formatDayHeader, formatFullDayLabel, formatSlotRange, formatWeekTitle } from "./booking-date-format";

describe("formatDayHeader", () => {
  it("formats a weekday and day number", () => {
    expect(formatDayHeader("2026-09-28")).toEqual({ weekday: "Mon", day: 28 });
  });

  it("is stable at a UTC month boundary", () => {
    expect(formatDayHeader("2026-10-01")).toEqual({ weekday: "Thu", day: 1 });
  });
});

describe("formatFullDayLabel", () => {
  it("formats the full weekday, day and month", () => {
    expect(formatFullDayLabel("2026-09-28")).toBe("Monday 28 September");
  });
});

describe("formatWeekTitle", () => {
  it("spans two months", () => {
    expect(formatWeekTitle("2026-09-28")).toBe("28 Sep – 4 Oct 2026");
  });

  it("stays within a single month", () => {
    expect(formatWeekTitle("2026-09-07")).toBe("7 – 13 Sep 2026");
  });

  it("spans a year boundary, naming both years", () => {
    expect(formatWeekTitle("2026-12-28")).toBe("28 Dec 2026 – 3 Jan 2027");
  });
});

describe("formatSlotRange", () => {
  it("joins start and end with an en dash", () => {
    expect(formatSlotRange("09:00", "09:30")).toBe("09:00 – 09:30");
  });

  it("handles a slot ending at 24:00 (a shift, or the day, running to midnight)", () => {
    expect(formatSlotRange("23:30", "24:00")).toBe("23:30 – 24:00");
  });
});
