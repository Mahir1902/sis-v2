import { describe, expect, it } from "vitest";
import {
  formatStatusBadgeClass,
  formatStatusDotClass,
  formatStatusLabel,
  shouldDisableVoid,
  shouldRenderDueDateRed,
} from "./invoiceTableUtils";

const NOW = new Date("2025-06-01T12:00:00Z").getTime();
const ONE_DAY_MS = 86_400_000;
const PAST = NOW - 7 * ONE_DAY_MS;
const FUTURE = NOW + 7 * ONE_DAY_MS;

describe("formatStatusDotClass", () => {
  it("returns neutral gray for draft", () => {
    const cls = formatStatusDotClass("draft");
    expect(cls).toContain("gray");
  });

  it("returns blue for sent", () => {
    const cls = formatStatusDotClass("sent");
    expect(cls).toContain("blue");
  });

  it("returns green for paid", () => {
    const cls = formatStatusDotClass("paid");
    expect(cls).toContain("green");
  });

  it("returns red for overdue", () => {
    const cls = formatStatusDotClass("overdue");
    expect(cls).toContain("red");
  });

  it("returns gray for voided", () => {
    const cls = formatStatusDotClass("voided");
    expect(cls).toContain("gray");
  });
});

describe("formatStatusBadgeClass", () => {
  it("returns the project palette gray class for draft", () => {
    const cls = formatStatusBadgeClass("draft");
    expect(cls).toContain("bg-gray-400/40");
    expect(cls).toContain("text-gray-700");
  });

  it("returns the project palette green class for paid", () => {
    const cls = formatStatusBadgeClass("paid");
    expect(cls).toContain("bg-green-400/40");
    expect(cls).toContain("text-green-700");
  });

  it("returns the project palette blue class for sent", () => {
    const cls = formatStatusBadgeClass("sent");
    expect(cls).toContain("bg-blue-400/40");
    expect(cls).toContain("text-blue-700");
  });

  it("returns the project palette red class for overdue", () => {
    const cls = formatStatusBadgeClass("overdue");
    expect(cls).toContain("bg-red-400/40");
    expect(cls).toContain("text-red-700");
  });

  it("returns a muted gray for voided", () => {
    const cls = formatStatusBadgeClass("voided");
    expect(cls).toContain("gray");
  });
});

describe("formatStatusLabel", () => {
  it("capitalises the first letter", () => {
    expect(formatStatusLabel("draft")).toBe("Draft");
    expect(formatStatusLabel("paid")).toBe("Paid");
  });

  it("preserves the rest of the word", () => {
    expect(formatStatusLabel("overdue")).toBe("Overdue");
  });
});

describe("shouldRenderDueDateRed", () => {
  it("returns true for overdue status regardless of dueDate", () => {
    expect(shouldRenderDueDateRed("overdue", FUTURE, NOW)).toBe(true);
    expect(shouldRenderDueDateRed("overdue", PAST, NOW)).toBe(true);
  });

  it("returns true when status is sent AND dueDate is strictly past", () => {
    expect(shouldRenderDueDateRed("sent", PAST, NOW)).toBe(true);
  });

  it("returns false when status is sent and dueDate is in the future", () => {
    expect(shouldRenderDueDateRed("sent", FUTURE, NOW)).toBe(false);
  });

  it("returns false when status is sent and dueDate equals now (strict <)", () => {
    expect(shouldRenderDueDateRed("sent", NOW, NOW)).toBe(false);
  });

  it("returns false for draft, even when dueDate is in the past", () => {
    expect(shouldRenderDueDateRed("draft", PAST, NOW)).toBe(false);
  });

  it("returns false for paid, even when dueDate is in the past", () => {
    expect(shouldRenderDueDateRed("paid", PAST, NOW)).toBe(false);
  });

  it("returns false for voided, even when dueDate is in the past", () => {
    expect(shouldRenderDueDateRed("voided", PAST, NOW)).toBe(false);
  });
});

describe("shouldDisableVoid", () => {
  it("returns true for paid invoices", () => {
    expect(shouldDisableVoid("paid")).toBe(true);
  });

  it("returns true for already-voided invoices", () => {
    expect(shouldDisableVoid("voided")).toBe(true);
  });

  it("returns false for draft invoices", () => {
    expect(shouldDisableVoid("draft")).toBe(false);
  });

  it("returns false for sent invoices", () => {
    expect(shouldDisableVoid("sent")).toBe(false);
  });

  it("returns false for overdue invoices", () => {
    expect(shouldDisableVoid("overdue")).toBe(false);
  });
});
