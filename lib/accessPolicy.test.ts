import { describe, expect, it } from "vitest";
import {
  CAPABILITIES,
  can,
  canOnStudent,
  GRANTABLE_CAPABILITIES,
  homeFor,
  ROLES,
  type Role,
  SENSITIVE_STUDENT_FIELDS,
  STUDENT_CAPABILITIES,
  withoutSensitiveFields,
} from "./accessPolicy";

/**
 * The expected policy, written out by hand from the CLAUDE.md permission
 * matrix and the server's role lists — deliberately NOT derived from the
 * module's own table, so a change to the table has to be made here too.
 *
 * Columns: admin, teacher, student. "any" = every student, "own" = only the
 * student record linked to the caller, "-" = never.
 */
type Cell = "any" | "own" | "-";
type Row = [admin: Cell, teacher: Cell, student: Cell];

const STUDENT_SCOPED: Record<string, Row> = {
  viewStudent: ["any", "any", "own"], // "View all students" / student: own only
  viewStudentSensitive: ["any", "-", "-"], // backend rule 7: NID + financial → admin
  viewStudentFees: ["any", "-", "own"], // "View own fees": admin ✅ teacher ❌ student ✅
  viewStudentGrades: ["any", "any", "own"], // "View grades": student own only
};

const SCHOOL_WIDE: Record<string, Row> = {
  viewReferenceData: ["any", "any", "any"],
  manageSchoolSetup: ["any", "-", "-"],
  manageSubjects: ["any", "-", "-"],
  listStudents: ["any", "any", "-"], // "View all students": student ❌
  manageStudents: ["any", "-", "-"], // "Create/edit students"
  importStudents: ["any", "-", "-"],
  promoteStudents: ["any", "-", "-"],
  manageStudentFees: ["any", "-", "-"], // "Manage fees"
  manageFeeStructures: ["any", "-", "-"], // "Manage fee structures"
  manageReceipts: ["any", "-", "-"],
  viewTransactionLog: ["any", "-", "-"],
  viewDashboard: ["any", "-", "-"],
  viewAuditLog: ["any", "-", "-"],
  manageUsers: ["any", "-", "-"],
  viewClasses: ["any", "any", "-"],
  manageAssessments: ["any", "any", "-"],
  browseAssessments: ["any", "-", "-"], // the Assessments admin screen
  viewClassAnalytics: ["any", "-", "-"], // the Class Analytics admin screen
  enterGrades: ["any", "any", "-"], // "Enter grades"
  viewReportCards: ["any", "any", "-"],
  uploadReportCard: ["any", "any", "-"], // "Upload report cards"
  deleteReportCard: ["any", "-", "-"],
  viewAttendance: ["any", "any", "-"],
  writeRegister: ["any", "any", "-"],
  noteAttendance: ["any", "-", "-"],
  manageCalendar: ["any", "-", "-"],
};

const OWN = "student_own";
const OTHER = "student_other";
const cell = (row: Row, role: Role) => row[ROLES.indexOf(role)];

describe("access policy table", () => {
  it("lists exactly the capabilities this test knows about", () => {
    expect([...STUDENT_CAPABILITIES].sort()).toEqual(
      Object.keys(STUDENT_SCOPED).sort(),
    );
    expect([...CAPABILITIES].sort()).toEqual(
      [...Object.keys(STUDENT_SCOPED), ...Object.keys(SCHOOL_WIDE)].sort(),
    );
  });

  describe("can(role, capability) — may this role ever do it", () => {
    for (const [capability, row] of Object.entries({
      ...STUDENT_SCOPED,
      ...SCHOOL_WIDE,
    })) {
      for (const role of ROLES) {
        const expected = cell(row, role) !== "-";
        it(`${role} ${expected ? "can" : "cannot"} ${capability}`, () => {
          expect(
            can({ role }, capability as (typeof CAPABILITIES)[number]),
          ).toBe(expected);
        });
      }
    }

    it("denies everything to a missing or unknown role", () => {
      expect(can(undefined, "viewReferenceData")).toBe(false);
      expect(can(null, "viewReferenceData")).toBe(false);
      expect(can({ role: "janitor" as Role }, "viewReferenceData")).toBe(false);
    });

    it("never grants a school-wide capability as own-only", () => {
      // "own" only means something next to a student id.
      for (const row of Object.values(SCHOOL_WIDE)) {
        expect(row).not.toContain("own");
      }
    });
  });

  describe("canOnStudent — role × capability × own-or-other student", () => {
    for (const [capability, row] of Object.entries(STUDENT_SCOPED)) {
      for (const role of ROLES) {
        const grant = cell(row, role);
        const cap = capability as (typeof STUDENT_CAPABILITIES)[number];
        // The caller is linked to OWN whatever their role, so an "any" grant
        // is proven not to depend on the link.
        const caller = { role, studentId: OWN };

        it(`${role} · ${capability} · own student → ${grant !== "-"}`, () => {
          expect(canOnStudent(caller, cap, OWN)).toBe(grant !== "-");
        });
        it(`${role} · ${capability} · other student → ${grant === "any"}`, () => {
          expect(canOnStudent(caller, cap, OTHER)).toBe(grant === "any");
        });
      }
    }

    it("refuses an own-only capability to a student account with no linked student", () => {
      const unlinked = { role: "student" as const };
      expect(canOnStudent(unlinked, "viewStudent", OWN)).toBe(false);
      expect(canOnStudent(unlinked, "viewStudentFees", OWN)).toBe(false);
      expect(canOnStudent(unlinked, "viewStudentGrades", OWN)).toBe(false);
    });

    it("refuses a missing caller", () => {
      expect(canOnStudent(undefined, "viewStudent", OWN)).toBe(false);
      expect(canOnStudent(null, "viewStudent", OWN)).toBe(false);
    });
  });
});

