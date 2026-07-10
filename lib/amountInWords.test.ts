import { describe, expect, it } from "vitest";
import { amountInWords } from "./amountInWords";

describe("amountInWords", () => {
  it("handles zero", () => {
    expect(amountInWords(0)).toBe("Zero Taka Only");
  });

  it("handles single digits", () => {
    expect(amountInWords(1)).toBe("One Taka Only");
    expect(amountInWords(9)).toBe("Nine Taka Only");
  });

  it("handles teens", () => {
    expect(amountInWords(10)).toBe("Ten Taka Only");
    expect(amountInWords(13)).toBe("Thirteen Taka Only");
    expect(amountInWords(19)).toBe("Nineteen Taka Only");
  });

  it("handles tens with units", () => {
    expect(amountInWords(20)).toBe("Twenty Taka Only");
    expect(amountInWords(42)).toBe("Forty Two Taka Only");
    expect(amountInWords(99)).toBe("Ninety Nine Taka Only");
  });

  it("handles hundreds", () => {
    expect(amountInWords(100)).toBe("One Hundred Taka Only");
    expect(amountInWords(150)).toBe("One Hundred Fifty Taka Only");
    expect(amountInWords(999)).toBe("Nine Hundred Ninety Nine Taka Only");
  });

  it("handles thousands", () => {
    expect(amountInWords(1000)).toBe("One Thousand Taka Only");
    expect(amountInWords(2500)).toBe("Two Thousand Five Hundred Taka Only");
    expect(amountInWords(12345)).toBe(
      "Twelve Thousand Three Hundred Forty Five Taka Only",
    );
  });

  it("handles lakhs (Indian numbering grouping)", () => {
    expect(amountInWords(100000)).toBe("One Lakh Taka Only");
    expect(amountInWords(150000)).toBe("One Lakh Fifty Thousand Taka Only");
    expect(amountInWords(2500000)).toBe("Twenty Five Lakh Taka Only");
  });

  it("handles crores", () => {
    expect(amountInWords(10000000)).toBe("One Crore Taka Only");
    expect(amountInWords(12345678)).toBe(
      "One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Taka Only",
    );
  });

  it("handles paisa alongside taka", () => {
    expect(amountInWords(100.5)).toBe("One Hundred Taka and Fifty Paisa Only");
    expect(amountInWords(1500.99)).toBe(
      "One Thousand Five Hundred Taka and Ninety Nine Paisa Only",
    );
  });

  it("handles paisa-only amounts", () => {
    expect(amountInWords(0.25)).toBe("Twenty Five Paisa Only");
  });

  it("rounds fractional paisa up to nearest paisa", () => {
    // 100.999 → 100 taka + 100 paisa (round) → 101 taka
    expect(amountInWords(100.999)).toBe("One Hundred One Taka Only");
  });

  it("rejects negative amounts", () => {
    expect(() => amountInWords(-1)).toThrow();
  });

  it("rejects non-finite amounts", () => {
    expect(() => amountInWords(Number.NaN)).toThrow();
    expect(() => amountInWords(Number.POSITIVE_INFINITY)).toThrow();
  });
});
