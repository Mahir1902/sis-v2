import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// useCapabilities reads api.users.getMe; drive exactly what it returns.
const getMe = vi.fn();
vi.mock("convex/react", () => ({ useQuery: () => getMe() }));

import { useCapabilities } from "./use-capabilities";

const me = (over: object) => ({
  _id: "u1",
  name: "Test",
  email: "t@school.edu",
  role: "admin",
  isActive: true,
  ...over,
});

afterEach(() => vi.clearAllMocks());

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

  it("grants nothing when nobody is signed in", () => {
    getMe.mockReturnValue(null);
    const { result } = renderHook(() => useCapabilities());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.me).toBeNull();
    expect(result.current.can("viewReferenceData")).toBe(false);
  });
});
