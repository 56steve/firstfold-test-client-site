import type { BlogPost } from "./blog-model";

/**
 * Addresses on this site's blog. The blog page is always /blog, and categories /blog/category/<name>. Each article
 * lives wherever its Firstfold post editor's "Web address" puts it: /<prefix>/<article> ("blog" by default), or
 * /<article> at the root of the site when the prefix is empty. The platform sends both with each post, so a change
 * reaches this site within a minute, with no redeploy.
 *
 * An article reached under any other prefix, such as its old /blog address, redirects permanently to its own, so a
 * changed prefix never breaks a link.
 */

export const DEFAULT_POST_PATH = "blog";
export const BLOG_HREF = "/blog";
/** The draft preview page. The platform's "Preview on my website" links here. */
export const PREVIEW_HREF = "/blog/preview";

/** The platform's rule (apps/platform/lib/post-path.ts there), re-checked here rather than trusted. */
const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_LENGTH = 40;
const RESERVED: ReadonlySet<string> = new Set(["api", "category", "preview", "sitemap", "robots"]);

/** The prefix the platform sent ("" for the root), or the default when it sent none or something unusable. */
export function normalizePostPath(value: unknown): string {
  if (value === "") return "";
  if (typeof value !== "string" || value.length > MAX_LENGTH) return DEFAULT_POST_PATH;
  return SEGMENT.test(value) && !RESERVED.has(value) ? value : DEFAULT_POST_PATH;
}

export function postHref(post: Pick<BlogPost, "slug" | "pathPrefix">): string {
  const slug = encodeURIComponent(post.slug);
  return post.pathPrefix === "" ? `/${slug}` : `/${post.pathPrefix}/${slug}`;
}

export function categoryHref(slug: string): string {
  return `${BLOG_HREF}/category/${encodeURIComponent(slug)}`;
}

export type ArticleAction = { readonly kind: "serve" } | { readonly kind: "redirect" };

/**
 * What /<section>/<slug> does for an article that exists: serve it at its own address, and redirect every other one
 * (another prefix, or an address the article had before) there.
 */
export function articleAction(section: string, slug: string, post: Pick<BlogPost, "pathPrefix" | "slug">): ArticleAction {
  return section === post.pathPrefix && slug === post.slug ? { kind: "serve" } : { kind: "redirect" };
}

/**
 * The article at `slug`: the one whose address it is now, or else the one that had it before (whose page then
 * redirects). Current addresses win, so an address reused by a newer article reaches that article.
 */
export function findArticle(posts: readonly BlogPost[], slug: string): BlogPost | null {
  return posts.find((post) => post.slug === slug) ?? posts.find((post) => post.previousSlugs.includes(slug)) ?? null;
}

/** Whether any article lives under `prefix`, so /<prefix> on its own (when no article has that address) can send
 * people to the blog page. */
export function usesPrefix(posts: readonly Pick<BlogPost, "pathPrefix">[], prefix: string): boolean {
  return posts.some((post) => post.pathPrefix === prefix);
}
