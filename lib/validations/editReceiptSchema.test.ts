import { describe, expect, it } from "vitest";
import { editReceiptSchema } from "./editReceiptSchema";

describe("editReceiptSchema", () => {
  it("rejects when no field is provided", () => {
    const result = editReceiptSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) =>
          i.message.includes("Provide at least one field"),
        ),
      ).toBe(true);
    }
  });

  it("accepts a single-field edit (payerName only)", () => {
    const result = editReceiptSchema.safeParse({
      payerName: "Muhammad Rahman",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a single-field edit (payerRole only)", () => {
    const result = editReceiptSchema.safeParse({ payerRole: "mother" });
    expect(result.success).toBe(true);
  });

  it("accepts a single-field edit (remarks only, including empty after trim is rejected)", () => {
    expect(
      editReceiptSchema.safeParse({ remarks: "Cash collected at counter" })
        .success,
    ).toBe(true);
  });

  it("rejects an unknown payerRole", () => {
    const result = editReceiptSchema.safeParse({ payerRole: "uncle" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty-after-trim payerName", () => {
    const result = editReceiptSchema.safeParse({ payerName: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) =>
          i.message.includes("Payer name cannot be empty"),
        ),
      ).toBe(true);
    }
  });

  it("trims whitespace from string fields", () => {
    const result = editReceiptSchema.safeParse({
      payerName: "  Muhammad Rahman  ",
      remarks: "  Paid in full  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.payerName).toBe("Muhammad Rahman");
      expect(result.data.remarks).toBe("Paid in full");
    }
  });

  it("rejects remarks longer than 500 characters", () => {
    const result = editReceiptSchema.safeParse({ remarks: "x".repeat(501) });
    expect(result.success).toBe(false);
  });
});
