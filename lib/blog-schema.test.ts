import { describe, expect, it } from "vitest";
import { blogPostingJsonLd, breadcrumbJsonLd, serializeJsonLd } from "./blog-schema";
import { testPost } from "./test-posts";

const POST = testPost({
  slug: "monsoon-menu",
  title: "Monsoon menu",
  publishedAt: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-21T00:00:00.000Z",
  coverImageUrl: "https://app.firstfold.io/content-media/4",
  categories: ["Recipes"],
  category: { slug: "recipes", name: "Recipes" },
  author: { name: "Asha", bio: null },
  seo: { title: "Monsoon menu", description: "New dishes", noIndex: false },
});
const CONTEXT = { siteUrl: "https://cafe.example", businessName: "Cafe" };

describe("blogPostingJsonLd", () => {
  it("describes the post with absolute URLs", () => {
    expect(blogPostingJsonLd(POST, CONTEXT)).toEqual({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: "Monsoon menu",
      description: "New dishes",
      url: "https://cafe.example/blog/monsoon-menu",
      mainEntityOfPage: "https://cafe.example/blog/monsoon-menu",
      datePublished: "2026-09-20T00:00:00.000Z",
      dateModified: "2026-09-21T00:00:00.000Z",
      author: { "@type": "Person", name: "Asha" },
      publisher: { "@type": "Organization", name: "Cafe", url: "https://cafe.example" },
      image: ["https://app.firstfold.io/content-media/4"],
      articleSection: "Recipes",
    });
  });

  it("credits the business when there is no author, and leaves out what the post doesn't have", () => {
    const jsonLd = blogPostingJsonLd(
      {
        ...POST,
        author: null,
        coverImageUrl: null,
        category: null,
        updatedAt: null,
        seo: { ...POST.seo, description: null },
      },
      CONTEXT,
    );
    expect(jsonLd.author).toEqual({ "@type": "Organization", name: "Cafe", url: "https://cafe.example" });
    expect(jsonLd).not.toHaveProperty("image");
    expect(jsonLd).not.toHaveProperty("articleSection");
    expect(jsonLd).not.toHaveProperty("description");
    expect(jsonLd.dateModified).toBe("2026-09-20T00:00:00.000Z");
  });

  it("has no dates at all for a post never published", () => {
    const jsonLd = blogPostingJsonLd({ ...POST, publishedAt: null, updatedAt: null }, CONTEXT);
    expect(jsonLd).not.toHaveProperty("datePublished");
    expect(jsonLd).not.toHaveProperty("dateModified");
  });
});

describe("breadcrumbJsonLd", () => {
  it("numbers the trail from 1", () => {
    expect(
      breadcrumbJsonLd([
        { name: "Blog", url: "https://cafe.example/blog" },
        { name: "Recipes", url: "https://cafe.example/blog/category/recipes" },
      ]),
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Blog", item: "https://cafe.example/blog" },
        { "@type": "ListItem", position: 2, name: "Recipes", item: "https://cafe.example/blog/category/recipes" },
      ],
    });
  });
});

describe("serializeJsonLd", () => {
  it("escapes < so text in a post can never close the script tag", () => {
    expect(serializeJsonLd({ headline: "</script><b>" })).toBe('{"headline":"\\u003c/script>\\u003cb>"}');
  });
});

describe("when the business moved its articles", () => {
  it("puts the article under the chosen path", () => {
    expect(blogPostingJsonLd({ ...POST, pathPrefix: "tips" }, CONTEXT).url).toBe("https://cafe.example/tips/monsoon-menu");
  });
});
