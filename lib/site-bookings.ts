/**
 * Week availability and the two-step OTP booking a client site's server calls. A copy of the platform's
 * apps/platform/lib/site-bookings.ts. ADDITIVE CHANGES ONLY.
 */
export type SiteSlotState = "free" | "taken" | "past";
export interface SiteSlot {
  readonly start: string; // "HH:MM", business local time
  readonly end: string;   // "HH:MM"
  readonly state: SiteSlotState;
}
export interface SiteAvailabilityDay {
  readonly date: string; // YYYY-MM-DD
  /** True on a closure, a weekday with no hours, or a day outside the booking window. */
  readonly closed: boolean;
  /** The closure's note when a closure caused it, else null. */
  readonly closedNote: string | null;
  readonly slots: readonly SiteSlot[]; // empty when closed
}
export interface SiteAvailability {
  readonly weekStart: string; // the Monday, YYYY-MM-DD
  readonly today: string;
  readonly slotMinutes: number;
  /** Monday of the previous week, or null when that week is entirely in the past. */
  readonly previousWeek: string | null;
  /** Monday of the next week, or null when it starts after the booking window. */
  readonly nextWeek: string | null;
  readonly days: readonly SiteAvailabilityDay[]; // always 7, Monday first
}
export interface SiteBookingFields {
  readonly name: string;
  readonly phone: string;
  readonly email?: string | null;
  readonly serviceId?: string | null;
  readonly date: string;  // YYYY-MM-DD
  readonly start: string; // HH:MM
  readonly note?: string | null;
  /** Honeypot: left empty by people. */
  readonly website?: string | null;
}
export interface SiteOtpRequest {
  readonly fields: SiteBookingFields;
  readonly clientIp: string;
}
export interface SiteOtpConfirm {
  readonly otpId: string;
  readonly code: string;
  readonly clientIp: string;
}
export type SiteBookingErrorCode =
  | "invalid" | "taken" | "paused" | "unavailable" | "limited" | "failed"
  | "wrong_code" | "expired" | "too_many_attempts";
export type SiteBookingError = {
  readonly status: "error";
  readonly code: SiteBookingErrorCode;
  readonly message: string;
  readonly field: string | null;
};
export type SiteOtpResponse =
  | { readonly status: "otp_sent"; readonly otpId: string; readonly expiresInSeconds: number; readonly phoneHint: string }
  | SiteBookingError;
export type SiteConfirmResponse =
  | { readonly status: "booked"; readonly date: string; readonly start: string; readonly end: string }
  | SiteBookingError;
