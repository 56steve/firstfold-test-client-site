/**
 * The blog post shape this site reads from the Firstfold platform, and the validation that turns the API's JSON into
 * it. Pure (no fetching, no `server-only`), so it is unit-tested; lib/firstfold-blog.ts does the fetching.
 *
 * Fields added to the API later (category, author, seo, updatedAt) are optional here: this site must keep working
 * against a platform that does not send them yet. Anything present but malformed is still refused.
 */

import { normalizePostPath } from "./blog-path";

export interface BlogCategory {
  readonly slug: string;
  readonly name: string;
}

export interface BlogAuthor {
  readonly name: string;
  readonly bio: string | null;
}

/** Search title and description, with the platform's defaults already applied. */
export interface BlogSeo {
  readonly title: string;
  readonly description: string | null;
  readonly noIndex: boolean;
}

export interface BlogPost {
  readonly slug: string;
  /** The first part of the article's address: "blog" → /blog/<slug>. Chosen per article (lib/blog-path.ts). */
  readonly pathPrefix: string;
  /** Addresses the article had before; each redirects to the current one. */
  readonly previousSlugs: readonly string[];
  readonly title: string;
  readonly excerpt: string | null;
  readonly publishedAt: string | null;
  readonly updatedAt: string | null;
  /** Already escaped by the platform, with unsafe link schemes removed, so it is rendered as-is. */
  readonly html: string;
  /** Absolute URL of the cover image, or null when the post has none. */
  readonly coverImageUrl: string | null;
  readonly categories: readonly string[];
  readonly category: BlogCategory | null;
  readonly author: BlogAuthor | null;
  readonly seo: BlogSeo;
}

export class BlogResponseShapeError extends Error {
  constructor(detail: string) {
    super(`The Firstfold blog API returned an unexpected shape: ${detail}`);
    this.name = "BlogResponseShapeError";
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function requireString(record: Record<string, unknown>, key: string): string {
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

/** `record[key]` read by `read`, or null when absent or null. An object of the wrong shape throws. */
function optionalObject<T>(
  record: Record<string, unknown>,
  key: string,
  read: (value: Record<string, unknown>) => T,
): T | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) throw new BlogResponseShapeError(`"${key}" is not an object`);
  return read(value);
}

function readSeo(value: Record<string, unknown>): BlogSeo {
  if (typeof value.noIndex !== "boolean") throw new BlogResponseShapeError('"seo.noIndex" is not a boolean');
  return {
    title: requireString(value, "title"),
    description: optionalString(value, "description"),
    noIndex: value.noIndex,
  };
}

/** Validates one post from the API at the boundary, rather than trusting a cast. */
export function parsePost(raw: unknown, origin: string): BlogPost {
  if (!isRecord(raw)) throw new BlogResponseShapeError("a post is not an object");
  const categories = raw.categories;
  if (!Array.isArray(categories) || !categories.every((c): c is string => typeof c === "string")) {
    throw new BlogResponseShapeError('"categories" is not a list of strings');
  }
  const title = requireString(raw, "title");
  const excerpt = optionalString(raw, "excerpt");
  const coverImagePath = optionalString(raw, "coverImagePath");
  return {
    slug: requireString(raw, "slug"),
    // Older platforms don't send it; the article then stays at /blog/<slug>.
    pathPrefix: normalizePostPath(raw.pathPrefix),
    previousSlugs: Array.isArray(raw.previousSlugs)
      ? raw.previousSlugs.filter((slug): slug is string => typeof slug === "string")
      : [],
    title,
    excerpt,
    publishedAt: optionalString(raw, "publishedAt"),
    updatedAt: optionalString(raw, "updatedAt"),
    html: requireString(raw, "html"),
    coverImageUrl: coverImagePath === null ? null : new URL(coverImagePath, origin).toString(),
    categories,
    category: optionalObject(raw, "category", (c) => ({
      slug: requireString(c, "slug"),
      name: requireString(c, "name"),
    })),
    author: optionalObject(raw, "author", (a) => ({ name: requireString(a, "name"), bio: optionalString(a, "bio") })),
    seo: optionalObject(raw, "seo", readSeo) ?? { title, description: excerpt, noIndex: false },
  };
}
