/**
 * Groups selected monthly fees by fee structure for independent
 * future-month selection in the CollectFeesDialog.
 */

export interface MonthlyStructureGroup {
  feeStructureId: string;
  structureName: string;
  feeType: string;
  academicYear: string;
  selectedFeeIds: string[];
}

interface FeeInput {
  _id: string;
  feeStructureId: string;
  billingPeriod?: string;
  balance: number;
  academicYear: string;
  feeStructureDoc?: {
    name?: string;
    feeType?: string;
    frequency?: string;
  } | null;
}

/**
 * Groups selected fees by feeStructureId, returning only monthly structures.
 *
 * Each group contains the structure metadata and the list of selected fee IDs
 * so the dialog can render an independent future-month selector per group.
 */
export function groupMonthlyStructures(
  selectedFees: FeeInput[],
): MonthlyStructureGroup[] {
  const groupMap = new Map<string, MonthlyStructureGroup>();

  for (const fee of selectedFees) {
    if (!fee.feeStructureDoc || fee.feeStructureDoc.frequency !== "monthly") {
      continue;
    }

    const existing = groupMap.get(fee.feeStructureId);
    if (existing) {
      existing.selectedFeeIds.push(fee._id);
    } else {
      groupMap.set(fee.feeStructureId, {
        feeStructureId: fee.feeStructureId,
        structureName: fee.feeStructureDoc.name ?? "Monthly Fee",
        feeType: fee.feeStructureDoc.feeType ?? "fee",
        academicYear: fee.academicYear,
        selectedFeeIds: [fee._id],
      });
    }
  }

  return Array.from(groupMap.values());
}
