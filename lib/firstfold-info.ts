import "server-only";
import { apiOrigin } from "./api-origin";
import { isSiteInfo } from "./site-info-guard";
import type { SiteInfo } from "./site-info";

/**
 * Reads this client's opening hours, closures, announcement and booking info from the Firstfold platform
 * (`GET /api/site/info`).
 *
 * Same conventions as lib/firstfold-blog.ts: the bearer token identifies the business, is read on the server only
 * (`server-only`), and responses are cached for 60 seconds to match the platform's own `max-age=60`.
 *
 * Unlike the blog, callers here only need "do we have info to show or not" — so any failure (missing token,
 * network error, non-200, or a body that doesn't match SiteInfo) is logged and reported as `null`, and it is up to
 * each page to render its own fallback.
 */

export const SITE_INFO_REVALIDATE_SECONDS = 60;

export async function getSiteInfo(): Promise<SiteInfo | null> {
  const token = process.env.FIRSTFOLD_SITE_TOKEN?.trim();
  if (token === undefined || token === "") {
    console.error("Firstfold site info: FIRSTFOLD_SITE_TOKEN is not set");
    return null;
  }

  const origin = apiOrigin();
  let response: Response;
  try {
    response = await fetch(`${origin}/api/site/info`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: SITE_INFO_REVALIDATE_SECONDS, tags: ["firstfold-site-info"] },
    });
  } catch (error) {
    console.error("Firstfold site info: network error", error);
    return null;
  }

  if (!response.ok) {
    console.error(`Firstfold site info: HTTP ${response.status}`);
    return null;
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    console.error("Firstfold site info: invalid JSON", error);
    return null;
  }

  if (!isSiteInfo(body)) {
    console.error("Firstfold site info: unexpected response shape");
    return null;
  }

  return body;
}
