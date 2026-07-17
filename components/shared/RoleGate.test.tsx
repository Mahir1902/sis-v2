import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// RoleGate calls useQuery(api.users.getMe). Mock convex/react so the test drives
// exactly what getMe returns without any backend.
const useQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: () => useQuery(),
}));

import { RoleGate } from "./RoleGate";

const me = (over: Partial<{ role: string; isActive: boolean }>) => ({
  _id: "u1",
  name: "Test",
  email: "t@e.com",
  role: "admin",
  isActive: true,
  ...over,
});

afterEach(() => vi.clearAllMocks());

describe("RoleGate", () => {
  it("renders children for an active user with an allowed role", () => {
    useQuery.mockReturnValue(me({ role: "admin", isActive: true }));
    render(
      <RoleGate allowedRoles={["admin"]}>
        <p>secret</p>
      </RoleGate>,
    );
    expect(screen.getByText("secret")).toBeInTheDocument();
  });

  it("denies an active user without an allowed role", () => {
    useQuery.mockReturnValue(me({ role: "teacher", isActive: true }));
    render(
      <RoleGate allowedRoles={["admin"]}>
        <p>secret</p>
      </RoleGate>,
    );
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    expect(screen.getByText("Access Denied")).toBeInTheDocument();
  });

  // The bug: a deactivated admin keeps role "admin", so the old gate let them
  // through and the page's admin-only queries then threw Unauthorized (the
  // settings "Something went wrong"). The gate must deny inactive users itself.
  it("denies a deactivated user even when their role would be allowed", () => {
    useQuery.mockReturnValue(me({ role: "admin", isActive: false }));
    render(
      <RoleGate allowedRoles={["admin"]}>
        <p>secret</p>
      </RoleGate>,
    );
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    expect(screen.getByText("Account Deactivated")).toBeInTheDocument();
  });
});
