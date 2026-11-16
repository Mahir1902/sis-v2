import { act, renderHook, waitFor } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const queries = new Map<string, unknown>([
  ["campus:list", [{ _id: "c1", name: "Campus A" }]],
  ["standardLevels:list", [{ _id: "l1", name: "Grade 4" }]],
  [
    "academicYears:list",
    [
      { _id: "y-last", name: "2025", startDate: 0, endDate: Date.now() - 1e9 },
      {
        _id: "y-now",
        name: "2026",
        startDate: Date.now() - 1e9,
        endDate: Date.now() + 1e10,
      },
    ],
  ],
  ["academicYears:getCurrent", { status: "current", year: { _id: "y-now" } }],
]);
vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0]) =>
    queries.get(getFunctionName(ref)),
}));

import { useAttendanceClass } from "./use-attendance-class";

afterEach(() => localStorage.clear());

describe("useAttendanceClass", () => {
  it("restores campus and level but opens on the server's current year", async () => {
    // Saved before the year rolled over.
    localStorage.setItem(
      "attendance.lastClass",
      JSON.stringify({
        campus: "c1",
        standardLevelId: "l1",
        academicYear: "y-last",
      }),
    );
    const { result } = renderHook(() => useAttendanceClass());
    await waitFor(() =>
      expect(result.current.classKey).toEqual({
        campus: "c1",
        standardLevelId: "l1",
        academicYear: "y-now",
      }),
    );
  });

  it("leaves the year unselected when there is no current year", async () => {
    queries.set("academicYears:getCurrent", {
      status: "overlap",
      years: [{ _id: "y-last" }, { _id: "y-now" }],
    });
    localStorage.setItem(
      "attendance.lastClass",
      JSON.stringify({ campus: "c1", standardLevelId: "l1" }),
    );
    const { result } = renderHook(() => useAttendanceClass());
    await waitFor(() => expect(result.current.selection.campus).toBe("c1"));
    expect(result.current.selection.academicYear).toBeUndefined();
    expect(result.current.classKey).toBeNull();
    queries.set("academicYears:getCurrent", {
      status: "current",
      year: { _id: "y-now" },
    });
  });

  it("remembers only campus and level", () => {
    const { result } = renderHook(() => useAttendanceClass());
    act(() =>
      result.current.update({
        campus: "c1",
        standardLevelId: "l1",
        academicYear: "y-last",
      } as never),
    );
    expect(
      JSON.parse(localStorage.getItem("attendance.lastClass") ?? "{}"),
    ).toEqual({ campus: "c1", standardLevelId: "l1" });
  });
});
