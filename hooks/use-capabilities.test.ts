import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// useCapabilities reads the auth state and api.users.getMe; drive both.
const getMe = vi.fn();
const auth = { isAuthenticated: true, isLoading: false };
vi.mock("convex/react", () => ({
  useQuery: () => getMe(),
  useConvexAuth: () => auth,
}));

import { useCapabilities } from "./use-capabilities";

const me = (over: object) => ({
  _id: "u1",
  name: "Test",
  email: "t@school.edu",
  role: "admin",
  isActive: true,
  ...over,
});

afterEach(() => {
  vi.clearAllMocks();
  auth.isAuthenticated = true;
  auth.isLoading = false;
});

describe("useCapabilities", () => {
  it("is loading, with nothing granted, until the account is known", () => {
    getMe.mockReturnValue(undefined);
    const { result } = renderHook(() => useCapabilities());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.can("viewReferenceData")).toBe(false);
  });

  it("answers from the policy table for the signed-in role", () => {
    getMe.mockReturnValue(me({ role: "teacher" }));
    const { result } = renderHook(() => useCapabilities());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.can("listStudents")).toBe(true);
    expect(result.current.can("manageStudents")).toBe(false);
    // The defect-1 question: may this page subscribe to the student's fees?
    expect(result.current.canOnStudent("viewStudentFees", "s1")).toBe(false);
    expect(result.current.canOnStudent("viewStudent", "s1")).toBe(true);
  });

  it("includes a feature an admin granted this teacher", () => {
    getMe.mockReturnValue(me({ role: "teacher", grants: ["viewAuditLog"] }));
    const { result } = renderHook(() => useCapabilities());
    expect(result.current.can("viewAuditLog")).toBe(true);
    expect(result.current.can("promoteStudents")).toBe(false);
  });

  it("limits a student account to the student record it is linked to", () => {
    getMe.mockReturnValue(me({ role: "student", studentId: "own" }));
    const { result } = renderHook(() => useCapabilities());
    expect(result.current.canOnStudent("viewStudentFees", "own")).toBe(true);
    expect(result.current.canOnStudent("viewStudentFees", "other")).toBe(false);
    expect(result.current.can("listStudents")).toBe(false);
  });

  it("grants a deactivated account nothing", () => {
    getMe.mockReturnValue(me({ role: "admin", isActive: false }));
    const { result } = renderHook(() => useCapabilities());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.can("viewDashboard")).toBe(false);
    expect(result.current.canOnStudent("viewStudent", "s1")).toBe(false);
  });

  it("keeps the last known account while a token refresh returns null", () => {
    getMe.mockReturnValue(me({ role: "teacher" }));
    const { result, rerender } = renderHook(() => useCapabilities());
    getMe.mockReturnValue(null);
    rerender();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.can("listStudents")).toBe(true);
    expect(result.current.me?.role).toBe("teacher");
  });

  it("is loading — not denied — when a page mounts during a token refresh", () => {
    // Signed in, but getMe has not resolved to an account yet and this hook
    // instance has none cached: a gate must wait, not flash "Access Denied".
    getMe.mockReturnValue(null);
    const { result } = renderHook(() => useCapabilities());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.can("listStudents")).toBe(false);
  });

  it("drops every capability the moment the session ends", () => {
    // Otherwise a gated query re-subscribes with no identity and the server
    // answers "Unauthenticated" before the redirect to /login.
    getMe.mockReturnValue(me({ role: "admin" }));
    const { result, rerender } = renderHook(() => useCapabilities());
    expect(result.current.can("listStudents")).toBe(true);

    auth.isAuthenticated = false;
    getMe.mockReturnValue(null);
    rerender();
    expect(result.current.can("listStudents")).toBe(false);
    expect(result.current.canOnStudent("viewStudent", "s1")).toBe(false);
    // Loading, so no gate renders a "denied" message on the way out.
    expect(result.current.isLoading).toBe(true);
  });
});
