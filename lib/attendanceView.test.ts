import { describe, expect, it } from "vitest";
import {
  appearanceNotes,
  closureVoidMessage,
  currentYear,
  formatDhakaTime,
  nextStatus,
  percentLabel,
  saveButtonLabel,
  unmarkedDaysBanner,
} from "./attendanceView";

describe("attendanceView", () => {
  it("cycles present → absent → late → present", () => {
    expect(nextStatus("present")).toBe("absent");
    expect(nextStatus("absent")).toBe("late");
    expect(nextStatus("late")).toBe("present");
  });

  it("save button carries the marked-yet signal", () => {
    const counts = { present: 27, late: 2, absent: 1 };
    expect(
      saveButtonLabel({ alreadyMarked: false, touched: false, counts }),
    ).toBe("Confirm all 30 present");
    expect(
      saveButtonLabel({ alreadyMarked: false, touched: true, counts }),
    ).toBe("Save — 27 present · 2 late · 1 absent");
    expect(
      saveButtonLabel({ alreadyMarked: true, touched: true, counts }),
    ).toBe("Update register");
  });

  it("renders — for an empty denominator, never 0%", () => {
    expect(percentLabel({ present: 0, late: 0, denominator: 0 })).toBe("—");
    expect(percentLabel({ present: 33, late: 2, denominator: 39 })).toBe("89%");
  });

  it("words both appearance flags and the never-appears note", () => {
    expect(
      appearanceNotes({
        denominator: 0,
        firstAppearance: null,
        markedBeforeFirst: 0,
        lastAppearance: null,
        markedAfterLast: 0,
      }),
    ).toEqual(["never appears in this period's register"]);
    expect(
      appearanceNotes({
        denominator: 40,
        firstAppearance: "2026-01-12",
        markedBeforeFirst: 30,
        lastAppearance: "2026-09-30",
        markedAfterLast: 40,
      }),
    ).toEqual([
      "first appears 12 Jan — the class was marked on 30 days before that",
      "last appears 30 Sep — class marked 40 days after",
    ]);
  });

  it("writes the completeness banner in prose", () => {
    expect(
      unmarkedDaysBanner({ schoolDaysUnmarked: 2, classMarkedDays: 38 }),
    ).toBe(
      "2 of 40 school days were never marked for this class. Those days count for nobody — every figure below is out of 38.",
    );
    expect(
      unmarkedDaysBanner({ schoolDaysUnmarked: 0, classMarkedDays: 38 }),
    ).toBeNull();
  });

  it("writes the void-confirm message", () => {
    expect(
      closureVoidMessage({
        startDate: "2026-04-12",
        endDate: "2026-04-12",
        markCount: 87,
        classCount: 4,
      }),
    ).toBe(
      "12 Apr already has 87 marks across 4 classes. Adding this closure voids them from all attendance figures.",
    );
  });

  it("formats mark time in Dhaka local time and picks the current year", () => {
    expect(formatDhakaTime(Date.UTC(2026, 3, 12, 2, 12))).toBe("08:12");
    const years = [
      { name: "a", startDate: 0, endDate: 10 },
      { name: "b", startDate: 20, endDate: 30 },
    ];
    expect(currentYear(years, 25)?.name).toBe("b");
    expect(currentYear(years, 15)?.name).toBe("b");
  });
});
