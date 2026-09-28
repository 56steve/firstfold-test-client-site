import type { Metadata } from "next";
import type { ReactElement } from "react";
import { PostPage, postPageMetadata } from "@/components/post-page";
import { getBlog } from "@/lib/firstfold-blog";

export const revalidate = 60;

// No articles are known at build time: each is rendered on first request, then refreshed at most once a minute.
export function generateStaticParams(): { section: string; slug: string }[] {
  return [];
}

interface PrefixedPostPageProps {
  readonly params: Promise<{ readonly section: string; readonly slug: string }>;
}

export async function generateMetadata({ params }: PrefixedPostPageProps): Promise<Metadata> {
  const [{ slug }, blog] = await Promise.all([params, getBlog()]);
  return postPageMetadata(blog, slug);
}

/** /<prefix>/<article> for an article given its own prefix in the post editor. Unknown articles are a 404. */
export default async function PrefixedPostPage({ params }: PrefixedPostPageProps): Promise<ReactElement> {
  const [{ section, slug }, blog] = await Promise.all([params, getBlog()]);
  return <PostPage blog={blog} section={section} rawSlug={slug} />;
}
