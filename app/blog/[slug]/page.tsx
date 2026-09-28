import type { Metadata } from "next";
import type { ReactElement } from "react";
import { PostPage, postPageMetadata } from "@/components/post-page";
import { DEFAULT_POST_PATH } from "@/lib/blog-path";
import { getBlog } from "@/lib/firstfold-blog";

export const revalidate = 60;

// No posts are known at build time: each is rendered on first request, then refreshed at most once a minute.
export function generateStaticParams(): { slug: string }[] {
  return [];
}

interface BlogPostPageProps {
  readonly params: Promise<{ readonly slug: string }>;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const [{ slug }, blog] = await Promise.all([params, getBlog()]);
  return postPageMetadata(blog, slug);
}

/** /blog/<article>: the article when its prefix is "blog" (the default), otherwise a redirect to its own address. */
export default async function BlogPostPage({ params }: BlogPostPageProps): Promise<ReactElement> {
  const [{ slug }, blog] = await Promise.all([params, getBlog()]);
  return <PostPage blog={blog} section={DEFAULT_POST_PATH} rawSlug={slug} />;
}
