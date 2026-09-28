/**
 * The pure state machine behind components/booking-form.tsx's BookingPanel: details → OTP → booked, plus every
 * error path the platform can answer with. Kept free of React, fetch and Date.now() (the caller passes `now` in
 * whenever a timestamp is needed) so every transition is unit-tested directly, and so the component itself only
 * has to dispatch actions and react to the resulting state.
 *
 * A response that reports the slot was taken, or a booking that succeeds, is signalled through `state.effect`
 * rather than handled inline here, because both need to call back out to the component's props (onTaken/onBooked)
 * — an impure step a reducer must never perform itself. The component watches `state.effect` in a useEffect, acts
 * on it, and dispatches "effect_handled" to clear it.
 */
import { isSiteConfirmResponse, isSiteOtpResponse } from "./site-bookings-guard";

/** The panel's own editable fields — anything the platform reports an error against outside this list (the
 * honeypot, or `date`/`start`, which the panel sets from the clicked slot rather than the visitor typing them) has
 * nowhere inline to show, so it becomes the panel's general status message instead. */
export const KNOWN_FIELDS = ["name", "phone", "serviceId"] as const;
export type KnownField = (typeof KNOWN_FIELDS)[number];

export function isKnownField(field: string | null): field is KnownField {
  return field !== null && (KNOWN_FIELDS as readonly string[]).includes(field);
}

/** A fresh "Resend code" click is disabled for this long, so a visitor can't spam the SMS provider. */
export const RESEND_COOLDOWN_MS = 30_000;

const FALLBACK_MESSAGE = "Something went wrong. Please try again or call us.";

export interface OtpInfo {
  readonly otpId: string;
  readonly phoneHint: string;
}

export interface BookedInfo {
  readonly date: string;
  readonly start: string;
  readonly end: string;
  /** The doctor the platform booked with; null when it didn't say (an older platform, or a name it couldn't read
   * back), in which case the confirmation simply leaves the doctor out. */
  readonly practitionerName: string | null;
}

export type PanelEffect = { readonly type: "taken"; readonly message: string } | { readonly type: "booked" };

export interface PanelState {
  readonly step: "details" | "otp" | "booked";
  readonly submitting: boolean;
  readonly otp: OtpInfo | null;
  /** True once the current OTP has been reported expired or attempted too many times: the code field and "Book
   * this slot" are disabled until a fresh code is requested. */
  readonly otpExpired: boolean;
  readonly code: string;
  readonly fieldError: { readonly field: KnownField | null; readonly message: string } | null;
  readonly codeError: string | null;
  /** The panel's status-region message: a paused/unavailable/limited/failed/expired/too_many_attempts message, or
   * a generic field-less "invalid" message. */
  readonly banner: string | null;
  readonly bannerShowsNewCodeCta: boolean;
  readonly resendDisabledUntil: number;
  readonly booked: BookedInfo | null;
  /** A one-shot side effect for the component to act on and then clear (dispatch "effect_handled"). */
  readonly effect: PanelEffect | null;
}

export const INITIAL_PANEL_STATE: PanelState = {
  step: "details",
  submitting: false,
  otp: null,
  otpExpired: false,
  code: "",
  fieldError: null,
  codeError: null,
  banner: null,
  bannerShowsNewCodeCta: false,
  resendDisabledUntil: 0,
  booked: null,
  effect: null,
};

export type PanelAction =
  /** The visitor picked a different slot, or clicked "Change details": back to a blank details step. */
  | { readonly type: "reset" }
  | { readonly type: "code_changed"; readonly value: string }
  /** About to POST /api/book/otp (the initial send, a resend, or "Send a new code"). */
  | { readonly type: "otp_requested" }
  /** The parsed (but not yet validated) response body from /api/book/otp. */
  | { readonly type: "otp_result"; readonly body: unknown; readonly now: number }
  /** About to POST /api/book/confirm. */
  | { readonly type: "confirm_requested" }
  /** The parsed (but not yet validated) response body from /api/book/confirm. */
  | { readonly type: "confirm_result"; readonly body: unknown }
  | { readonly type: "effect_handled" };

export function panelReducer(state: PanelState, action: PanelAction): PanelState {
  switch (action.type) {
    case "reset":
      return INITIAL_PANEL_STATE;

    case "code_changed":
      return { ...state, code: action.value.replace(/\D/g, "").slice(0, 6), codeError: null };

    case "otp_requested":
      return { ...state, submitting: true, codeError: null };

    case "confirm_requested":
      return { ...state, submitting: true, codeError: null, banner: null, bannerShowsNewCodeCta: false };

    case "effect_handled":
      return { ...state, effect: null };

    case "otp_result": {
      const { body, now } = action;
      const cameFromOtp = state.step === "otp";
      const previousOtp = state.otp;

      if (!isSiteOtpResponse(body)) {
        return {
          ...state,
          submitting: false,
          step: cameFromOtp ? "otp" : "details",
          banner: FALLBACK_MESSAGE,
          bannerShowsNewCodeCta: false,
        };
      }

      if (body.status === "otp_sent") {
        return {
          ...state,
          step: "otp",
          submitting: false,
          otp: { otpId: body.otpId, phoneHint: body.phoneHint },
          otpExpired: false,
          code: "",
          fieldError: null,
          codeError: null,
          banner: null,
          bannerShowsNewCodeCta: false,
          resendDisabledUntil: now + RESEND_COOLDOWN_MS,
        };
      }

      if (body.code === "taken") {
        return { ...state, submitting: false, effect: { type: "taken", message: body.message } };
      }

      if (body.code === "invalid") {
        // A rejected `start` or `date` means the slot itself is no longer bookable (past, outside the window, or
        // already taken by the time the platform checked) — the same outcome as "taken", not a field the visitor
        // can fix by editing the form.
        if (body.field === "start" || body.field === "date") {
          return { ...state, submitting: false, effect: { type: "taken", message: body.message } };
        }
        return {
          ...state,
          step: "details",
          submitting: false,
          otp: null,
          otpExpired: false,
          code: "",
          codeError: null,
          banner: null,
          bannerShowsNewCodeCta: false,
          resendDisabledUntil: 0,
          fieldError: { field: isKnownField(body.field) ? body.field : null, message: body.message },
        };
      }

      // paused | unavailable | limited | failed
      return {
        ...state,
        submitting: false,
        step: cameFromOtp ? "otp" : "details",
        otp: cameFromOtp ? previousOtp : null,
        banner: body.message,
        bannerShowsNewCodeCta: false,
      };
    }

    case "confirm_result": {
      const { body } = action;

      if (!isSiteConfirmResponse(body)) {
        return { ...state, submitting: false, banner: FALLBACK_MESSAGE, bannerShowsNewCodeCta: false };
      }

      if (body.status === "booked") {
        return {
          ...state,
          step: "booked",
          submitting: false,
          booked: { date: body.date, start: body.start, end: body.end, practitionerName: body.practitionerName ?? null },
          effect: { type: "booked" },
        };
      }

      if (body.code === "taken") {
        return { ...state, submitting: false, effect: { type: "taken", message: body.message } };
      }

      if (body.code === "wrong_code") {
        return { ...state, submitting: false, code: "", codeError: body.message };
      }

      if (body.code === "expired" || body.code === "too_many_attempts") {
        return { ...state, submitting: false, otpExpired: true, banner: body.message, bannerShowsNewCodeCta: true };
      }

      // paused | unavailable | limited | failed | invalid
      return { ...state, submitting: false, banner: body.message, bannerShowsNewCodeCta: false };
    }

    default:
      return state;
  }
}
