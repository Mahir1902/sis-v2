import { describe, expect, it } from "vitest";
import { distributeInvoicePayment } from "./distributeInvoicePayment";

describe("distributeInvoicePayment", () => {
  it("pays a single fee in full when the payment matches its balance", () => {
    const result = distributeInvoicePayment({
      paymentAmount: 1000,
      fees: [{ studentFeeId: "f1", balance: 1000 }],
    });
    expect(result).toEqual([{ studentFeeId: "f1", appliedAmount: 1000 }]);
  });

  it("pays fees in array order, fully applying earlier ones first", () => {
    const result = distributeInvoicePayment({
      paymentAmount: 1500,
      fees: [
        { studentFeeId: "f1", balance: 1000 },
        { studentFeeId: "f2", balance: 700 },
      ],
    });
    expect(result).toEqual([
      { studentFeeId: "f1", appliedAmount: 1000 },
      { studentFeeId: "f2", appliedAmount: 500 },
    ]);
  });

  it("only includes fees that received a non-zero amount", () => {
    const result = distributeInvoicePayment({
      paymentAmount: 700,
      fees: [
        { studentFeeId: "f1", balance: 1000 },
        { studentFeeId: "f2", balance: 500 },
      ],
    });
    expect(result).toEqual([{ studentFeeId: "f1", appliedAmount: 700 }]);
  });

  it("throws when the payment exceeds the total outstanding balance", () => {
    expect(() =>
      distributeInvoicePayment({
        paymentAmount: 2000,
        fees: [{ studentFeeId: "f1", balance: 1000 }],
      }),
    ).toThrow(/exceeds/i);
  });

  it("throws when the payment is zero or negative", () => {
    expect(() =>
      distributeInvoicePayment({
        paymentAmount: 0,
        fees: [{ studentFeeId: "f1", balance: 1000 }],
      }),
    ).toThrow(/positive/i);
    expect(() =>
      distributeInvoicePayment({
        paymentAmount: -10,
        fees: [{ studentFeeId: "f1", balance: 1000 }],
      }),
    ).toThrow(/positive/i);
  });

  it("ignores fees with zero or negative balance", () => {
    const result = distributeInvoicePayment({
      paymentAmount: 500,
      fees: [
        { studentFeeId: "fPaid", balance: 0 },
        { studentFeeId: "f1", balance: 500 },
      ],
    });
    expect(result).toEqual([{ studentFeeId: "f1", appliedAmount: 500 }]);
  });

  it("throws when there are no fees with outstanding balance", () => {
    expect(() =>
      distributeInvoicePayment({
        paymentAmount: 100,
        fees: [{ studentFeeId: "fPaid", balance: 0 }],
      }),
    ).toThrow(/no outstanding/i);
  });
});
