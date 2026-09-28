import Link from "next/link";
import type { ReactElement } from "react";
import type { CategorySummary } from "@/lib/blog-categories";
import { BLOG_HREF, categoryHref } from "@/lib/blog-path";

interface CategoryNavProps {
  readonly categories: readonly CategorySummary[];
  /** The category page being shown, or null on the all-posts page. */
  readonly current: string | null;
}

/** "All · News · Recipes": real links rather than a client-side filter, so every category page can be crawled. */
export function CategoryNav({ categories, current }: CategoryNavProps): ReactElement | null {
  if (categories.length === 0) return null;
  return (
    <nav aria-label="Blog categories" className="category-nav">
      <Link href={BLOG_HREF} aria-current={current === null ? "page" : undefined}>
        All
      </Link>
      {categories.map((category) => (
        <Link
          key={category.slug}
          href={categoryHref(category.slug)}
          aria-current={current === category.slug ? "page" : undefined}
        >
          {category.name}
        </Link>
      ))}
    </nav>
  );
}
