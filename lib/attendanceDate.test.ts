import { describe, expect, it } from "vitest";
import {
  dhakaDate,
  formatDisplayDate,
  isWeekend,
  shiftDate,
} from "./attendanceDate";

describe("dhakaDate", () => {
  it("rolls over to the next day at 18:00 UTC (00:00 Dhaka)", () => {
    expect(dhakaDate(Date.UTC(2026, 2, 10, 17, 59))).toBe("2026-03-10");
    expect(dhakaDate(Date.UTC(2026, 2, 10, 18, 0))).toBe("2026-03-11");
  });

  it("stays on the same day just before midnight Dhaka", () => {
    // 23:55 Dhaka on 31 Dec = 17:55 UTC on 31 Dec
    expect(dhakaDate(Date.UTC(2026, 11, 31, 17, 55))).toBe("2026-12-31");
    // 00:05 Dhaka on 1 Jan = 18:05 UTC on 31 Dec
    expect(dhakaDate(Date.UTC(2026, 11, 31, 18, 5))).toBe("2027-01-01");
  });
});

describe("shiftDate", () => {
  it("shifts by calendar days across month and year boundaries", () => {
    expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDate("2026-01-01", -14)).toBe("2025-12-18");
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDate("2026-05-10", 0)).toBe("2026-05-10");
  });
});

describe("isWeekend", () => {
  it("classifies Friday and Saturday as the weekend", () => {
    expect(isWeekend("2026-03-13")).toBe(true); // Friday
    expect(isWeekend("2026-03-14")).toBe(true); // Saturday
  });

  it("classifies Sunday through Thursday as school days", () => {
    for (const d of [
      "2026-03-15",
      "2026-03-16",
      "2026-03-17",
      "2026-03-18",
      "2026-03-19",
    ]) {
      expect(isWeekend(d)).toBe(false);
    }
  });
});

describe("formatDisplayDate", () => {
  it("renders DD-MM-YYYY", () => {
    expect(formatDisplayDate("2026-03-05")).toBe("05-03-2026");
  });
});
