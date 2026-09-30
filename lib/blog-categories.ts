import type { BlogPost } from "./blog-model";

export interface CategorySummary {
  readonly slug: string;
  readonly name: string;
  readonly count: number;
}

/**
 * The categories that have at least one published post, by name. Derived from the posts themselves, so an empty
 * category never gets a filter chip, a page or a sitemap entry.
 */
export function categoriesOf(posts: readonly BlogPost[]): readonly CategorySummary[] {
  const bySlug = new Map<string, CategorySummary>();
  for (const { category } of posts) {
    if (category === null) continue;
    const seen = bySlug.get(category.slug);
    bySlug.set(category.slug, { slug: category.slug, name: category.name, count: (seen?.count ?? 0) + 1 });
  }
  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function postsInCategory(posts: readonly BlogPost[], slug: string): readonly BlogPost[] {
  return posts.filter((post) => post.category?.slug === slug);
}

/** Other posts in the same category, newest first (the API already orders posts that way). */
export function relatedPosts(posts: readonly BlogPost[], current: BlogPost, limit: number): readonly BlogPost[] {
  if (current.category === null) return [];
  return postsInCategory(posts, current.category.slug)
    .filter((post) => post.slug !== current.slug)
    .slice(0, limit);
}
