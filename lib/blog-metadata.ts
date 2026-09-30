import type { Metadata } from "next";
import type { BlogPost } from "./blog-model";
import { postUrl } from "./blog-schema";

/**
 * A post page's <head>: the search title and description (defaults already applied by the platform), its canonical
 * address, Open Graph article tags for link previews, and noindex when the customer hid the post from search.
 */
export function postMetadata(post: BlogPost, siteUrl: string): Metadata {
  const url = postUrl(siteUrl, post);
  const images = post.coverImageUrl === null ? undefined : [post.coverImageUrl];
  const description = post.seo.description ?? undefined;
  return {
    title: post.seo.title,
    description,
    alternates: { canonical: url },
    ...(post.seo.noIndex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: "article",
      url,
      title: post.seo.title,
      description,
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt ?? undefined,
      authors: post.author === null ? undefined : [post.author.name],
      section: post.category?.name,
      images,
    },
    twitter: { card: images === undefined ? "summary" : "summary_large_image" },
  };
}
