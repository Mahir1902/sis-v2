import { act, renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { userAccessSchema } from "@/lib/validations/userAccessSchema";

const getMe = vi.fn();
const updateUserRole = vi.fn();
const setTeacherGrants = vi.fn();
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  type Ref = Parameters<typeof getFunctionName>[0];
  return {
    useQuery: () => getMe(),
    useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
    useMutation: (ref: Ref) =>
      getFunctionName(ref) === "users:updateUserRole"
        ? updateUserRole
        : setTeacherGrants,
  };
});

import {
  type AccessAccount,
  accessDefaults,
  planAccessSave,
  useUserAccessForm,
} from "./use-user-access-form";

const U2 = "u2" as Id<"users">;
const S1 = "s1" as Id<"students">;

const account = (over: Partial<AccessAccount> = {}): AccessAccount => ({
  _id: U2,
  name: "Kamal Rahman",
  email: "kamal@school.edu",
  role: "teacher",
  isActive: true,
  studentId: undefined,
  linkedStudent: null,
  grants: [],
  ...over,
});
const linkedStudent = {
  studentFullName: "Rahim Uddin",
  studentNumber: "S-0142",
};

afterEach(() => vi.clearAllMocks());

describe("accessDefaults — what the sheet opens with", () => {
  it("opens a teacher on their role and grants", () => {
    expect(accessDefaults(account({ grants: ["viewAuditLog"] }))).toEqual({
      role: "teacher",
      studentId: "",
      grants: ["viewAuditLog"],
    });
  });

  it("ignores a stored grant that is not grantable", () => {
    const stored = account({ grants: ["manageUsers", "manageSubjects"] });
    expect(accessDefaults(stored).grants).toEqual(["manageSubjects"]);
  });

  it("opens a linked student account on its student", () => {
    const student = account({ role: "student", studentId: S1, linkedStudent });
    expect(accessDefaults(student).studentId).toBe(S1);
  });

  it("treats a link to a deleted student as no link", () => {
    const stale = account({ role: "student", studentId: S1 });
    expect(accessDefaults(stale).studentId).toBe("");
  });
});

describe("planAccessSave — which calls a save makes", () => {
  it("makes no call when nothing changed", () => {
    const teacher = account({ grants: ["viewAuditLog"] });
    expect(planAccessSave(teacher, accessDefaults(teacher))).toEqual({});
  });

  it("only sets grants for a teacher who stays a teacher", () => {
    const plan = planAccessSave(account({ grants: ["viewAuditLog"] }), {
      role: "teacher",
      studentId: "",
      grants: ["viewAuditLog", "manageCalendar"],
    });
    expect(plan).toEqual({ grants: ["viewAuditLog", "manageCalendar"] });
  });

  it("does not resend the same grants in a different order", () => {
    const teacher = account({ grants: ["viewAuditLog", "manageCalendar"] });
    const plan = planAccessSave(teacher, {
      role: "teacher",
      studentId: "",
      grants: ["manageCalendar", "viewAuditLog"],
    });
    expect(plan).toEqual({});
  });

  it("changes the role, then grants, when an admin becomes a teacher", () => {
    const plan = planAccessSave(account({ role: "admin" }), {
      role: "teacher",
      studentId: "",
      grants: ["promoteStudents"],
    });
    expect(plan).toEqual({
      role: { role: "teacher" },
      grants: ["promoteStudents"],
    });
  });

  it("skips the grants call for a new teacher with no extras", () => {
    const plan = planAccessSave(account({ role: "admin" }), {
      role: "teacher",
      studentId: "",
      grants: [],
    });
    expect(plan).toEqual({ role: { role: "teacher" } });
  });

  it("only changes the role when a teacher becomes an admin", () => {
    const teacher = account({ grants: ["viewAuditLog"] });
    // The switches keep their values while hidden; they are not sent.
    const plan = planAccessSave(teacher, {
      role: "admin",
      studentId: "",
      grants: ["viewAuditLog"],
    });
    expect(plan).toEqual({ role: { role: "admin" } });
  });

  it("links the picked student when an account becomes a student", () => {
    const plan = planAccessSave(account(), {
      role: "student",
      studentId: S1,
      grants: [],
    });
    expect(plan).toEqual({ role: { role: "student", studentId: S1 } });
  });

  it("fixes a legacy student account that has no linked student", () => {
    const legacy = account({ role: "student" });
    const plan = planAccessSave(legacy, {
      role: "student",
      studentId: S1,
      grants: [],
    });
    expect(plan).toEqual({ role: { role: "student", studentId: S1 } });
  });

  it("does not send a student for a role that is not student", () => {
    const student = account({ role: "student", studentId: S1, linkedStudent });
    const plan = planAccessSave(student, {
      role: "admin",
      studentId: S1,
      grants: [],
    });
    expect(plan).toEqual({ role: { role: "admin" } });
  });

  it("leaves a stale stored name alone until the admin changes something", () => {
    const stored = account({ grants: ["manageUsers"] });
    expect(planAccessSave(stored, accessDefaults(stored))).toEqual({});
  });
});

