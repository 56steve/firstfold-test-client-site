"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { formatDayHeader, formatFullDayLabel, formatSlotRange, formatWeekTitle } from "@/lib/booking-date-format";
import { BookingPanel } from "@/components/booking-form";
import { isSiteAvailability, isSiteBookingError } from "@/lib/site-bookings-guard";
import type { SiteAvailability, SiteSlotState } from "@/lib/site-bookings";
import type { SiteInfoService } from "@/lib/site-info";

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

export interface BookingWeekProps {
  readonly services: readonly SiteInfoService[];
}

/**
 * The /book page's week grid: previous/next navigation, a row per distinct slot time, a column per day, and the
 * booking panel (components/booking-form.tsx) that opens in a modal `<dialog>` when a free slot is clicked.
 */
export function BookingWeek({ services }: BookingWeekProps): ReactElement {
  const [requestedWeek, setRequestedWeek] = useState<string | null>(null);
  const [data, setData] = useState<SiteAvailability | null>(null);
  // Shown full-page in place of the grid, only while there's no data at all yet to fall back to.
  const [initialErrorMessage, setInitialErrorMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  // The grid-level status region: a "taken"/"no longer available" message, or a fetch error once the grid already
  // has data to keep showing underneath it. Cleared whenever a new slot is selected.
  const [notice, setNotice] = useState<string | null>(null);
  const noticeRef = useRef<HTMLDivElement | null>(null);
  // Tracks whether `data` was non-null as of the last commit, without being a fetch-effect dependency (adding
  // `data` itself would refire the effect every time the effect sets it, looping the fetch forever).
  const hasDataRef = useRef(false);
  // The slot button that opened the panel, so closing it returns focus there instead of dropping it.
  const openerRef = useRef<HTMLButtonElement | null>(null);
  // The (requestedWeek, refreshKey) pair of the most recently *completed* fetch — compared against the pair
  // driving the current render to derive `isFetching` below, rather than a separate `setState(true)` at the very
  // start of the effect (the lint rule for this codebase flags an unconditional synchronous setState there) or a
  // ref read during render (also disallowed). It's only ever set from inside the fetch's own `.finally`, i.e.
  // asynchronously, which is fine.
  const [lastCompletedFetchKey, setLastCompletedFetchKey] = useState("");

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  useEffect(() => {
    hasDataRef.current = data !== null;
  }, [data]);

  const fetchKey = `${requestedWeek ?? ""}:${refreshKey}`;
  const isFetching = fetchKey !== lastCompletedFetchKey;

  useEffect(() => {
    let cancelled = false;
    const query = requestedWeek === null ? "" : `?week=${encodeURIComponent(requestedWeek)}`;

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
          setData(body);
          setInitialErrorMessage(null);
          return;
        }

        const message = isSiteBookingError(body) ? body.message : LOAD_ERROR_MESSAGE;
        if (hasDataRef.current) setNotice(message);
        else setInitialErrorMessage(message);
      })
      .catch(() => {
        if (cancelled) return;
        if (hasDataRef.current) setNotice(LOAD_ERROR_MESSAGE);
        else setInitialErrorMessage(LOAD_ERROR_MESSAGE);
      })
      .finally(() => {
        if (!cancelled) setLastCompletedFetchKey(fetchKey);
      });

    return () => {
      cancelled = true;
    };
  }, [requestedWeek, refreshKey, fetchKey]);

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

      <div className={isFetching ? "week-grid-wrap is-loading" : "week-grid-wrap"}>
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
