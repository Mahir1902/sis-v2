import { describe, expect, it } from "vitest";
import { buildReceiptSnapshot } from "./receiptSnapshot";

const student = {
  studentFullName: "Sara Ahmed",
  studentNumber: "STU-0042",
};

const billingContact = {
  name: "Ahmed Khan",
  contactType: "father" as const,
};

const issuer = { name: "Tahmid Iqbal" };

const feeStructures = new Map<string, { name: string }>([
  ["fs-tuition", { name: "Tuition Fee" }],
  ["fs-library", { name: "Library Fee" }],
]);

describe("buildReceiptSnapshot", () => {
  it("snapshots student name and number", () => {
    const snap = buildReceiptSnapshot({
      student,
      billingContact,
      issuer,
      feeStructures,
      paidLines: [
        {
          feeStructureId: "fs-tuition",
          originalAmount: 5000,
          discountAmount: 0,
          paidAmount: 5000,
        },
      ],
    });
    expect(snap.studentNameSnapshot).toBe("Sara Ahmed");
    expect(snap.studentNumberSnapshot).toBe("STU-0042");
  });

  it("maps billing contact to payerName and payerRole", () => {
    const snap = buildReceiptSnapshot({
      student,
      billingContact: { name: "Fatima Khan", contactType: "mother" },
      issuer,
      feeStructures,
      paidLines: [
        {
          feeStructureId: "fs-tuition",
          originalAmount: 5000,
          discountAmount: 0,
          paidAmount: 5000,
        },
      ],
    });
    expect(snap.payerName).toBe("Fatima Khan");
    expect(snap.payerRole).toBe("mother");
  });

  it("snapshots the issuer name", () => {
    const snap = buildReceiptSnapshot({
      student,
      billingContact,
      issuer: { name: "Mr. Hossain" },
      feeStructures,
      paidLines: [
        {
          feeStructureId: "fs-tuition",
          originalAmount: 5000,
          discountAmount: 0,
          paidAmount: 5000,
        },
      ],
    });
    expect(snap.issuerName).toBe("Mr. Hossain");
  });

  it("resolves the fee structure name on each line item", () => {
    const snap = buildReceiptSnapshot({
      student,
      billingContact,
      issuer,
      feeStructures,
      paidLines: [
        {
          feeStructureId: "fs-tuition",
          billingPeriod: "2026-06",
          originalAmount: 5000,
          discountAmount: 0,
          paidAmount: 5000,
        },
        {
          feeStructureId: "fs-library",
          originalAmount: 500,
          discountAmount: 0,
          paidAmount: 500,
        },
      ],
    });
    expect(snap.lineItems).toHaveLength(2);
    expect(snap.lineItems[0]).toMatchObject({
      feeStructureName: "Tuition Fee",
      billingPeriod: "2026-06",
      originalAmount: 5000,
      discountAmount: 0,
      paidAmount: 5000,
    });
    expect(snap.lineItems[1]).toMatchObject({
      feeStructureName: "Library Fee",
      billingPeriod: undefined,
      originalAmount: 500,
      discountAmount: 0,
      paidAmount: 500,
    });
  });

  it("throws when a line item references an unknown fee structure", () => {
    expect(() =>
      buildReceiptSnapshot({
        student,
        billingContact,
        issuer,
        feeStructures,
        paidLines: [
          {
            feeStructureId: "fs-missing",
            originalAmount: 100,
            discountAmount: 0,
            paidAmount: 100,
          },
        ],
      }),
    ).toThrow(/fs-missing/);
  });
});
