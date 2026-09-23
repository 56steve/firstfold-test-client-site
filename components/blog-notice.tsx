import type { ReactElement } from "react";
import type { BlogResult } from "@/lib/firstfold-blog";

/**
 * What the blog shows when it has no posts to list. Spelled out per cause, because this is a test site whose job is
 * to show whether the Firstfold connection works; a real client site would show a quieter "No posts yet".
 */
export function BlogNotice({ result }: { readonly result: Exclude<BlogResult, { kind: "ok" }> }): ReactElement {
  switch (result.kind) {
    case "not-configured":
      return (
        <p className="notice">
          The blog is not connected yet. Add <code>FIRSTFOLD_SITE_TOKEN</code> in the Vercel project&apos;s environment
          variables and redeploy.
        </p>
      );
    case "unauthorized":
      return (
        <p className="notice">
          Firstfold refused this site&apos;s blog token. It may have been replaced in the admin: paste the new one into
          Vercel and redeploy.
        </p>
      );
    case "unavailable":
      return <p className="notice">The blog could not be loaded right now ({result.detail}). Try again shortly.</p>;
  }
}
