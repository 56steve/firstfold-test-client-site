/**
 * Pure date-label formatting for the /book week grid: turning a YYYY-MM-DD string into the weekday/day/month
 * labels the grid header, slot buttons and booking panel need. Every Date this builds is anchored to UTC midnight
 * so the calendar date shown never shifts with the visitor's own time zone — the string already names a specific
 * day in the business's own time zone, and that's the day that must be displayed, regardless of where the browser
 * happens to be.
 *
 * Weekday and month names come from fixed arrays, not Intl.DateTimeFormat: the exact spelling and abbreviation
 * Intl produces for a given locale can vary across JS engines and ICU data versions (en-GB's short September, for
 * one, is "Sept" in some environments and "Sep" in others), so a fixed array is the only way to guarantee the same
 * output everywhere this runs.
 */

const WEEKDAY_SHORT_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const WEEKDAY_LONG_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
const MONTH_SHORT_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const MONTH_LONG_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function parseISODate(date: string): Date {
  const [yearStr = "", monthStr = "", dayStr = ""] = date.split("-");
  return new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr)));
}

function addDays(date: string, days: number): Date {
  const base = parseISODate(date);
  base.setUTCDate(base.getUTCDate() + days);
  return base;
}

/** `getUTCDay()` is 0-6, Sunday first — matches the index of WEEKDAY_*_NAMES directly. */
function weekdayShort(date: Date): string {
  return WEEKDAY_SHORT_NAMES[date.getUTCDay()] ?? "";
}

function weekdayLong(date: Date): string {
  return WEEKDAY_LONG_NAMES[date.getUTCDay()] ?? "";
}

/** `getUTCMonth()` is 0-11 — matches the index of MONTH_*_NAMES directly. */
function monthShort(date: Date): string {
  return MONTH_SHORT_NAMES[date.getUTCMonth()] ?? "";
}

function monthLong(date: Date): string {
  return MONTH_LONG_NAMES[date.getUTCMonth()] ?? "";
}

export interface DayHeader {
  readonly weekday: string; // "Mon"
  readonly day: number; // 28
}

/** "Mon" / 28 — the two parts of a grid column header. */
export function formatDayHeader(date: string): DayHeader {
  const parsed = parseISODate(date);
  return { weekday: weekdayShort(parsed), day: parsed.getUTCDate() };
}

/** "Monday 28 September" — for aria-labels and the booking panel's own heading. */
export function formatFullDayLabel(date: string): string {
  const parsed = parseISODate(date);
  return `${weekdayLong(parsed)} ${parsed.getUTCDate()} ${monthLong(parsed)}`;
}

/** "28 Sep – 4 Oct 2026" within a year, or "28 Dec 2026 – 3 Jan 2027" across one — the week title, spanning the
 * Monday through the following Sunday. */
export function formatWeekTitle(weekStart: string): string {
  const start = parseISODate(weekStart);
  const end = addDays(weekStart, 6);
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const startMonth = monthShort(start);
  const endMonth = monthShort(end);
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();

  const sameMonth = startMonth === endMonth && startYear === endYear;
  const startLabel = sameMonth ? `${startDay}` : `${startDay} ${startMonth}`;
  const startLabelWithYear = startYear === endYear ? startLabel : `${startLabel} ${startYear}`;

  return `${startLabelWithYear} – ${endDay} ${endMonth} ${endYear}`;
}

/** "09:00 – 09:30" (or "23:30 – 24:00" for a slot or booking running to midnight) — a plain join, so any
 * "HH:MM"/"24:00" pair from lib/site-bookings.ts already renders correctly without any date parsing here. */
export function formatSlotRange(start: string, end: string): string {
  return `${start} – ${end}`;
}
