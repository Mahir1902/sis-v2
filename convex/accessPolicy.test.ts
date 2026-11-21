/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";
import {
  CAPABILITIES,
  type Capability,
  can,
  ROLES,
  type Role,
  SENSITIVE_STUDENT_FIELDS,
} from "../lib/accessPolicy";
import { dhakaDate } from "../lib/attendanceDate";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { redeemInvite } from "./auth";
import schema from "./schema";

/**
 * The Access Policy enforced through real Convex functions (in-memory, no
 * deployment):
 *  - a regression test for each live defect the module was built to close
 *    (architecture review 2026-11-21, defects 1–4);
 *  - parity: for every capability, one function behind it accepts and refuses
 *    each role exactly as the table in `lib/accessPolicy.ts` says.
 */

const modules = import.meta.glob("./**/*.*s");
type TC = TestConvex<typeof schema>;

const DAY = 24 * 60 * 60 * 1000;

let t: TC;
let users: Record<Role, Id<"users">>;
let unlinkedStudentUser: Id<"users">;
let campus: Id<"campuses">;
let level: Id<"standardLevels">;
let year: Id<"academicYears">;
/** The student record the student-role account is linked to. */
let own: Id<"students">;
/** Somebody else. */
let other: Id<"students">;
let ownEnrollment: Id<"enrollments">;
let otherEnrollment: Id<"enrollments">;

const as = (userId: Id<"users">) =>
  t.withIdentity({ subject: `${userId}|session` });
const asRole = (role: Role) => as(users[role]);

const SENSITIVE = {
  fatherNidNumber: "NID-FATHER",
  motherNidNumber: "NID-MOTHER",
  guardianNidNumber: "NID-GUARDIAN",
  passportNumber: "PASSPORT",
  birthCertificateNumber: "BIRTH-CERT",
  familyAnnualIncome: "INCOME",
};

beforeEach(async () => {
  t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    campus = await ctx.db.insert("campuses", { name: "Main", address: "" });
    level = await ctx.db.insert("standardLevels", {
      name: "Grade 4",
      code: "04",
    });
    const now = Date.now();
    year = await ctx.db.insert("academicYears", {
      name: "This Year",
      startDate: now - 100 * DAY,
      semester1EndDate: now + 10 * DAY,
      endDate: now + 200 * DAY,
    });

    const seedStudent = async (studentNumber: string, name: string) => {
      const studentId = await ctx.db.insert("students", {
        studentNumber,
        studentFullName: name,
        fatherPhoneNumber: "017",
        status: "active",
        createdAt: new Date(now).toISOString(),
        ...SENSITIVE,
      });
      const enrollmentId = await ctx.db.insert("enrollments", {
        studentId,
        academicYear: year,
        standardLevelId: level,
        campus,
        enrollmentType: "new_admission",
        enrollmentDate: now,
      });
      return { studentId, enrollmentId };
    };
    ({ studentId: own, enrollmentId: ownEnrollment } = await seedStudent(
      "S-OWN",
      "Own Student",
    ));
    ({ studentId: other, enrollmentId: otherEnrollment } = await seedStudent(
      "S-OTHER",
      "Other Student",
    ));

    const user = (role: Role, studentId?: Id<"students">) =>
      ctx.db.insert("users", {
        name: role,
        email: `${role}${studentId ? "" : "-unlinked"}@school.edu`,
        role,
        isActive: true,
        ...(studentId ? { studentId } : {}),
      });
    users = {
      admin: await user("admin"),
      teacher: await user("teacher"),
      student: await user("student", own),
    };
    unlinkedStudentUser = await user("student");
  });
});

describe("defect 1 — the fees read follows the matrix (teachers see no fees)", () => {
  it("lets an admin and the student themself read a student's fees", async () => {
    await expect(
      asRole("admin").query(api.studentFees.getByStudent, { studentId: own }),
    ).resolves.toEqual([]);
    await expect(
      asRole("student").query(api.studentFees.getByStudent, { studentId: own }),
    ).resolves.toEqual([]);
  });

  it("refuses a teacher, and a student asking about someone else", async () => {
    await expect(
      asRole("teacher").query(api.studentFees.getByStudent, { studentId: own }),
    ).rejects.toThrow("Unauthorized");
    await expect(
      asRole("student").query(api.studentFees.getByStudent, {
        studentId: other,
      }),
    ).rejects.toThrow("Unauthorized");
  });
});

