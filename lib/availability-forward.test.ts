import { describe, expect, it } from "vitest";
import {
  buildUpstreamPath,
  GENERIC_FAILURE_RESPONSE,
  interpretUpstreamResponse,
  isValidWeekParam,
  practitionerParam,
} from "./availability-forward";

const DOCTOR_ID = "5b0c3f9e-2c1a-4d7e-9f3a-1b2c3d4e5f60";

describe("isValidWeekParam", () => {
  it("accepts a real calendar date", () => {
    expect(isValidWeekParam("2026-09-28")).toBe(true);
  });

  it.each(["2026-9-28", "2026-13-01", "2026-02-30", "28-09-2026", "2026/09/28", "", "not-a-date"])(
    "rejects a malformed or non-existent date %s",
    (value) => {
      expect(isValidWeekParam(value)).toBe(false);
    },
  );
});

describe("buildUpstreamPath", () => {
  it("omits the query when week is null", () => {
    expect(buildUpstreamPath(null)).toBe("/api/site/availability");
  });

  it("includes an encoded week when given", () => {
    expect(buildUpstreamPath("2026-09-28")).toBe("/api/site/availability?week=2026-09-28");
  });

  it("adds the practitioner when given, with or without a week", () => {
    expect(buildUpstreamPath("2026-09-28", DOCTOR_ID)).toBe(
      `/api/site/availability?week=2026-09-28&practitioner=${DOCTOR_ID}`,
    );
    expect(buildUpstreamPath(null, DOCTOR_ID)).toBe(`/api/site/availability?practitioner=${DOCTOR_ID}`);
  });

  it("omits the practitioner when it is null", () => {
    expect(buildUpstreamPath("2026-09-28", null)).toBe("/api/site/availability?week=2026-09-28");
  });
});

describe("practitionerParam", () => {
  it("keeps a uuid", () => {
    expect(practitionerParam(DOCTOR_ID)).toBe(DOCTOR_ID);
  });

  it("keeps an uppercase uuid", () => {
    expect(practitionerParam(DOCTOR_ID.toUpperCase())).toBe(DOCTOR_ID.toUpperCase());
  });

  it.each([null, "", "any", "123", `${DOCTOR_ID}x`, `${DOCTOR_ID}&week=2026-01-05`, " " + DOCTOR_ID])(
    "drops anything that isn't a uuid: %s",
    (value) => {
      expect(practitionerParam(value)).toBeNull();
    },
  );
});

const VALID_AVAILABILITY = {
  weekStart: "2026-09-28",
  today: "2026-09-25",
  slotMinutes: 30,
  previousWeek: "2026-09-21",
  nextWeek: "2026-10-05",
  days: ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"].map(
    (date) => ({
      date,
      closed: false,
      closedNote: null,
      slots: [{ start: "09:00", end: "09:30", state: "free" }],
    }),
  ),
};

describe("interpretUpstreamResponse", () => {
  it("relays a 200 availability response", () => {
    expect(interpretUpstreamResponse(200, VALID_AVAILABILITY)).toEqual({ status: 200, body: VALID_AVAILABILITY });
  });

  it("rebuilds the body from validated keys only, dropping anything extra the platform sent", () => {
    const withExtra = { ...VALID_AVAILABILITY, secret: "leak-me" };
    const result = interpretUpstreamResponse(200, withExtra);
    expect(result.status).toBe(200);
    expect("secret" in result.body).toBe(false);
  });

  it.each([400, 403, 409])("relays a well-formed error body for status %d", (status) => {
    const body = { status: "error", code: "unavailable", message: "Nope", field: null };
    expect(interpretUpstreamResponse(status, body)).toEqual({ status, body });
  });

  it("maps a 200 with a body that isn't SiteAvailability to a generic 502", () => {
    expect(interpretUpstreamResponse(200, { ok: true })).toEqual({ status: 502, body: GENERIC_FAILURE_RESPONSE });
  });

  it("maps an unexpected status to a generic 502", () => {
    expect(interpretUpstreamResponse(500, VALID_AVAILABILITY)).toEqual({ status: 502, body: GENERIC_FAILURE_RESPONSE });
  });

  it("maps a 400 with an unrecognized body to a generic 502", () => {
    expect(interpretUpstreamResponse(400, { oops: true })).toEqual({ status: 502, body: GENERIC_FAILURE_RESPONSE });
  });
});
