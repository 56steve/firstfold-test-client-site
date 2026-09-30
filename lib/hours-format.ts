/**
 * Pure formatting helpers for opening hours and closures. Kept free of React and fetch so they are simple to unit
 * test; components/opening-hours.tsx is the only caller.
 */
import type { SiteInfoClosure, SiteInfoHours } from "./site-info";

/** Monday through Sunday, indexed to match SiteInfoHours.dayOfWeek (0 = Monday). */
export const WEEKDAY_LABELS: readonly string[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const CLOSURE_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** One row's text, e.g. "09:00 – 17:00", "09:00 – 01:00 (next day)", "Open 24 hours" or "Closed". */
function formatShift(row: SiteInfoHours): string {
  if (row.closed) return "Closed";
  if (row.openAllDay) return "Open 24 hours";
  const { opensAt, closesAt } = row;
  if (opensAt === null || closesAt === null) return "Closed";
  const closesNextDay = closesAt < opensAt;
  return `${opensAt} – ${closesAt}${closesNextDay ? " (next day)" : ""}`;
}

/**
 * One weekday's display text from its hours rows (0-6, Monday = 0). Multiple rows (split shifts) join with ", ".
 * A day with no rows at all shows "—".
 */
export function formatDayHours(hours: readonly SiteInfoHours[], dayOfWeek: number): string {
  const rows = hours.filter((row) => row.dayOfWeek === dayOfWeek);
  if (rows.length === 0) return "—";
  return rows.map(formatShift).join(", ");
}

export interface FormattedDay {
  readonly label: string;
  readonly text: string;
}

/** The week Monday through Sunday, each day's label and ready-to-display text. */
export function formatWeek(hours: readonly SiteInfoHours[]): readonly FormattedDay[] {
  return WEEKDAY_LABELS.map((label, dayOfWeek) => ({ label, text: formatDayHours(hours, dayOfWeek) }));
}

/**
 * "YYYY-MM-DD" -> "12 Nov", parsed as UTC so the calendar date never shifts with the viewer's time zone.
 *
 * lib/site-info-guard.ts already rejects a malformed or non-existent date before it ever reaches SiteInfo, but this
 * is defensive on top of that: a render must never throw over bad data, so an unparseable date falls back to the
 * raw string rather than letting Intl.DateTimeFormat raise a RangeError on an Invalid Date.
 */
function formatClosureDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  // Date silently rolls a non-existent day like "2026-02-30" over to 2 March instead of rejecting it; a round trip
  // through toISOString catches that (and anything else Date normalized away) and falls back rather than show it.
  return date.toISOString().slice(0, 10) === isoDate ? CLOSURE_DATE_FORMAT.format(date) : isoDate;
}

/** "12 Nov – 14 Nov · Diwali" style; a single-day closure shows its date once, and a note-less closure drops the "· ". */
export function formatClosure(closure: SiteInfoClosure): string {
  const start = formatClosureDate(closure.startsOn);
  const range = closure.startsOn === closure.endsOn ? start : `${start} – ${formatClosureDate(closure.endsOn)}`;
  const note = closure.note?.trim();
  return note === undefined || note === "" ? range : `${range} · ${note}`;
}
