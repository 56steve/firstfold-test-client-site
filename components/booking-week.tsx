"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { formatDayHeader, formatFullDayLabel, formatSlotRange, formatWeekTitle } from "@/lib/booking-date-format";
import { BookingPanel } from "@/components/booking-form";
import type { DoctorChoice } from "@/lib/doctor-choice";
import { isSiteAvailability, isSiteBookingError } from "@/lib/site-bookings-guard";
import type { SiteAvailability, SiteSlotState } from "@/lib/site-bookings";
import type { SiteInfoPractitioner, SiteInfoService } from "@/lib/site-info";

const LOAD_ERROR_MESSAGE = "We couldn't load the booking calendar. Please call us.";

interface Selection {
  readonly date: string;
  readonly start: string;
  readonly end: string;
}

/** One row of the grid: a distinct slot time shared (at most) by every day of the week. */
interface SlotRow {
  readonly start: string;
  readonly end: string;
}

/** The union of every distinct slot time across the week's days, sorted by start time — the grid's rows. Two days
 * with different hours simply leave the other's rows empty for the times they don't have. */
function collectSlotRows(days: SiteAvailability["days"]): readonly SlotRow[] {
  const seen = new Map<string, SlotRow>();
  for (const day of days) {
    for (const slot of day.slots) {
      const key = `${slot.start}-${slot.end}`;
      if (!seen.has(key)) seen.set(key, { start: slot.start, end: slot.end });
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.start.localeCompare(b.start));
}

/** Every distinct closure note across the week's closed days, in the order they first appear — used when there
 * are no rows to render at all (every day closed), so the reason still reaches the visitor. */
function collectClosureNotes(days: SiteAvailability["days"]): readonly string[] {
  const seen = new Set<string>();
  for (const day of days) {
    if (day.closed && day.closedNote !== null) seen.add(day.closedNote);
  }
  return Array.from(seen);
}

/** A fetched week, and the doctor it was fetched for (null: any doctor). */
interface LoadedWeek {
  readonly availability: SiteAvailability;
  readonly practitionerId: string | null;
}

export interface BookingWeekProps {
  readonly services: readonly SiteInfoService[];
  /** The doctor whose slots to show, or null for any doctor (which is also what a clinic with no choice of doctor
   * always passes, so its requests are exactly what they were before doctors existed). */
  readonly practitionerId: string | null;
  /** The doctors the visitor is choosing between (lib/doctor-choice.ts's doctorChoices): empty when the clinic
   * offers no choice, in which case the booking panel says nothing about doctors. */
  readonly doctors: readonly SiteInfoPractitioner[];
}

/**
 * The /book page's week grid: previous/next navigation, a row per distinct slot time, a column per day, and the
 * booking panel (components/booking-form.tsx) that opens in a modal `<dialog>` when a free slot is clicked.
 */
export function BookingWeek({ services, practitionerId, doctors }: BookingWeekProps): ReactElement {
  const [requestedWeek, setRequestedWeek] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<LoadedWeek | null>(null);
  const data = loaded?.availability ?? null;
  // Shown full-page in place of the grid, only while there's no data at all yet to fall back to.
  const [initialErrorMessage, setInitialErrorMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  // The grid-level status region: a "taken"/"no longer available" message, or a fetch error once the grid already
  // has data to keep showing underneath it. Cleared whenever a new slot is selected.
  const [notice, setNotice] = useState<string | null>(null);
  const noticeRef = useRef<HTMLDivElement | null>(null);
  // The doctor the currently shown week was fetched for as of the last commit (undefined: nothing shown yet),
  // without being a fetch-effect dependency (adding `loaded` itself would refire the effect every time the effect
  // sets it, looping the fetch forever). A failed fetch keeps the shown week under a notice only when it belongs to
  // the same doctor; another doctor's grid must never stay clickable under this doctor's name.
  const loadedPractitionerRef = useRef<string | null | undefined>(undefined);
  // The slot button that opened the panel, so closing it returns focus there instead of dropping it.
  const openerRef = useRef<HTMLButtonElement | null>(null);
  // The (requestedWeek, refreshKey) pair of the most recently *completed* fetch — compared against the pair
  // driving the current render to derive `isFetching` below, rather than a separate `setState(true)` at the very
  // start of the effect (the lint rule for this codebase flags an unconditional synchronous setState there) or a
  // ref read during render (also disallowed). It's only ever set from inside the fetch's own `.finally`, i.e.
  // asynchronously, which is fine.
  const [lastCompletedFetchKey, setLastCompletedFetchKey] = useState("");

  // The doctor this grid last rendered for. A different one (the visitor picked another card above the grid) is
  // handled here, during render, rather than in an effect — React's documented way to reset state on a prop change
  // without a wasted render of the stale state: back to the current week, with any open panel and notice closed.
  // The previous doctor's grid stays visible (dimmed, and unclickable and unfocusable via .is-loading and inert)
  // until the new one arrives, so the page doesn't jump.
  const [shownPractitionerId, setShownPractitionerId] = useState(practitionerId);
  if (practitionerId !== shownPractitionerId) {
    setShownPractitionerId(practitionerId);
    setRequestedWeek(null);
    setSelection(null);
    setNotice(null);
  }

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  useEffect(() => {
    loadedPractitionerRef.current = loaded === null ? undefined : loaded.practitionerId;
  }, [loaded]);

  const fetchKey = `${practitionerId ?? ""}:${requestedWeek ?? ""}:${refreshKey}`;
  const isFetching = fetchKey !== lastCompletedFetchKey;

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (requestedWeek !== null) params.set("week", requestedWeek);
    if (practitionerId !== null) params.set("practitioner", practitionerId);
    const query = params.size === 0 ? "" : `?${params.toString()}`;

    // A failure keeps the week already on screen (under a notice) only when it is this same doctor's; otherwise the
    // grid is dropped for the full-page message.
    function showFailure(message: string): void {
      if (loadedPractitionerRef.current === practitionerId) {
        setNotice(message);
      } else {
        setLoaded(null);
        setInitialErrorMessage(message);
      }
    }

    fetch(`/api/availability${query}`, { cache: "no-store" })
      .then(async (response) => {
        let body: unknown = null;
        try {
          body = await response.json();
        } catch {
          body = null;
        }
        if (cancelled) return;

        if (response.ok && isSiteAvailability(body)) {
          setLoaded({ availability: body, practitionerId });
          setInitialErrorMessage(null);
          return;
        }

        showFailure(isSiteBookingError(body) ? body.message : LOAD_ERROR_MESSAGE);
      })
      .catch(() => {
        if (cancelled) return;
        showFailure(LOAD_ERROR_MESSAGE);
      })
      .finally(() => {
        if (!cancelled) setLastCompletedFetchKey(fetchKey);
      });

    return () => {
      cancelled = true;
    };
  }, [requestedWeek, refreshKey, practitionerId, fetchKey]);

  useEffect(() => {
    if (notice !== null) noticeRef.current?.focus();
  }, [notice]);

  function handleSelectSlot(next: Selection, opener: HTMLButtonElement): void {
    openerRef.current = opener;
    setNotice(null);
    setSelection(next);
  }

  function handleClosePanel(): void {
    setSelection(null);
    openerRef.current?.focus();
  }

  function handleTaken(message: string): void {
    setSelection(null);
    setNotice(message);
    refresh();
  }

  function handleBooked(): void {
    refresh();
  }

  if (data === null) {
    return <p className="notice">{initialErrorMessage ?? "Loading availability…"}</p>;
  }

  const rows = collectSlotRows(data.days);
  // Only meaningful once there is a choice of doctor; see BookingPanelProps.doctor.
  const doctor: DoctorChoice | null =
    doctors.length === 0
      ? null
      : { practitioner: doctors.find((candidate) => candidate.id === practitionerId) ?? null };

  return (
    <div>
      <div
        ref={noticeRef}
        role="status"
        aria-live="polite"
        tabIndex={-1}
        className={notice === null ? "sr-only" : "form-status form-error"}
      >
        {notice ?? ""}
      </div>

      <div className="week-nav">
        <button
          type="button"
          onClick={() => data.previousWeek !== null && setRequestedWeek(data.previousWeek)}
          disabled={data.previousWeek === null}
          aria-label="Previous week"
        >
          ◀
        </button>
        <span className="week-title" aria-live="polite">
          {formatWeekTitle(data.weekStart)}
        </span>
        <button
          type="button"
          onClick={() => data.nextWeek !== null && setRequestedWeek(data.nextWeek)}
          disabled={data.nextWeek === null}
          aria-label="Next week"
        >
          ▶
        </button>
        <span className="week-loading" aria-live="polite">
          {isFetching ? "Loading…" : ""}
        </span>
      </div>

      <div className="legend">
        <span className="legend-item">
          <span className="legend-swatch legend-free" aria-hidden="true" /> Free
        </span>
        <span className="legend-item">
          <span className="legend-swatch legend-taken" aria-hidden="true" /> Taken
        </span>
        <span className="legend-item">
          <span className="legend-swatch legend-past" aria-hidden="true" /> Past
        </span>
      </div>

      {/* inert while fetching: .is-loading only blocks the pointer, and the previous doctor's slot buttons must not
          be reachable by keyboard either. */}
      <div className={isFetching ? "week-grid-wrap is-loading" : "week-grid-wrap"} inert={isFetching}>
        {rows.length === 0 ? (
          <>
            <p className="notice">No slots this week.</p>
            {collectClosureNotes(data.days).length === 0 ? null : (
              <ul className="closure-notes">
                {collectClosureNotes(data.days).map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <table className="week-grid">
            <caption className="sr-only">Available appointment slots, week of {formatWeekTitle(data.weekStart)}</caption>
            <thead>
              <tr>
                {data.days.map((day) => {
                  const header = formatDayHeader(day.date);
                  return (
                    <th scope="col" key={day.date}>
                      <span className="week-grid-weekday">{header.weekday}</span>
                      <span className="week-grid-day">{header.day}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`${row.start}-${row.end}`}>
                  {data.days.map((day) => {
                    if (day.closed) {
                      // A closed day's column is merged into a single cell, shown once at the top of the column,
                      // rather than repeated ("Closed") down every row.
                      if (rowIndex > 0) return null;
                      return (
                        <td key={day.date} rowSpan={rows.length} className="slot-cell slot-closed">
                          Closed
                          {day.closedNote === null ? null : <span className="slot-closed-note">{day.closedNote}</span>}
                        </td>
                      );
                    }

                    const slot = day.slots.find((candidate) => candidate.start === row.start && candidate.end === row.end);
                    if (slot === undefined) {
                      return <td key={day.date} className="slot-cell slot-empty" />;
                    }

                    return (
                      <td key={day.date} className="slot-cell">
                        <SlotCell date={day.date} start={row.start} end={row.end} state={slot.state} onSelect={handleSelectSlot} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selection === null ? null : (
        <BookingPanel
          date={selection.date}
          start={selection.start}
          end={selection.end}
          services={services}
          doctor={doctor}
          onClose={handleClosePanel}
          onBooked={handleBooked}
          onTaken={handleTaken}
        />
      )}
    </div>
  );
}

function SlotCell({
  date,
  start,
  end,
  state,
  onSelect,
}: {
  readonly date: string;
  readonly start: string;
  readonly end: string;
  readonly state: SiteSlotState;
  readonly onSelect: (selection: Selection, opener: HTMLButtonElement) => void;
}): ReactElement {
  // Every cell shows only its own time range; free/taken/past are told apart by style alone (background, hatch,
  // greying — see .slot-button.slot-free/.slot-taken/.slot-past below), not by any visible status word. The
  // aria-label is what actually names the state for assistive tech.
  const range = formatSlotRange(start, end);
  const dayLabel = formatFullDayLabel(date);

  if (state === "free") {
    return (
      <button
        type="button"
        className="slot-button slot-free"
        aria-label={`Book ${dayLabel}, ${range}`}
        onClick={(event) => onSelect({ date, start, end }, event.currentTarget)}
      >
        {range}
      </button>
    );
  }

  const isTaken = state === "taken";
  return (
    <button
      type="button"
      className={`slot-button ${isTaken ? "slot-taken" : "slot-past"}`}
      disabled
      aria-disabled="true"
      aria-label={`${dayLabel}, ${range}, ${isTaken ? "taken" : "past"}`}
    >
      {range}
    </button>
  );
}
