import type { ReactElement } from "react";
import { serializeJsonLd, type JsonLdObject } from "@/lib/blog-schema";

/** schema.org data for search engines. serializeJsonLd escapes "<", so nothing in a post can break out of the tag. */
export function JsonLd({ data }: { readonly data: JsonLdObject | readonly JsonLdObject[] }): ReactElement {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
