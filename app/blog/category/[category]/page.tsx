import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { BlogNotice } from "@/components/blog-notice";
import { CategoryNav } from "@/components/category-nav";
import { JsonLd } from "@/components/json-ld";
import { PostCard } from "@/components/post-card";
import { categoriesOf, postsInCategory } from "@/lib/blog-categories";
import { blogUrl, breadcrumbJsonLd, categoryUrl } from "@/lib/blog-schema";
import { getBlog } from "@/lib/firstfold-blog";
import { siteUrl } from "@/lib/site-url";

export const revalidate = 60;

// No categories are known at build time: each page renders on first request, then refreshes at most once a minute.
export function generateStaticParams(): { category: string }[] {
  return [];
}

interface CategoryPageProps {
  readonly params: Promise<{ readonly category: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const slug = decodeURIComponent((await params).category);
  const blog = await getBlog();
  const category = blog.kind === "ok" ? categoriesOf(blog.posts).find((c) => c.slug === slug) : undefined;
  if (category === undefined) return { title: "Category not found" };
  return {
    title: category.name,
    description: `Posts about ${category.name}.`,
    alternates: { canonical: categoryUrl(siteUrl(), category.slug) },
  };
}

/** One category's posts. A category with no published posts has no page: it 404s like an unknown one. */
export default async function CategoryPage({ params }: CategoryPageProps): Promise<ReactElement> {
  const slug = decodeURIComponent((await params).category);
  const blog = await getBlog();
  if (blog.kind !== "ok") {
    return (
      <>
        <h1>Blog</h1>
        <BlogNotice result={blog} />
      </>
    );
  }
  const categories = categoriesOf(blog.posts);
  const category = categories.find((c) => c.slug === slug);
  if (category === undefined) notFound();

  const origin = siteUrl();
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Blog", url: blogUrl(origin) },
          { name: category.name, url: categoryUrl(origin, category.slug) },
        ])}
      />
      <h1>{category.name}</h1>
      <CategoryNav categories={categories} current={category.slug} />
      <div className="grid">
        {postsInCategory(blog.posts, category.slug).map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </>
  );
}
