import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { findPost, formatPostDate, getBlog } from "@/lib/firstfold-blog";

export const revalidate = 60;

// No posts are known at build time: each is rendered on first request, then refreshed at most once a minute.
// An unpublished or deleted post drops out of the list and so becomes a 404 on the next refresh.
export function generateStaticParams(): { slug: string }[] {
  return [];
}

interface PostPageProps {
  readonly params: Promise<{ readonly slug: string }>;
}

async function loadPost(slug: string) {
  const blog = await getBlog();
  return blog.kind === "ok" ? findPost(blog.posts, decodeURIComponent(slug)) : null;
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const post = await loadPost((await params).slug);
  return post === null ? { title: "Post not found" } : { title: post.title, description: post.excerpt ?? undefined };
}

export default async function PostPage({ params }: PostPageProps): Promise<ReactElement> {
  const post = await loadPost((await params).slug);
  if (post === null) notFound();

  const date = formatPostDate(post.publishedAt);
  return (
    <article className="post">
      <Link href="/blog" className="back">
        ← All posts
      </Link>
      <h1>{post.title}</h1>
      {date === null ? null : <time dateTime={post.publishedAt ?? undefined}>{date}</time>}
      {post.coverImageUrl === null ? null : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.coverImageUrl} alt="" className="post-cover" />
      )}
      {/* The platform escapes the body and strips unsafe link schemes before sending it (lib/blog-html.ts there). */}
      <div className="post-body" dangerouslySetInnerHTML={{ __html: post.html }} />
    </article>
  );
}
