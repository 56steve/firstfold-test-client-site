import { describe, expect, it } from "vitest";
import { INITIAL_PANEL_STATE, panelReducer, RESEND_COOLDOWN_MS } from "./booking-panel-reducer";
import type { PanelState } from "./booking-panel-reducer";

const NOW = 1_700_000_000_000;

function otpStepState(overrides: Partial<PanelState> = {}): PanelState {
  return {
    ...INITIAL_PANEL_STATE,
    step: "otp",
    otp: { otpId: "otp-1", phoneHint: "•••• 3210" },
    ...overrides,
  };
}

describe("panelReducer / reset", () => {
  it("returns the initial state from any state", () => {
    const dirty = otpStepState({ code: "123456", banner: "oops", submitting: true });
    expect(panelReducer(dirty, { type: "reset" })).toEqual(INITIAL_PANEL_STATE);
  });
});

describe("panelReducer / code_changed", () => {
  it("keeps only digits, up to 6", () => {
    const result = panelReducer(INITIAL_PANEL_STATE, { type: "code_changed", value: "1a2b3c4d5e6f7g" });
    expect(result.code).toBe("123456");
  });

  it("clears a previous code error", () => {
    const state = { ...INITIAL_PANEL_STATE, codeError: "That code isn't right." };
    expect(panelReducer(state, { type: "code_changed", value: "1" }).codeError).toBeNull();
  });
});

describe("panelReducer / otp_requested and confirm_requested", () => {
  it("otp_requested sets submitting and clears the code error", () => {
    const state = { ...INITIAL_PANEL_STATE, codeError: "oops" };
    const result = panelReducer(state, { type: "otp_requested" });
    expect(result.submitting).toBe(true);
    expect(result.codeError).toBeNull();
  });

  it("confirm_requested sets submitting and clears the code error and banner", () => {
    const state = otpStepState({ codeError: "oops", banner: "old banner", bannerShowsNewCodeCta: true });
    const result = panelReducer(state, { type: "confirm_requested" });
    expect(result.submitting).toBe(true);
    expect(result.codeError).toBeNull();
    expect(result.banner).toBeNull();
    expect(result.bannerShowsNewCodeCta).toBe(false);
  });
});

describe("panelReducer / effect_handled", () => {
  it("clears the effect", () => {
    const state = { ...INITIAL_PANEL_STATE, effect: { type: "booked" as const } };
    expect(panelReducer(state, { type: "effect_handled" }).effect).toBeNull();
  });
});

describe("panelReducer / otp_result", () => {
  it("otp_sent moves to the otp step and starts the resend cooldown from `now`", () => {
    const body = { status: "otp_sent", otpId: "otp-9", expiresInSeconds: 600, phoneHint: "•••• 1234" };
    const result = panelReducer(INITIAL_PANEL_STATE, { type: "otp_result", body, now: NOW });
    expect(result.step).toBe("otp");
    expect(result.otp).toEqual({ otpId: "otp-9", phoneHint: "•••• 1234" });
    expect(result.otpExpired).toBe(false);
    expect(result.code).toBe("");
    expect(result.submitting).toBe(false);
    expect(result.resendDisabledUntil).toBe(NOW + RESEND_COOLDOWN_MS);
  });

  it("otp_sent from the otp step (a resend) also refreshes the cooldown and otp id", () => {
    const state = otpStepState({ resendDisabledUntil: NOW - 5000, code: "999999" });
    const body = { status: "otp_sent", otpId: "otp-new", expiresInSeconds: 600, phoneHint: "•••• 3210" };
    const result = panelReducer(state, { type: "otp_result", body, now: NOW });
    expect(result.otp).toEqual({ otpId: "otp-new", phoneHint: "•••• 3210" });
    expect(result.code).toBe("");
    expect(result.resendDisabledUntil).toBe(NOW + RESEND_COOLDOWN_MS);
  });

  it("taken sets the taken effect and stops submitting", () => {
    const body = { status: "error", code: "taken", message: "Someone just booked that slot.", field: null };
    const result = panelReducer({ ...INITIAL_PANEL_STATE, submitting: true }, { type: "otp_result", body, now: NOW });
    expect(result.effect).toEqual({ type: "taken", message: "Someone just booked that slot." });
    expect(result.submitting).toBe(false);
  });

  it("invalid on start is treated like taken (closes the panel)", () => {
    const body = { status: "error", code: "invalid", message: "That slot is no longer available.", field: "start" };
    const result = panelReducer(INITIAL_PANEL_STATE, { type: "otp_result", body, now: NOW });
    expect(result.effect).toEqual({ type: "taken", message: "That slot is no longer available." });
  });

  it("invalid on date is treated like taken (closes the panel)", () => {
    const body = { status: "error", code: "invalid", message: "That day is no longer available.", field: "date" };
    const result = panelReducer(INITIAL_PANEL_STATE, { type: "otp_result", body, now: NOW });
    expect(result.effect).toEqual({ type: "taken", message: "That day is no longer available." });
  });

  it("invalid on a known field goes back to details with a field error", () => {
    const state = otpStepState();
    const body = { status: "error", code: "invalid", message: "That phone number doesn't look right.", field: "phone" };
    const result = panelReducer(state, { type: "otp_result", body, now: NOW });
    expect(result.step).toBe("details");
    expect(result.otp).toBeNull();
    expect(result.fieldError).toEqual({ field: "phone", message: "That phone number doesn't look right." });
  });

  it("invalid on an unrecognized field falls back to a field-less error", () => {
    const body = { status: "error", code: "invalid", message: "Nope.", field: "mystery" };
    const result = panelReducer(INITIAL_PANEL_STATE, { type: "otp_result", body, now: NOW });
    expect(result.fieldError).toEqual({ field: null, message: "Nope." });
  });

  it("invalid with a null field goes back to details with a field-less error", () => {
    const body = { status: "error", code: "invalid", message: "Nope.", field: null };
    const result = panelReducer(INITIAL_PANEL_STATE, { type: "otp_result", body, now: NOW });
    expect(result.fieldError).toEqual({ field: null, message: "Nope." });
  });

  it.each(["paused", "unavailable", "limited", "failed"])(
    "%s from the details step shows a banner and stays on details",
    (code) => {
      const body = { status: "error", code, message: "Not right now.", field: null };
      const result = panelReducer(INITIAL_PANEL_STATE, { type: "otp_result", body, now: NOW });
      expect(result.step).toBe("details");
      expect(result.banner).toBe("Not right now.");
    },
  );

  it.each(["paused", "unavailable", "limited", "failed"])(
    "%s from the otp step (a resend) shows a banner but stays on the otp step, keeping the otp",
    (code) => {
      const state = otpStepState();
      const body = { status: "error", code, message: "Not right now.", field: null };
      const result = panelReducer(state, { type: "otp_result", body, now: NOW });
      expect(result.step).toBe("otp");
      expect(result.otp).toEqual(state.otp);
      expect(result.banner).toBe("Not right now.");
    },
  );

  it("a malformed response falls back to a generic banner, preserving the current step", () => {
    const result = panelReducer(INITIAL_PANEL_STATE, { type: "otp_result", body: { ok: true }, now: NOW });
    expect(result.step).toBe("details");
    expect(result.banner).toBe("Something went wrong. Please try again or call us.");
  });

  it("a malformed response from the otp step stays on the otp step", () => {
    const state = otpStepState();
    const result = panelReducer(state, { type: "otp_result", body: null, now: NOW });
    expect(result.step).toBe("otp");
  });
});

