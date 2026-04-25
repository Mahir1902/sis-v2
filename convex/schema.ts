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
    campus: v.string(),
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

  studentFees: defineTable({
    studentId: v.id("students"),
    feeStructureId: v.id("feeStructure"),
    academicYear: v.id("academicYears"),
    dueDate: v.float64(),
    originalAmount: v.float64(),
    paidAmount: v.float64(),
    balance: v.float64(),
    status: v.union(
      v.literal("unpaid"),
      v.literal("partial"),
      v.literal("paid"),
    ),
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
  }).index("by_student_year", ["studentId", "academicYear"]),

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
    isAdvancePayment: v.optional(v.boolean()),
    monthsPaid: v.optional(v.array(v.string())),
    remarks: v.optional(v.string()),
    collectedBy: v.optional(v.id("users")),
  })
    .index("by_student_year", ["studentId", "academicYear"])
    .index("by_fee", ["feeId"]),

  studentDiscounts: defineTable({
    studentId: v.id("students"),
    discountRuleId: v.id("discountRules"),
    academicYear: v.string(),
    reason: v.string(),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    status: v.string(), // "active" | "inactive"
    relatedEntityId: v.optional(v.string()),
  }).index("by_student_year", ["studentId", "academicYear"]),

  advancePayments: defineTable({
    studentId: v.id("students"),
    transactionId: v.id("feeTransactions"),
    academicYear: v.string(),
    amount: v.float64(),
    adjustedAmount: v.optional(v.float64()),
    remainingAmount: v.float64(),
    monthsCovered: v.array(v.string()),
    paymentDate: v.string(),
    status: v.string(), // "active" | "fully_applied"
  }).index("by_student_year", ["studentId", "academicYear"]),

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

  assessmentWeightingRules: defineTable({
    subjectId: v.id("subjects"),
    standardLevelId: v.id("standardLevels"),
    semester: v.union(v.literal(1), v.literal(2)),
    ca1Weight: v.float64(),
    ca2Weight: v.float64(),
    ca3Weight: v.float64(),
    classPerformanceWeight: v.optional(v.float64()),
    continualAssessmentWeight: v.optional(v.float64()),
    isActive: v.boolean(),
  })
    .index("by_standard_subject_semester", [
      "standardLevelId",
      "subjectId",
      "semester",
    ])
    .index("by_active", ["isActive"]),

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
    remarks: v.optional(v.string()),
    computedAt: v.optional(v.float64()),
  })
    .index("by_enrollment_semester", ["enrollmentId", "semester"])
    .index("by_student", ["studentId"])
    .index("by_subject", ["subjectId"]),
});
