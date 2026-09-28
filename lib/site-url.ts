/**
 * This website's own public origin, for canonical links, the sitemap and schema.org data, all of which must be
 * absolute. Set SITE_URL to the real domain once it is connected; until then Vercel's production host is used, and
 * outside Vercel, localhost (development only, with a warning in a production build).
 */

const DEVELOPMENT_ORIGIN = "http://localhost:3000";

/** The origin of an http(s) URL, or null for anything else ("example.com", "ftp://…", garbage). */
function httpOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

export function siteUrl(): string {
  const configured = process.env.SITE_URL?.trim();
  if (configured) {
    const origin = httpOrigin(configured);
    if (origin !== null) return origin;
    console.warn(`SITE_URL "${configured}" is not an http(s) address, so it is ignored. Use e.g. https://www.example.com`);
  }
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  if (process.env.NODE_ENV === "production") {
    console.warn("SITE_URL is not set: canonical links, the sitemap and schema.org data will point at localhost.");
  }
  return DEVELOPMENT_ORIGIN;
}

export function absoluteUrl(path: string): string {
  return new URL(path, `${siteUrl()}/`).toString();
}
