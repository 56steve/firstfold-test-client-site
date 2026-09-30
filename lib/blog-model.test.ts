import { describe, expect, it } from "vitest";
import { BlogResponseShapeError, parsePost } from "./blog-model";

const ORIGIN = "https://app.firstfold.io";

/** What the platform sent before categories, authors and search settings existed. */
const OLD_SHAPE = {
  slug: "monsoon-menu",
  title: "Monsoon menu",
  excerpt: "New dishes",
  publishedAt: null,
  html: "<p>x</p>",
  coverImagePath: null,
  categories: [],
};

describe("parsePost", () => {
  it("accepts the older API shape, filling in defaults", () => {
    expect(parsePost(OLD_SHAPE, ORIGIN)).toMatchObject({
      category: null,
      author: null,
      updatedAt: null,
      seo: { title: "Monsoon menu", description: "New dishes", noIndex: false },
    });
  });

  it("reads category, author, search settings and updatedAt", () => {
    const post = parsePost(
      {
        ...OLD_SHAPE,
        categories: ["Recipes"],
        category: { slug: "recipes", name: "Recipes" },
        author: { name: "Asha", bio: null },
        seo: { title: "Monsoon menu 2026", description: "D", noIndex: true },
        updatedAt: "2026-09-24T00:00:00.000Z",
      },
      ORIGIN,
    );
    expect(post).toMatchObject({
      category: { slug: "recipes", name: "Recipes" },
      author: { name: "Asha", bio: null },
      seo: { title: "Monsoon menu 2026", description: "D", noIndex: true },
      updatedAt: "2026-09-24T00:00:00.000Z",
    });
  });

  it("reads each article's address prefix, defaulting to blog", () => {
    expect(parsePost(OLD_SHAPE, ORIGIN).pathPrefix).toBe("blog");
    expect(parsePost({ ...OLD_SHAPE, pathPrefix: "tips" }, ORIGIN).pathPrefix).toBe("tips");
    expect(parsePost({ ...OLD_SHAPE, pathPrefix: "API!" }, ORIGIN).pathPrefix).toBe("blog");
  });

  it("reads the article's earlier addresses, defaulting to none", () => {
    expect(parsePost(OLD_SHAPE, ORIGIN).previousSlugs).toEqual([]);
    expect(parsePost({ ...OLD_SHAPE, previousSlugs: ["old", 3] }, ORIGIN).previousSlugs).toEqual(["old"]);
  });

  it("makes the cover image path absolute on the platform", () => {
    expect(parsePost({ ...OLD_SHAPE, coverImagePath: "/content-media/4" }, ORIGIN).coverImageUrl).toBe(
      "https://app.firstfold.io/content-media/4",
    );
  });

  it("rejects a malformed category or search settings rather than guessing", () => {
    expect(() => parsePost({ ...OLD_SHAPE, category: { slug: 3, name: "X" } }, ORIGIN)).toThrow(BlogResponseShapeError);
    expect(() => parsePost({ ...OLD_SHAPE, seo: { title: "T", description: null } }, ORIGIN)).toThrow(
      BlogResponseShapeError,
    );
  });
});
