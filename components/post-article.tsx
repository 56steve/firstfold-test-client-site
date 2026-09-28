import Link from "next/link";
import type { ReactElement } from "react";
import { categoryHref } from "@/lib/blog-path";
import { formatPostDate, type BlogPost } from "@/lib/firstfold-blog";

/** A post's page body, shared by the published page and the preview so a draft looks exactly as it will. */
export function PostArticle({ post }: { readonly post: BlogPost }): ReactElement {
  const date = formatPostDate(post.publishedAt);
  const hasMeta = date !== null || post.category !== null || post.author !== null;
  return (
    <>
      <h1>{post.title}</h1>
      {hasMeta ? (
        <p className="post-meta">
          {date === null ? null : <time dateTime={post.publishedAt ?? undefined}>{date}</time>}
          {post.category === null ? null : (
            <Link href={categoryHref(post.category.slug)}>{post.category.name}</Link>
          )}
          {post.author === null ? null : <span>By {post.author.name}</span>}
        </p>
      ) : null}
      {post.coverImageUrl === null ? null : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.coverImageUrl} alt="" className="post-cover" />
      )}
      {/* The platform escapes the body and strips unsafe link schemes before sending it (lib/blog-html.ts there). */}
      <div className="post-body" dangerouslySetInnerHTML={{ __html: post.html }} />
      {post.author === null || post.author.bio === null ? null : (
        <p className="post-author-bio">
          <strong>{post.author.name}</strong> {post.author.bio}
        </p>
      )}
    </>
  );
}