describe("userAccessSchema", () => {
  it("requires a student for the student role", () => {
    const result = userAccessSchema.safeParse({
      role: "student",
      studentId: "",
      grants: [],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["studentId"]);
  });

  it("needs no student for a teacher", () => {
    const values = { role: "teacher", studentId: "", grants: ["viewAuditLog"] };
    expect(userAccessSchema.safeParse(values).success).toBe(true);
  });

  it("refuses a feature that is not grantable", () => {
    const values = { role: "teacher", studentId: "", grants: ["manageUsers"] };
    expect(userAccessSchema.safeParse(values).success).toBe(false);
  });
});

describe("useUserAccessForm", () => {
  const signInAs = (id: string) =>
    getMe.mockReturnValue({
      _id: id,
      name: "Admin",
      email: "a@school.edu",
      role: "admin",
      isActive: true,
    });
  const open = (target: AccessAccount) => {
    const onSaved = vi.fn();
    const hook = renderHook(() => useUserAccessForm(target, onSaved));
    return { ...hook, onSaved };
  };

  it("locks the role on the admin's own account", () => {
    signInAs("u2");
    expect(open(account({ role: "admin" })).result.current.isSelf).toBe(true);
  });

  it("warns that leaving the teacher role drops the teacher's grants", () => {
    signInAs("u1");
    const { result } = open(account({ grants: ["viewAuditLog"] }));
    expect(result.current.droppedGrantCount).toBe(0);
    act(() => result.current.form.setValue("role", "admin"));
    expect(result.current.droppedGrantCount).toBe(1);
  });

  it("has nothing to save after a change is undone", () => {
    signInAs("u1");
    const { result } = open(account({ role: "admin" }));
    expect(result.current.hasChanges).toBe(false);
    act(() => {
      result.current.form.setValue("role", "student");
      result.current.form.setValue("studentId", S1);
    });
    expect(result.current.hasChanges).toBe(true);
    act(() => result.current.form.setValue("role", "admin"));
    expect(result.current.hasChanges).toBe(false);
  });

  it("holds a stale sheet when another admin changed the account", () => {
    signInAs("u1");
    let target = account({ grants: ["viewAuditLog"] });
    const { result, rerender } = renderHook(() =>
      useUserAccessForm(target, vi.fn()),
    );
    expect(result.current.changedElsewhere).toBe(false);
    target = account({ role: "admin" });
    rerender();
    expect(result.current.changedElsewhere).toBe(true);
    act(() => result.current.reload());
    expect(result.current.changedElsewhere).toBe(false);
    expect(result.current.form.getValues()).toEqual({
      role: "admin",
      studentId: "",
      grants: [],
    });
  });

  it("does not mistake its own grants save for someone else's change", async () => {
    signInAs("u1");
    let target = account({ grants: ["viewAuditLog"] });
    // As Convex does: the live row carries the write when the call resolves.
    setTeacherGrants.mockImplementation(async ({ grants }) => {
      target = account({ grants });
    });
    const { result } = renderHook(() => useUserAccessForm(target, vi.fn()));
    act(() =>
      result.current.form.setValue("grants", [
        "viewAuditLog",
        "manageSubjects",
      ]),
    );
    await act(() => result.current.onSubmit());
    expect(target.grants).toEqual(["viewAuditLog", "manageSubjects"]);
    expect(result.current.changedElsewhere).toBe(false);
  });

  it("saves role then grants, toasts, and closes", async () => {
    signInAs("u1");
    const order: string[] = [];
    updateUserRole.mockImplementation(async () => order.push("role"));
    setTeacherGrants.mockImplementation(async () => order.push("grants"));
    const { result, onSaved } = open(account({ role: "admin" }));
    act(() => {
      result.current.form.setValue("role", "teacher");
      result.current.form.setValue("grants", ["manageSubjects"]);
    });
    await act(() => result.current.onSubmit());
    expect(order).toEqual(["role", "grants"]);
    expect(updateUserRole).toHaveBeenCalledWith({
      userId: U2,
      role: "teacher",
    });
    expect(setTeacherGrants).toHaveBeenCalledWith({
      userId: U2,
      grants: ["manageSubjects"],
    });
    expect(toast.success).toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
  });

  it("does not save a student account with no student picked", async () => {
    signInAs("u1");
    const { result, onSaved } = open(account());
    act(() => result.current.form.setValue("role", "student"));
    await act(() => result.current.onSubmit());
    expect(updateUserRole).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("says so, and stays open, when the role saved but the grants did not", async () => {
    signInAs("u1");
    updateUserRole.mockResolvedValue(null);
    setTeacherGrants.mockRejectedValue(new Error("boom"));
    const { result, onSaved } = open(account({ role: "admin" }));
    act(() => {
      result.current.form.setValue("role", "teacher");
      result.current.form.setValue("grants", ["manageSubjects"]);
    });
    await act(() => result.current.onSubmit());
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/role was saved/i),
    );
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("explains a refused student link in plain words", async () => {
    signInAs("u1");
    updateUserRole.mockRejectedValue(
      new ConvexError({ code: "STUDENT_REQUIRED" }),
    );
    const { result, onSaved } = open(account());
    act(() => {
      result.current.form.setValue("role", "student");
      result.current.form.setValue("studentId", S1);
    });
    await act(() => result.current.onSubmit());
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/student/i));
    expect(onSaved).not.toHaveBeenCalled();
  });
});
