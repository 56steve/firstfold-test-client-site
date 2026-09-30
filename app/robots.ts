import type { MetadataRoute } from "next";
import { PREVIEW_HREF } from "@/lib/blog-path";
import { siteUrl } from "@/lib/site-url";

/** Everything may be crawled except the draft preview page; the sitemap lists the blog. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: PREVIEW_HREF }], sitemap: `${siteUrl()}/sitemap.xml` };
}
