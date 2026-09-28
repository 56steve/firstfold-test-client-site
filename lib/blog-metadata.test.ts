import { describe, expect, it } from "vitest";
import { postMetadata } from "./blog-metadata";
import { testPost } from "./test-posts";

const POST = testPost({
  slug: "monsoon-menu",
  title: "Monsoon menu",
  publishedAt: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-21T00:00:00.000Z",
  coverImageUrl: "https://app.firstfold.io/content-media/4",
  category: { slug: "recipes", name: "Recipes" },
  author: { name: "Asha", bio: null },
  seo: { title: "Monsoon menu 2026", description: "New dishes", noIndex: false },
});

describe("postMetadata", () => {
  it("uses the search title and description, a canonical URL and article Open Graph tags", () => {
    const metadata = postMetadata(POST, "https://cafe.example");
    expect(metadata).toMatchObject({
      title: "Monsoon menu 2026",
      description: "New dishes",
      alternates: { canonical: "https://cafe.example/blog/monsoon-menu" },
      openGraph: {
        type: "article",
        url: "https://cafe.example/blog/monsoon-menu",
        publishedTime: "2026-09-20T00:00:00.000Z",
        modifiedTime: "2026-09-21T00:00:00.000Z",
        authors: ["Asha"],
        section: "Recipes",
        images: ["https://app.firstfold.io/content-media/4"],
      },
      twitter: { card: "summary_large_image" },
    });
    expect(metadata.robots).toBeUndefined();
  });

  it("asks search engines not to index a hidden post, but still to follow its links", () => {
    const hidden = { ...POST, seo: { ...POST.seo, noIndex: true } };
    expect(postMetadata(hidden, "https://cafe.example").robots).toEqual({ index: false, follow: true });
  });

  it("uses a small card when there is no image", () => {
    expect(postMetadata({ ...POST, coverImageUrl: null }, "https://cafe.example").twitter).toEqual({
      card: "summary",
    });
  });
});

it("puts the canonical address under the business's chosen path", () => {
  expect(postMetadata({ ...POST, pathPrefix: "tips" }, "https://cafe.example").alternates).toEqual({
    canonical: "https://cafe.example/tips/monsoon-menu",
  });
});
