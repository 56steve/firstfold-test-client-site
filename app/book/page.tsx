import type { Metadata } from "next";
import type { ReactElement } from "react";
import { BookingScheduler } from "@/components/booking-scheduler";
import { getSiteInfo } from "@/lib/firstfold-info";

export const metadata: Metadata = { title: "Book an appointment" };

// Never statically cached: the week grid always needs a fresh read of whether booking is on, paused or off, not
// whatever this page last happened to be built or revalidated with.
export const dynamic = "force-dynamic";

export default async function BookPage(): Promise<ReactElement> {
  const info = await getSiteInfo();

  // No site info at all (platform unreachable, token missing) or the business doesn't take online appointments.
  if (info === null || info.booking === null) {
    return (
      <>
        <h1>Book an appointment</h1>
        <p className="notice">Call us to book.</p>
      </>
    );
  }

  const { booking } = info;

  return (
    <>
      <h1>Book an appointment</h1>
      {booking.accepting ? (
        <BookingScheduler services={booking.services} practitioners={booking.practitioners} />
      ) : (
        <p className="notice">{booking.pausedMessage ?? "Online booking is paused. Please call us."}</p>
      )}
    </>
  );
}
