import { describe, expect, it } from "vitest";
import { resolveBillingContact } from "./resolveBillingContact";

describe("resolveBillingContact", () => {
  const baseStudent = {
    primaryBillingContact: "father" as const,
    fatherName: "Mr Rahman",
    fatherEmail: "father@example.com",
    motherName: "Mrs Rahman",
    motherEmail: "mother@example.com",
    guardianName: "Mr Karim",
    guardianEmail: undefined,
  };

  it("returns the father's name and email when primaryBillingContact is father", () => {
    const result = resolveBillingContact(baseStudent);
    expect(result).toEqual({
      contactType: "father",
      name: "Mr Rahman",
      email: "father@example.com",
      hasEmail: true,
    });
  });

  it("returns the mother when primaryBillingContact is mother", () => {
    const result = resolveBillingContact({
      ...baseStudent,
      primaryBillingContact: "mother",
    });
    expect(result).toEqual({
      contactType: "mother",
      name: "Mrs Rahman",
      email: "mother@example.com",
      hasEmail: true,
    });
  });

  it("returns the guardian when primaryBillingContact is guardian", () => {
    const result = resolveBillingContact({
      ...baseStudent,
      primaryBillingContact: "guardian",
    });
    expect(result).toEqual({
      contactType: "guardian",
      name: "Mr Karim",
      email: undefined,
      hasEmail: false,
    });
  });

  it("treats an empty string email as missing", () => {
    const result = resolveBillingContact({
      ...baseStudent,
      fatherEmail: "",
    });
    expect(result.hasEmail).toBe(false);
    expect(result.email).toBeUndefined();
  });

  it("trims whitespace from the resolved email", () => {
    const result = resolveBillingContact({
      ...baseStudent,
      fatherEmail: "  father@example.com  ",
    });
    expect(result.email).toBe("father@example.com");
    expect(result.hasEmail).toBe(true);
  });
});
