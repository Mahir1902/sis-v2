import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  CURRENT_STANDING_SUBTITLE,
  CURRENT_STANDING_TITLE,
  type GradeSpreadDatum,
} from "@/lib/cohortView";
import { GradeSpreadChart } from "./GradeSpreadChart";

const series: GradeSpreadDatum[] = [
  { grade: "A+", count: 2 },
  { grade: "A", count: 3 },
  { grade: "B", count: 3 },
  { grade: "C", count: 4 },
  { grade: "D", count: 3 },
  { grade: "F", count: 2 },
];

describe("GradeSpreadChart", () => {
  it("renders the 'Current Standing' title and the in-progress subtitle", () => {
    render(<GradeSpreadChart series={series} total={17} />);

    expect(screen.getByText(CURRENT_STANDING_TITLE)).toBeInTheDocument();
    expect(screen.getByText(CURRENT_STANDING_SUBTITLE)).toBeInTheDocument();
  });

  it("never uses the word 'Results' as a heading or label", () => {
    render(<GradeSpreadChart series={series} total={17} />);
    // The subtitle sentence contains lowercase "results"; assert no capitalised
    // heading/label word "Results" appears anywhere.
    expect(screen.queryByText(/\bResults\b/)).not.toBeInTheDocument();
  });

  it("shows the pluralised total-grade count label", () => {
    render(<GradeSpreadChart series={series} total={17} />);
    expect(screen.getByText("17 grades")).toBeInTheDocument();
  });

  it("renders a status skeleton and no title while loading", () => {
    render(<GradeSpreadChart series={series} total={17} loading={true} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText(CURRENT_STANDING_TITLE)).not.toBeInTheDocument();
  });
});
