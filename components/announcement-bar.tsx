import type { ReactElement } from "react";
import type { SiteInfo } from "@/lib/site-info";

/** A slim bar at the very top of every page, showing the business's one-line announcement. Nothing when null. */
export function AnnouncementBar({
  announcement,
}: {
  readonly announcement: SiteInfo["announcement"];
}): ReactElement | null {
  if (announcement === null) return null;
  return (
    <aside className="announcement-bar" aria-label="Announcement">
      {announcement.message}
    </aside>
  );
}
