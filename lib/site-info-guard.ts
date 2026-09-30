/**
 * Validates that an arbitrary parsed JSON value matches SiteInfo, at the boundary of GET /api/site/info, rather
 * than trusting a cast. Pure (no fetching, no `server-only`), so it is unit-tested directly; lib/firstfold-info.ts
 * does the fetching.
 */
import type {
  SiteInfo,
  SiteInfoBooking,
  SiteInfoClosure,
  SiteInfoHours,
  SiteInfoPractitioner,
  SiteInfoService,
} from "./site-info";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isDayOfWeek(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" and a real calendar date — rejects both malformed strings ("2026-2-30") and invalid ones ("2026-02-30"). */
function isDateString(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const [yearStr = "", monthStr = "", dayStr = ""] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const TIME_PATTERN = /^\d{2}:\d{2}$/;

/** "HH:MM" — format only (the platform is the source of truth for whether the hour/minute values are sane). */
function isTimeString(value: unknown): value is string {
  return typeof value === "string" && TIME_PATTERN.test(value);
}

function isNullableTimeString(value: unknown): value is string | null {
  return value === null || isTimeString(value);
}

function isHours(value: unknown): value is SiteInfoHours {
  return (
    isRecord(value) &&
    isDayOfWeek(value.dayOfWeek) &&
    isNullableTimeString(value.opensAt) &&
    isNullableTimeString(value.closesAt) &&
    typeof value.closed === "boolean" &&
    typeof value.openAllDay === "boolean"
  );
}

function isClosure(value: unknown): value is SiteInfoClosure {
  return isRecord(value) && isDateString(value.startsOn) && isDateString(value.endsOn) && isNullableString(value.note);
}

function isService(value: unknown): value is SiteInfoService {
  return isRecord(value) && typeof value.id === "string" && typeof value.name === "string";
}

/**
 * An absolute http(s) URL, or null. The photo ends up in an <img src> on the /book page, so anything else — a
 * relative path (which would resolve against this site, not the platform), a `data:` or `javascript:` URL — is a
 * malformed contract rather than something to render.
 */
function isNullablePhotoUrl(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** A non-empty id (it becomes the `practitioner` query parameter and the booking's practitionerId) and a non-blank
 * name (it is the only visible label of the doctor's radio card). */
function isPractitioner(value: unknown): value is SiteInfoPractitioner {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id !== "" &&
    typeof value.name === "string" &&
    value.name.trim() !== "" &&
    isNullableString(value.title) &&
    isNullablePhotoUrl(value.photoUrl)
  );
}

function isBooking(value: unknown): value is SiteInfoBooking {
  return (
    isRecord(value) &&
    typeof value.accepting === "boolean" &&
    isNullableString(value.pausedMessage) &&
    Array.isArray(value.services) &&
    value.services.every(isService) &&
    typeof value.slotMinutes === "number" &&
    Number.isInteger(value.slotMinutes) &&
    value.slotMinutes > 0 &&
    // Missing on platforms older than 2026-09-28 (the site then behaves as a single-doctor clinic); when present it
    // must be a list of well-formed doctors — one bad entry rejects the whole body, the same as every other list.
    (value.practitioners === undefined || (Array.isArray(value.practitioners) && value.practitioners.every(isPractitioner)))
  );
}

function isAnnouncement(value: unknown): value is SiteInfo["announcement"] {
  if (value === null) return true;
  return isRecord(value) && typeof value.message === "string" && isDateString(value.endsOn);
}

export function isSiteInfo(value: unknown): value is SiteInfo {
  return (
    isRecord(value) &&
    typeof value.business === "string" &&
    isNullableString(value.timeZone) &&
    isDateString(value.today) &&
    Array.isArray(value.hours) &&
    value.hours.every(isHours) &&
    Array.isArray(value.closures) &&
    value.closures.every(isClosure) &&
    isAnnouncement(value.announcement) &&
    (value.booking === null || isBooking(value.booking))
  );
}
