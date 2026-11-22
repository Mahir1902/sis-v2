"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  type GrantableCapability,
  isGrantable,
  type Role,
} from "@/lib/accessPolicy";
import {
  type UserAccessValues,
  userAccessSchema,
} from "@/lib/validations/userAccessSchema";
import { useCapabilities } from "./use-capabilities";

/** One row of Settings → Users, as `users.listUsers` returns it. */
export type AccessAccount = FunctionReturnType<
  typeof api.users.listUsers
>[number];

/** The calls one save makes, in the order they are made: role, then grants. */
export type AccessPlan = {
  role?: { role: Role; studentId?: Id<"students"> };
  grants?: GrantableCapability[];
};

/**
 * What the account has now, in the sheet's terms. A link to a student who was
 * since deleted counts as no link (the admin has to pick again), and a stored
 * grant that is not grantable counts for nothing — as it does on the server.
 */
export function accessDefaults(account: AccessAccount): UserAccessValues {
  return {
    role: account.role,
    studentId: account.linkedStudent ? (account.studentId ?? "") : "",
    grants: account.grants.filter(isGrantable),
  };
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item) => b.includes(item));

/**
 * Which calls turn the account as it is now into what the sheet says. Only
 * what changed is sent: the student link only for a student account, grants
 * only for a teacher. Changing the role drops the account's grants on the
 * server, so a new teacher starts from none.
 */
export function planAccessSave(
  account: AccessAccount,
  values: UserAccessValues,
): AccessPlan {
  const current = accessDefaults(account);
  const roleChanged = values.role !== current.role;
  const plan: AccessPlan = {};

  if (values.role === "student") {
    // With no student picked yet this is still a pending change, so Save is
    // offered and the form answers it with "pick a student"; it is never sent.
    if (roleChanged || values.studentId !== current.studentId) {
      plan.role = {
        role: "student",
        studentId: values.studentId as Id<"students">,
      };
    }
    return plan;
  }

  if (roleChanged) plan.role = { role: values.role };
  if (values.role === "teacher") {
    const held = roleChanged ? [] : current.grants;
    if (!sameSet(held, values.grants)) plan.grants = values.grants;
  }
  return plan;
}

function refusalMessage(err: unknown): string {
  const code =
    err instanceof ConvexError
      ? (err.data as { code?: string } | undefined)?.code
      : undefined;
  if (code === "STUDENT_REQUIRED") {
    return "That student record could not be found. Pick another student.";
  }
  if (code === "NOT_A_TEACHER") {
    return "This account is no longer a teacher, so it cannot have extra features.";
  }
  return "Couldn't save access. Please try again.";
}

/**
 * The "Manage access" sheet for one account: its form, what the chosen role
 * implies, and the save. `account` is the live row, so a save only ever sends
 * what still differs — pressing Save again after a half-finished save retries
 * just the part that failed.
 */
export function useUserAccessForm(account: AccessAccount, onSaved: () => void) {
  const { me } = useCapabilities();
  const updateUserRole = useMutation(api.users.updateUserRole);
  const setTeacherGrants = useMutation(api.users.setTeacherGrants);

  // The account as this sheet last knew it: when it opened, was reloaded, or
  // after its own role change. The live row drifting from this means another
  // admin changed the account meanwhile.
  const live = accessDefaults(account);
  const [known, setKnown] = useState(live);
  const form = useForm<UserAccessValues>({
    resolver: zodResolver(userAccessSchema),
    defaultValues: known,
  });
  const values = useWatch({ control: form.control }) as UserAccessValues;
  const plan = planAccessSave(account, values);
  const isSaving = form.formState.isSubmitting;
  const changedElsewhere =
    !isSaving &&
    (known.role !== live.role ||
      known.studentId !== live.studentId ||
      !sameSet(known.grants, live.grants));

  const onSubmit = form.handleSubmit(async (submitted) => {
    const { role, grants } = planAccessSave(account, submitted);
    if (!role && !grants) return onSaved();
    let roleSaved = false;
    try {
      if (role) {
        await updateUserRole({ userId: account._id, ...role });
        roleSaved = true;
        // A role change drops the account's grants on the server.
        setKnown({
          role: role.role,
          studentId: role.studentId ?? "",
          grants: [],
        });
      }
      if (grants) {
        await setTeacherGrants({ userId: account._id, grants });
        // The live row already carries them when the call resolves.
        setKnown((before) => ({ ...before, grants }));
      }
      toast.success(`Access updated for ${account.name}`);
      onSaved();
    } catch (err: unknown) {
      toast.error(
        roleSaved
          ? "The role was saved, but the extra features were not. Press Save again."
          : refusalMessage(err),
      );
    }
  });

  return {
    form,
    /** The role chosen in the sheet (not yet saved). */
    role: values.role,
    /** The server refuses an admin changing their own role. */
    isSelf: me?._id === account._id,
    /** Extra features this save takes away because the teacher role goes. */
    droppedGrantCount:
      account.role === "teacher" && values.role !== "teacher"
        ? accessDefaults(account).grants.length
        : 0,
    /** False when the sheet matches the account — nothing to save. */
    hasChanges: plan.role !== undefined || plan.grants !== undefined,
    isSaving,
    /**
     * Another admin changed this account while the sheet was open. Saving is
     * held until `reload`, so a stale sheet cannot undo their change.
     */
    changedElsewhere,
    /** Start again from the account as it is now. */
    reload: () => {
      setKnown(live);
      form.reset(live);
    },
    onSubmit,
  };
}
