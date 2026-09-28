import { describe, expect, it } from "vitest";
import {
  buildUpstreamRequest,
  GENERIC_FAILURE_RESPONSE,
  interpretUpstreamResponse,
  InvalidBookingBodyError,
  whitelistFields,
} from "./book-forward";
import { without } from "./__tests__/support";

const VALID_BODY = {
  name: "Asha Rao",
  phone: "+91 90000 00000",
  serviceId: "svc-1",
  date: "2026-10-01",
  start: "09:00",
  website: "",
  practitionerId: "5b0c3f9e-2c1a-4d7e-9f3a-1b2c3d4e5f60",
};

describe("whitelistFields", () => {
  it("passes through a fully populated valid body", () => {
    expect(whitelistFields(VALID_BODY)).toEqual({
      name: "Asha Rao",
      phone: "+91 90000 00000",
      serviceId: "svc-1",
      date: "2026-10-01",
      start: "09:00",
      website: "",
      practitionerId: "5b0c3f9e-2c1a-4d7e-9f3a-1b2c3d4e5f60",
    });
  });

  it("never forwards an email or a note, which the booking no longer asks for", () => {
    const result = whitelistFields({ ...VALID_BODY, email: "asha@example.com", note: "First visit" });
    expect(result).not.toHaveProperty("email");
    expect(result).not.toHaveProperty("note");
  });

  it("drops keys that are not part of the known shape", () => {
    const withExtra = { ...VALID_BODY, admin: true, token: "steal-me" };
    const result = whitelistFields(withExtra);
    expect(Object.keys(result).sort()).toEqual(
      ["date", "name", "phone", "practitionerId", "serviceId", "start", "website"].sort(),
    );
  });

  it("defaults absent optional fields to null", () => {
    const required = ["serviceId", "website", "practitionerId"].reduce(
      (body, key) => without(body, key),
      VALID_BODY as Record<string, unknown>,
    );
    expect(whitelistFields(required)).toMatchObject({ serviceId: null, website: null, practitionerId: null });
  });

  it("keeps an explicit null for an optional field", () => {
    expect(whitelistFields({ ...VALID_BODY, serviceId: null })).toMatchObject({ serviceId: null });
  });

  it("keeps an explicit null practitionerId, which means any doctor", () => {
    expect(whitelistFields({ ...VALID_BODY, practitionerId: null })).toMatchObject({ practitionerId: null });
  });

  it.each(["name", "phone", "date", "start"])("rejects a missing required field %s", (field) => {
    expect(() => whitelistFields(without(VALID_BODY as Record<string, unknown>, field))).toThrow(
      InvalidBookingBodyError,
    );
  });

  it.each(["name", "phone", "date", "start"])("rejects a wrongly typed required field %s", (field) => {
    expect(() => whitelistFields({ ...VALID_BODY, [field]: 42 })).toThrow(InvalidBookingBodyError);
  });

  it.each(["name", "phone", "date", "start"])("passes a blank required field %s through unchanged", (field) => {
    // Type checks only: a blank required field is the platform's business to reject (with a field-specific 422
    // message), not this route's.
    expect(whitelistFields({ ...VALID_BODY, [field]: "   " })).toMatchObject({ [field]: "   " });
  });

  it("rejects a non-object body", () => {
    expect(() => whitelistFields(null)).toThrow(InvalidBookingBodyError);
    expect(() => whitelistFields("hello")).toThrow(InvalidBookingBodyError);
    expect(() => whitelistFields([VALID_BODY])).toThrow(InvalidBookingBodyError);
  });

  it.each(["serviceId", "website", "practitionerId"])("rejects a wrongly typed optional field %s", (field) => {
    expect(() => whitelistFields({ ...VALID_BODY, [field]: 42 })).toThrow(InvalidBookingBodyError);
  });

  it("rejects a numeric honeypot instead of silently treating it as empty", () => {
    // A bot posting website: 1 (or any non-string, non-null value) is a shape violation, not "no honeypot value" —
    // it must be rejected with a 400, never laundered into null.
    expect(() => whitelistFields({ ...VALID_BODY, website: 1 })).toThrow(InvalidBookingBodyError);
  });
});

describe("buildUpstreamRequest", () => {
  it("wraps the fields and IP together", () => {
    const fields = whitelistFields(VALID_BODY);
    expect(buildUpstreamRequest(fields, "203.0.113.5")).toEqual({ fields, clientIp: "203.0.113.5" });
  });
});

describe("interpretUpstreamResponse", () => {
  it("relays a 200 otp_sent response", () => {
    const body = { status: "otp_sent", otpId: "otp-1", expiresInSeconds: 600, phoneHint: "•••• 3210" };
    expect(interpretUpstreamResponse(200, body)).toEqual({ status: 200, body });
  });

  it.each([400, 422, 409, 403, 429, 500])("relays a well-formed error body for status %d", (status) => {
    const body = { status: "error", code: "invalid", message: "Nope", field: "phone" };
    expect(interpretUpstreamResponse(status, body)).toEqual({ status, body });
  });

  it("rebuilds the body from validated keys only, dropping anything extra the platform sent", () => {
    const withExtra = { status: "error", code: "invalid", message: "Nope", field: "phone", secret: "leak-me" };
    const result = interpretUpstreamResponse(422, withExtra);
    expect(result).toEqual({ status: 422, body: { status: "error", code: "invalid", message: "Nope", field: "phone" } });
    expect(result.body).not.toBe(withExtra);
    expect("secret" in result.body).toBe(false);
  });

  it("rebuilds an otp_sent body without carrying along any extra keys", () => {
    const result = interpretUpstreamResponse(200, {
      status: "otp_sent",
      otpId: "otp-1",
      expiresInSeconds: 600,
      phoneHint: "•••• 3210",
      extra: "unexpected",
    });
    expect(result).toEqual({
      status: 200,
      body: { status: "otp_sent", otpId: "otp-1", expiresInSeconds: 600, phoneHint: "•••• 3210" },
    });
  });

  it("maps an unexpected status to a generic 502", () => {
    expect(interpretUpstreamResponse(418, { status: "otp_sent", otpId: "x", expiresInSeconds: 1, phoneHint: "y" })).toEqual({
      status: 502,
      body: GENERIC_FAILURE_RESPONSE,
    });
  });

  it("maps a relayable status with an unrecognized body to a generic 502", () => {
    expect(interpretUpstreamResponse(200, { ok: true })).toEqual({ status: 502, body: GENERIC_FAILURE_RESPONSE });
  });

  it("maps a 401 (our own token is wrong) to a generic 502", () => {
    expect(interpretUpstreamResponse(401, { error: "unauthorized" })).toEqual({
      status: 502,
      body: GENERIC_FAILURE_RESPONSE,
    });
  });

  it("maps an error body with an unknown code to a generic 502", () => {
    expect(interpretUpstreamResponse(422, { status: "error", code: "mystery", message: "x", field: null })).toEqual({
      status: 502,
      body: GENERIC_FAILURE_RESPONSE,
    });
  });
});
