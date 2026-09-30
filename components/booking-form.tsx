"use client";

import { useEffect, useId, useReducer, useRef, useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { formatFullDayLabel, formatSlotRange } from "@/lib/booking-date-format";
import { bookedMessage, doctorLine } from "@/lib/doctor-choice";
import type { DoctorChoice } from "@/lib/doctor-choice";
import { INITIAL_PANEL_STATE, panelReducer } from "@/lib/booking-panel-reducer";
import type { KnownField } from "@/lib/booking-panel-reducer";
import type { SiteInfoService } from "@/lib/site-info";

/** Matches the platform's own limits, so a visitor hits the same ceiling here as a server-side 422 would enforce. */
const MAX_LENGTHS: Record<KnownField, number> = { name: 80, phone: 30, serviceId: 0 };

type FocusableField = HTMLInputElement | HTMLSelectElement;

export interface BookingPanelProps {
  /** YYYY-MM-DD, the day of the clicked slot. */
  readonly date: string;
  /** HH:MM, the clicked slot's start. */
  readonly start: string;
  /** HH:MM (or "24:00"), the clicked slot's end. */
  readonly end: string;
  readonly services: readonly SiteInfoService[];
  /** The doctor picked above the grid (its `practitioner` is null for "Any doctor"), or null when the clinic offers
   * no choice — then the panel says nothing about doctors, exactly as before doctors existed. */
  readonly doctor: DoctorChoice | null;
  readonly onClose: () => void;
  /** Called once the slot is booked, so the grid behind the panel can refetch and show it as taken. The panel
   * itself keeps showing its own confirmation until the visitor closes it. */
  readonly onBooked: () => void;
  /** Called when either step reports the slot was taken by someone else (or is no longer bookable): the panel
   * closes itself (the caller should also refetch the grid), and this carries the platform's own message for the
   * caller to show. */
  readonly onTaken: (message: string) => void;
}

/**
 * The booking panel the /book page's week grid opens in a modal `<dialog>` when a free slot is clicked: first the
 * visitor's details (an OTP is sent by SMS), then the 6-digit code, then a confirmation. The step machine itself
 * lives in lib/booking-panel-reducer.ts, pure and unit-tested; this component only dispatches actions, performs
 * the two fetches, and owns the DOM/focus concerns a reducer can't. See components/booking-week.tsx for the grid
 * that renders this.
 */
export function BookingPanel({
  date,
  start,
  end,
  services,
  doctor,
  onClose,
  onBooked,
  onTaken,
}: BookingPanelProps): ReactElement {
  const formId = useId();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [website, setWebsite] = useState(""); // honeypot: real visitors never fill this in
  const [state, dispatch] = useReducer(panelReducer, INITIAL_PANEL_STATE);
  const [now, setNow] = useState(() => Date.now());
  // Set by the "Change details" button so the effect below knows to focus the Name field once the details step is
  // back, rather than the heading (which is where every other reset — a newly clicked slot — sends focus). A ref,
  // not state: it never affects what's rendered, only where focus goes once the render it's waiting for happens.
  const focusNameNextRef = useRef(false);

  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const headingRef = useRef<HTMLElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const codeInputRef = useRef<HTMLInputElement | null>(null);
  const fieldRefs = useRef<Partial<Record<KnownField, FocusableField | null>>>({});

  const dayLabel = formatFullDayLabel(date);
  const slotRange = formatSlotRange(start, end);
  const headingId = `${formId}-heading`;
  const doctorLineId = `${formId}-doctor`;
  const codeId = `${formId}-code`;
  const codeErrorId = `${formId}-code-error`;

  // Open the native modal dialog once, right when the panel mounts (the grid renders this component only once a
  // free slot is clicked, so mounting is "the panel opening"). showModal() gives a backdrop, an automatic focus
  // trap, and inert background content, all without any extra JS. It also moves initial focus into the dialog on
  // its own; the effect below overrides that with a more deliberate focus target (the heading).
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // Bridges every way the native dialog closes itself — the Escape key (which fires "cancel" then "close") and
  // requestClose() below (the × button, and "Done" after booking) — to the one onClose the grid passed in, so
  // there's a single path that clears the grid's selection and returns focus to the slot button that opened this.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, [onClose]);

  function requestClose(): void {
    dialogRef.current?.close();
  }

  // A different slot was clicked (the parent keeps this component, and the open dialog, mounted; only its props
  // change), or this is the first render for the slot it opened with: back to a blank details step (the typed
  // contact fields, held in their own useState above, are untouched) and focus the heading.
  useEffect(() => {
    dispatch({ type: "reset" });
    headingRef.current?.focus();
  }, [date, start]);

  // Resolve the reducer's one-shot side effects: tell the parent when the slot was taken (or is no longer
  // bookable) or booked, then clear the effect so it isn't re-applied on the next render.
  useEffect(() => {
    if (state.effect === null) return;
    if (state.effect.type === "taken") {
      onTaken(state.effect.message);
    } else {
      onBooked();
    }
    dispatch({ type: "effect_handled" });
  }, [state.effect, onTaken, onBooked]);

  // Move focus to the code input the moment a fresh OTP arrives, so keyboard and screen reader users land on the
  // field they need next rather than staying on the "Send code" button that's no longer there.
  const activeOtpId = state.step === "otp" ? (state.otp?.otpId ?? null) : null;
  useEffect(() => {
    if (activeOtpId !== null) codeInputRef.current?.focus();
  }, [activeOtpId]);

  // "Change details" asked for the Name field once the details step is back.
  useEffect(() => {
    if (focusNameNextRef.current && state.step === "details") {
      fieldRefs.current.name?.focus();
      focusNameNextRef.current = false;
    }
  }, [state.step]);

  // Move focus after each error or the final confirmation: to the first invalid field for a details-step field
  // error, to the code input for a wrong-code error, otherwise to the status region so a screen reader user lands
  // on the (already-announced) message rather than being left behind on a control that's no longer relevant.
  useEffect(() => {
    if (state.step === "booked") {
      statusRef.current?.focus();
      return;
    }
    if (state.codeError !== null) {
      codeInputRef.current?.focus();
      return;
    }
    if (state.fieldError !== null) {
      if (state.fieldError.field !== null) fieldRefs.current[state.fieldError.field]?.focus();
      else statusRef.current?.focus();
      return;
    }
    if (state.banner !== null) statusRef.current?.focus();
  }, [state.step, state.fieldError, state.codeError, state.banner]);

  // Tick once a second while the OTP step is showing, so the "Resend code" cooldown counts down.
  useEffect(() => {
    if (state.step !== "otp") return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [state.step]);

  const resendSecondsLeft = Math.max(0, Math.ceil((state.resendDisabledUntil - now) / 1000));

  async function sendOtp(): Promise<void> {
    dispatch({ type: "otp_requested" });

    let body: unknown = null;
    try {
      const response = await fetch("/api/book/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          serviceId: serviceId === "" ? null : serviceId,
          date,
          start,
          website: website.trim() === "" ? null : website,
          // Null is "any doctor" — also what a clinic with no choice to offer sends, which the platform treats the
          // same as the field being absent.
          practitionerId: doctor?.practitioner?.id ?? null,
        }),
      });
      try {
        body = await response.json();
      } catch {
        body = null;
      }
    } catch {
      body = null;
    }

    // The same instant is used both as the reducer's cooldown baseline and as this component's own `now`, so the
    // "Resend code (30s)" countdown reads correctly on the very next render instead of waiting up to a second for
    // the next tick of the interval above.
    const requestNow = Date.now();
    setNow(requestNow);
    dispatch({ type: "otp_result", body, now: requestNow });
  }

  async function confirmCode(): Promise<void> {
    if (state.otp === null) return;
    const { otpId } = state.otp;
    const { code } = state;
    dispatch({ type: "confirm_requested" });

    let body: unknown = null;
    try {
      const response = await fetch("/api/book/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otpId, code }),
      });
      try {
        body = await response.json();
      } catch {
        body = null;
      }
    } catch {
      body = null;
    }

    dispatch({ type: "confirm_result", body });
  }

  function changeDetails(): void {
    focusNameNextRef.current = true;
    dispatch({ type: "reset" });
  }

  function handleDetailsSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void sendOtp();
  }

  function handleConfirmSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void confirmCode();
  }

  function fieldAttributes(field: KnownField): { "aria-invalid": boolean; "aria-describedby": string | undefined } {
    const hasError = state.fieldError?.field === field;
    return { "aria-invalid": hasError, "aria-describedby": hasError ? fieldErrorId(field) : undefined };
  }

  function fieldErrorId(field: KnownField): string {
    return `${formId}-${field}-error`;
  }

  // The confirmation names the slot the platform actually booked (state.booked), not just the one that was
  // clicked — the two should always agree, but the server's own answer is the more trustworthy source. The same
  // goes for the doctor, which for "Any doctor" is only known once the platform has picked one. It is left out
  // when the clinic offers no choice of doctor, so a single-doctor clinic's confirmation reads as it always has.
  const statusMessage =
    state.step === "booked" && state.booked !== null
      ? bookedMessage(
          formatFullDayLabel(state.booked.date),
          formatSlotRange(state.booked.start, state.booked.end),
          doctor === null ? null : state.booked.practitionerName,
        )
      : (state.banner ?? (state.fieldError?.field === null ? state.fieldError.message : null) ?? "");
  const statusIsError = state.step !== "booked" && statusMessage !== "";
  const statusClassName = state.step === "booked" ? "form-status form-success" : statusIsError ? "form-status form-error" : "sr-only";

  return (
    <dialog
      ref={dialogRef}
      className="panel"
      aria-labelledby={headingId}
      aria-describedby={doctor === null ? undefined : doctorLineId}
      aria-modal="true"
    >
      <div className="panel-head">
        <h2
          id={headingId}
          ref={(el) => {
            headingRef.current = el;
          }}
          tabIndex={-1}
        >
          {dayLabel} · {slotRange}
        </h2>
        <button type="button" className="panel-close" onClick={requestClose} aria-label="Close">
          ×
        </button>
      </div>

      {doctor === null ? null : <p className="panel-doctor" id={doctorLineId}>{doctorLine(doctor.practitioner)}</p>}

      <div ref={statusRef} role="status" aria-live="polite" tabIndex={-1} className={statusClassName}>
        {statusMessage}
      </div>

      {state.step === "booked" ? (
        <div className="form panel-actions">
          <button type="button" onClick={requestClose}>
            Done
          </button>
        </div>
      ) : state.step === "otp" ? (
        <div>
          <p>We sent a 6-digit code to {state.otp?.phoneHint}</p>
          <form className="form" onSubmit={handleConfirmSubmit} noValidate>
            <div className="field">
              <label htmlFor={codeId}>Code</label>
              <input
                id={codeId}
                ref={(el) => {
                  codeInputRef.current = el;
                }}
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                disabled={state.submitting || state.otpExpired}
                value={state.code}
                onChange={(event) => dispatch({ type: "code_changed", value: event.target.value })}
                aria-invalid={state.codeError !== null}
                aria-describedby={state.codeError !== null ? codeErrorId : undefined}
              />
              {state.codeError === null ? null : (
                <p className="field-error" id={codeErrorId}>
                  {state.codeError}
                </p>
              )}
            </div>

            {!state.bannerShowsNewCodeCta ? null : (
              <button type="button" onClick={() => void sendOtp()} disabled={state.submitting}>
                Send a new code
              </button>
            )}

            <div className="otp-actions">
              <button type="submit" disabled={state.submitting || state.otpExpired || state.code.length !== 6}>
                {state.submitting ? "Booking…" : "Book this slot"}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => void sendOtp()}
                disabled={state.submitting || resendSecondsLeft > 0}
              >
                {resendSecondsLeft > 0 ? `Resend code (${resendSecondsLeft}s)` : "Resend code"}
              </button>
              <button type="button" className="button-secondary" onClick={changeDetails} disabled={state.submitting}>
                Change details
              </button>
            </div>
          </form>
        </div>
      ) : (
        <form className="form" onSubmit={handleDetailsSubmit} noValidate>
          <div className="field">
            <label htmlFor={`${formId}-name`}>Name</label>
            <input
              id={`${formId}-name`}
              ref={(el) => {
                fieldRefs.current.name = el;
              }}
              name="name"
              type="text"
              autoComplete="name"
              required
              maxLength={MAX_LENGTHS.name}
              value={name}
              onChange={(event) => setName(event.target.value)}
              {...fieldAttributes("name")}
            />
            {state.fieldError?.field !== "name" ? null : (
              <p className="field-error" id={fieldErrorId("name")}>
                {state.fieldError.message}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor={`${formId}-phone`}>Phone</label>
            <input
              id={`${formId}-phone`}
              ref={(el) => {
                fieldRefs.current.phone = el;
              }}
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              placeholder="+91 98765 43210"
              maxLength={MAX_LENGTHS.phone}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              {...fieldAttributes("phone")}
            />
            {state.fieldError?.field !== "phone" ? null : (
              <p className="field-error" id={fieldErrorId("phone")}>
                {state.fieldError.message}
              </p>
            )}
          </div>

          {services.length === 0 ? null : (
            <div className="field">
              <label htmlFor={`${formId}-service`}>Service</label>
              <select
                id={`${formId}-service`}
                ref={(el) => {
                  fieldRefs.current.serviceId = el;
                }}
                name="service"
                value={serviceId}
                onChange={(event) => setServiceId(event.target.value)}
                {...fieldAttributes("serviceId")}
              >
                <option value="">No preference</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
              {state.fieldError?.field !== "serviceId" ? null : (
                <p className="field-error" id={fieldErrorId("serviceId")}>
                  {state.fieldError.message}
                </p>
              )}
            </div>
          )}

          {/* Honeypot: hidden from sighted users (CSS) and from assistive tech (aria-hidden), out of the tab
              order, and not autofilled. A person never fills this in; a bot that fills every field does. */}
          <div className="sr-only" aria-hidden="true">
            <label htmlFor={`${formId}-website`}>Leave this field blank</label>
            <input
              id={`${formId}-website`}
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>

          <button type="submit" disabled={state.submitting}>
            {state.submitting ? "Sending…" : "Send code"}
          </button>
        </form>
      )}
    </dialog>
  );
}
