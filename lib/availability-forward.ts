/**
 * The pure parts of GET /api/availability: validating the `week` query parameter before it is forwarded to the
 * platform, building the upstream path, and interpreting the platform's response. Kept free of
 * Next.js/Request/Response types so this is simple to unit test directly; app/api/availability/route.ts wires it
 * to fetch.
 */
import { GENERIC_FAILURE_RESPONSE } from "./request-guard";
import { isSiteAvailability, isSiteBookingError } from "./site-bookings-guard";
import type { SiteAvailability, SiteBookingError } from "./site-bookings";
import { isUuid } from "./uuid";

export { GENERIC_FAILURE_RESPONSE, INVALID_BODY_RESPONSE } from "./request-guard";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" and a real calendar date — the same rule GET /api/site/availability itself applies to `week`. */
export function isValidWeekParam(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [yearStr = "", monthStr = "", dayStr = ""] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * The `practitioner` query parameter to forward, or null to leave it off. Only a uuid is forwarded; anything else
 * (blank, "any", a probing string) is dropped rather than rejected, so the grid falls back to "any doctor" instead
 * of erroring — a wrong id that *is* a uuid still reaches the platform, which answers its own 400 for it.
 */
export function practitionerParam(value: string | null): string | null {
  return value !== null && isUuid(value) ? value : null;
}

/** The upstream path to call: `week` omitted lets the platform default to the current week, and `practitioner`
 * omitted means any doctor. */
export function buildUpstreamPath(week: string | null, practitioner: string | null = null): string {
  const params = new URLSearchParams();
  if (week !== null) params.set("week", week);
  if (practitioner !== null) params.set("practitioner", practitioner);
  const query = params.toString();
  return query === "" ? "/api/site/availability" : `/api/site/availability?${query}`;
}

/** Status codes the platform answers a SiteBookingError body for; 200 is handled separately since it answers a
 * SiteAvailability body instead. */
const RELAYED_ERROR_STATUSES: ReadonlySet<number> = new Set([400, 403, 409]);

function rebuildAvailability(value: SiteAvailability): SiteAvailability {
  return {
    weekStart: value.weekStart,
    today: value.today,
    slotMinutes: value.slotMinutes,
    previousWeek: value.previousWeek,
    nextWeek: value.nextWeek,
    days: value.days.map((day) => ({
      date: day.date,
      closed: day.closed,
      closedNote: day.closedNote,
      slots: day.slots.map((slot) => ({ start: slot.start, end: slot.end, state: slot.state })),
    })),
  };
}

function rebuildError(value: SiteBookingError): SiteBookingError {
  return { status: "error", code: value.code, message: value.message, field: value.field };
}

export interface RelayedAvailabilityResponse {
  readonly status: number;
  readonly body: SiteAvailability | SiteBookingError;
}

/**
 * Interprets the platform's response to the forwarded availability request. A 200 is relayed only when its body
 * matches SiteAvailability; a listed error status is relayed only when its body matches SiteBookingError.
 * Everything else — an unexpected status, or a body that doesn't match the shape its status implies — maps to a
 * generic 502, the same convention as lib/book-forward.ts and lib/confirm-forward.ts.
 */
export function interpretUpstreamResponse(status: number, body: unknown): RelayedAvailabilityResponse {
  if (status === 200 && isSiteAvailability(body)) {
    return { status, body: rebuildAvailability(body) };
  }
  if (RELAYED_ERROR_STATUSES.has(status) && isSiteBookingError(body)) {
    return { status, body: rebuildError(body) };
  }
  return { status: 502, body: GENERIC_FAILURE_RESPONSE };
}
