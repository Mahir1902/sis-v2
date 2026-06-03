import { describe, expect, it } from "vitest";
import { applyBillingContactBackfill } from "./applyBillingContactBackfill";

describe("applyBillingContactBackfill", () => {
  it("returns the father default patch when the field is missing", () => {
    const patch = applyBillingContactBackfill({
      primaryBillingContact: undefined,
    });
    expect(patch).toEqual({ primaryBillingContact: "father" });
  });

  it("returns undefined when the field is already set to father", () => {
    const patch = applyBillingContactBackfill({
      primaryBillingContact: "father",
    });
    expect(patch).toBeUndefined();
  });

  it("returns undefined when the field is already set to mother", () => {
    const patch = applyBillingContactBackfill({
      primaryBillingContact: "mother",
    });
    expect(patch).toBeUndefined();
  });

  it("returns undefined when the field is already set to guardian", () => {
    const patch = applyBillingContactBackfill({
      primaryBillingContact: "guardian",
    });
    expect(patch).toBeUndefined();
  });
});
