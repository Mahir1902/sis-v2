import { describe, expect, it } from "vitest";
import {
  CAPABILITIES,
  can,
  canOnStudent,
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
          expect(can(role, capability as (typeof CAPABILITIES)[number])).toBe(
            expected,
          );
        });
      }
    }

    it("denies everything to a missing or unknown role", () => {
      expect(can(undefined, "viewReferenceData")).toBe(false);
      expect(can("janitor" as Role, "viewReferenceData")).toBe(false);
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
