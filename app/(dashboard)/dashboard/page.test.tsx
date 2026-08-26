import { render, screen } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// The page (and the RoleGate it renders) fetch via useQuery. Route by function
// name so the test controls getMe while the dashboard stats stay "loading".
const useQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (ref: unknown) => useQuery(ref),
}));

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

import DashboardPage from "./page";

type Me = { role: string; isActive: boolean } | null | undefined;

const givenMe = (me: Me) =>
  useQuery.mockImplementation((ref: unknown) =>
    // biome-ignore lint/suspicious/noExplicitAny: opaque generated function reference
    getFunctionName(ref as any) === "users:getMe" ? me : undefined,
  );

afterEach(() => vi.clearAllMocks());

// Regression test for #121: "/" and the login redirect both land on /dashboard,
// which is admin-only. Non-admins must be redirected to their role home instead
// of being shown Access Denied.
describe("DashboardPage role redirect", () => {
  it("redirects an active teacher to /students without flashing Access Denied", () => {
    givenMe({ role: "teacher", isActive: true });
    const { container } = render(<DashboardPage />);
    expect(replace).toHaveBeenCalledWith("/students");
    expect(screen.queryByText("Access Denied")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("redirects an active student to /students", () => {
    givenMe({ role: "student", isActive: true });
    render(<DashboardPage />);
    expect(replace).toHaveBeenCalledWith("/students");
  });

  it("keeps an active admin on the dashboard", () => {
    givenMe({ role: "admin", isActive: true });
    render(<DashboardPage />);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText(/Welcome back/)).toBeInTheDocument();
  });

  it("does not redirect a deactivated teacher so the gate can explain", () => {
    givenMe({ role: "teacher", isActive: false });
    render(<DashboardPage />);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("Account Deactivated")).toBeInTheDocument();
  });

  it("does not redirect while getMe is still loading", () => {
    givenMe(undefined);
    render(<DashboardPage />);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByText("Access Denied")).not.toBeInTheDocument();
  });
});
