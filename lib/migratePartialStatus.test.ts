import { describe, expect, it } from "vitest";
import { resolvePartialStatus } from "./migratePartialStatus";

describe("resolvePartialStatus", () => {
  it("flips to paid when paidAmount fully covers (originalAmount - discount)", () => {
    expect(
      resolvePartialStatus({
        paidAmount: 1000,
        originalAmount: 1500,
        appliedDiscounts: [
          { discountId: "d1" as never, type: "fixed", amount: 500 },
        ],
      }),
    ).toBe("paid");
  });

  it("flips to paid when paidAmount exactly matches the discounted total", () => {
    expect(
      resolvePartialStatus({
        paidAmount: 2000,
        originalAmount: 2000,
        appliedDiscounts: [],
      }),
    ).toBe("paid");
  });

  it("flips to unpaid when paidAmount is below the discounted total", () => {
    expect(
      resolvePartialStatus({
        paidAmount: 800,
        originalAmount: 1500,
        appliedDiscounts: [
          { discountId: "d1" as never, type: "fixed", amount: 500 },
        ],
      }),
    ).toBe("unpaid");
  });

  it("treats zero paidAmount with no discounts as unpaid", () => {
    expect(
      resolvePartialStatus({
        paidAmount: 0,
        originalAmount: 1000,
        appliedDiscounts: [],
      }),
    ).toBe("unpaid");
  });

  it("sums multiple applied discounts before comparing", () => {
    // originalAmount 3000, discounts 500 + 200 + 300 = 1000, net due 2000
    expect(
      resolvePartialStatus({
        paidAmount: 2000,
        originalAmount: 3000,
        appliedDiscounts: [
          { discountId: "d1" as never, type: "fixed", amount: 500 },
          { discountId: "d2" as never, type: "fixed", amount: 200 },
          { discountId: "d3" as never, type: "percentage", amount: 300 },
        ],
      }),
    ).toBe("paid");
  });

  it("treats overpayment as paid (paidAmount > net due)", () => {
    expect(
      resolvePartialStatus({
        paidAmount: 2500,
        originalAmount: 2000,
        appliedDiscounts: [],
      }),
    ).toBe("paid");
  });

  it("treats discount equal to originalAmount as paid even with zero paidAmount", () => {
    // 100% scholarship — net due is 0
    expect(
      resolvePartialStatus({
        paidAmount: 0,
        originalAmount: 1500,
        appliedDiscounts: [
          { discountId: "d1" as never, type: "percentage", amount: 1500 },
        ],
      }),
    ).toBe("paid");
  });
});
