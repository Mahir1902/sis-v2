"use client";

import { useMutation } from "convex/react";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { placementErrorMessage } from "@/lib/placementErrors";
import { cn } from "@/lib/utils";
import { ReadmitDialog } from "./ReadmitDialog";

type Status =
  | "active"
  | "graduated"
  | "transferred"
  | "withdrawn"
  | "suspended"
  | "expelled";

const statusStyles: Record<Status, string> = {
  active: "bg-green-400/40 text-green-700",
  graduated: "bg-purple-400/40 text-purple-700",
  transferred: "bg-yellow-400/40 text-yellow-700",
  withdrawn: "bg-gray-400/40 text-gray-700",
  suspended: "bg-orange-400/40 text-orange-700",
  expelled: "bg-red-400/40 text-red-700",
};

const allStatuses: Status[] = [
  "active",
  "graduated",
  "transferred",
  "withdrawn",
  "suspended",
  "expelled",
];

/** Leaving closes the student's enrollment (convex/lib/placement.ts). */
const leaverStatuses: Status[] = [
  "graduated",
  "transferred",
  "withdrawn",
  "expelled",
];

interface StatusBadgeProps {
  studentId: Id<"students">;
  /** Undefined for imported students whose status cell was blank (#93). */
  status: Status | undefined;
  readonly?: boolean;
}

export function StatusBadge({
  studentId,
  status,
  readonly = false,
}: StatusBadgeProps) {
  const [pendingStatus, setPendingStatus] = useState<Status | null>(null);
  const [readmitOpen, setReadmitOpen] = useState(false);
  const updateStatus = useMutation(api.students.updateStudentStatus);
  const hasLeft = !!status && leaverStatuses.includes(status);

  async function handleConfirm() {
    if (!pendingStatus) return;
    try {
      await updateStatus({ studentId, status: pendingStatus });
      toast.success(`Status updated to ${pendingStatus}`);
    } catch (err) {
      toast.error(placementErrorMessage(err, "Failed to update status"));
    } finally {
      setPendingStatus(null);
    }
  }

  function choose(s: Status) {
    // Anything but active is confirmed first (leaving removes the class).
    if (s !== "active") setPendingStatus(s);
    // A leaver goes back to active only by re-admission into a class.
    else if (hasLeft) setReadmitOpen(true);
    else
      updateStatus({ studentId, status: s })
        .then(() => toast.success(`Status updated to ${s}`))
        .catch((err) =>
          toast.error(placementErrorMessage(err, "Failed to update status")),
        );
  }

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize",
        status ? statusStyles[status] : "bg-gray-100 text-gray-600",
      )}
    >
      {status ?? "Unspecified"}
      {!readonly && <ChevronDown className="h-3 w-3" />}
    </span>
  );

  if (readonly) return badge;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Change status, currently ${status ?? "unspecified"}`}
            className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-school-green"
          >
            {badge}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {allStatuses.map((s) => (
            <DropdownMenuItem
              key={s}
              // A leaver cannot be suspended — they have no class to keep.
              disabled={s === status || (hasLeft && s === "suspended")}
              onClick={() => choose(s)}
              className="capitalize"
            >
              {hasLeft && s === "active" ? "Re-admit…" : s}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={!!pendingStatus}
        onOpenChange={() => setPendingStatus(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Mark student as {pendingStatus}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will change the student&apos;s status to{" "}
              <strong>{pendingStatus}</strong>.{" "}
              {hasLeft
                ? "They stay without a class; going back to active needs a re-admission."
                : pendingStatus && leaverStatuses.includes(pendingStatus)
                  ? "They will be removed from their class; bringing them back needs a re-admission."
                  : "They keep their class. This can be reversed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mounted only while open: fresh form each time, none per table row. */}
      {readmitOpen && (
        <ReadmitDialog
          open
          onOpenChange={setReadmitOpen}
          studentId={studentId}
        />
      )}
    </>
  );
}
