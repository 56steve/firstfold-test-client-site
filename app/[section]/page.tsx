import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { ReactElement } from "react";
import { PostPage, postPageMetadata } from "@/components/post-page";
import { findArticle, usesPrefix } from "@/lib/blog-path";
import { getBlog } from "@/lib/firstfold-blog";

export const revalidate = 60;

// No articles are known at build time: each is rendered on first request, then refreshed at most once a minute.
export function generateStaticParams(): { section: string }[] {
  return [];
}

interface RootAddressPageProps {
  readonly params: Promise<{ readonly section: string }>;
}

export async function generateMetadata({ params }: RootAddressPageProps): Promise<Metadata> {
  const [{ section }, blog] = await Promise.all([params, getBlog()]);
  return postPageMetadata(blog, section);
}

/**
 * /<one word>. The site's own pages (/, /blog) are static routes and never reach here. Otherwise it is:
 * - an article at the root of the site (its Web address has no "/"), or any article reached by one of its addresses,
 *   which redirects to where it lives now;
 * - a prefix on its own, e.g. /tips when articles live at /tips/<article>: sent to the blog page (temporarily, since
 *   prefixes change);
 * - anything else: 404.
 */
export default async function RootAddressPage({ params }: RootAddressPageProps): Promise<ReactElement> {
  const [{ section }, blog] = await Promise.all([params, getBlog()]);
  if (blog.kind !== "ok") notFound();
  const slug = decodeURIComponent(section);
  if (findArticle(blog.posts, slug) !== null) return <PostPage blog={blog} section="" rawSlug={section} />;
  if (usesPrefix(blog.posts, slug)) redirect("/blog");
  notFound();
}
