import { describe, expect, it } from "vitest";
import {
  type MonthlyStructureGroup,
  groupMonthlyStructures,
} from "./perStructureFutureMonths";

describe("groupMonthlyStructures", () => {
  it("groups selected monthly fees by feeStructureId", () => {
    const selectedFees = [
      {
        _id: "fee-1",
        feeStructureId: "struct-A",
        billingPeriod: "2025-01",
        balance: 1000,
        feeStructureDoc: {
          name: "Tuition",
          feeType: "tuition",
          frequency: "monthly",
        },
        academicYear: "ay-1",
      },
      {
        _id: "fee-2",
        feeStructureId: "struct-A",
        billingPeriod: "2025-02",
        balance: 1000,
        feeStructureDoc: {
          name: "Tuition",
          feeType: "tuition",
          frequency: "monthly",
        },
        academicYear: "ay-1",
      },
      {
        _id: "fee-3",
        feeStructureId: "struct-B",
        billingPeriod: "2025-01",
        balance: 500,
        feeStructureDoc: {
          name: "Sports",
          feeType: "sports",
          frequency: "monthly",
        },
        academicYear: "ay-1",
      },
    ];

    const groups = groupMonthlyStructures(selectedFees);

    expect(groups).toHaveLength(2);

    const tuitionGroup = groups.find((g) => g.feeStructureId === "struct-A");
    expect(tuitionGroup).toBeDefined();
    expect(tuitionGroup?.structureName).toBe("Tuition");
    expect(tuitionGroup?.selectedFeeIds).toEqual(["fee-1", "fee-2"]);

    const sportsGroup = groups.find((g) => g.feeStructureId === "struct-B");
    expect(sportsGroup).toBeDefined();
    expect(sportsGroup?.structureName).toBe("Sports");
    expect(sportsGroup?.selectedFeeIds).toEqual(["fee-3"]);
  });

  it("excludes non-monthly fees from grouping", () => {
    const selectedFees = [
      {
        _id: "fee-1",
        feeStructureId: "struct-A",
        billingPeriod: "2025-01",
        balance: 1000,
        feeStructureDoc: {
          name: "Tuition",
          feeType: "tuition",
          frequency: "monthly",
        },
        academicYear: "ay-1",
      },
      {
        _id: "fee-2",
        feeStructureId: "struct-C",
        balance: 3000,
        feeStructureDoc: {
          name: "Admission",
          feeType: "admission",
          frequency: "one-time",
        },
        academicYear: "ay-1",
      },
    ];

    const groups = groupMonthlyStructures(selectedFees);
    expect(groups).toHaveLength(1);
    expect(groups[0].feeStructureId).toBe("struct-A");
  });

  it("returns empty array when no monthly fees are selected", () => {
    const selectedFees = [
      {
        _id: "fee-1",
        feeStructureId: "struct-C",
        balance: 3000,
        feeStructureDoc: {
          name: "Admission",
          feeType: "admission",
          frequency: "one-time",
        },
        academicYear: "ay-1",
      },
    ];

    const groups = groupMonthlyStructures(selectedFees);
    expect(groups).toHaveLength(0);
  });

  it("handles fees with missing feeStructureDoc gracefully", () => {
    const selectedFees = [
      {
        _id: "fee-1",
        feeStructureId: "struct-A",
        billingPeriod: "2025-01",
        balance: 1000,
        feeStructureDoc: null,
        academicYear: "ay-1",
      },
    ];

    const groups = groupMonthlyStructures(selectedFees);
    expect(groups).toHaveLength(0);
  });

  it("preserves the academicYear from the first fee in each group", () => {
    const selectedFees = [
      {
        _id: "fee-1",
        feeStructureId: "struct-A",
        billingPeriod: "2025-01",
        balance: 1000,
        feeStructureDoc: {
          name: "Tuition",
          feeType: "tuition",
          frequency: "monthly",
        },
        academicYear: "ay-2025",
      },
    ];

    const groups = groupMonthlyStructures(selectedFees);
    expect(groups[0].academicYear).toBe("ay-2025");
  });
});
