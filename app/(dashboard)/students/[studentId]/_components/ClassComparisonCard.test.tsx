import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import type { SubjectRowView } from "@/lib/academicHistoryView";
import {
  ClassComparisonCard,
  SubjectComparisonRowView,
} from "./ClassComparisonCard";

/** Minimal helper to build a SubjectRowView with sensible defaults. */
function makeView(overrides: Partial<SubjectRowView> = {}): SubjectRowView {
  return {
    // `as` casts only the branded id — the value never leaves the pure view.
    subjectId: "subject_1" as SubjectRowView["subjectId"],
    subjectName: "Mathematics",
    weightedAverage: 86,
    classAverage: 74,
    delta: 12,
    position: { rank: 1, outOf: 6 },
    provisional: false,
    presentCaCount: 3,
    expectedCaCount: 3,
    ...overrides,
  };
}

describe("SubjectComparisonRowView", () => {
  it("renders full data: name, You, Class, +delta with up icon, position, no badge", () => {
    render(<SubjectComparisonRowView data={makeView()} />);

    expect(screen.getByText("Mathematics")).toBeInTheDocument();
    expect(screen.getByText("86.0%")).toBeInTheDocument();
    expect(screen.getByText("74.0%")).toBeInTheDocument();
    expect(screen.getByText("+12.0")).toBeInTheDocument();
    expect(screen.getByTestId("delta-up-icon")).toBeInTheDocument();
    expect(screen.getByText("1st of 6")).toBeInTheDocument();
    expect(screen.queryByText("Provisional")).not.toBeInTheDocument();
  });

  it("suppresses the class column and delta when classAverage is null", () => {
    render(
      <SubjectComparisonRowView
        data={makeView({ classAverage: null, delta: null })}
      />,
    );

    expect(screen.getByText("not enough class data yet")).toBeInTheDocument();
    // No delta icon of any direction when there is no delta.
    expect(screen.queryByTestId("delta-up-icon")).not.toBeInTheDocument();
    expect(screen.queryByTestId("delta-down-icon")).not.toBeInTheDocument();
    expect(screen.queryByTestId("delta-flat-icon")).not.toBeInTheDocument();
  });

  it("renders a negative delta with a down icon and a below-class aria-label", () => {
    render(
      <SubjectComparisonRowView
        data={makeView({ weightedAverage: 69, classAverage: 74, delta: -5 })}
      />,
    );

    expect(screen.getByText("-5.0")).toBeInTheDocument();
    expect(screen.getByTestId("delta-down-icon")).toBeInTheDocument();
    expect(screen.getByLabelText("5.0 below class")).toBeInTheDocument();
  });

  it("shows a Provisional badge with its sub-label and no position when provisional", () => {
    render(
      <SubjectComparisonRowView
        data={makeView({
          provisional: true,
          position: null,
          presentCaCount: 1,
          expectedCaCount: 3,
        })}
      />,
    );

    expect(screen.getByText("Provisional")).toBeInTheDocument();
    expect(screen.getByText("Based on 1 of 3 CAs")).toBeInTheDocument();
    // No position text when position is null.
    expect(screen.queryByText(/of 6/)).not.toBeInTheDocument();
  });
});

describe("ClassComparisonCard", () => {
  const queryArgs = {
    standardLevelId: "level_1" as Id<"standardLevels">,
    academicYear: "year_1" as Id<"academicYears">,
    semester: 1 as const,
    studentId: "student_1" as Id<"students">,
  };

  it("renders the empty state when there are no rows and not loading", () => {
    render(
      <ClassComparisonCard rows={[]} queryArgs={queryArgs} loading={false} />,
    );

    expect(
      screen.getByText("No graded subjects this term yet."),
    ).toBeInTheDocument();
    // Empty state, not a loading status.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders a loading skeleton and not the empty state when loading", () => {
    render(
      <ClassComparisonCard rows={[]} queryArgs={queryArgs} loading={true} />,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(
      screen.queryByText("No graded subjects this term yet."),
    ).not.toBeInTheDocument();
  });
});