describe("defect 2 — sensitive fields go to admins only", () => {
  it("gives an admin the identity numbers and family income", async () => {
    const student = await asRole("admin").query(api.students.getStudentById, {
      studentId: other,
    });
    expect(student).toMatchObject(SENSITIVE);
  });

  it("gives a teacher the record without them", async () => {
    const student = await asRole("teacher").query(api.students.getStudentById, {
      studentId: other,
    });
    expect(student).toMatchObject({
      studentFullName: "Other Student",
      fatherPhoneNumber: "017",
    });
    for (const field of SENSITIVE_STUDENT_FIELDS) {
      expect(student).not.toHaveProperty(field);
    }
  });

  it("gives a student their own record without them", async () => {
    const student = await asRole("student").query(api.students.getStudentById, {
      studentId: own,
    });
    expect(student).toMatchObject({ studentFullName: "Own Student" });
    for (const field of SENSITIVE_STUDENT_FIELDS) {
      expect(student).not.toHaveProperty(field);
    }
  });
});

describe("defect 3 — a student reads only their own enrollments", () => {
  it("refuses another student's enrollment history and current enrollment", async () => {
    await expect(
      asRole("student").query(api.enrollments.getEnrollmentHistory, {
        studentId: other,
      }),
    ).rejects.toThrow("Unauthorized");
    await expect(
      asRole("student").query(api.enrollments.getCurrentEnrollment, {
        studentId: other,
      }),
    ).rejects.toThrow("Unauthorized");
  });

  it("returns their own", async () => {
    const history = await asRole("student").query(
      api.enrollments.getEnrollmentHistory,
      { studentId: own },
    );
    expect(history.map((e) => e._id)).toEqual([ownEnrollment]);
    const current = await asRole("student").query(
      api.enrollments.getCurrentEnrollment,
      { studentId: own },
    );
    expect(current?._id).toBe(ownEnrollment);
  });

  it("still lets staff read any student's", async () => {
    for (const role of ["admin", "teacher"] as const) {
      const current = await asRole(role).query(
        api.enrollments.getCurrentEnrollment,
        { studentId: other },
      );
      expect(current?._id).toBe(otherEnrollment);
    }
  });

  it("refuses a student account that is linked to no student record", async () => {
    await expect(
      as(unlinkedStudentUser).query(api.enrollments.getEnrollmentHistory, {
        studentId: own,
      }),
    ).rejects.toThrow("Unauthorized");
    await expect(
      as(unlinkedStudentUser).query(api.students.getStudentById, {
        studentId: own,
      }),
    ).rejects.toThrow("Unauthorized");
  });
});

describe("defect 4 — a student account is linked to its student record", () => {
  const readsOwnRecord = async (userId: Id<"users">) => {
    const student = await as(userId).query(api.students.getStudentById, {
      studentId: own,
    });
    return student?.studentNumber;
  };

  it("links the account when a student invite is redeemed", async () => {
    const userId = await t.run(async (ctx) => {
      await ctx.db.insert("invites", {
        token: "student-token",
        email: "kid@school.edu",
        role: "student",
        name: "Kid",
        studentId: own,
        status: "pending",
        expiresAt: Date.now() + DAY,
        invitedBy: users.admin,
      });
      return redeemInvite(
        ctx.db,
        { email: "kid@school.edu", inviteToken: "student-token" },
        Date.now(),
      );
    });

    expect(await readsOwnRecord(userId)).toBe("S-OWN");
    await expect(
      as(userId).query(api.students.getStudentById, { studentId: other }),
    ).rejects.toThrow("Unauthorized");
  });

  it("treats a student invite with no student record behind it as dead", async () => {
    const redeem = (token: string, studentId?: Id<"students">) =>
      t.run(async (ctx) => {
        await ctx.db.insert("invites", {
          token,
          email: `${token}@school.edu`,
          role: "student",
          name: "Kid",
          status: "pending",
          expiresAt: Date.now() + DAY,
          invitedBy: users.admin,
          ...(studentId ? { studentId } : {}),
        });
        return redeemInvite(
          ctx.db,
          { email: `${token}@school.edu`, inviteToken: token },
          Date.now(),
        );
      });
    const deleted = await t.run(async (ctx) => {
      const id = await ctx.db.insert("students", {
        studentNumber: "S-GONE",
        createdAt: new Date().toISOString(),
      });
      await ctx.db.delete(id);
      return id;
    });

    await expect(redeem("no-student")).rejects.toThrow("Invalid invite");
    await expect(redeem("gone-student", deleted)).rejects.toThrow(
      "Invalid invite",
    );
  });

  it("does not link a staff account, whatever the invite carries", async () => {
    const userId = await t.run(async (ctx) => {
      await ctx.db.insert("invites", {
        token: "teacher-token",
        email: "new-teacher@school.edu",
        role: "teacher",
        name: "New Teacher",
        studentId: own,
        status: "pending",
        expiresAt: Date.now() + DAY,
        invitedBy: users.admin,
      });
      return redeemInvite(
        ctx.db,
        { email: "new-teacher@school.edu", inviteToken: "teacher-token" },
        Date.now(),
      );
    });
    const me = await as(userId).query(api.users.getMe, {});
    expect(me).toMatchObject({ role: "teacher" });
    expect(me?.studentId).toBeUndefined();
  });

  it("links the account when an admin makes a user a student", async () => {
    await asRole("admin").mutation(api.users.updateUserRole, {
      userId: unlinkedStudentUser,
      role: "student",
      studentId: own,
    });
    expect(await readsOwnRecord(unlinkedStudentUser)).toBe("S-OWN");
    expect(
      await as(unlinkedStudentUser).query(api.users.getMe, {}),
    ).toMatchObject({ role: "student", studentId: own });
  });

  it("refuses to make a user a student without a student record", async () => {
    await expect(
      asRole("admin").mutation(api.users.updateUserRole, {
        userId: users.teacher,
        role: "student",
      }),
    ).rejects.toThrow("STUDENT_REQUIRED");

    const deleted = await t.run(async (ctx) => {
      const id = await ctx.db.insert("students", {
        studentNumber: "S-GONE",
        createdAt: new Date().toISOString(),
      });
      await ctx.db.delete(id);
      return id;
    });
    await expect(
      asRole("admin").mutation(api.users.updateUserRole, {
        userId: users.teacher,
        role: "student",
        studentId: deleted,
      }),
    ).rejects.toThrow("STUDENT_REQUIRED");

    // Nothing changed.
    expect(await asRole("teacher").query(api.users.getMe, {})).toMatchObject({
      role: "teacher",
    });
  });

  it("drops the link when the account stops being a student", async () => {
    await asRole("admin").mutation(api.users.updateUserRole, {
      userId: users.student,
      role: "teacher",
      // A stale id from the form must not survive on a staff account.
      studentId: own,
    });
    const me = await asRole("student").query(api.users.getMe, {});
    expect(me).toMatchObject({ role: "teacher" });
    expect(me?.studentId).toBeUndefined();

    // Back to student without a record: still refused, still not linked.
    await expect(
      asRole("admin").mutation(api.users.updateUserRole, {
        userId: users.student,
        role: "student",
      }),
    ).rejects.toThrow("STUDENT_REQUIRED");
  });
});

