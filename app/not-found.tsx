import Link from "next/link";
import { BLOG_HREF } from "@/lib/blog-path";
import type { ReactElement } from "react";

export default function NotFound(): ReactElement {
  return (
    <>
      <h1>Page not found</h1>
      <p className="notice">
        If this was a blog post, it may have been unpublished or deleted. <Link href={BLOG_HREF}>See all posts</Link>.
      </p>
    </>
  );
}
