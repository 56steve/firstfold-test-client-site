import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement, ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "TEST 2 – Firstfold QA", template: "%s · TEST 2 – Firstfold QA" },
  description: "A test client website for checking the Firstfold blog connection. Not a real business.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { readonly children: ReactNode }): ReactElement {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            TEST 2 – Firstfold QA
          </Link>
          <nav aria-label="Main">
            <Link href="/">Home</Link>
            <Link href="/blog">Blog</Link>
          </nav>
        </header>
        <main className="site-main">{children}</main>
        <footer className="site-footer">A test client site for Firstfold. Not a real business.</footer>
      </body>
    </html>
  );
}