describe("grades follow the matrix (a student sees only their own)", () => {
  it("lets a student read their own computed grades, not another's", async () => {
    await expect(
      asRole("student").query(api.computedGrades.getComputedGradesByStudent, {
        studentId: own,
      }),
    ).resolves.toEqual([]);
    await expect(
      asRole("student").query(api.computedGrades.getComputedGradesByStudent, {
        studentId: other,
      }),
    ).rejects.toThrow("Unauthorized");
  });

  it("checks the student behind an enrollment-keyed read", async () => {
    await expect(
      asRole("student").query(
        api.computedGrades.getGradesByEnrollmentSemester,
        { enrollmentId: ownEnrollment, semester: 1 },
      ),
    ).resolves.toBeDefined();
    await expect(
      asRole("student").query(
        api.computedGrades.getGradesByEnrollmentSemester,
        { enrollmentId: otherEnrollment, semester: 1 },
      ),
    ).rejects.toThrow("Unauthorized");
    await expect(
      asRole("teacher").query(
        api.computedGrades.getGradesByEnrollmentSemester,
        { enrollmentId: otherEnrollment, semester: 1 },
      ),
    ).resolves.toBeDefined();
  });
});

describe("an inactive or signed-out caller has no capabilities", () => {
  it("refuses a deactivated admin", async () => {
    await t.run((ctx) => ctx.db.patch(users.admin, { isActive: false }));
    await expect(
      asRole("admin").query(api.students.getAllStudents, {}),
    ).rejects.toThrow("Unauthorized");
  });

  it("refuses a caller with no session", async () => {
    await expect(t.query(api.students.getAllStudents, {})).rejects.toThrow(
      "Unauthenticated",
    );
  });
});

/**
 * One real function per capability. `call` is run as each role; it must be
 * refused with "Unauthorized" exactly when the table says the role lacks the
 * capability. A permitted call may still fail for its own reasons (a missing
 * row, a business rule) — only the permission verdict is asserted here.
 */
type Call = (as: TC) => Promise<unknown>;

/** Capabilities that gate a screen only; no Convex function is behind them. */
const SCREEN_ONLY: Capability[] = ["browseAssessments", "viewClassAnalytics"];

