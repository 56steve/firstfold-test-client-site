/**
 * The /book page's doctor choice, as pure functions: whether the clinic offers one at all, and the two sentences
 * the booking panel shows about it. Kept out of the components so the "two or more doctors" rule lives in exactly
 * one place and every wording is unit-tested.
 */
import type { SiteInfoPractitioner } from "./site-info";
import { isUuid } from "./uuid";

/** What the visitor chose in the doctor picker: a doctor, or null for "Any doctor". Wrapped in an object so a
 * caller can pass `DoctorChoice | null`, where the outer null means the clinic offers no choice at all. */
export interface DoctorChoice {
  readonly practitioner: SiteInfoPractitioner | null;
}

/**
 * The doctors to offer a choice between: all of them, in the clinic's order, when there are two or more; otherwise
 * none. A single doctor (or a platform older than 2026-09-28, which sends no list) means there is nothing to
 * choose, and the page must look and behave exactly as it did before doctors existed.
 *
 * A doctor whose id isn't a uuid is left out first: the availability route drops a non-uuid `practitioner`, so
 * picking that doctor would show every doctor's slots under their name.
 */
export function doctorChoices(
  practitioners: readonly SiteInfoPractitioner[] | undefined,
): readonly SiteInfoPractitioner[] {
  if (practitioners === undefined) return [];
  const bookable = practitioners.filter((practitioner) => isUuid(practitioner.id));
  return bookable.length >= 2 ? bookable : [];
}

/** The line under the booking panel's slot heading: the chosen doctor's name as the clinic wrote it (it may
 * already carry its own "Dr"), or the first available doctor for "Any doctor". */
export function doctorLine(practitioner: SiteInfoPractitioner | null): string {
  return practitioner === null ? "With the first available doctor" : `With ${practitioner.name}`;
}

/** The booking panel's confirmation. Names the doctor only when the platform said who it booked with — for "Any
 * doctor" that is the one it picked, which the visitor hasn't seen anywhere else yet. */
export function bookedMessage(dayLabel: string, slotRange: string, practitionerName: string | null): string {
  if (practitionerName === null || practitionerName.trim() === "") {
    return `You're booked: ${dayLabel}, ${slotRange}.`;
  }
  return `You're booked with ${practitionerName}: ${dayLabel}, ${slotRange}.`;
}
