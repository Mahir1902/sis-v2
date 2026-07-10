import { describe, expect, it } from "vitest";
import { receiptEmailBody, receiptEmailSubject } from "./receiptTemplates";

describe("receiptEmailSubject", () => {
  it("matches the locked format `Money Receipt {receiptNumber} — {schoolName}`", () => {
    expect(
      receiptEmailSubject({
        receiptNumber: "RCP-2026-00042",
        schoolName: "Singapore International School",
      }),
    ).toBe("Money Receipt RCP-2026-00042 — Singapore International School");
  });
});

describe("receiptEmailBody", () => {
  const args = {
    payerName: "Mr Rahman",
    paymentDate: "08/05/2026",
    totalAmount: "৳50,000",
    studentName: "Mahir Rahman",
    schoolName: "Singapore International School",
  };

  it("pins the locked body verbatim with placeholders interpolated", () => {
    const expected = [
      "Dear Mr Rahman,",
      "",
      "Please find attached the Money Receipt for the payment received on",
      "08/05/2026 totaling BDT ৳50,000 for Mahir Rahman.",
      "",
      "If you have any questions, please reply to this email or contact",
      "the school office.",
      "",
      "Thank you,",
      "Singapore International School",
    ].join("\n");
    expect(receiptEmailBody(args)).toBe(expected);
  });

  it("opens with the payer name and closes with the school name", () => {
    const body = receiptEmailBody(args);
    expect(body.startsWith("Dear Mr Rahman,")).toBe(true);
    expect(body.endsWith("Singapore International School")).toBe(true);
  });

  it("re-interpolates each field independently", () => {
    const body = receiptEmailBody({
      ...args,
      payerName: "Mrs Karim",
      studentName: "Ayesha Karim",
      totalAmount: "BDT 12,500",
    });
    expect(body).toContain("Dear Mrs Karim,");
    expect(body).toContain("totaling BDT BDT 12,500 for Ayesha Karim.");
  });
});
