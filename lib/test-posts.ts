import type { BlogPost } from "./blog-model";

/** A published post for unit tests, with every optional part empty unless overridden. */
export function testPost(overrides: Partial<BlogPost> = {}): BlogPost {
  const slug = overrides.slug ?? "post";
  return {
    slug,
    pathPrefix: "blog",
    previousSlugs: [],
    title: slug,
    excerpt: null,
    publishedAt: null,
    updatedAt: null,
    html: "",
    coverImageUrl: null,
    categories: [],
    category: null,
    author: null,
    seo: { title: overrides.title ?? slug, description: null, noIndex: false },
    ...overrides,
  };
}
