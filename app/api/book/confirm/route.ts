import { NextResponse } from "next/server";
import { apiOrigin } from "@/lib/api-origin";
import { buildUpstreamRequest, GENERIC_FAILURE_RESPONSE, interpretUpstreamResponse, whitelistConfirmFields } from "@/lib/confirm-forward";
import {
  extractClientIp,
  INVALID_BODY_RESPONSE,
  InvalidBookingBodyError,
  isBodyReadFailure,
  isCrossOriginRequest,
  readBodyWithinLimit,
  UPSTREAM_TIMEOUT_MS,
} from "@/lib/request-guard";
import type { ConfirmFields } from "@/lib/confirm-forward";

/**
 * Forwards the second step of booking — the OTP code the patient was sent — from this site's own booking panel to
 * the Firstfold platform (`POST /api/site/bookings/confirm`), attaching the bearer token server-side so it is
 * never sent to the browser. On success the slot is booked.
 *
 * The request/response shapes live in lib/site-bookings.ts; the parts that don't touch Next's Request/Response —
 * sizing, field whitelisting, and interpreting the platform's reply — live in lib/confirm-forward.ts and
 * lib/request-guard.ts (the latter shared with app/api/book/otp/route.ts), where they are unit tested. This route
 * itself is tested in route.test.ts, with `fetch` mocked for the call to the platform.
 *
 * No OPTIONS handler: this route is only ever called from this site's own client component, same-origin, so there
 * is nothing to preflight — adding CORS support here would only widen who can call it.
 */
export async function POST(request: Request): Promise<Response> {
  if (isCrossOriginRequest(request)) {
    return NextResponse.json(INVALID_BODY_RESPONSE, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return NextResponse.json(INVALID_BODY_RESPONSE, { status: 415, headers: { "Cache-Control": "no-store" } });
  }

  const rawBody = await readBodyWithinLimit(request);
  if (isBodyReadFailure(rawBody)) {
    return NextResponse.json(INVALID_BODY_RESPONSE, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(INVALID_BODY_RESPONSE, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  let fields: ConfirmFields;
  try {
    fields = whitelistConfirmFields(parsedBody);
  } catch (error) {
    if (error instanceof InvalidBookingBodyError) {
      return NextResponse.json(INVALID_BODY_RESPONSE, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    throw error;
  }

  const token = process.env.FIRSTFOLD_SITE_TOKEN?.trim();
  if (token === undefined || token === "") {
    console.error("Firstfold booking confirm: FIRSTFOLD_SITE_TOKEN is not set");
    return NextResponse.json(GENERIC_FAILURE_RESPONSE, { status: 502, headers: { "Cache-Control": "no-store" } });
  }

  const clientIp = extractClientIp(request.headers);
  const upstreamRequest = buildUpstreamRequest(fields, clientIp);

  let upstreamStatus: number;
  let upstreamBody: unknown;
  try {
    const upstreamResponse = await fetch(`${apiOrigin()}/api/site/bookings/confirm`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(upstreamRequest),
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    upstreamStatus = upstreamResponse.status;
    try {
      upstreamBody = await upstreamResponse.json();
    } catch (error) {
      console.error("Firstfold booking confirm: platform returned a non-JSON response", error);
      return NextResponse.json(GENERIC_FAILURE_RESPONSE, { status: 502, headers: { "Cache-Control": "no-store" } });
    }
  } catch (error) {
    console.error("Firstfold booking confirm: network error reaching the platform", error);
    return NextResponse.json(GENERIC_FAILURE_RESPONSE, { status: 502, headers: { "Cache-Control": "no-store" } });
  }

  const relayed = interpretUpstreamResponse(upstreamStatus, upstreamBody);
  if (relayed.status === 502) {
    console.error(`Firstfold booking confirm: platform answered ${upstreamStatus} with an unexpected body`, upstreamBody);
  }
  return NextResponse.json(relayed.body, { status: relayed.status, headers: { "Cache-Control": "no-store" } });
}
