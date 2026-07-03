import { describe, expect, it } from "vitest";
import { gradeSpread, mean, rankStandardCompetition } from "./gradeAnalytics";

describe("mean", () => {
  it("averages values", () => {
    expect(mean([80, 70, 90])).toBeCloseTo(80);
    expect(mean([42])).toBeCloseTo(42);
  });

  it("returns null (never NaN) for an empty list", () => {
    // A NaN from sum/0 would escape into the query result and reach the chart.
    expect(mean([])).toBeNull();
  });
});

describe("gradeSpread", () => {
  it("counts every letter bucket, zero-filling absent grades", () => {
    expect(gradeSpread(["A", "A", "F", "C", "A+"])).toEqual({
      "A+": 1,
      A: 2,
      B: 0,
      C: 1,
      D: 0,
      F: 1,
    });
  });

  it("returns an all-zero spread for no grades", () => {
    expect(gradeSpread([])).toEqual({ "A+": 0, A: 0, B: 0, C: 0, D: 0, F: 0 });
  });
});

describe("rankStandardCompetition", () => {
  it("ranks distinct values highest-first (1st = highest)", () => {
    const ranked = rankStandardCompetition(
      [{ v: 70 }, { v: 90 }, { v: 80 }],
      (x) => x.v,
    );
    // Returned in the SAME order as input, each tagged with its rank.
    expect(ranked).toEqual([
      { item: { v: 70 }, rank: 3 },
      { item: { v: 90 }, rank: 1 },
      { item: { v: 80 }, rank: 2 },
    ]);
  });

  it("shares a rank for ties and skips the next (5,5,7 not 5,5,6)", () => {
    const ranks = rankStandardCompetition(
      [{ v: 90 }, { v: 85 }, { v: 85 }, { v: 80 }],
      (x) => x.v,
    ).map((r) => r.rank);
    expect(ranks).toEqual([1, 2, 2, 4]);
  });

  it("treats grades equal to 2dp as a tie despite float drift", () => {
    // The same grade reached by different float paths drifts at ~1e-14; both must be 1st.
    const a = (0.1 + 0.2) * 100; // 30.000000000000004
    const b = 30;
    expect(a).not.toBe(b); // precondition: raw values really do differ
    const ranks = rankStandardCompetition([{ v: a }, { v: b }], (x) => x.v).map(
      (r) => r.rank,
    );
    expect(ranks).toEqual([1, 1]);
  });

  it("ranks a single entry 1st and an empty list to []", () => {
    expect(rankStandardCompetition([{ v: 42 }], (x) => x.v)).toEqual([
      { item: { v: 42 }, rank: 1 },
    ]);
    expect(rankStandardCompetition([], (x: { v: number }) => x.v)).toEqual([]);
  });
});
