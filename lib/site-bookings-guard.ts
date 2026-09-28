/**
 * Validates that an arbitrary parsed JSON value matches the shapes in lib/site-bookings.ts, at the boundary of
 * every response this site's server routes relay from the platform (GET /api/availability, POST /api/book/otp,
 * POST /api/book/confirm). Pure (no fetching, no `server-only`), so it is unit-tested directly and safe to reuse
 * from a client component that wants to double-check what it just fetched.
 */
import type {
  SiteAvailability,
  SiteAvailabilityDay,
  SiteBookingError,
  SiteBookingErrorCode,
  SiteConfirmResponse,
  SiteOtpResponse,
  SiteSlot,
  SiteSlotState,
} from "./site-bookings";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" and a real calendar date — rejects both malformed strings ("2026-2-30") and invalid ones
 * ("2026-02-30"). */
function isDateString(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const [yearStr = "", monthStr = "", dayStr = ""] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isNullableDateString(value: unknown): value is string | null {
  return value === null || isDateString(value);
}

/** "HH:MM", a real 24-hour wall-clock time — 00:00 through 23:59 only, so "24:00" and "12:60" are both rejected.
 * Used for every *start* time: a slot, or a booking, can never start at midnight-the-end-of-day. */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function isTimeString(value: unknown): value is string {
  return typeof value === "string" && TIME_PATTERN.test(value);
}

/** "HH:MM" as above, plus "24:00" — the platform emits "24:00" as a slot's or a booking's *end* for a range that
 * runs to midnight (a closing shift, or "open all day"). Used only for end times; a start can never be "24:00". */
const END_TIME_PATTERN = /^(?:([01]\d|2[0-3]):[0-5]\d|24:00)$/;

function isEndTimeString(value: unknown): value is string {
  return typeof value === "string" && END_TIME_PATTERN.test(value);
}

const SLOT_STATES: ReadonlySet<string> = new Set<SiteSlotState>(["free", "taken", "past"]);

function isSiteSlotState(value: unknown): value is SiteSlotState {
  return typeof value === "string" && SLOT_STATES.has(value);
}

function isSiteSlot(value: unknown): value is SiteSlot {
  return isRecord(value) && isTimeString(value.start) && isEndTimeString(value.end) && isSiteSlotState(value.state);
}

function isSiteAvailabilityDay(value: unknown): value is SiteAvailabilityDay {
  return (
    isRecord(value) &&
    isDateString(value.date) &&
    typeof value.closed === "boolean" &&
    isNullableString(value.closedNote) &&
    Array.isArray(value.slots) &&
    value.slots.every(isSiteSlot)
  );
}

/** `days` must be exactly 7 (Monday first), per the SiteAvailability contract. */
export function isSiteAvailability(value: unknown): value is SiteAvailability {
  return (
    isRecord(value) &&
    isDateString(value.weekStart) &&
    isDateString(value.today) &&
    typeof value.slotMinutes === "number" &&
    Number.isInteger(value.slotMinutes) &&
    value.slotMinutes > 0 &&
    isNullableDateString(value.previousWeek) &&
    isNullableDateString(value.nextWeek) &&
    Array.isArray(value.days) &&
    value.days.length === 7 &&
    value.days.every(isSiteAvailabilityDay)
  );
}

const ERROR_CODES: ReadonlySet<string> = new Set<SiteBookingErrorCode>([
  "invalid",
  "taken",
  "paused",
  "unavailable",
  "limited",
  "failed",
  "wrong_code",
  "expired",
  "too_many_attempts",
]);

function isSiteBookingErrorCode(value: unknown): value is SiteBookingErrorCode {
  return typeof value === "string" && ERROR_CODES.has(value);
}

export function isSiteBookingError(value: unknown): value is SiteBookingError {
  return (
    isRecord(value) &&
    value.status === "error" &&
    isSiteBookingErrorCode(value.code) &&
    typeof value.message === "string" &&
    isNullableString(value.field)
  );
}

export function isSiteOtpResponse(value: unknown): value is SiteOtpResponse {
  if (!isRecord(value)) return false;
  if (value.status === "otp_sent") {
    return (
      typeof value.otpId === "string" &&
      value.otpId !== "" &&
      typeof value.expiresInSeconds === "number" &&
      Number.isFinite(value.expiresInSeconds) &&
      typeof value.phoneHint === "string"
    );
  }
  return isSiteBookingError(value);
}

export function isSiteConfirmResponse(value: unknown): value is SiteConfirmResponse {
  if (!isRecord(value)) return false;
  if (value.status === "booked") {
    return (
      isDateString(value.date) &&
      isTimeString(value.start) &&
      isEndTimeString(value.end) &&
      // Missing from platforms older than 2026-09-28; when present, the doctor's name or null.
      (value.practitionerName === undefined || isNullableString(value.practitionerName))
    );
  }
  return isSiteBookingError(value);
}
