import {
  dhakaDate,
  EDIT_WINDOW_DAYS,
  shiftDate,
} from "../../lib/attendanceDate";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireRole } from "./permissions";

export type LockReason = "future" | "outside_window";

/**
 * Pure verdict on whether a role may write the given attendance date today.
 * Shared by `requireAttendanceWrite` (the gate) and `getRegister` (the
 * server-computed `canWrite` / `lockReason`, spec §7 A1).
 *
 * String comparison only — "YYYY-MM-DD" sorts lexicographically.
 */
export function attendanceLockReason(
  role: string,
  date: string,
  today: string = dhakaDate(),
): LockReason | null {
  if (date > today) return "future";
  if (role === "teacher" && date < shiftDate(today, -EDIT_WINDOW_DAYS)) {
    return "outside_window";
  }
  return null;
}

/**
 * Gate for every attendance write (spec §3.1). Role first, then the window.
 * teacher → today back through 14 calendar days from the attendance date.
 * admin   → today or any past date.
 * nobody  → the future.
 *
 * Deliberately NOT in `requireRole` — attendance-specific logic stays beside
 * the attendance code so per-class teacher scoping later is a one-file change.
 */
export async function requireAttendanceWrite(
  ctx: MutationCtx | QueryCtx,
  date: string,
) {
  const user = await requireRole(ctx, ["admin", "teacher"]);
  const reason = attendanceLockReason(user.role, date);
  if (reason === "future") throw new Error("Cannot mark a future date");
  if (reason === "outside_window") {
    throw new Error("This date is outside the correction window");
  }
  return user;
}