describe("panelReducer / confirm_result", () => {
  it("booked moves to the booked step, records the slot and sets the booked effect", () => {
    const state = otpStepState({ submitting: true });
    const body = { status: "booked", date: "2026-09-28", start: "09:00", end: "09:30" };
    const result = panelReducer(state, { type: "confirm_result", body });
    expect(result.step).toBe("booked");
    expect(result.submitting).toBe(false);
    expect(result.booked).toEqual({ date: "2026-09-28", start: "09:00", end: "09:30", practitionerName: null });
    expect(result.effect).toEqual({ type: "booked" });
  });

  it("booked records the doctor the platform booked with", () => {
    const body = { status: "booked", date: "2026-10-13", start: "14:00", end: "14:30", practitionerName: "Dr Rahul Menon" };
    const result = panelReducer(otpStepState({ submitting: true }), { type: "confirm_result", body });
    expect(result.booked).toEqual({ date: "2026-10-13", start: "14:00", end: "14:30", practitionerName: "Dr Rahul Menon" });
  });

  it("taken sets the taken effect", () => {
    const body = { status: "error", code: "taken", message: "Someone just booked that slot.", field: null };
    const result = panelReducer(otpStepState(), { type: "confirm_result", body });
    expect(result.effect).toEqual({ type: "taken", message: "Someone just booked that slot." });
  });

  it("wrong_code clears the code and shows the message under it", () => {
    const state = otpStepState({ code: "111111" });
    const body = { status: "error", code: "wrong_code", message: "That code isn't right. 4 tries left.", field: null };
    const result = panelReducer(state, { type: "confirm_result", body });
    expect(result.code).toBe("");
    expect(result.codeError).toBe("That code isn't right. 4 tries left.");
    expect(result.step).toBe("otp");
  });

  it.each(["expired", "too_many_attempts"])("%s disables the code input and offers a new code", (code) => {
    const body = { status: "error", code, message: "That code has expired.", field: null };
    const result = panelReducer(otpStepState(), { type: "confirm_result", body });
    expect(result.otpExpired).toBe(true);
    expect(result.banner).toBe("That code has expired.");
    expect(result.bannerShowsNewCodeCta).toBe(true);
  });

  it.each(["paused", "unavailable", "limited", "failed", "invalid"])("%s shows a banner without closing the panel", (code) => {
    const body = { status: "error", code, message: "Not right now.", field: null };
    const result = panelReducer(otpStepState(), { type: "confirm_result", body });
    expect(result.step).toBe("otp");
    expect(result.banner).toBe("Not right now.");
    expect(result.effect).toBeNull();
  });

  it("a malformed response falls back to a generic banner", () => {
    const result = panelReducer(otpStepState(), { type: "confirm_result", body: "nope" });
    expect(result.banner).toBe("Something went wrong. Please try again or call us.");
  });
});
