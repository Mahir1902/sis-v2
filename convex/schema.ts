import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  // ─── Reference / Lookup Tables ───────────────────────────────────────────

  academicYears: defineTable({
    name: v.string(), // "2024-2025"
    startDate: v.float64(), // Unix ms
    endDate: v.float64(), // Unix ms
  }),

  campuses: defineTable({
    name: v.string(),
    address: v.string(),
  }),

  standardLevels: defineTable({
    name: v.string(), // "Grade 1"
    code: v.string(), // "01"
    nextLevelId: v.optional(v.id("standardLevels")),
  }),

  subjects: defineTable({
    name: v.string(),
    code: v.string(),
    displayOrder: v.optional(v.float64()),
    isActive: v.boolean(),
  })
    .index("by_active", ["isActive"])
    .index("by_name", ["name"]),

  gradeMapping: defineTable({
    letterGrade: v.string(),
    minPercentage: v.float64(),
    maxPercentage: v.float64(),
    order: v.float64(),
    description: v.optional(v.string()),
    isActive: v.boolean(),
  }).index("by_active", ["isActive"]),

  // ─── Users ────────────────────────────────────────────────────────────────

  users: defineTable({
    name: v.string(),
    email: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("teacher"),
      v.literal("student"),
    ),
    isActive: v.boolean(),
    studentId: v.optional(v.id("students")), // links student-role users to their record
  }).index("by_email", ["email"]),

  // ─── Invites (admin-created accounts, self-service redemption) ────────────
  //
  // Spec #55 / #56. An invite is NOT an account — the `users` row is created at
  // acceptance (in `convex/auth.ts`), never here. Role-agnostic on purpose (a
  // future student-invite UI needs no migration). `expired` is DERIVED from
  // `status === "pending" && now > expiresAt` (see `lib/inviteStatus.ts`) — it
  // is never stored, so no cron/sweep. Single-use: the auth gate flips
  // `status → "accepted"` + stamps `acceptedAt` in the same transaction as the
  // user insert. `by_token` is the redemption lookup (required by the gate);
  // `by_email` backs the create-time duplicate guards.

  invites: defineTable({
    token: v.string(), // crypto-random, unguessable — the sole authZ for signup
    email: v.string(), // bound at issue time; the account is created for THIS email
    role: v.union(
      v.literal("admin"),
      v.literal("teacher"),
      v.literal("student"),
    ),
    name: v.string(), // admin-set; becomes the new user's name at acceptance
    studentId: v.optional(v.id("students")), // future student invites
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("revoked"),
    ),
    expiresAt: v.float64(), // Unix ms; now + INVITE_TTL_MS at issue/regenerate
    invitedBy: v.id("users"),
    acceptedAt: v.optional(v.float64()),
  })
    .index("by_token", ["token"])
    .index("by_email", ["email"]),

  // ─── Staff (stub — required by assessment references) ─────────────────────

  staff: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    role: v.optional(v.string()),
  }),

  // ─── Students & Enrollments ───────────────────────────────────────────────

  students: defineTable({
    // Identity
    studentNumber: v.string(),
    studentFullName: v.string(),
    gender: v.union(v.literal("Male"), v.literal("Female")),
    dateOfBirth: v.float64(),
    placeOfBirth: v.string(),
    citizenship: v.string(),
    religion: v.string(),
    bloodGroup: v.string(),

    // Documents
    birthCertificateNumber: v.string(),
    passportNumber: v.optional(v.string()),
    passportValidTill: v.optional(v.float64()),

    // Academic placement (current)
    standardLevel: v.id("standardLevels"),
    academicYear: v.id("academicYears"),
    campus: v.id("campuses"),

    // Dates
    admissionDate: v.float64(),
    classStartDate: v.float64(),

    // Address
    presentAddress: v.string(),
    permanentAddress: v.optional(v.string()),

    // Previous school
    previousSchoolName: v.optional(v.string()),
    previousSchoolAddress: v.optional(v.string()),

    // Health
    healthIssue: v.object({
      hasHealthIssues: v.boolean(),
      issueDescription: v.optional(v.string()),
    }),

    // Photos (Convex storage IDs)
    studentPhotoUrl: v.optional(v.id("_storage")),
    fatherPhotoUrl: v.optional(v.id("_storage")),
    motherPhotoUrl: v.optional(v.id("_storage")),

    // Father
    fatherName: v.string(),
    fatherOccupation: v.string(),
    fatherNidNumber: v.string(),
    fatherPhoneNumber: v.string(),

    // Mother
    motherName: v.string(),
    motherOccupation: v.string(),
    motherNidNumber: v.string(),
    motherPhoneNumber: v.string(),

    // Guardian
    guardianName: v.string(),
    guardianRelation: v.string(),
    guardianNidNumber: v.string(),
    guardianPhoneNumber: v.string(),

    // Billing contact emails — used by the Receipt Compose Email launcher
    // (ADR-0002). All three are optional because the school does not always
    // capture all three on intake; they are widened here ahead of the parent
    // intake form picking them up.
    fatherEmail: v.optional(v.string()),
    motherEmail: v.optional(v.string()),
    guardianEmail: v.optional(v.string()),

    // Billing Contact (CONTEXT.md domain term) — designates which parent/
    // guardian is financially responsible. Required after the issue #33
    // backfill migration; default for backfilled records was "father".
    primaryBillingContact: v.union(
      v.literal("father"),
      v.literal("mother"),
      v.literal("guardian"),
    ),

    // Financial
    familyAnnualIncome: v.string(),

    // Siblings
    siblingIds: v.optional(v.array(v.id("students"))),

    // Status
    status: v.union(
      v.literal("active"),
      v.literal("graduated"),
      v.literal("transferred"),
      v.literal("withdrawn"),
      v.literal("suspended"),
      v.literal("expelled"),
    ),

    // Admin
    consultantName: v.string(),
    createdAt: v.string(), // ISO string
  })
    .index("by_standard_level", ["standardLevel"])
    .index("by_status", ["status"])
    .index("by_academic_year", ["academicYear"]),

  enrollments: defineTable({
    studentId: v.id("students"),
    academicYear: v.id("academicYears"),
    standardLevelId: v.id("standardLevels"),
    campus: v.id("campuses"),
    section: v.optional(v.string()),
    rollNumber: v.optional(v.string()),
    enrollmentType: v.string(), // "new_admission" | "promotion"
    enrollmentDate: v.float64(),
    status: v.string(), // "active" | "completed"

    exitDate: v.optional(v.float64()),
    exitReason: v.optional(v.string()),
    exitDestination: v.optional(v.string()),
    exitNotes: v.optional(v.string()),

    previousEnrollmentId: v.optional(v.id("enrollments")),
  })
    .index("by_student_academic_year", ["studentId", "academicYear"])
    .index("by_standard_level", ["standardLevelId"])
    .index("by_campus_standard", ["campus", "standardLevelId"]),

  // ─── Simple Grades (kept alongside assessment system) ─────────────────────

  grades: defineTable({
    studentId: v.id("students"),
    enrollmentId: v.id("enrollments"),
    subjectId: v.id("subjects"),
    marksObtained: v.float64(),
    totalMarks: v.float64(),
    percentage: v.float64(),
    letterGrade: v.string(),
    semester: v.union(v.literal(1), v.literal(2)),
    remarks: v.optional(v.string()),
    createdAt: v.float64(),
    updatedAt: v.optional(v.float64()),
  })
    .index("by_enrollment", ["enrollmentId"])
    .index("by_enrollment_semester", ["enrollmentId", "semester"])
    .index("by_student", ["studentId"]),

  // ─── Fee System ───────────────────────────────────────────────────────────

  feeStructure: defineTable({
    name: v.string(),
    baseAmount: v.float64(),
    frequency: v.union(
      v.literal("one-time"),
      v.literal("monthly"),
      v.literal("yearly"),
    ),
    feeType: v.union(
      v.literal("admission"),
      v.literal("tuition"),
      v.literal("registration"),
      v.literal("library"),
      v.literal("sports"),
      v.literal("computer"),
    ),
    standardLevel: v.id("standardLevels"),
    isActive: v.boolean(),
    dueDate: v.optional(v.float64()),
    lateFeeConfig: v.optional(
      v.object({
        enabled: v.boolean(),
        amountPerDay: v.optional(v.float64()),
        maxAmount: v.optional(v.float64()),
        maxDays: v.optional(v.float64()),
        amount: v.optional(v.float64()),
      }),
    ),
  }).index("by_standard", ["standardLevel"]),

  discountRules: defineTable({
    name: v.string(),
    discountType: v.union(v.literal("percentage"), v.literal("fixed")),
    amount: v.float64(),
    maxDiscountAmount: v.optional(v.float64()),
    isActive: v.optional(v.boolean()),
    description: v.optional(v.string()),
    discription: v.optional(v.string()), // typo in v1 data — kept for compatibility
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  }),

  // Issue #36 (ADR-0002): `invoiceNumber` and its `by_invoice` index were
  // dropped in the narrow step. Sessions are pure transaction-log primitives;
  // parent-facing numbering lives only on `receipts.receiptNumber`. UIs that
  // need the Receipt while viewing a Session join via `receipts.by_session`.
  feeCollectionSessions: defineTable({
    studentId: v.id("students"),
    academicYear: v.id("academicYears"),
    campus: v.optional(v.id("campuses")),
    totalAmount: v.float64(),
    paymentMode: v.union(
      v.literal("Cash"),
      v.literal("Bank Transfer"),
      v.literal("Cheque"),
      v.literal("UPI"),
      v.literal("Online"),
    ),
    remarks: v.optional(v.string()),
    status: v.union(v.literal("completed"), v.literal("voided")),
    collectedBy: v.id("users"),
    transactionDate: v.float64(),
    feeCount: v.float64(),
    standardLevelId: v.optional(v.id("standardLevels")),
  })
    .index("by_student", ["studentId"])
    .index("by_academic_year", ["academicYear"])
    .index("by_academic_year_date", ["academicYear", "transactionDate"])
    .index("by_campus", ["campus"])
    .index("by_year_level", ["academicYear", "standardLevelId"]),

  studentFees: defineTable({
    studentId: v.id("students"),
    feeStructureId: v.id("feeStructure"),
    academicYear: v.id("academicYears"),
    dueDate: v.float64(),
    originalAmount: v.float64(),
    paidAmount: v.float64(),
    balance: v.float64(),
    // Issue #36 (ADR-0002): `"partial"` was dropped. Any payment that does
    // not fully cover the outstanding balance is rejected upstream; partial
    // tracking now lives in the Receipt snapshot, not on the live fee row.
    status: v.union(v.literal("unpaid"), v.literal("paid")),
    billingPeriod: v.optional(v.string()),
    appliedDiscounts: v.array(
      v.object({
        discountId: v.id("discountRules"),
        type: v.string(),
        amount: v.float64(),
      }),
    ),
    paymentDetails: v.array(
      v.object({
        paymentId: v.id("feeTransactions"),
        date: v.string(),
        amount: v.float64(),
        mode: v.string(),
      }),
    ),
    lateFeeAmount: v.optional(v.float64()),
  })
    .index("by_student_year", ["studentId", "academicYear"])
    .index("by_feeStructure", ["feeStructureId"])
    .index("by_status_and_due_date", ["status", "dueDate"]),

  feeTransactions: defineTable({
    studentId: v.id("students"),
    feeId: v.id("studentFees"),
    academicYear: v.id("academicYears"),
    amount: v.float64(),
    paymentMode: v.union(
      v.literal("Cash"),
      v.literal("Bank Transfer"),
      v.literal("Cheque"),
      v.literal("UPI"),
      v.literal("Online"),
    ),
    transactionDate: v.float64(),
    referenceNumber: v.optional(v.string()),
    sessionId: v.optional(v.id("feeCollectionSessions")),
    isAdvancePayment: v.optional(v.boolean()),
    monthsPaid: v.optional(v.array(v.string())),
    remarks: v.optional(v.string()),
    collectedBy: v.optional(v.id("users")),
  })
    .index("by_student_year", ["studentId", "academicYear"])
    .index("by_fee", ["feeId"])
    .index("by_session", ["sessionId"]),

  studentDiscounts: defineTable({
    studentId: v.id("students"),
    discountRuleId: v.id("discountRules"),
    academicYear: v.id("academicYears"),
    reason: v.string(),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    status: v.string(), // "active" | "inactive"
    relatedEntityId: v.optional(v.string()),
  }).index("by_student_year", ["studentId", "academicYear"]),

  advancePayments: defineTable({
    studentId: v.id("students"),
    transactionId: v.id("feeTransactions"),
    academicYear: v.id("academicYears"),
    amount: v.float64(),
    adjustedAmount: v.optional(v.float64()),
    remainingAmount: v.float64(),
    monthsCovered: v.array(v.string()),
    paymentDate: v.string(),
    status: v.string(), // "active" | "fully_applied"
  }).index("by_student_year", ["studentId", "academicYear"]),

  // ─── Receipts (ADR-0002 + ADR-0003) ──────────────────────────────────────
  //
  // Money Receipt — the school's only parent-facing billing document. Issued
  // 1:1 with `feeCollectionSessions` at payment time. Every PDF-renderable
  // field is snapshotted at issue time so future fee edits cannot mutate an
  // old document (the parent's copy and the school's copy must always agree).
  //
  // Correction model (ADR-0003) is three mutations: `editReceipt` (cosmetic
  // fields only), `voidReceipt` (no replacement), and `voidAndReissueReceipt`
  // (financial correction — cross-links via `supersedes` / `supersededBy`).

  receipts: defineTable({
    // Live references (NOT snapshotted — these point at current records)
    studentId: v.id("students"),
    sessionId: v.id("feeCollectionSessions"), // 1:1 by construction
    collectedBy: v.id("users"),

    // Identity + lifecycle
    receiptNumber: v.string(), // RCP-YYYY-NNNNN, calendar-year reset
    status: v.union(v.literal("issued"), v.literal("voided")),
    totalAmount: v.float64(),
    paymentMethod: v.union(
      v.literal("Cash"),
      v.literal("Bank Transfer"),
      v.literal("Cheque"),
      v.literal("UPI"),
      v.literal("Online"),
    ),
    paymentDate: v.float64(),
    issuedAt: v.float64(),
    voidedAt: v.optional(v.float64()),
    voidedBy: v.optional(v.id("users")),

    // Snapshot fields (frozen at issue time — every renderable field on the
    // PDF lives here, NOT joined from a live row, so the document is stable
    // even if the underlying student/fee record changes later).
    payerName: v.string(),
    payerRole: v.union(
      v.literal("father"),
      v.literal("mother"),
      v.literal("guardian"),
    ),
    studentNameSnapshot: v.string(),
    studentNumberSnapshot: v.string(),
    issuerName: v.string(),
    lineItems: v.array(
      v.object({
        feeStructureName: v.string(),
        billingPeriod: v.optional(v.string()),
        originalAmount: v.float64(),
        discountAmount: v.float64(),
        paidAmount: v.float64(),
      }),
    ),
    remarks: v.optional(v.string()),

    // Re-issue chain (ADR-0003). Set atomically by `voidAndReissueReceipt`;
    // never set by `voidReceipt` alone.
    supersedes: v.optional(v.id("receipts")), // on the new replacement
    supersededBy: v.optional(v.id("receipts")), // on the voided original
  })
    .index("by_student", ["studentId"])
    .index("by_session", ["sessionId"])
    .index("by_receipt_number", ["receiptNumber"])
    .index("by_status_and_payment_date", ["status", "paymentDate"]),

  // ─── Receipt counters ────────────────────────────────────────────────────
  //
  // One document per calendar year, holding the next receipt sequence to
  // allocate. Read-then-write happens INSIDE the same mutation that creates
  // the Receipt — Convex serialises mutations per document, so the counter
  // is race-safe by construction (see DA prompt #1 in HANDOFF_issue_36.md).

  receiptCounters: defineTable({
    year: v.float64(), // calendar year, e.g. 2026
    nextNumber: v.float64(), // 1-based; first receipt of 2026 uses 1
  }).index("by_year", ["year"]),

  // ─── Report Cards ─────────────────────────────────────────────────────────

  reportCards: defineTable({
    studentId: v.id("students"),
    enrollmentId: v.id("enrollments"),
    semester: v.union(v.literal(1), v.literal(2)),
    fileUrl: v.id("_storage"),
    fileName: v.string(),
    notes: v.optional(v.string()),
    uploadedAt: v.float64(),
    uploadedBy: v.optional(v.id("users")),
  })
    .index("by_student", ["studentId"])
    .index("by_enrollment", ["enrollmentId"])
    .index("by_enrollment_semester", ["enrollmentId", "semester"]),

  // ─── Assessment System (CA-1 / CA-2 / CA-3) ──────────────────────────────
  //
  // `assessmentWeightingRules` was removed (ADR-0004 / A.3): CAs are always
  // weighted equally, so the table, its mutation, and its query carried no
  // reachable behaviour. Grade math renormalizes over present CAs in
  // `lib/gradeComputation.ts`.

  assessments: defineTable({
    name: v.string(),
    assessmentNumber: v.union(v.literal(1), v.literal(2), v.literal(3)),
    semester: v.union(v.literal(1), v.literal(2)),
    subjectId: v.id("subjects"),
    standardLevelId: v.id("standardLevels"),
    academicYearId: v.id("academicYears"),
    totalMarks: v.float64(),
    passingMarks: v.optional(v.float64()),
    assessmentDate: v.optional(v.float64()),
    isActive: v.boolean(),
    createdAt: v.optional(v.float64()),
  })
    .index("by_subject_semester", ["subjectId", "semester"])
    .index("by_standard_year", ["standardLevelId", "academicYearId"])
    .index("by_active", ["isActive"]),

  assessmentQuestions: defineTable({
    assessmentId: v.id("assessments"),
    questionNumber: v.float64(),
    questionText: v.optional(v.string()),
    marksAllocated: v.float64(),
    learningObjective: v.optional(v.string()),
    conceptTag: v.optional(v.string()),
    displayOrder: v.optional(v.float64()),
    isActive: v.optional(v.boolean()),
    createdAt: v.optional(v.float64()),
  })
    .index("by_assessment", ["assessmentId"])
    .index("by_assessment_order", ["assessmentId", "displayOrder"]),

  studentAssessmentAnswers: defineTable({
    studentId: v.id("students"),
    enrollmentId: v.id("enrollments"),
    assessmentId: v.id("assessments"),
    questionId: v.id("assessmentQuestions"),
    marksObtained: v.float64(),
    isAbsent: v.optional(v.boolean()),
    remarks: v.optional(v.string()),
    enteredAt: v.optional(v.float64()),
  })
    .index("by_student_assessment", ["studentId", "assessmentId"])
    .index("by_enrollment", ["enrollmentId"])
    .index("by_assessment", ["assessmentId"])
    .index("by_question", ["questionId"]),

  computedGrades: defineTable({
    studentId: v.id("students"),
    enrollmentId: v.id("enrollments"),
    // Denormalised from the enrollment (immutable once the grade exists) so class-level
    // analytics can index "all grades for a level + year + subject + semester" in ONE read
    // instead of fanning out over every enrollment. Optional until the ADR-0004 recompute
    // backfills every row; narrow to required afterward (widen-migrate-narrow).
    standardLevelId: v.optional(v.id("standardLevels")),
    academicYear: v.optional(v.id("academicYears")),
    subjectId: v.id("subjects"),
    semester: v.union(v.literal(1), v.literal(2)),
    ca1Marks: v.optional(v.float64()),
    ca1Percentage: v.optional(v.float64()),
    ca1TotalMarks: v.optional(v.float64()),
    ca2Marks: v.optional(v.float64()),
    ca2Percentage: v.optional(v.float64()),
    ca2TotalMarks: v.optional(v.float64()),
    ca3Marks: v.optional(v.float64()),
    ca3Percentage: v.optional(v.float64()),
    ca3TotalMarks: v.optional(v.float64()),
    weightedAverage: v.float64(),
    letterGrade: v.string(),
    totalMarksObtained: v.optional(v.float64()),
    totalPossibleMarks: v.optional(v.float64()),
    // Number of CAs the subject runs this term, snapshotted at compute time
    // (ADR-0004 / A.2). Powers the Provisional Grade tag: present CA count
    // (derived from which caXPercentage fields are set) < expectedCaCount ⇒
    // provisional. Optional until the A.4 backfill populates every row; narrow
    // to required afterward (widen-migrate-narrow).
    expectedCaCount: v.optional(v.float64()),
    remarks: v.optional(v.string()),
    computedAt: v.optional(v.float64()),
  })
    .index("by_enrollment_semester", ["enrollmentId", "semester"])
    .index("by_student", ["studentId"])
    .index("by_subject", ["subjectId"])
    // Class-level analytics: one indexed read returns an entire class for a subject + term.
    .index("by_level_year_subject_semester", [
      "standardLevelId",
      "academicYear",
      "subjectId",
      "semester",
    ]),

  // ─── Audit Logs ───────────────────────────────────────────────────────────

  auditLogs: defineTable({
    userId: v.id("users"),
    userEmail: v.string(),
    userName: v.string(),
    action: v.union(
      v.literal("create"),
      v.literal("update"),
      v.literal("delete"),
      v.literal("status_change"),
      v.literal("collect_payment"),
      v.literal("collect_fees"),
      v.literal("apply_discount"),
      v.literal("upload"),
      v.literal("promote"),
      v.literal("role_change"),
      v.literal("void"),
    ),
    entityType: v.string(),
    entityId: v.string(),
    description: v.string(),
    metadata: v.optional(v.any()),
    timestamp: v.float64(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_entity", ["entityType", "entityId"])
    .index("by_user", ["userId"]),
});
