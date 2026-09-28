/**
 * The pure parts of POST /api/book/otp: whitelisting the incoming booking fields before they are forwarded to the
 * platform, and interpreting the platform's response. Kept free of Next.js/Request/Response types (and of
 * `server-only`, which throws when imported outside a bundler that sets the "react-server" condition) so this is
 * simple to unit test directly; app/api/book/otp/route.ts wires it to fetch and to lib/request-guard.ts for the
 * body-reading, same-origin and client-IP checks it shares with app/api/book/confirm/route.ts.
 */
import { GENERIC_FAILURE_RESPONSE, InvalidBookingBodyError } from "./request-guard";
import { isSiteOtpResponse } from "./site-bookings-guard";
import type { SiteBookingFields, SiteOtpRequest, SiteOtpResponse } from "./site-bookings";

export { GENERIC_FAILURE_RESPONSE, INVALID_BODY_RESPONSE, InvalidBookingBodyError } from "./request-guard";

/** A required string field: must be a string (any string, including blank — the platform validates content). */
function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string") throw new InvalidBookingBodyError(`"${key}" must be a string`);
  return value;
}

/**
 * An optional string field: absent (or explicitly undefined) becomes null, an explicit null stays null, and a
 * present value must be a string — anything else (a number, boolean, object, array, ...) is a type error, not a
 * silently-dropped value, so a probing or malfunctioning client is rejected rather than laundered into null.
 */
function optionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  throw new InvalidBookingBodyError(`"${key}" must be a string or null`);
}

/**
 * Picks only the known SiteBookingFields keys out of an arbitrary parsed JSON body, so nothing the browser sends
 * beyond the expected shape is ever forwarded to the platform. This checks *types* only — a blank name, phone,
 * date or start is passed through so the platform's own validation (and its field-specific 422 message) is what
 * the visitor sees, not a generic client-side rejection. Throws InvalidBookingBodyError when a field is missing or
 * of the wrong type.
 */
export function whitelistFields(body: unknown): SiteBookingFields {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new InvalidBookingBodyError("body is not an object");
  }
  const record = body as Record<string, unknown>;

  const name = requiredString(record, "name");
  const phone = requiredString(record, "phone");
  const date = requiredString(record, "date");
  const start = requiredString(record, "start");

  const serviceId = optionalString(record, "serviceId");
  const website = optionalString(record, "website");
  // Null (or absent) means "any doctor". Type-checked only, like serviceId: whether it names an active doctor is
  // the platform's call, answered with its own field-specific error.
  const practitionerId = optionalString(record, "practitionerId");

  return { name, phone, serviceId, date, start, website, practitionerId };
}

/** The exact request body to send to POST {PLATFORM}/api/site/bookings/otp. */
export function buildUpstreamRequest(fields: SiteBookingFields, clientIp: string): SiteOtpRequest {
  return { fields, clientIp };
}

/** Status codes the platform answers with a SiteOtpResponse body for; everything else is relayed as a 502. */
const RELAYED_STATUSES: ReadonlySet<number> = new Set([200, 400, 422, 409, 403, 429, 500]);

/** Rebuilds a response from only its validated keys — the upstream object itself is never forwarded as-is. */
function rebuildResponse(body: SiteOtpResponse): SiteOtpResponse {
  if (body.status === "otp_sent") {
    return { status: "otp_sent", otpId: body.otpId, expiresInSeconds: body.expiresInSeconds, phoneHint: body.phoneHint };
  }
  return { status: "error", code: body.code, message: body.message, field: body.field };
}

export interface RelayedOtpResponse {
  readonly status: number;
  readonly body: SiteOtpResponse;
}

/**
 * Interprets the platform's response to the forwarded OTP request. The platform's status is relayed, and its body
 * is rebuilt from only its validated keys, when the status is one it answers with a SiteOtpResponse for and that
 * body actually matches the shape; otherwise (an unexpected status, or a body that doesn't match) this maps to a
 * generic 502 so the browser never sees a body shape it doesn't understand. A network error or invalid-JSON
 * response from the platform is handled by the caller before this is reached, and should also map to the 502 case.
 */
export function interpretUpstreamResponse(status: number, body: unknown): RelayedOtpResponse {
  if (RELAYED_STATUSES.has(status) && isSiteOtpResponse(body)) {
    return { status, body: rebuildResponse(body) };
  }
  return { status: 502, body: GENERIC_FAILURE_RESPONSE };
}
