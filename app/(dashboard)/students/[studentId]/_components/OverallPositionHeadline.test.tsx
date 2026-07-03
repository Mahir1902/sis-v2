import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OverallPositionHeadline } from "./OverallPositionHeadline";

describe("OverallPositionHeadline", () => {
  it("renders the ranked headline with an award icon and no detail line", () => {
    render(
      <OverallPositionHeadline overall={{ rank: 1, outOf: 6 }} reason={null} />,
    );

    expect(screen.getByText("Stood 1st of 6 in class")).toBeInTheDocument();
    // Decorative accent icon is present for a real rank.
    expect(screen.getByTestId("award-icon")).toBeInTheDocument();
    // No detail line for a ranked result.
    expect(screen.queryByTestId("position-detail")).not.toBeInTheDocument();
  });

  it("renders the provisional headline and its detail", () => {
    render(<OverallPositionHeadline overall={null} reason="provisional" />);

    expect(screen.getByText("Class position pending")).toBeInTheDocument();
    expect(
      screen.getByText("Class position posts when all subjects are final"),
    ).toBeInTheDocument();
  });

  it("renders the insufficient-peers detail", () => {
    render(
      <OverallPositionHeadline overall={null} reason="insufficient_peers" />,
    );

    expect(
      screen.getByText("Needs 5 or more fully-graded classmates"),
    ).toBeInTheDocument();
  });

  it("renders the not-graded headline with no detail", () => {
    render(<OverallPositionHeadline overall={null} reason="not_graded" />);

    expect(screen.getByText("Not yet graded this term")).toBeInTheDocument();
    expect(screen.queryByTestId("position-detail")).not.toBeInTheDocument();
  });

  it("renders a loading status and no headline text when loading", () => {
    render(
      <OverallPositionHeadline overall={null} reason={null} loading={true} />,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(
      screen.queryByText("Class position pending"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("award-icon")).not.toBeInTheDocument();
  });
});
