/**
 * Request-level helpers shared by every route that forwards a browser request from this site's server to the
 * Firstfold platform: reading a POST body within a size cap, checking that a POST is same-origin, and picking the
 * client's IP out of the proxy headers — plus the two response bodies every forwarding route falls back to when it
 * cannot make sense of the request, or cannot make sense of the platform's reply. Kept free of any route-specific
 * shape so app/api/availability/route.ts, app/api/book/otp/route.ts and app/api/book/confirm/route.ts can all
 * build on it, and free of Next.js/Request/Response coupling beyond the one Web-standard Request type, so this is
 * simple to unit test directly.
 */
import { isIP } from "node:net";
import type { SiteBookingError } from "./site-bookings";

/** No POST route here accepts a body larger than this, before ever parsing it as JSON. */
export const MAX_BODY_BYTES = 16 * 1024;

/** Every route's fetch to the platform aborts after this long; the resulting AbortError is caught the same way as
 * any other network failure, and becomes the same generic 502. */
export const UPSTREAM_TIMEOUT_MS = 10_000;

export function exceedsMaxBodySize(byteLength: number): boolean {
  return byteLength > MAX_BODY_BYTES;
}

/** Minimal shape of the Headers this needs, so tests can pass a plain object instead of a real Request. */
export interface HeaderReader {
  get(name: string): string | null;
}

/** What a forwarding route answers when it cannot even make sense of the request (bad JSON, missing/invalid
 * fields, a bad query parameter, a cross-origin POST, or the wrong content type). */
export const INVALID_BODY_RESPONSE: SiteBookingError = {
  status: "error",
  code: "invalid",
  message: "We couldn't read that request. Please try again.",
  field: null,
};

/** What a forwarding route answers when the platform can't be reached, or answers with something it doesn't
 * recognize — the only response shape this site ever shows for an unexpected upstream failure, deliberately
 * generic so nothing about the platform's own error leaks to the browser. */
export const GENERIC_FAILURE_RESPONSE: SiteBookingError = {
  status: "error",
  code: "failed",
  message: "We couldn't reach the booking system. Please call us.",
  field: null,
};

export class InvalidBookingBodyError extends Error {
  constructor(detail: string) {
    super(`Invalid booking request body: ${detail}`);
    this.name = "InvalidBookingBodyError";
  }
}

/** Sentinels distinct from any possible body string, returned when the stream can't be turned into one. */
const BODY_TOO_LARGE = Symbol("body-too-large");
const BODY_READ_ERROR = Symbol("body-read-error");
export type BodyReadFailure = typeof BODY_TOO_LARGE | typeof BODY_READ_ERROR;

export function isBodyReadFailure(value: string | BodyReadFailure): value is BodyReadFailure {
  return value === BODY_TOO_LARGE || value === BODY_READ_ERROR;
}

/**
 * Reads the request body as text, counting bytes as each chunk arrives, and stops as soon as the total would
 * exceed the cap — rather than buffering an arbitrarily large body in full before ever checking its size. A
 * connection that drops or aborts mid-upload makes `reader.read()` itself reject; that's caught here too, so it
 * becomes the same contract-shaped 400 rather than an unhandled rejection turning into a plain 500.
 */
export async function readBodyWithinLimit(request: Request): Promise<string | BodyReadFailure> {
  const body = request.body;
  if (body === null) return "";

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    let result: ReadableStreamReadResult<Uint8Array>;
    try {
      result = await reader.read();
    } catch (error) {
      console.error("Firstfold booking: the request body stream errored while reading", error);
      return BODY_READ_ERROR;
    }

    if (result.done) break;

    total += result.value.byteLength;
    if (exceedsMaxBodySize(total)) {
      await reader.cancel().catch(() => undefined);
      return BODY_TOO_LARGE;
    }
    chunks.push(result.value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

/**
 * True when the request carries an Origin header whose host disagrees with the host this request actually arrived
 * on — a browser only sends Origin on a cross-site request, so this catches a form on some other page posting here,
 * without needing an OPTIONS preflight or a CORS allow-list. Compared against `x-forwarded-host` (falling back to
 * `host`), the same way Next's own server-action origin check does, since a request behind a reverse proxy carries
 * the public host in `x-forwarded-host` rather than in `host`.
 */
export function isCrossOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return false;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return true; // an Origin header that isn't even a valid URL is not one to trust
  }

  const requestHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return originHost !== requestHost;
}

/**
 * The client IP Firstfold uses for rate limiting: the first entry of `x-forwarded-for`, then `x-real-ip`, then a
 * loopback fallback — each checked with `net.isIP` so a malformed or spoofed-looking value never reaches the
 * platform as if it were real. `x-forwarded-for` is trusted here because Vercel's edge network overwrites it on
 * every request; behind a self-hosted reverse proxy this would need to read from a header (or trusted-proxy-chain
 * configuration) that proxy controls instead.
 */
export function extractClientIp(headers: HeaderReader): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor !== null) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first !== undefined && isIP(first) !== 0) return first;
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp !== undefined && isIP(realIp) !== 0) return realIp;
  return "127.0.0.1";
}
