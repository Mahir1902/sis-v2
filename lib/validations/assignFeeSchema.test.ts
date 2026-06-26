import { describe, expect, it } from "vitest";
import { type AssignFeeValues, assignFeeSchema } from "./assignFeeSchema";

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
