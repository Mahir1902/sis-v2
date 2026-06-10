/**
 * Builds the snapshot portion of a Money Receipt — every PDF-renderable
 * field that ADR-0002 requires us to freeze at issue time, copied from the
 * live student / billing contact / fee-structure rows into the Receipt row.
 *
 * After the Receipt is written, edits to any of those source rows must NOT
 * change what a parent sees on a reprint. The snapshot is the mechanism.
 *
 * Pure — no Convex types, no DB access — so it's unit-testable in isolation
 * and used by the `collectFees` mutation in `convex/feeCollectionSessions.ts`.
 */

export type PayerRole = "father" | "mother" | "guardian";

export interface ReceiptSnapshotStudent {
  studentFullName: string;
  studentNumber: string;
}

export interface ReceiptSnapshotBillingContact {
  name: string;
  contactType: PayerRole;
}

export interface ReceiptSnapshotIssuer {
  name: string;
}

export interface ReceiptSnapshotPaidLine {
  feeStructureId: string;
  billingPeriod?: string;
  originalAmount: number;
  discountAmount: number;
  paidAmount: number;
}

export interface ReceiptLineItem {
  feeStructureName: string;
  billingPeriod?: string;
  originalAmount: number;
  discountAmount: number;
  paidAmount: number;
}

export interface ReceiptSnapshot {
  payerName: string;
  payerRole: PayerRole;
  studentNameSnapshot: string;
  studentNumberSnapshot: string;
  issuerName: string;
  lineItems: ReceiptLineItem[];
}

export interface BuildReceiptSnapshotArgs {
  student: ReceiptSnapshotStudent;
  billingContact: ReceiptSnapshotBillingContact;
  issuer: ReceiptSnapshotIssuer;
  feeStructures: Map<string, { name: string }>;
  paidLines: ReceiptSnapshotPaidLine[];
}

export function buildReceiptSnapshot(
  args: BuildReceiptSnapshotArgs,
): ReceiptSnapshot {
  const { student, billingContact, issuer, feeStructures, paidLines } = args;

  const lineItems: ReceiptLineItem[] = paidLines.map((line) => {
    const structure = feeStructures.get(line.feeStructureId);
    if (!structure) {
      throw new Error(
        `Fee structure not found for receipt line: ${line.feeStructureId}`,
      );
    }
    return {
      feeStructureName: structure.name,
      billingPeriod: line.billingPeriod,
      originalAmount: line.originalAmount,
      discountAmount: line.discountAmount,
      paidAmount: line.paidAmount,
    };
  });

  return {
    payerName: billingContact.name,
    payerRole: billingContact.contactType,
    studentNameSnapshot: student.studentFullName,
    studentNumberSnapshot: student.studentNumber,
    issuerName: issuer.name,
    lineItems,
  };
}
