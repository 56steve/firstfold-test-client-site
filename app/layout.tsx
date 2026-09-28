import type { Metadata } from "next";
import Link from "next/link";
import { BLOG_HREF } from "@/lib/blog-path";
import type { ReactElement, ReactNode } from "react";
import { AnnouncementBar } from "@/components/announcement-bar";
import { getSiteInfo } from "@/lib/firstfold-info";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

export const metadata: Metadata = {
  // Resolves relative Open Graph and canonical URLs against this site's own address.
  metadataBase: new URL(siteUrl()),
  title: { default: "TEST 2 – Firstfold QA", template: "%s · TEST 2 – Firstfold QA" },
  description: "A test client website for checking the Firstfold blog connection. Not a real business.",
  // This repository is a TEST site, so nothing here should be indexed. Real client sites delete this line;
  // app/robots.ts and app/sitemap.ts are the template's real behaviour.
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { readonly children: ReactNode }): Promise<ReactElement> {
  const info = await getSiteInfo();

  return (
    <html lang="en">
      <body>
        <AnnouncementBar announcement={info?.announcement ?? null} />
        <header className="site-header">
          <Link href="/" className="brand">
            TEST 2 – Firstfold QA
          </Link>
          <nav aria-label="Main">
            <Link href="/">Home</Link>
            <Link href={BLOG_HREF}>Blog</Link>
            <Link href="/book">Book an appointment</Link>
          </nav>
        </header>
        <main className="site-main">{children}</main>
        <footer className="site-footer">A test client site for Firstfold. Not a real business.</footer>
      </body>
    </html>
  );
}
