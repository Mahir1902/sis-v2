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
  /** Create campuses and academic years; edit a year's dates. */
  manageSchoolSetup: ADMIN,
  /** Create subjects and switch them on or off. */
  manageSubjects: ADMIN,

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
   * The Assessments screen: every level's CA papers, and creating them. A
   * teacher without it still reaches mark entry for a paper by its link.
   */
  browseAssessments: ADMIN,
  /** The Class Analytics screen: grade spread and students needing help. */
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

/**
 * Features an admin may give to an individual teacher on top of the teacher
 * role (`users.grants`). This list is the whole reach of a grant: fee
 * management, user management, student records and identity data are absent,
 * so no grant — however it got stored — can open them directly.
 *
 * Two entries do reach money and account data, deliberately: `viewAuditLog`
 * shows audit metadata including fee amounts, receipt edits, account emails
 * and role changes, and `promoteStudents` assigns next year's fees (and
 * graduates leavers) while promoting. The captain kept both grantable knowing
 * this (TASK_LOG.md, 2026-11-21), and the grant editor discloses it.
 */
export const GRANTABLE_CAPABILITIES = [
  "browseAssessments",
  "viewClassAnalytics",
  "promoteStudents",
  "manageSubjects",
  "viewAuditLog",
  "manageCalendar",
] as const satisfies readonly SchoolCapability[];
export type GrantableCapability = (typeof GRANTABLE_CAPABILITIES)[number];

/** Is this name one an admin may grant to a teacher? */
export const isGrantable = (
  capability: string,
): capability is GrantableCapability =>
  (GRANTABLE_CAPABILITIES as readonly string[]).includes(capability);

/**
 * What the grant editor (Settings → Users) calls each grantable feature, and
 * the one line it says about it. Keyed by capability, so a capability cannot
 * become grantable without copy. The Promotions and Audit Log lines are the
 * disclosures the captain's decision rests on — keep them.
 */
export const GRANTABLE_FEATURES: Record<
  GrantableCapability,
  { label: string; description: string }
> = {
  browseAssessments: {
    label: "Assessments",
    description: "See every level's CA papers and create new ones.",
  },
  viewClassAnalytics: {
    label: "Class Analytics",
    description: "Grade spread and students needing help, for any class.",
  },
  promoteStudents: {
    label: "Promotions",
    description:
      "Promote or hold back a class. Also assigns next year's fees and graduates leavers.",
  },
  manageSubjects: {
    label: "Subjects",
    description: "Add subjects and switch them on or off.",
  },
  viewAuditLog: {
    label: "Audit Log",
    description:
      "Read the full change history, including fee and account changes.",
  },
  manageCalendar: {
    label: "School Calendar",
    description:
      "Add and remove closures. Closing a day voids its attendance marks.",
  },
};

/** The part of a user account the policy needs. */
export type PolicyCaller = {
  role: Role;
  /** The student record a student-role account is linked to. */
  studentId?: string;
  /** Extra features an admin granted this teacher. */
  grants?: readonly string[];
};

/**
 * May this account ever use the capability — by its role, or (a teacher) by
 * a grant? For a student-scoped capability this is "for at least one
 * student"; decide a specific student with `canOnStudent`. Use for nav
 * entries, page gates and school-wide actions.
 */
export function can(
  caller: PolicyCaller | null | undefined,
  capability: Capability,
): boolean {
  if (!caller) return false;
  if (POLICY[capability][caller.role] !== undefined) return true;
  return (
    caller.role === "teacher" &&
    isGrantable(capability) &&
    (caller.grants?.includes(capability) ?? false)
  );
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

/**
 * Where an account lands after sign-in: the first screen its role can load.
 * A student goes to their own record, never the roster; an unlinked student
 * (or an unknown account) falls through to `/students`, which explains.
 */
export function homeFor(caller: PolicyCaller | null | undefined): string {
  if (can(caller, "viewDashboard")) return "/dashboard";
  if (can(caller, "listStudents")) return "/students";
  return caller?.studentId ? `/students/${caller.studentId}` : "/students";
}
