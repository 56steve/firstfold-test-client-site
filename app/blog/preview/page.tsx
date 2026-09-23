import type { Metadata } from "next";
import type { ReactElement } from "react";
import { PostArticle } from "@/components/post-article";
import { getPreviewPost, type PreviewResult } from "@/lib/firstfold-blog";

// A draft is read fresh on every visit: never built ahead, never cached.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };

interface PreviewPageProps {
  readonly searchParams: Promise<{ readonly token?: string | string[] }>;
}

function Problem({ result }: { readonly result: Exclude<PreviewResult, { kind: "ok" }> }): ReactElement {
  const message = {
    "not-configured": "Previews need this site's blog token. Add FIRSTFOLD_SITE_TOKEN in Vercel and redeploy.",
    unauthorized: "Firstfold refused this site's blog token, so the preview can't load.",
    expired: "This preview link has expired or is no longer valid. Go back to your Firstfold dashboard and open the preview again.",
    unavailable: "The preview could not be loaded right now. Try again shortly.",
  }[result.kind];
  return (
    <>
      <h1>Preview</h1>
      <p className="notice">{message}</p>
    </>
  );
}

/**
 * "Preview on my website": the Firstfold dashboard sends the owner here with a 30-minute token for one post. The post
 * renders with the same component as the published page, under a banner that says it isn't live.
 */
export default async function PreviewPage({ searchParams }: PreviewPageProps): Promise<ReactElement> {
  const { token } = await searchParams;
  const result = typeof token === "string" && token !== "" ? await getPreviewPost(token) : ({ kind: "expired" } as const);
  if (result.kind !== "ok") return <Problem result={result} />;

  return (
    <article className="post">
      <p className="preview-banner" role="status">
        Preview: this is how your post will look. It isn&apos;t published yet, and only people with this link can see it.
      </p>
      <PostArticle post={result.post} />
    </article>
  );
}
