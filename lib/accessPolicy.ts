/**
 * Access Policy — the one copy of "who may do what".
 *
 * The CLAUDE.md permission matrix as a table, shared by the Convex functions
 * (`convex/lib/permissions.ts` enforces it) and the app (`useCapabilities`,
 * `RoleGate`, the sidebar and the action buttons read it). Pure: no Convex,
 * no React. To change who may do something, edit the table — nothing else.
 */

export const ROLES = ["admin", "teacher", "student"] as const;
export type Role = (typeof ROLES)[number];

/**
 * How far a grant reaches: `"any"` is every student / the whole school;
 * `"own"` is only the student record linked to the caller's account.
 */
type Scope = "any" | "own";

const ADMIN = { admin: "any" } as const;
const STAFF = { admin: "any", teacher: "any" } as const;
const EVERYONE = { admin: "any", teacher: "any", student: "any" } as const;

/**
 * Capabilities about ONE student record. Always checked next to a student id
 * (`canOnStudent`, or `requireStudentAccess` on the server), because a grant
 * may be own-only.
 */
const STUDENT_POLICY = {
  /** The student's profile, placement and enrollment history. */
  viewStudent: { admin: "any", teacher: "any", student: "own" },
  /** Identity numbers and family income (CLAUDE.md backend rule 7). */
  viewStudentSensitive: ADMIN,
  /** The student's fee records. Teachers do not see fees. */
  viewStudentFees: { admin: "any", student: "own" },
  /** The student's computed grades. */
  viewStudentGrades: { admin: "any", teacher: "any", student: "own" },
} as const satisfies Record<string, Partial<Record<Role, Scope>>>;

/** Capabilities that are not about one student record: never own-only. */
const SCHOOL_POLICY = {
  /** Campuses, standard levels, academic years. */
  viewReferenceData: EVERYONE,
  /** Create campuses, academic years and subjects. */
  manageSchoolSetup: ADMIN,

  /** The student roster, and who a student's siblings are. */
  listStudents: STAFF,
  /** Admit, edit, change status, readmit, delete. */
  manageStudents: ADMIN,
  importStudents: ADMIN,
  promoteStudents: ADMIN,

  /** Assign, discount, collect, delete fees; payment history. */
  manageStudentFees: ADMIN,
  /** Fee structures and discount rules — financial data, admin only. */
  manageFeeStructures: ADMIN,
  /** Read, edit, void and re-issue Money Receipts. */
  manageReceipts: ADMIN,
  viewTransactionLog: ADMIN,

  viewDashboard: ADMIN,
  viewAuditLog: ADMIN,
  /** User accounts, roles and invites. */
  manageUsers: ADMIN,

  /** Class rosters, the subject list and class-level grade figures. */
  viewClasses: STAFF,
  /** CA papers and their questions. */
  manageAssessments: STAFF,
  /**
   * The Assessments and Class Analytics admin screens. Admin-only today even
   * though the functions behind them allow teachers, who reach mark entry by
   * link — Phase 5 item 20 gives teachers their own class-scoped screens.
   */
  browseAssessments: ADMIN,
  viewClassAnalytics: ADMIN,
  /** Marks per student per question. */
  enterGrades: STAFF,
  viewReportCards: STAFF,
  uploadReportCard: STAFF,
  deleteReportCard: ADMIN,

  /** Registers, the daily call list, term reports, closures. */
  viewAttendance: STAFF,
  /** Mark a Class's register (the date window is checked separately). */
  writeRegister: STAFF,
  noteAttendance: ADMIN,
  /** Closures on the School Calendar. */
  manageCalendar: ADMIN,
} as const satisfies Record<string, Partial<Record<Role, "any">>>;

export type StudentCapability = keyof typeof STUDENT_POLICY;
export type SchoolCapability = keyof typeof SCHOOL_POLICY;
export type Capability = StudentCapability | SchoolCapability;

const POLICY: Record<Capability, Partial<Record<Role, Scope>>> = {
  ...STUDENT_POLICY,
  ...SCHOOL_POLICY,
};

export const STUDENT_CAPABILITIES = Object.keys(
  STUDENT_POLICY,
) as StudentCapability[];
export const CAPABILITIES = Object.keys(POLICY) as Capability[];

/** The part of a user account the policy needs. */
export type PolicyCaller = {
  role: Role;
  /** The student record a student-role account is linked to. */
  studentId?: string;
};

/**
 * May this role ever use the capability? For a student-scoped capability this
 * is "for at least one student" — decide a specific student with
 * `canOnStudent`. Use for nav entries, page gates and school-wide actions.
 */
export function can(role: Role | undefined, capability: Capability): boolean {
  return role !== undefined && POLICY[capability][role] !== undefined;
}

/** May this caller use the capability on this particular student? */
export function canOnStudent(
  caller: PolicyCaller | null | undefined,
  capability: StudentCapability,
  studentId: string,
): boolean {
  if (!caller) return false;
  const scope: Scope | undefined = POLICY[capability][caller.role];
  if (scope === "any") return true;
  return scope === "own" && caller.studentId === studentId;
}

/** Fields only a `viewStudentSensitive` holder may receive. */
export const SENSITIVE_STUDENT_FIELDS = [
  "fatherNidNumber",
  "motherNidNumber",
  "guardianNidNumber",
  "passportNumber",
  "birthCertificateNumber",
  "familyAnnualIncome",
] as const;

/** A copy of the student record with the sensitive fields removed. */
export function withoutSensitiveFields<T extends object>(student: T): T {
  const shaped = { ...student } as Record<string, unknown>;
  for (const field of SENSITIVE_STUDENT_FIELDS) delete shaped[field];
  return shaped as T;
}
