import type { ReactElement } from "react";
import { formatClosure, formatWeek } from "@/lib/hours-format";
import type { SiteInfo } from "@/lib/site-info";

/** The week Monday through Sunday, plus a "Closures" list of current and upcoming closures. */
export function OpeningHours({
  hours,
  closures,
}: {
  readonly hours: SiteInfo["hours"];
  readonly closures: SiteInfo["closures"];
}): ReactElement {
  const week = formatWeek(hours);
  return (
    <section aria-labelledby="hours-heading" className="hours">
      <h2 id="hours-heading">Opening hours</h2>
      <dl className="hours-list">
        {week.map((day) => (
          <div className="hours-row" key={day.label}>
            <dt>{day.label}</dt>
            <dd>{day.text}</dd>
          </div>
        ))}
      </dl>
      {closures.length === 0 ? null : (
        <div className="closures">
          <h3>Closures</h3>
          <ul>
            {closures.map((closure, index) => (
              <li key={`${closure.startsOn}-${closure.endsOn}-${closure.note ?? ""}-${index}`}>
                {formatClosure(closure)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
