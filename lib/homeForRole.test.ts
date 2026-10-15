import { describe, expect, it } from "vitest";
import { homeForRole } from "./homeForRole";

describe("homeForRole", () => {
  it("sends admins to the dashboard", () => {
    expect(homeForRole("admin")).toBe("/dashboard");
  });

  it("sends teachers to /students", () => {
    expect(homeForRole("teacher")).toBe("/students");
  });

  it("defaults unknown/missing roles to /students", () => {
    expect(homeForRole("student")).toBe("/students");
    expect(homeForRole(undefined)).toBe("/students");
  });
});
