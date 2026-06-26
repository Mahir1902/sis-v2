import { describe, expect, it } from "vitest";
import {
  applyReceiptsListFilter,
  type ReceiptListRow,
} from "./receiptsListFilter";

const row = (overrides: Partial<ReceiptListRow>): ReceiptListRow => ({
  _id: "r1" as ReceiptListRow["_id"],
  receiptNumber: "RCP-2026-00001",
  studentId: "s1" as ReceiptListRow["studentId"],
  studentNameSnapshot: "Asha Begum",
  studentNumberSnapshot: "A-001",
  payerName: "Karim",
  status: "issued",
  paymentMethod: "Cash",
  paymentDate: new Date("2026-06-10T10:00:00Z").getTime(),
  totalAmount: 5000,
  supersedes: undefined,
  supersededBy: undefined,
  ...overrides,
});

describe("applyReceiptsListFilter", () => {
  it("returns only receipts whose paymentDate falls within the date range", () => {
    const within = row({
      _id: "in" as ReceiptListRow["_id"],
      paymentDate: new Date("2026-06-05T00:00:00Z").getTime(),
    });
    const before = row({
      _id: "before" as ReceiptListRow["_id"],
      paymentDate: new Date("2026-05-30T00:00:00Z").getTime(),
    });
    const after = row({
      _id: "after" as ReceiptListRow["_id"],
      paymentDate: new Date("2026-07-01T00:00:00Z").getTime(),
    });

    const result = applyReceiptsListFilter([within, before, after], {
      dateRange: {
        from: new Date("2026-06-01T00:00:00Z").getTime(),
        to: new Date("2026-06-30T23:59:59Z").getTime(),
      },
    });

    expect(result.map((r) => r._id)).toEqual(["in"]);
  });

  it("treats the date range as inclusive on both endpoints", () => {
    const exactFrom = new Date("2026-06-01T00:00:00Z").getTime();
    const exactTo = new Date("2026-06-30T23:59:59Z").getTime();

    const a = row({
      _id: "a" as ReceiptListRow["_id"],
      paymentDate: exactFrom,
    });
    const b = row({ _id: "b" as ReceiptListRow["_id"], paymentDate: exactTo });

    const result = applyReceiptsListFilter([a, b], {
      dateRange: { from: exactFrom, to: exactTo },
    });

    expect(result.map((r) => r._id).sort()).toEqual(["a", "b"]);
  });

  it("filters by studentId when provided", () => {
    const mine = row({
      _id: "mine" as ReceiptListRow["_id"],
      studentId: "s1" as ReceiptListRow["studentId"],
    });
    const other = row({
      _id: "other" as ReceiptListRow["_id"],
      studentId: "s2" as ReceiptListRow["studentId"],
    });

    const result = applyReceiptsListFilter([mine, other], {
      studentId: "s1" as ReceiptListRow["studentId"],
    });

    expect(result.map((r) => r._id)).toEqual(["mine"]);
  });

  it("filters by status when provided", () => {
    const issued = row({ _id: "i" as ReceiptListRow["_id"], status: "issued" });
    const voided = row({ _id: "v" as ReceiptListRow["_id"], status: "voided" });

    expect(
      applyReceiptsListFilter([issued, voided], { status: "voided" }).map(
        (r) => r._id,
      ),
    ).toEqual(["v"]);
  });

  it("returns all receipts when no filters are passed", () => {
    const a = row({ _id: "a" as ReceiptListRow["_id"] });
    const b = row({ _id: "b" as ReceiptListRow["_id"] });
    expect(
      applyReceiptsListFilter([a, b], {})
        .map((r) => r._id)
        .sort(),
    ).toEqual(["a", "b"]);
  });

  it("sorts results by paymentDate descending (most recent first)", () => {
    const old = row({
      _id: "old" as ReceiptListRow["_id"],
      paymentDate: new Date("2026-01-01T00:00:00Z").getTime(),
    });
    const recent = row({
      _id: "recent" as ReceiptListRow["_id"],
      paymentDate: new Date("2026-06-10T00:00:00Z").getTime(),
    });
    const middle = row({
      _id: "middle" as ReceiptListRow["_id"],
      paymentDate: new Date("2026-03-15T00:00:00Z").getTime(),
    });

    const result = applyReceiptsListFilter([old, recent, middle], {});

    expect(result.map((r) => r._id)).toEqual(["recent", "middle", "old"]);
  });

  it("does not mutate the input array", () => {
    const input = [
      row({
        _id: "a" as ReceiptListRow["_id"],
        paymentDate: new Date("2026-01-01T00:00:00Z").getTime(),
      }),
      row({
        _id: "b" as ReceiptListRow["_id"],
        paymentDate: new Date("2026-06-01T00:00:00Z").getTime(),
      }),
    ];
    const originalOrder = input.map((r) => r._id);
    applyReceiptsListFilter(input, {});
    expect(input.map((r) => r._id)).toEqual(originalOrder);
  });
});
