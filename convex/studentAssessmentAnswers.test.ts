/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

/**
 * Mark entry writes only for a student in the assessment's class: the
 * enrollment must be the student's own, in the assessment's level + year.
 */

const modules = import.meta.glob("./**/*.*s");

it("bulkMarkEntry rejects an enrollment that is not the student's, or not in the assessment's class", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const admin = await ctx.db.insert("users", {
      name: "Admin",
      email: "admin@school.edu",
      role: "admin",
      isActive: true,
    });
    const grade4 = await ctx.db.insert("standardLevels", {
      name: "Grade 4",
      code: "04",
    });
    const grade5 = await ctx.db.insert("standardLevels", {
      name: "Grade 5",
      code: "05",
    });
    const year = await ctx.db.insert("academicYears", {
      name: "2026-2027",
      startDate: 0,
      endDate: 1,
    });
    const subject = await ctx.db.insert("subjects", {
      name: "Maths",
      code: "MAT",
      isActive: true,
    });
    const assessment = await ctx.db.insert("assessments", {
      name: "CA-1",
      assessmentNumber: 1,
      semester: 1,
      subjectId: subject,
      standardLevelId: grade4,
      academicYearId: year,
      totalMarks: 10,
      isActive: true,
    });
    const question = await ctx.db.insert("assessmentQuestions", {
      assessmentId: assessment,
      questionNumber: 1,
      marksAllocated: 10,
    });
    const student = (studentNumber: string) =>
      ctx.db.insert("students", {
        studentNumber,
        studentFullName: studentNumber,
        gender: "Male",
        dateOfBirth: 0,
        placeOfBirth: "Dhaka",
        citizenship: "BD",
        religion: "-",
        bloodGroup: "-",
        birthCertificateNumber: "-",
        admissionDate: 0,
        classStartDate: 0,
        presentAddress: "-",
        healthIssue: { hasHealthIssues: false },
        fatherName: "F",
        fatherOccupation: "-",
        fatherNidNumber: "-",
        fatherPhoneNumber: "017",
        motherName: "M",
        motherOccupation: "-",
        motherNidNumber: "-",
        motherPhoneNumber: "018",
        guardianName: "G",
        guardianRelation: "-",
        guardianNidNumber: "-",
        guardianPhoneNumber: "019",
        primaryBillingContact: "mother",
        familyAnnualIncome: "-",
        status: "active",
        consultantName: "-",
        createdAt: new Date().toISOString(),
      });
    const rafi = await student("RAFI");
    const mina = await student("MINA");
    const enrol = (studentId: typeof rafi, level: typeof grade4) =>
      ctx.db.insert("enrollments", {
        studentId,
        academicYear: year,
        standardLevelId: level,
        enrollmentType: "new_admission",
        enrollmentDate: 0,
      });
    return {
      admin,
      assessment,
      question,
      rafi,
      rafiGrade4: await enrol(rafi, grade4),
      minaGrade4: await enrol(mina, grade4),
      minaGrade5: await enrol(mina, grade5),
      mina,
    };
  });
  const asAdmin = t.withIdentity({ subject: `${ids.admin}|s` });
  const enter = (
    studentId: typeof ids.rafi,
    enrollmentId: typeof ids.rafiGrade4,
  ) =>
    asAdmin.mutation(api.studentAssessmentAnswers.bulkMarkEntry, {
      assessmentId: ids.assessment,
      entries: [
        { studentId, enrollmentId, questionId: ids.question, marksObtained: 7 },
      ],
    });

  await expect(enter(ids.rafi, ids.minaGrade4)).rejects.toThrow(
    /not in this assessment's class/,
  ); // someone else's enrollment
  await expect(enter(ids.mina, ids.minaGrade5)).rejects.toThrow(
    /not in this assessment's class/,
  ); // the student's own, but another level
  await expect(enter(ids.rafi, ids.rafiGrade4)).resolves.toEqual({ count: 1 });
  await expect(
    asAdmin.mutation(api.studentAssessmentAnswers.markStudentAbsent, {
      studentId: ids.mina,
      enrollmentId: ids.minaGrade5,
      assessmentId: ids.assessment,
    }),
  ).rejects.toThrow(/not in this assessment's class/);
});
