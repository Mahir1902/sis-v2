import { describe, expect, it } from "vitest";
import { getStudentInitials, studentSearchText } from "./studentRowDisplay";

describe("getStudentInitials", () => {
  it("takes the first two word initials", () => {
    expect(getStudentInitials("Ayesha Rahman Khan")).toBe("AR");
  });

  it("falls back to an em-dash for a student with no name (#93 import)", () => {
    expect(getStudentInitials(undefined)).toBe("—");
  });

  it("survives blank and multi-space names", () => {
    expect(getStudentInitials("   ")).toBe("—");
    expect(getStudentInitials("John  Doe")).toBe("JD");
  });
});

describe("studentSearchText", () => {
  it("joins name and student number", () => {
    expect(
      studentSearchText({
        studentFullName: "Ayesha Rahman",
        studentNumber: "S-1",
      }),
    ).toBe("Ayesha Rahman S-1");
  });

  it("never contains the word undefined when the name is missing", () => {
    const text = studentSearchText({
      studentFullName: undefined,
      studentNumber: "S-2",
    });
    expect(text).not.toContain("undefined");
    expect(text).toBe("S-2");
  });
});
