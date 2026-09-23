import Link from "next/link";
import type { ReactElement } from "react";
import { BlogNotice } from "@/components/blog-notice";
import { PostCard } from "@/components/post-card";
import { getBlog } from "@/lib/firstfold-blog";

// Rebuilt at most once a minute, so new posts appear without a redeploy. Kept literal: Next reads it at build time.
export const revalidate = 60;

const LATEST_COUNT = 3;

export default async function HomePage(): Promise<ReactElement> {
  const blog = await getBlog();
  return (
    <>
      <section className="hero">
        <h1>Good food, served simply.</h1>
        <p>This is a test client website. Its only job is to show the owner&apos;s blog, written in Firstfold.</p>
      </section>

      <section aria-labelledby="latest">
        <div className="section-head">
          <h2 id="latest">Latest from the blog</h2>
          <Link href="/blog">All posts</Link>
        </div>
        {blog.kind !== "ok" ? (
          <BlogNotice result={blog} />
        ) : blog.posts.length === 0 ? (
          <p className="notice">No posts yet.</p>
        ) : (
          <div className="grid">
            {blog.posts.slice(0, LATEST_COUNT).map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
