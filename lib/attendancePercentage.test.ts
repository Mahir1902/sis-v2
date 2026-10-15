import { describe, expect, it } from "vitest";
import { attendancePercentage } from "./attendancePercentage";

describe("attendancePercentage", () => {
  it("rounds down, never up (the worked example: 35/39 → 89)", () => {
    expect(
      attendancePercentage({ present: 33, late: 2, denominator: 39 }),
    ).toBe(89);
    // 249/250 = 99.6 → 99, so 100% means genuinely never missed a day
    expect(
      attendancePercentage({ present: 249, late: 0, denominator: 250 }),
    ).toBe(99);
    expect(
      attendancePercentage({ present: 250, late: 0, denominator: 250 }),
    ).toBe(100);
  });

  it("returns null for a zero denominator", () => {
    expect(attendancePercentage({ present: 0, late: 0, denominator: 0 })).toBe(
      null,
    );
  });

  it("counts late as present", () => {
    expect(
      attendancePercentage({ present: 0, late: 10, denominator: 10 }),
    ).toBe(100);
  });
});
