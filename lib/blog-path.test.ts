import { describe, expect, it } from "vitest";
import {
  articleAction,
  BLOG_HREF,
  categoryHref,
  findArticle,
  normalizePostPath,
  postHref,
  PREVIEW_HREF,
  usesPrefix,
} from "./blog-path";
import { testPost } from "./test-posts";

describe("normalizePostPath", () => {
  it("keeps a valid prefix from the platform", () => {
    expect(normalizePostPath("tips")).toBe("tips");
    expect(normalizePostPath("health-tips")).toBe("health-tips");
  });

  it("keeps the empty prefix of an article at the root of the site", () => {
    expect(normalizePostPath("")).toBe("");
  });

  it.each([undefined, null, 3, "Our News", "news/2026", "api", "category"])("falls back to blog for %s", (value) => {
    expect(normalizePostPath(value)).toBe("blog");
  });
});

describe("links", () => {
  it("keep the blog page, categories and preview under /blog", () => {
    expect(BLOG_HREF).toBe("/blog");
    expect(categoryHref("back-care")).toBe("/blog/category/back-care");
    expect(PREVIEW_HREF).toBe("/blog/preview");
  });

  it("put each article under its own prefix", () => {
    expect(postHref(testPost({ slug: "five-stretches" }))).toBe("/blog/five-stretches");
    expect(postHref(testPost({ slug: "five-stretches", pathPrefix: "tips" }))).toBe("/tips/five-stretches");
    expect(postHref(testPost({ slug: "a b" }))).toBe("/blog/a%20b");
    expect(postHref(testPost({ slug: "article-1", pathPrefix: "" }))).toBe("/article-1");
  });
});

describe("articleAction", () => {
  const post = testPost({ slug: "desk-stretches", pathPrefix: "tips" });

  it("serves an article at its own address", () => {
    expect(articleAction("tips", "desk-stretches", post)).toEqual({ kind: "serve" });
    expect(articleAction("blog", "post", testPost())).toEqual({ kind: "serve" });
  });

  it("serves an article at the root of the site", () => {
    expect(articleAction("", "article-1", testPost({ slug: "article-1", pathPrefix: "" }))).toEqual({ kind: "serve" });
    expect(articleAction("", "desk-stretches", post)).toEqual({ kind: "redirect" });
  });

  it("redirects an article reached at any other prefix or an earlier address", () => {
    expect(articleAction("blog", "desk-stretches", post)).toEqual({ kind: "redirect" });
    expect(articleAction("tips", "five-stretches", post)).toEqual({ kind: "redirect" });
  });
});

describe("findArticle", () => {
  const current = testPost({ slug: "desk-stretches", previousSlugs: ["five-stretches"] });
  const other = testPost({ slug: "monsoon-menu" });

  it("finds an article by its current address", () => {
    expect(findArticle([other, current], "desk-stretches")).toBe(current);
  });

  it("finds an article by an earlier address, so the old link can redirect", () => {
    expect(findArticle([other, current], "five-stretches")).toBe(current);
  });

  it("prefers a current address over another article's earlier one", () => {
    const reused = testPost({ slug: "five-stretches" });
    expect(findArticle([current, reused], "five-stretches")).toBe(reused);
  });

  it("finds nothing for an unknown address", () => {
    expect(findArticle([current], "nope")).toBeNull();
  });
});

describe("usesPrefix", () => {
  it("says whether any article lives under a prefix", () => {
    const posts = [testPost({ pathPrefix: "tips" }), testPost()];
    expect(usesPrefix(posts, "tips")).toBe(true);
    expect(usesPrefix(posts, "news")).toBe(false);
  });
});
