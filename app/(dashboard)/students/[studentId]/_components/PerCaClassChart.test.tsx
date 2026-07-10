import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PerCaChartPoint } from "@/lib/academicHistoryView";
import { PerCaClassChart } from "./PerCaClassChart";

const emptyData: PerCaChartPoint[] = [
  { ca: "CA-1", you: null, classMean: null },
  { ca: "CA-2", you: null, classMean: null },
  { ca: "CA-3", you: null, classMean: null },
];

const populatedData: PerCaChartPoint[] = [
  { ca: "CA-1", you: 80, classMean: 74 },
  { ca: "CA-2", you: 85, classMean: 76 },
  { ca: "CA-3", you: 78, classMean: 75 },
];

describe("PerCaClassChart", () => {
  it("renders a status skeleton and no chart or empty text when loading", () => {
    render(<PerCaClassChart data={emptyData} loading={true} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(
      screen.queryByText("No CA data for this subject yet."),
    ).not.toBeInTheDocument();
  });

  it("renders the empty state when every point has no data", () => {
    render(<PerCaClassChart data={emptyData} />);

    expect(
      screen.getByText("No CA data for this subject yet."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders the subject title and no empty state when data is present", () => {
    render(<PerCaClassChart data={populatedData} subjectName="Mathematics" />);

    expect(screen.getByText(/Mathematics/)).toBeInTheDocument();
    expect(
      screen.queryByText("No CA data for this subject yet."),
    ).not.toBeInTheDocument();
  });
});