describe("per-teacher grants — features an admin gives one teacher", () => {
  it("lists exactly the features that can be granted", () => {
    // Money, user management, student records and identity data are never
    // grantable: this list is the whole of what a grant can reach.
    expect([...GRANTABLE_CAPABILITIES].sort()).toEqual([
      "browseAssessments",
      "manageCalendar",
      "manageSubjects",
      "promoteStudents",
      "viewAuditLog",
      "viewClassAnalytics",
    ]);
  });

  it("gives a teacher a granted feature on top of the teacher role", () => {
    const plain = { role: "teacher" as const };
    const granted = { role: "teacher" as const, grants: ["viewAuditLog"] };
    expect(can(plain, "viewAuditLog")).toBe(false);
    expect(can(granted, "viewAuditLog")).toBe(true);
    // Only what was granted, and nothing lost.
    expect(can(granted, "promoteStudents")).toBe(false);
    expect(can(granted, "listStudents")).toBe(true);
  });

  it("ignores a stored grant for anything outside the grantable list", () => {
    const sneaky = {
      role: "teacher" as const,
      grants: ["manageUsers", "manageStudentFees", "viewDashboard", "nonsense"],
    };
    expect(can(sneaky, "manageUsers")).toBe(false);
    expect(can(sneaky, "manageStudentFees")).toBe(false);
    expect(can(sneaky, "viewDashboard")).toBe(false);
  });

  it("never widens a student record: grants do not reach student-scoped capabilities", () => {
    const teacher = {
      role: "teacher" as const,
      grants: ["viewStudentFees", "viewStudentSensitive"],
    };
    expect(canOnStudent(teacher, "viewStudentFees", OTHER)).toBe(false);
    expect(canOnStudent(teacher, "viewStudentSensitive", OTHER)).toBe(false);
  });

  it("applies to teachers only", () => {
    const student = { role: "student" as const, grants: ["viewAuditLog"] };
    expect(can(student, "viewAuditLog")).toBe(false);
    // An admin already holds everything grantable.
    for (const capability of GRANTABLE_CAPABILITIES) {
      expect(can({ role: "admin" }, capability)).toBe(true);
    }
  });
});

describe("withoutSensitiveFields", () => {
  it("names the identity-number and income fields (CLAUDE.md backend rule 7)", () => {
    expect([...SENSITIVE_STUDENT_FIELDS].sort()).toEqual([
      "birthCertificateNumber",
      "familyAnnualIncome",
      "fatherNidNumber",
      "guardianNidNumber",
      "motherNidNumber",
      "passportNumber",
    ]);
  });

  it("drops the sensitive keys and keeps everything else", () => {
    const shaped = withoutSensitiveFields({
      studentFullName: "Rahim",
      fatherNidNumber: "NID-F",
      motherNidNumber: "NID-M",
      guardianNidNumber: "NID-G",
      passportNumber: "P123",
      birthCertificateNumber: "BC-1",
      familyAnnualIncome: "500000",
      fatherPhoneNumber: "017",
    });
    expect(shaped).toEqual({
      studentFullName: "Rahim",
      fatherPhoneNumber: "017",
    });
  });

  it("does not mutate its input", () => {
    const original = { fatherNidNumber: "NID-F" };
    withoutSensitiveFields(original);
    expect(original).toEqual({ fatherNidNumber: "NID-F" });
  });
});

describe("homeFor — where an account lands after sign-in", () => {
  it("sends an admin to the dashboard", () => {
    expect(homeFor({ role: "admin" })).toBe("/dashboard");
  });

  it("sends a teacher to the student roster", () => {
    expect(homeFor({ role: "teacher" })).toBe("/students");
  });

  it("sends a student to their own record, never the roster", () => {
    expect(homeFor({ role: "student", studentId: "s1" })).toBe("/students/s1");
  });

  it("sends an unlinked student or an unknown account to /students, which explains", () => {
    expect(homeFor({ role: "student" })).toBe("/students");
    expect(homeFor(undefined)).toBe("/students");
    expect(homeFor(null)).toBe("/students");
  });
});
