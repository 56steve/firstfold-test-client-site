import type { MetadataRoute } from "next";
import { categoriesOf } from "@/lib/blog-categories";
import { blogUrl, categoryUrl, postUrl } from "@/lib/blog-schema";
import { getBlog } from "@/lib/firstfold-blog";
import { siteUrl } from "@/lib/site-url";

export const revalidate = 3600;

/** Home, the blog, each category with posts, and each article not hidden from search engines, at its own address. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteUrl();
  const pages: MetadataRoute.Sitemap = [{ url: `${origin}/` }, { url: blogUrl(origin) }];
  const blog = await getBlog();
  // The platform is unreachable or not configured: still list the pages that don't depend on it.
  if (blog.kind !== "ok") return pages;
  return [
    ...pages,
    ...categoriesOf(blog.posts).map((category) => ({ url: categoryUrl(origin, category.slug) })),
    ...blog.posts
      .filter((post) => !post.seo.noIndex)
      .map((post) => ({
        url: postUrl(origin, post),
        lastModified: post.updatedAt ?? post.publishedAt ?? undefined,
      })),
  ];
}
