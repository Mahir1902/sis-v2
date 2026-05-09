import { describe, expect, it } from "vitest";
import {
  assignFeeSchema,
  type AssignFeeValues,
  resolveAssignFeePayload,
} from "./assignFeeSchema";

describe("assignFeeSchema", () => {
  it("accepts a valid one-time fee assignment (no billingPeriod)", () => {
    const input: AssignFeeValues = {
      feeStructureId: "abc123",
      frequency: "one-time",
      billingPeriod: undefined,
    };
    const result = assignFeeSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("accepts a valid yearly fee assignment (no billingPeriod)", () => {
    const input: AssignFeeValues = {
      feeStructureId: "abc123",
      frequency: "yearly",
      billingPeriod: undefined,
    };
    const result = assignFeeSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("accepts a valid monthly fee assignment with billingPeriod", () => {
    const input: AssignFeeValues = {
      feeStructureId: "abc123",
      frequency: "monthly",
      billingPeriod: "2025-03",
    };
    const result = assignFeeSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("rejects when feeStructureId is empty", () => {
    const input = {
      feeStructureId: "",
      frequency: "one-time",
    };
    const result = assignFeeSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects when frequency is monthly but billingPeriod is missing", () => {
    const input = {
      feeStructureId: "abc123",
      frequency: "monthly",
      billingPeriod: undefined,
    };
    const result = assignFeeSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects when frequency is monthly but billingPeriod is empty string", () => {
    const input = {
      feeStructureId: "abc123",
      frequency: "monthly",
      billingPeriod: "",
    };
    const result = assignFeeSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("accepts one-time frequency even when billingPeriod is provided (ignored)", () => {
    const input = {
      feeStructureId: "abc123",
      frequency: "one-time",
      billingPeriod: "2025-06",
    };
    const result = assignFeeSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe("resolveAssignFeePayload", () => {
  const baseStructure = {
    _id: "struct-1" as string,
    baseAmount: 5000,
    frequency: "monthly" as const,
  };

  it("returns correct payload for a monthly fee", () => {
    const payload = resolveAssignFeePayload(baseStructure, "2025-03");
    expect(payload).toEqual({
      feeStructureId: "struct-1",
      originalAmount: 5000,
      paidAmount: 0,
      balance: 5000,
      status: "unpaid",
      billingPeriod: "2025-03",
    });
  });

  it("returns correct payload for a one-time fee (no billingPeriod)", () => {
    const oneTimeStructure = { ...baseStructure, frequency: "one-time" as const };
    const payload = resolveAssignFeePayload(oneTimeStructure, undefined);
    expect(payload).toEqual({
      feeStructureId: "struct-1",
      originalAmount: 5000,
      paidAmount: 0,
      balance: 5000,
      status: "unpaid",
      billingPeriod: undefined,
    });
  });

  it("returns correct payload for a yearly fee (no billingPeriod)", () => {
    const yearlyStructure = { ...baseStructure, frequency: "yearly" as const };
    const payload = resolveAssignFeePayload(yearlyStructure, undefined);
    expect(payload).toEqual({
      feeStructureId: "struct-1",
      originalAmount: 5000,
      paidAmount: 0,
      balance: 5000,
      status: "unpaid",
      billingPeriod: undefined,
    });
  });

  it("sets paidAmount to 0 and balance to baseAmount", () => {
    const payload = resolveAssignFeePayload(
      { ...baseStructure, baseAmount: 12000 },
      "2025-01",
    );
    expect(payload.paidAmount).toBe(0);
    expect(payload.balance).toBe(12000);
    expect(payload.originalAmount).toBe(12000);
  });

  it("always sets status to unpaid", () => {
    const payload = resolveAssignFeePayload(baseStructure, "2025-06");
    expect(payload.status).toBe("unpaid");
  });
});
