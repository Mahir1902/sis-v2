import { describe, expect, it } from "vitest";
import { inviteUserSchema } from "./inviteSchema";

describe("inviteUserSchema", () => {
  it("accepts a valid admin/teacher invite", () => {
    expect(
      inviteUserSchema.safeParse({
        name: "Fatima Sesay",
        email: "fatima@school.edu",
        role: "teacher",
      }).success,
    ).toBe(true);
  });

  it("rejects a one-character name", () => {
    expect(
      inviteUserSchema.safeParse({ name: "F", email: "f@s.edu", role: "admin" })
        .success,
    ).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(
      inviteUserSchema.safeParse({
        name: "Fatima",
        email: "nope",
        role: "admin",
      }).success,
    ).toBe(false);
  });

  it("rejects student (not invitable here)", () => {
    expect(
      inviteUserSchema.safeParse({
        name: "Fatima",
        email: "f@s.edu",
        role: "student",
      }).success,
    ).toBe(false);
  });
});
