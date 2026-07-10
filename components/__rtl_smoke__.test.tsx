import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

// Tracer-bullet: proves the RTL harness can render React, resolve the "@"
// path alias inside a .test.tsx file, and apply jest-dom matchers.
describe("RTL harness smoke test", () => {
  it("renders a React component and applies jest-dom matchers", () => {
    render(
      <button type="button" aria-label="ping">
        pong
      </button>,
    );

    const button = screen.getByRole("button", { name: "ping" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("pong");
  });

  it("resolves the @ alias to project utils inside a JSX test file", () => {
    expect(cn("a", "b")).toBe("a b");
  });
});
