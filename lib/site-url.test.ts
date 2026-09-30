import { afterEach, describe, expect, it, vi } from "vitest";
import { absoluteUrl, siteUrl } from "./site-url";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("siteUrl", () => {
  it("uses SITE_URL without a trailing slash", () => {
    vi.stubEnv("SITE_URL", "https://cafe.example/");
    expect(siteUrl()).toBe("https://cafe.example");
  });

  it("falls back to Vercel's production host", () => {
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "cafe.vercel.app");
    expect(siteUrl()).toBe("https://cafe.vercel.app");
  });

  it("ignores a SITE_URL that is not an http(s) address", () => {
    vi.stubEnv("SITE_URL", "example.com");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "cafe.vercel.app");
    expect(siteUrl()).toBe("https://cafe.vercel.app");
  });

  it("keeps only the origin of a SITE_URL with a path", () => {
    vi.stubEnv("SITE_URL", "https://cafe.example/blog");
    expect(siteUrl()).toBe("https://cafe.example");
  });

  it("falls back to localhost in development", () => {
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(siteUrl()).toBe("http://localhost:3000");
  });
});

describe("absoluteUrl", () => {
  it("joins a path onto the site's origin", () => {
    vi.stubEnv("SITE_URL", "https://cafe.example");
    expect(absoluteUrl("/blog")).toBe("https://cafe.example/blog");
  });
});
