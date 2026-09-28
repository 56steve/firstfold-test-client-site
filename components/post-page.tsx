import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { ReactElement } from "react";
import { JsonLd } from "@/components/json-ld";
import { PostArticle } from "@/components/post-article";
import { PostCard } from "@/components/post-card";
import { relatedPosts } from "@/lib/blog-categories";
import { postMetadata } from "@/lib/blog-metadata";
import type { BlogPost } from "@/lib/blog-model";
import { articleAction, BLOG_HREF, findArticle, postHref } from "@/lib/blog-path";
import { blogPostingJsonLd, blogUrl, breadcrumbJsonLd, categoryUrl, postUrl } from "@/lib/blog-schema";
import type { BlogResult } from "@/lib/firstfold-blog";
import { siteUrl } from "@/lib/site-url";

/** How many other posts from the same category are suggested under a post. */
const RELATED_POST_COUNT = 3;

type LoadedBlog = Extract<BlogResult, { kind: "ok" }>;

/** The <head> of one article, shared by /blog/<article>, /<prefix>/<article> and /<article>. */
export function postPageMetadata(blog: BlogResult, rawSlug: string): Metadata {
  const post = blog.kind === "ok" ? findArticle(blog.posts, decodeURIComponent(rawSlug)) : null;
  return blog.kind !== "ok" || post === null ? { title: "Post not found" } : postMetadata(post, siteUrl());
}

interface PostPageProps {
  readonly blog: BlogResult;
  /** The prefix the article was reached under: "blog" for app/blog/[slug], the prefix for app/[section]/[slug], ""
   * for an address at the root of the site (app/[section]). */
  readonly section: string;
  readonly rawSlug: string;
}

/**
 * One article, at its own address. An article reached any other way (another prefix, such as its old /blog address,
 * or an address it had before) redirects there permanently. 404 when the platform can't be reached or it's gone.
 */
export function PostPage({ blog, section, rawSlug }: PostPageProps): ReactElement {
  if (blog.kind !== "ok") notFound();
  const slug = decodeURIComponent(rawSlug);
  const post = findArticle(blog.posts, slug);
  if (post === null) notFound();
  if (articleAction(section, slug, post).kind === "redirect") permanentRedirect(postHref(post));
  return <PostView blog={blog} post={post} />;
}

function PostView({ blog, post }: { readonly blog: LoadedBlog; readonly post: BlogPost }): ReactElement {
  const origin = siteUrl();
  const related = relatedPosts(blog.posts, post, RELATED_POST_COUNT);
  return (
    <>
      <JsonLd
        data={[
          blogPostingJsonLd(post, { siteUrl: origin, businessName: blog.business }),
          breadcrumbJsonLd([
            { name: "Blog", url: blogUrl(origin) },
            ...(post.category === null ? [] : [{ name: post.category.name, url: categoryUrl(origin, post.category.slug) }]),
            { name: post.title, url: postUrl(origin, post) },
          ]),
        ]}
      />
      <article className="post">
        <Link href={BLOG_HREF} className="back">
          ← All posts
        </Link>
        <PostArticle post={post} />
      </article>
      {post.category === null || related.length === 0 ? null : (
        <section className="related" aria-labelledby="related-heading">
          <h2 id="related-heading">More in {post.category.name}</h2>
          <div className="grid">
            {related.map((other) => (
              <PostCard key={other.slug} post={other} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
