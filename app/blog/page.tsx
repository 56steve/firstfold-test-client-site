import type { Metadata } from "next";
import type { ReactElement } from "react";
import { BlogNotice } from "@/components/blog-notice";
import { CategoryNav } from "@/components/category-nav";
import { PostCard } from "@/components/post-card";
import { categoriesOf } from "@/lib/blog-categories";
import { blogUrl } from "@/lib/blog-schema";
import { getBlog } from "@/lib/firstfold-blog";
import { siteUrl } from "@/lib/site-url";

export const revalidate = 60;

export function generateMetadata(): Metadata {
  return { title: "Blog", alternates: { canonical: blogUrl(siteUrl()) } };
}

/** Every post, with category chips. Always at /blog; each post links to wherever the business keeps its articles. */
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
        <>
          <CategoryNav categories={categoriesOf(blog.posts)} current={null} />
          <div className="grid">
            {blog.posts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
