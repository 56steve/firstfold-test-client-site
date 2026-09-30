"use client";

import { useState } from "react";
import type { ReactElement } from "react";
import { BookingWeek } from "@/components/booking-week";
import { DoctorPicker } from "@/components/doctor-picker";
import { doctorChoices } from "@/lib/doctor-choice";
import type { SiteInfoPractitioner, SiteInfoService } from "@/lib/site-info";

export interface BookingSchedulerProps {
  readonly services: readonly SiteInfoService[];
  /** Every active doctor, as site info sent them; missing from platforms older than 2026-09-28. */
  readonly practitioners: readonly SiteInfoPractitioner[] | undefined;
}

/**
 * The client half of the /book page (app/book/page.tsx is a server component): holds which doctor the visitor
 * chose, shows the doctor picker when the clinic has two or more doctors, and hands the choice to the grid. On a
 * wide screen the picker is a vertical list beside the grid, so the calendar starts at the top of the page instead
 * of below a row of cards; on a narrow one there is no room for a side column, and it falls back to a scrolling row
 * above the grid (see .booking-layout in app/globals.css). With one doctor (or none listed) there is no picker and the grid always asks for any doctor, so the
 * page is exactly what it was before doctors existed.
 */
export function BookingScheduler({ services, practitioners }: BookingSchedulerProps): ReactElement {
  const doctors = doctorChoices(practitioners);
  const [practitionerId, setPractitionerId] = useState<string | null>(null);

  if (doctors.length === 0) {
    return <BookingWeek services={services} practitionerId={null} doctors={doctors} />;
  }

  return (
    <div className="booking-layout">
      <DoctorPicker practitioners={doctors} selectedId={practitionerId} onChange={setPractitionerId} />
      <div className="booking-layout-main">
        <BookingWeek services={services} practitionerId={practitionerId} doctors={doctors} />
      </div>
    </div>
  );
}
