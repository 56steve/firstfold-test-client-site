import { describe, expect, it } from "vitest";
import { practitionerInitials } from "./practitioner-initials";

describe("practitionerInitials", () => {
  it("takes the first letters of the first and last names", () => {
    expect(practitionerInitials("Aster Physio")).toBe("AP");
  });

  it.each(["Dr Rahul Menon", "Dr. Rahul Menon", "dr rahul menon", "DR. Rahul Menon"])(
    "skips a leading Dr/Dr. title: %s",
    (name) => {
      expect(practitionerInitials(name)).toBe("RM");
    },
  );

  it("uses only the first and last of three or more names", () => {
    expect(practitionerInitials("Dr Asha Lakshmi Rao")).toBe("AR");
  });

  it("gives one letter for a single name", () => {
    expect(practitionerInitials("Madhu")).toBe("M");
  });

  it("keeps a lone Dr rather than returning nothing", () => {
    expect(practitionerInitials("Dr")).toBe("D");
  });

  it("does not skip a name that merely starts with Dr", () => {
    expect(practitionerInitials("Drew Barry")).toBe("DB");
  });

  it("ignores extra whitespace", () => {
    expect(practitionerInitials("  Dr   Rahul    Menon  ")).toBe("RM");
  });

  it("uppercases and keeps a non-Latin first character whole", () => {
    expect(practitionerInitials("éa ñu")).toBe("ÉÑ");
    expect(practitionerInitials("𝒜sha Rao")).toBe("𝒜R");
  });

  it("returns an empty string for a blank name", () => {
    expect(practitionerInitials("   ")).toBe("");
  });
});
