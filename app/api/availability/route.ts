import { NextResponse } from "next/server";
import { apiOrigin } from "@/lib/api-origin";
import {
  buildUpstreamPath,
  GENERIC_FAILURE_RESPONSE,
  interpretUpstreamResponse,
  isValidWeekParam,
  practitionerParam,
} from "@/lib/availability-forward";
import { INVALID_BODY_RESPONSE, UPSTREAM_TIMEOUT_MS } from "@/lib/request-guard";

/**
 * Forwards a week's availability request from the /book page's grid to the Firstfold platform
 * (`GET /api/site/availability`), attaching the bearer token server-side so it is never sent to the browser.
 *
 * The request/response shapes live in lib/site-bookings.ts; the parts that don't touch Next's Request/Response —
 * validating `week`, building the upstream path, and interpreting the platform's reply — live in
 * lib/availability-forward.ts, where they are unit tested. This route itself is tested in route.test.ts, with
 * `fetch` mocked for the call to the platform.
 *
 * No POST/OPTIONS handler: this is a read-only forward, and CORS is neither needed (same-origin only) nor granted.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const week = searchParams.get("week");
  if (week !== null && !isValidWeekParam(week)) {
    return NextResponse.json(INVALID_BODY_RESPONSE, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  // A non-uuid practitioner is dropped (any doctor), not rejected — see practitionerParam.
  const practitioner = practitionerParam(searchParams.get("practitioner"));

  const token = process.env.FIRSTFOLD_SITE_TOKEN?.trim();
  if (token === undefined || token === "") {
    console.error("Firstfold availability: FIRSTFOLD_SITE_TOKEN is not set");
    return NextResponse.json(GENERIC_FAILURE_RESPONSE, { status: 502, headers: { "Cache-Control": "no-store" } });
  }

  let upstreamStatus: number;
  let upstreamBody: unknown;
  try {
    const upstreamResponse = await fetch(`${apiOrigin()}${buildUpstreamPath(week, practitioner)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    upstreamStatus = upstreamResponse.status;
    try {
      upstreamBody = await upstreamResponse.json();
    } catch (error) {
      console.error("Firstfold availability: platform returned a non-JSON response", error);
      return NextResponse.json(GENERIC_FAILURE_RESPONSE, { status: 502, headers: { "Cache-Control": "no-store" } });
    }
  } catch (error) {
    console.error("Firstfold availability: network error reaching the platform", error);
    return NextResponse.json(GENERIC_FAILURE_RESPONSE, { status: 502, headers: { "Cache-Control": "no-store" } });
  }

  const relayed = interpretUpstreamResponse(upstreamStatus, upstreamBody);
  if (relayed.status === 502) {
    console.error(`Firstfold availability: platform answered ${upstreamStatus} with an unexpected body`, upstreamBody);
  }
  return NextResponse.json(relayed.body, { status: relayed.status, headers: { "Cache-Control": "no-store" } });
}
