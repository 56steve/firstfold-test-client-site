import type { ReactElement } from "react";
import { formatPostDate, type BlogPost } from "@/lib/firstfold-blog";

/** A post's page body, shared by the published page and the preview so a draft looks exactly as it will. */
export function PostArticle({ post }: { readonly post: BlogPost }): ReactElement {
  const date = formatPostDate(post.publishedAt);
  return (
    <>
      <h1>{post.title}</h1>
      {date === null ? null : <time dateTime={post.publishedAt ?? undefined}>{date}</time>}
      {post.coverImageUrl === null ? null : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.coverImageUrl} alt="" className="post-cover" />
      )}
      {/* The platform escapes the body and strips unsafe link schemes before sending it (lib/blog-html.ts there). */}
      <div className="post-body" dangerouslySetInnerHTML={{ __html: post.html }} />
    </>
  );
}
