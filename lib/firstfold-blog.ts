import "server-only";

/**
 * Reads this client's published blog posts from the Firstfold platform (`GET /api/site/posts`).
 *
 * The token identifies the business, so the request never names one. It is a server-side secret: this module is
 * `server-only`, and nothing here is ever sent to the browser.
 *
 * Responses are cached for 60 seconds (Next's data cache, matching the platform's own `max-age=60`), so a post the
 * customer publishes in their dashboard appears here within about a minute, with no redeploy.
 */

/** How long a fetched list of posts is reused before the platform is asked again. */
export const BLOG_REVALIDATE_SECONDS = 60;

const DEFAULT_API_ORIGIN = "https://app.firstfold.io";

export interface BlogPost {
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string | null;
  readonly publishedAt: string | null;
  /** Already escaped by the platform, with unsafe link schemes removed, so it is rendered as-is. */
  readonly html: string;
  /** Absolute URL of the cover image, or null when the post has none. */
  readonly coverImageUrl: string | null;
  readonly categories: readonly string[];
}

export type BlogResult =
  | { readonly kind: "ok"; readonly business: string; readonly posts: readonly BlogPost[] }
  /** FIRSTFOLD_SITE_TOKEN is not set in this deployment. */
  | { readonly kind: "not-configured" }
  /** The platform refused the token: wrong, or replaced in the admin since this site was deployed. */
  | { readonly kind: "unauthorized" }
  /** The platform could not be reached or answered with something unexpected. */
  | { readonly kind: "unavailable"; readonly detail: string };

class BlogResponseShapeError extends Error {
  constructor(detail: string) {
    super(`The Firstfold blog API returned an unexpected shape: ${detail}`);
    this.name = "BlogResponseShapeError";
  }
}

function apiOrigin(): string {
  const configured = process.env.FIRSTFOLD_API_ORIGIN?.trim();
  return configured === undefined || configured === "" ? DEFAULT_API_ORIGIN : configured.replace(/\/+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string") throw new BlogResponseShapeError(`"${key}" is not a string`);
  return value;
}

function optionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new BlogResponseShapeError(`"${key}" is neither a string nor null`);
  return value;
}

/** Validates one post from the API at the boundary, rather than trusting a cast. */
function parsePost(raw: unknown, origin: string): BlogPost {
  if (!isRecord(raw)) throw new BlogResponseShapeError("a post is not an object");
  const categories = raw.categories;
  if (!Array.isArray(categories) || !categories.every((c): c is string => typeof c === "string")) {
    throw new BlogResponseShapeError('"categories" is not a list of strings');
  }
  const coverImagePath = optionalString(raw, "coverImagePath");
  return {
    slug: requireString(raw, "slug"),
    title: requireString(raw, "title"),
    excerpt: optionalString(raw, "excerpt"),
    publishedAt: optionalString(raw, "publishedAt"),
    html: requireString(raw, "html"),
    coverImageUrl: coverImagePath === null ? null : new URL(coverImagePath, origin).toString(),
    categories,
  };
}

function parseResponse(body: unknown, origin: string): { business: string; posts: BlogPost[] } {
  if (!isRecord(body)) throw new BlogResponseShapeError("the body is not an object");
  const posts = body.posts;
  if (!Array.isArray(posts)) throw new BlogResponseShapeError('"posts" is not a list');
  return { business: requireString(body, "business"), posts: posts.map((post) => parsePost(post, origin)) };
}

export async function getBlog(): Promise<BlogResult> {
  const token = process.env.FIRSTFOLD_SITE_TOKEN?.trim();
  if (token === undefined || token === "") return { kind: "not-configured" };

  const origin = apiOrigin();
  let response: Response;
  try {
    response = await fetch(`${origin}/api/site/posts`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: BLOG_REVALIDATE_SECONDS, tags: ["firstfold-blog"] },
    });
  } catch (error) {
    return { kind: "unavailable", detail: error instanceof Error ? error.message : "network error" };
  }

  if (response.status === 401) return { kind: "unauthorized" };
  if (!response.ok) return { kind: "unavailable", detail: `HTTP ${response.status}` };

  try {
    const { business, posts } = parseResponse(await response.json(), origin);
    return { kind: "ok", business, posts };
  } catch (error) {
    if (error instanceof BlogResponseShapeError || error instanceof SyntaxError) {
      return { kind: "unavailable", detail: error.message };
    }
    throw error;
  }
}

export type PreviewResult =
  | { readonly kind: "ok"; readonly post: BlogPost }
  | { readonly kind: "not-configured" }
  | { readonly kind: "unauthorized" }
  /** The link expired (30 minutes), was tampered with, or its post was deleted. */
  | { readonly kind: "expired" }
  | { readonly kind: "unavailable"; readonly detail: string };

/**
 * One draft post for the "Preview on my website" page: the preview token from the link, plus this site's own token.
 * Never cached, by Next or by anything in between: a draft changes every time the owner saves it.
 */
export async function getPreviewPost(previewToken: string): Promise<PreviewResult> {
  const token = process.env.FIRSTFOLD_SITE_TOKEN?.trim();
  if (token === undefined || token === "") return { kind: "not-configured" };

  const origin = apiOrigin();
  const url = new URL("/api/site/posts/preview", origin);
  url.searchParams.set("token", previewToken);
  let response: Response;
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  } catch (error) {
    return { kind: "unavailable", detail: error instanceof Error ? error.message : "network error" };
  }

  if (response.status === 401) return { kind: "unauthorized" };
  if (response.status === 404) return { kind: "expired" };
  if (!response.ok) return { kind: "unavailable", detail: `HTTP ${response.status}` };

  try {
    const body: unknown = await response.json();
    if (!isRecord(body)) throw new BlogResponseShapeError("the body is not an object");
    return { kind: "ok", post: parsePost(body.post, origin) };
  } catch (error) {
    if (error instanceof BlogResponseShapeError || error instanceof SyntaxError) {
      return { kind: "unavailable", detail: error.message };
    }
    throw error;
  }
}

/**
 * The post with this address. Addresses are not guaranteed unique on the platform yet (two posts with the same title
 * share one), so the newest wins: the API returns posts newest first.
 */
export function findPost(posts: readonly BlogPost[], slug: string): BlogPost | null {
  return posts.find((post) => post.slug === slug) ?? null;
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

/** "23 September 2026", in the client's own time zone rather than the server's. */
export function formatPostDate(iso: string | null): string | null {
  if (iso === null) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : DATE_FORMAT.format(date);
}
