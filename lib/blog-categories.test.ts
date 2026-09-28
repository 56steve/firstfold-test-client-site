import { describe, expect, it } from "vitest";
import { categoriesOf, postsInCategory, relatedPosts } from "./blog-categories";
import { testPost } from "./test-posts";

function inCategory(slug: string, name: string | null) {
  return testPost({
    slug,
    categories: name === null ? [] : [name],
    category: name === null ? null : { slug: name.toLowerCase(), name },
  });
}

const POSTS = [inCategory("a", "Recipes"), inCategory("b", "News"), inCategory("c", "Recipes"), inCategory("d", null)];

describe("categoriesOf", () => {
  it("lists each category with posts once, by name, with its count", () => {
    expect(categoriesOf(POSTS)).toEqual([
      { slug: "news", name: "News", count: 1 },
      { slug: "recipes", name: "Recipes", count: 2 },
    ]);
  });

  it("is empty when no post has a category", () => {
    expect(categoriesOf([inCategory("d", null)])).toEqual([]);
  });
});

describe("postsInCategory", () => {
  it("keeps only that category's posts, in the order given", () => {
    expect(postsInCategory(POSTS, "recipes").map((p) => p.slug)).toEqual(["a", "c"]);
  });
});

describe("relatedPosts", () => {
  it("returns other posts in the same category, up to the limit", () => {
    expect(relatedPosts(POSTS, POSTS[0]!, 3).map((p) => p.slug)).toEqual(["c"]);
    expect(relatedPosts(POSTS, POSTS[0]!, 0)).toEqual([]);
  });

  it("returns nothing for a post without a category", () => {
    expect(relatedPosts(POSTS, POSTS[3]!, 3)).toEqual([]);
  });
});
