import Link from "next/link";
import type { ReactElement } from "react";
import { formatPostDate, type BlogPost } from "@/lib/firstfold-blog";

export function PostCard({ post }: { readonly post: BlogPost }): ReactElement {
  const date = formatPostDate(post.publishedAt);
  return (
    <article className="card">
      <Link href={`/blog/${encodeURIComponent(post.slug)}`} className="card-link">
        {post.coverImageUrl === null ? null : (
          // A plain <img>: the cover lives on the Firstfold platform, and this keeps the test honest about whether
          // that URL is publicly reachable, rather than hiding it behind Next's image optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.coverImageUrl} alt="" className="card-cover" loading="lazy" />
        )}
        <h2>{post.title}</h2>
        {date === null ? null : <time dateTime={post.publishedAt ?? undefined}>{date}</time>}
        {post.excerpt === null ? null : <p>{post.excerpt}</p>}
      </Link>
    </article>
  );
}
