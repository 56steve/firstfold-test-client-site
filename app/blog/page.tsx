import type { Metadata } from "next";
import type { ReactElement } from "react";
import { BlogNotice } from "@/components/blog-notice";
import { PostCard } from "@/components/post-card";
import { getBlog } from "@/lib/firstfold-blog";

export const revalidate = 60;

export const metadata: Metadata = { title: "Blog" };

export default async function BlogPage(): Promise<ReactElement> {
  const blog = await getBlog();
  return (
    <>
      <h1>Blog</h1>
      {blog.kind !== "ok" ? (
        <BlogNotice result={blog} />
      ) : blog.posts.length === 0 ? (
        <p className="notice">No posts yet.</p>
      ) : (
        <div className="grid">
          {blog.posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      )}
    </>
  );
}