function parityCalls(): Partial<Record<Capability, Call>> {
  return {
    viewReferenceData: (c) => c.query(api.campus.list, {}),
    manageSchoolSetup: (c) =>
      c.mutation(api.campus.create, { name: "New", address: "" }),
    listStudents: (c) => c.query(api.students.getAllStudents, {}),
    manageStudents: (c) =>
      c.mutation(api.students.updateStudentStatus, {
        studentId: other,
        status: "suspended",
      }),
    importStudents: (c) =>
      c.query(api.studentImport.getExistingStudents, {
        studentNumbers: [],
        academicYear: year,
      }),
    promoteStudents: (c) =>
      c.query(api.promotions.getPromotionCandidates, {
        campus,
        standardLevelId: level,
        academicYearId: year,
      }),
    manageStudentFees: (c) =>
      c.query(api.feeCollectionSessions.getByStudent, { studentId: other }),
    manageFeeStructures: (c) => c.query(api.feeStructure.list, {}),
    manageReceipts: (c) => c.query(api.receipts.listReceipts, {}),
    viewTransactionLog: (c) =>
      c.query(api.transactionLog.searchStudents, { nameQuery: "Other" }),
    viewDashboard: (c) => c.query(api.dashboard.getSummaryStats, {}),
    viewAuditLog: (c) => c.query(api.auditLogs.getRecentLogs, {}),
    manageUsers: (c) => c.query(api.users.listUsers, {}),
    viewClasses: (c) => c.query(api.subjects.list, {}),
    manageAssessments: (c) =>
      c.query(api.assessments.getAssessmentsByLevelYear, {
        standardLevelId: level,
        academicYearId: year,
      }),
    enterGrades: (c) =>
      c.query(api.studentAssessmentAnswers.getAnswersByEnrollment, {
        enrollmentId: otherEnrollment,
      }),
    viewReportCards: (c) =>
      c.query(api.reportCards.getByStudent, { studentId: other }),
    uploadReportCard: (c) => c.mutation(api.reportCards.generateUploadUrl, {}),
    deleteReportCard: async (c) => {
      const reportCardId = await t.run(async (ctx) =>
        ctx.db.insert("reportCards", {
          studentId: other,
          enrollmentId: otherEnrollment,
          semester: 1,
          fileUrl: await ctx.storage.store(new Blob(["pdf"])),
          fileName: "card.pdf",
          uploadedAt: Date.now(),
        }),
      );
      return c.mutation(api.reportCards.deleteReportCard, { reportCardId });
    },
    viewAttendance: (c) => c.query(api.closures.list, { academicYear: year }),
    writeRegister: (c) =>
      c.mutation(api.attendance.saveRegister, {
        campus,
        standardLevelId: level,
        academicYear: year,
        date: dhakaDate(),
        marks: [{ studentId: other, status: "present" }],
      }),
    noteAttendance: async (c) => {
      const attendanceId = await t.run((ctx) =>
        ctx.db.insert("attendance", {
          studentId: other,
          date: dhakaDate(),
          status: "absent",
          standardLevelId: level,
          campus,
          academicYear: year,
          markedBy: users.admin,
          markedAt: Date.now(),
        }),
      );
      return c.mutation(api.attendance.setNote, { attendanceId, note: "sick" });
    },
    manageCalendar: (c) =>
      c.mutation(api.closures.create, {
        startDate: dhakaDate(),
        endDate: dhakaDate(),
        campuses: [campus],
        reason: "Holiday",
      }),
    // Student-scoped: asked here about ANOTHER student, so only an "any"
    // grant passes — own-or-other is covered by the defect suites above.
    viewStudent: (c) =>
      c.query(api.enrollments.getCurrentEnrollment, { studentId: other }),
    viewStudentFees: (c) =>
      c.query(api.studentFees.getByStudent, { studentId: other }),
    viewStudentGrades: (c) =>
      c.query(api.computedGrades.getComputedGradesByStudent, {
        studentId: other,
      }),
  };
}

/** Roles expected to pass a call about ANOTHER student / the whole school. */
const EXPECTED_FOR_OTHER: Partial<Record<Capability, Role[]>> = {
  viewStudent: ["admin", "teacher"],
  viewStudentFees: ["admin"],
  viewStudentGrades: ["admin", "teacher"],
};

describe("parity — every capability is enforced by Convex as the table says", () => {
  it("covers every capability in the table", () => {
    const covered = [
      ...Object.keys(parityCalls()),
      ...SCREEN_ONLY,
      // Enforced inside the student-scoped read; see defect 2.
      "viewStudentSensitive",
    ].sort();
    expect(covered).toEqual([...CAPABILITIES].sort());
  });

  for (const capability of CAPABILITIES) {
    for (const role of ROLES) {
      const expected =
        EXPECTED_FOR_OTHER[capability]?.includes(role) ?? can(role, capability);

      it(`${capability}: ${role} is ${expected ? "allowed" : "refused"}`, async () => {
        const call = parityCalls()[capability];
        if (!call) return; // screen-only, or covered by the defect suites
        let refused = false;
        try {
          await call(asRole(role) as TC);
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (/Unauthenticated/.test(message)) throw error;
          refused = /Unauthorized/.test(message);
        }
        expect(refused).toBe(!expected);
      });
    }
  }
});
