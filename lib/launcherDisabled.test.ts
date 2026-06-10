import { describe, expect, it } from "vitest";
import { emailLauncherDisabledReason } from "./launcherDisabled";

const baseStudent = {
  primaryBillingContact: "father" as const,
  fatherName: "Mr Rahman",
  fatherEmail: "father@example.com",
  motherName: "Mrs Rahman",
  motherEmail: "mother@example.com",
  guardianName: "Mr Karim",
  guardianEmail: undefined,
};

describe("emailLauncherDisabledReason", () => {
  it("returns the locked tooltip when primaryBillingContact is unset", () => {
    expect(
      emailLauncherDisabledReason({
        ...baseStudent,
        primaryBillingContact: undefined,
      }),
    ).toBe("No Billing Contact set for this student.");
  });

  it("returns the locked tooltip when the resolved Billing Contact has no email", () => {
    expect(
      emailLauncherDisabledReason({
        ...baseStudent,
        primaryBillingContact: "guardian",
        guardianEmail: undefined,
      }),
    ).toBe("No email on file for the Billing Contact.");
  });

  it("treats an empty-string email as missing", () => {
    expect(
      emailLauncherDisabledReason({
        ...baseStudent,
        primaryBillingContact: "father",
        fatherEmail: "",
      }),
    ).toBe("No email on file for the Billing Contact.");
  });

  it("treats a whitespace-only email as missing", () => {
    expect(
      emailLauncherDisabledReason({
        ...baseStudent,
        primaryBillingContact: "mother",
        motherEmail: "   ",
      }),
    ).toBe("No email on file for the Billing Contact.");
  });

  it("returns null when the Billing Contact is set and has an email", () => {
    expect(emailLauncherDisabledReason(baseStudent)).toBeNull();
  });

  it("returns null for whichever Billing Contact has the email", () => {
    expect(
      emailLauncherDisabledReason({
        ...baseStudent,
        primaryBillingContact: "mother",
      }),
    ).toBeNull();
  });
});
