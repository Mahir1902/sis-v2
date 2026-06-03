import { describe, expect, it } from "vitest";
import {
  formatBulkVoidMessage,
  summarizeBulkVoidResults,
} from "./bulkVoidInvoices";

describe("summarizeBulkVoidResults", () => {
  it("reports all successes when every promise fulfils", () => {
    const results: PromiseSettledResult<void>[] = [
      { status: "fulfilled", value: undefined },
      { status: "fulfilled", value: undefined },
      { status: "fulfilled", value: undefined },
    ];

    expect(summarizeBulkVoidResults(results)).toEqual({
      succeeded: 3,
      failed: 0,
      failureReasons: [],
    });
  });
});

describe("summarizeBulkVoidResults", () => {
  it("collects failure reasons from rejected results", () => {
    const results: PromiseSettledResult<void>[] = [
      { status: "fulfilled", value: undefined },
      { status: "rejected", reason: new Error("Cannot void a paid invoice") },
      { status: "rejected", reason: new Error("Invoice is already voided") },
    ];

    expect(summarizeBulkVoidResults(results)).toEqual({
      succeeded: 1,
      failed: 2,
      failureReasons: [
        "Cannot void a paid invoice",
        "Invoice is already voided",
      ],
    });
  });

  it("handles non-Error rejection reasons by stringifying them", () => {
    const results: PromiseSettledResult<void>[] = [
      { status: "rejected", reason: "network down" },
      { status: "rejected", reason: { something: "weird" } },
    ];

    const summary = summarizeBulkVoidResults(results);
    expect(summary.succeeded).toBe(0);
    expect(summary.failed).toBe(2);
    expect(summary.failureReasons[0]).toBe("network down");
    expect(summary.failureReasons[1]).toBe("Unknown error");
  });
});

describe("formatBulkVoidMessage", () => {
  it("phrases an all-success run as a plural success message", () => {
    expect(
      formatBulkVoidMessage({ succeeded: 3, failed: 0, failureReasons: [] }),
    ).toEqual({
      tone: "success",
      message: "3 invoices voided",
    });
  });

  it("uses singular wording when exactly one invoice was voided", () => {
    expect(
      formatBulkVoidMessage({ succeeded: 1, failed: 0, failureReasons: [] }),
    ).toEqual({
      tone: "success",
      message: "1 invoice voided",
    });
  });

  it("reports a partial run with a warning tone and both counts", () => {
    expect(
      formatBulkVoidMessage({
        succeeded: 2,
        failed: 1,
        failureReasons: ["Cannot void a paid invoice"],
      }),
    ).toEqual({
      tone: "warning",
      message: "2 voided, 1 failed",
    });
  });

  it("reports an all-fail run as an error with a plural failure count", () => {
    expect(
      formatBulkVoidMessage({
        succeeded: 0,
        failed: 3,
        failureReasons: [
          "Cannot void a paid invoice",
          "Cannot void a paid invoice",
          "Invoice is already voided",
        ],
      }),
    ).toEqual({
      tone: "error",
      message: "Failed to void 3 invoices",
    });
  });

  it("uses singular wording when exactly one void fails", () => {
    expect(
      formatBulkVoidMessage({
        succeeded: 0,
        failed: 1,
        failureReasons: ["Cannot void a paid invoice"],
      }),
    ).toEqual({
      tone: "error",
      message: "Failed to void 1 invoice",
    });
  });
});
