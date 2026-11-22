"use client";

import { useMutation, useQuery } from "convex/react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/** What linking needs to know about a student; the name may be absent (#93). */
type Linkable = {
  _id: Id<"students">;
  studentNumber: string;
  studentFullName?: string;
};

const nameOf = (s: Linkable) => s.studentFullName ?? s.studentNumber;

/**
 * Link and unlink siblings of one student (#89). The server writes the link
 * on both records; this hook owns the mutation call, the pending guard and
 * the toasts.
 *
 * `siblings` is the student's current sibling list (`undefined` while it
 * loads — nothing is written until it is known). The roster to pick from is
 * only fetched while `searching` is true.
 */
export function useSiblingLinks(
  studentId: Id<"students">,
  siblings: readonly (Linkable | null)[] | undefined,
  searching: boolean,
) {
  const updateStudent = useMutation(api.students.updateStudent);
  const roster = useQuery(api.students.getAllStudents, searching ? {} : "skip");
  const [isPending, setIsPending] = useState(false);

  // Kept in a ref so Undo, fired from a toast after later renders, edits the
  // current list rather than the one it closed over.
  // ponytail: the whole list is sent, so two admins editing one student at
  // the same moment can overwrite each other; add link/unlink mutations if
  // that ever matters.
  const linked = useRef<Id<"students">[] | undefined>(undefined);
  linked.current = siblings?.flatMap((s) => (s ? [s._id] : []));

  const save = async (
    next: (current: Id<"students">[]) => Id<"students">[],
    success: string,
    undo?: () => void,
  ) => {
    if (!linked.current) return;
    setIsPending(true);
    try {
      await updateStudent({ studentId, siblingIds: next(linked.current) });
      toast.success(
        success,
        undo ? { action: { label: "Undo", onClick: undo } } : undefined,
      );
    } catch {
      toast.error("Could not update siblings. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  const link = (s: Linkable) =>
    save((ids) => [...ids, s._id], `Linked ${nameOf(s)} as sibling`);

  const unlink = (s: Linkable) =>
    save(
      (ids) => ids.filter((id) => id !== s._id),
      `Unlinked ${nameOf(s)}`,
      () => link(s),
    );

  return {
    /** Students that can still be linked; `undefined` while loading. */
    candidates: roster?.filter(
      (s) => s._id !== studentId && !linked.current?.includes(s._id),
    ),
    link,
    unlink,
    isPending,
  };
}
