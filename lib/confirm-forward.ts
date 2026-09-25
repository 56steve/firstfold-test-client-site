/**
 * The pure parts of POST /api/book/confirm: validating {otpId, code} before forwarding to the platform, and
 * interpreting the platform's response. Mirrors lib/book-forward.ts's shape for the OTP-send step; the two are
 * kept separate because the field validation is different (a uuid and a 6-digit code, not the full booking form)
 * even though both routes lean on the same lib/request-guard.ts for the body-reading, same-origin and client-IP
 * checks.
 */
import { GENERIC_FAILURE_RESPONSE, InvalidBookingBodyError } from "./request-guard";
import { isSiteConfirmResponse } from "./site-bookings-guard";
import type { SiteConfirmResponse, SiteOtpConfirm } from "./site-bookings";

export { GENERIC_FAILURE_RESPONSE, INVALID_BODY_RESPONSE, InvalidBookingBodyError } from "./request-guard";

const OTP_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_PATTERN = /^\d{6}$/;

export interface ConfirmFields {
  readonly otpId: string;
  readonly code: string;
}

/**
 * Validates the two fields POST /api/book/confirm accepts from the browser: `otpId` must look like a uuid and
 * `code` must be exactly 6 digits, matching the OTP contract (lib/site-bookings.ts). Anything else — a missing
 * field, the wrong type, or a value that doesn't match either shape — throws InvalidBookingBodyError, the same as
 * lib/book-forward.ts's whitelistFields.
 */
export function whitelistConfirmFields(body: unknown): ConfirmFields {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new InvalidBookingBodyError("body is not an object");
  }
  const record = body as Record<string, unknown>;

  const otpId = record.otpId;
  if (typeof otpId !== "string" || !OTP_ID_PATTERN.test(otpId)) {
    throw new InvalidBookingBodyError('"otpId" must be a uuid');
  }

  const code = record.code;
  if (typeof code !== "string" || !CODE_PATTERN.test(code)) {
    throw new InvalidBookingBodyError('"code" must be 6 digits');
  }

  return { otpId, code };
}

/** The exact request body to send to POST {PLATFORM}/api/site/bookings/confirm. */
export function buildUpstreamRequest(fields: ConfirmFields, clientIp: string): SiteOtpConfirm {
  return { otpId: fields.otpId, code: fields.code, clientIp };
}

/** Status codes the platform answers with a SiteConfirmResponse body for; everything else is relayed as a 502.
 * Includes 500 (the platform's own "failed" outcome), same as lib/book-forward.ts's RELAYED_STATUSES: the
 * platform's 500 already carries a safe, validated SiteConfirmResponse body (see handleBookingConfirmRequest's
 * FAILED_MESSAGE), so relaying it as-is is strictly more informative than collapsing it into this route's own
 * generic 502. */
const RELAYED_STATUSES: ReadonlySet<number> = new Set([200, 400, 403, 409, 410, 422, 429, 500]);

/** Rebuilds a response from only its validated keys — the upstream object itself is never forwarded as-is. */
function rebuildResponse(body: SiteConfirmResponse): SiteConfirmResponse {
  if (body.status === "booked") {
    return { status: "booked", date: body.date, start: body.start, end: body.end };
  }
  return { status: "error", code: body.code, message: body.message, field: body.field };
}

export interface RelayedConfirmResponse {
  readonly status: number;
  readonly body: SiteConfirmResponse;
}

/**
 * Interprets the platform's response to the forwarded confirm request. The platform's status is relayed, and its
 * body is rebuilt from only its validated keys, when the status is one it answers with a SiteConfirmResponse for
 * and that body actually matches the shape; otherwise this maps to a generic 502, the same convention as
 * lib/book-forward.ts's interpretUpstreamResponse.
 */
export function interpretUpstreamResponse(status: number, body: unknown): RelayedConfirmResponse {
  if (RELAYED_STATUSES.has(status) && isSiteConfirmResponse(body)) {
    return { status, body: rebuildResponse(body) };
  }
  return { status: 502, body: GENERIC_FAILURE_RESPONSE };
}
