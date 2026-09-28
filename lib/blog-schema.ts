import type { BlogPost } from "./blog-model";
import { BLOG_HREF, categoryHref, postHref } from "./blog-path";

/**
 * schema.org data for blog pages, built automatically from each post. The customer never sees or sets any of it.
 * Every URL is absolute, because search engines ignore relative URLs in JSON-LD.
 */

export interface SchemaContext {
  /** This site's origin, no trailing slash (lib/site-url.ts). */
  readonly siteUrl: string;
  readonly businessName: string;
}

export type JsonLdObject = Readonly<Record<string, unknown>>;

/** Google shows at most this many characters of a headline. */
const MAX_HEADLINE_LENGTH = 110;

export function blogUrl(siteUrl: string): string {
  return `${siteUrl}${BLOG_HREF}`;
}

export function postUrl(siteUrl: string, post: Pick<BlogPost, "slug" | "pathPrefix">): string {
  return `${siteUrl}${postHref(post)}`;
}

export function categoryUrl(siteUrl: string, slug: string): string {
  return `${siteUrl}${categoryHref(slug)}`;
}

export function blogPostingJsonLd(post: BlogPost, { siteUrl, businessName }: SchemaContext): JsonLdObject {
  const url = postUrl(siteUrl, post);
  const publisher = { "@type": "Organization", name: businessName, url: siteUrl };
  const modified = post.updatedAt ?? post.publishedAt;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.seo.title.slice(0, MAX_HEADLINE_LENGTH),
    ...(post.seo.description === null ? {} : { description: post.seo.description }),
    url,
    mainEntityOfPage: url,
    ...(post.publishedAt === null ? {} : { datePublished: post.publishedAt }),
    ...(modified === null ? {} : { dateModified: modified }),
    // With no named author, the business itself is the author, which is what Google recommends over leaving it out.
    author: post.author === null ? publisher : { "@type": "Person", name: post.author.name },
    publisher,
    ...(post.coverImageUrl === null ? {} : { image: [post.coverImageUrl] }),
    ...(post.category === null ? {} : { articleSection: post.category.name }),
  };
}

export interface BreadcrumbItem {
  readonly name: string;
  readonly url: string;
}

export function breadcrumbJsonLd(items: readonly BreadcrumbItem[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** JSON for inside a <script> tag, with `<` escaped so customer text can never end the tag early. */
export function serializeJsonLd(data: JsonLdObject | readonly JsonLdObject[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
