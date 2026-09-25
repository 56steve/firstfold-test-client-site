import { describe, expect, it } from "vitest";
import {
  buildUpstreamRequest,
  GENERIC_FAILURE_RESPONSE,
  interpretUpstreamResponse,
  InvalidBookingBodyError,
  whitelistConfirmFields,
} from "./confirm-forward";

const VALID_BODY = { otpId: "0198f2b0-1234-7abc-8def-0123456789ab", code: "123456" };

describe("whitelistConfirmFields", () => {
  it("passes through a well-formed body", () => {
    expect(whitelistConfirmFields(VALID_BODY)).toEqual(VALID_BODY);
  });

  it("drops keys that are not part of the known shape", () => {
    const result = whitelistConfirmFields({ ...VALID_BODY, admin: true });
    expect(Object.keys(result).sort()).toEqual(["code", "otpId"]);
  });

  it("accepts an uppercase uuid", () => {
    expect(whitelistConfirmFields({ ...VALID_BODY, otpId: VALID_BODY.otpId.toUpperCase() }).otpId).toBe(
      VALID_BODY.otpId.toUpperCase(),
    );
  });

  it.each(["not-a-uuid", "0198f2b0-1234-7abc-8def", "", "0198f2b012347abc8def0123456789ab"])(
    "rejects a malformed otpId %s",
    (otpId) => {
      expect(() => whitelistConfirmFields({ ...VALID_BODY, otpId })).toThrow(InvalidBookingBodyError);
    },
  );

  it("rejects a missing otpId", () => {
    expect(() => whitelistConfirmFields({ code: "123456" })).toThrow(InvalidBookingBodyError);
  });

  it("rejects a non-string otpId", () => {
    expect(() => whitelistConfirmFields({ ...VALID_BODY, otpId: 42 })).toThrow(InvalidBookingBodyError);
  });

  it.each(["12345", "1234567", "12345a", "", "abcdef"])("rejects a malformed code %s", (code) => {
    expect(() => whitelistConfirmFields({ ...VALID_BODY, code })).toThrow(InvalidBookingBodyError);
  });

  it("rejects a missing code", () => {
    expect(() => whitelistConfirmFields({ otpId: VALID_BODY.otpId })).toThrow(InvalidBookingBodyError);
  });

  it("rejects a non-string code", () => {
    expect(() => whitelistConfirmFields({ ...VALID_BODY, code: 123456 })).toThrow(InvalidBookingBodyError);
  });

  it("rejects a non-object body", () => {
    expect(() => whitelistConfirmFields(null)).toThrow(InvalidBookingBodyError);
    expect(() => whitelistConfirmFields("hello")).toThrow(InvalidBookingBodyError);
    expect(() => whitelistConfirmFields([VALID_BODY])).toThrow(InvalidBookingBodyError);
  });
});

describe("buildUpstreamRequest", () => {
  it("wraps the fields and IP together", () => {
    const fields = whitelistConfirmFields(VALID_BODY);
    expect(buildUpstreamRequest(fields, "203.0.113.5")).toEqual({ ...VALID_BODY, clientIp: "203.0.113.5" });
  });
});

describe("interpretUpstreamResponse", () => {
  it("relays a 200 booked response", () => {
    const body = { status: "booked", date: "2026-09-28", start: "09:00", end: "09:30" };
    expect(interpretUpstreamResponse(200, body)).toEqual({ status: 200, body });
  });

  it.each([400, 403, 409, 410, 422, 429])("relays a well-formed error body for status %d", (status) => {
    const body = { status: "error", code: "wrong_code", message: "Nope", field: null };
    expect(interpretUpstreamResponse(status, body)).toEqual({ status, body });
  });

  it("relays a well-formed 500 failed body, same as book-forward's RELAYED_STATUSES", () => {
    const body = { status: "error", code: "failed", message: "Something went wrong. Please try again or call us.", field: null };
    expect(interpretUpstreamResponse(500, body)).toEqual({ status: 500, body });
  });

  it("rebuilds the body from validated keys only, dropping anything extra the platform sent", () => {
    const withExtra = { status: "booked", date: "2026-09-28", start: "09:00", end: "09:30", secret: "leak-me" };
    const result = interpretUpstreamResponse(200, withExtra);
    expect(result).toEqual({ status: 200, body: { status: "booked", date: "2026-09-28", start: "09:00", end: "09:30" } });
    expect("secret" in result.body).toBe(false);
  });

  it("maps an unexpected status to a generic 502", () => {
    expect(interpretUpstreamResponse(418, { status: "booked", date: "2026-09-28", start: "09:00", end: "09:30" })).toEqual({
      status: 502,
      body: GENERIC_FAILURE_RESPONSE,
    });
  });

  it("maps a relayable status with an unrecognized body to a generic 502", () => {
    expect(interpretUpstreamResponse(200, { ok: true })).toEqual({ status: 502, body: GENERIC_FAILURE_RESPONSE });
  });

  it("maps an error body with an unknown code to a generic 502", () => {
    expect(interpretUpstreamResponse(422, { status: "error", code: "mystery", message: "x", field: null })).toEqual({
      status: 502,
      body: GENERIC_FAILURE_RESPONSE,
    });
  });
});
