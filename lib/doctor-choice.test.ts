import { describe, expect, it } from "vitest";
import { bookedMessage, doctorChoices, doctorLine } from "./doctor-choice";
import type { SiteInfoPractitioner } from "./site-info";

const ASTER: SiteInfoPractitioner = {
  id: "0f5c9a3e-2b1d-4c7e-9a8f-1d2e3f4a5b6c",
  name: "Aster Physio",
  title: null,
  photoUrl: null,
};
const RAHUL: SiteInfoPractitioner = {
  id: "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
  name: "Dr Rahul Menon",
  title: "Sports physiotherapist",
  photoUrl: null,
};
const NEHA: SiteInfoPractitioner = { id: "3e4f5a6b-7c8d-4e9f-a0b1-c2d3e4f5a6b7", name: "Dr Neha Rao", title: null, photoUrl: null };
const NOT_A_UUID: SiteInfoPractitioner = { id: "doctor-2", name: "Dr Not Forwarded", title: null, photoUrl: null };

describe("doctorChoices", () => {
  it("offers every doctor, in order, when there are two or more", () => {
    expect(doctorChoices([ASTER, RAHUL])).toEqual([ASTER, RAHUL]);
  });

  it("offers no choice for a single doctor", () => {
    expect(doctorChoices([ASTER])).toEqual([]);
  });

  it("offers no choice when there are none, or the platform predates doctors", () => {
    expect(doctorChoices([])).toEqual([]);
    expect(doctorChoices(undefined)).toEqual([]);
  });

  it("drops a doctor whose id is not a uuid, since the availability route would not forward it", () => {
    expect(doctorChoices([ASTER, NOT_A_UUID, RAHUL])).toEqual([ASTER, RAHUL]);
  });

  it("offers no choice when fewer than two doctors have a uuid id", () => {
    expect(doctorChoices([ASTER, NOT_A_UUID])).toEqual([]);
    expect(doctorChoices([NOT_A_UUID, { ...NEHA, id: "" }])).toEqual([]);
  });
});

describe("doctorLine", () => {
  it("names the chosen doctor as given", () => {
    expect(doctorLine(RAHUL)).toBe("With Dr Rahul Menon");
    expect(doctorLine(ASTER)).toBe("With Aster Physio");
  });

  it("falls back to the first available doctor", () => {
    expect(doctorLine(null)).toBe("With the first available doctor");
  });
});

describe("bookedMessage", () => {
  it("names the doctor when the platform said who it booked with", () => {
    expect(bookedMessage("Tuesday 13 October", "2:00 – 2:30 pm", "Dr Rahul Menon")).toBe(
      "You're booked with Dr Rahul Menon: Tuesday 13 October, 2:00 – 2:30 pm.",
    );
  });

  it("keeps the doctor-less sentence when it didn't", () => {
    expect(bookedMessage("Tuesday 13 October", "2:00 – 2:30 pm", null)).toBe(
      "You're booked: Tuesday 13 October, 2:00 – 2:30 pm.",
    );
  });

  it("treats a blank name as no name", () => {
    expect(bookedMessage("Tuesday 13 October", "2:00 – 2:30 pm", "  ")).toBe(
      "You're booked: Tuesday 13 October, 2:00 – 2:30 pm.",
    );
  });
});
