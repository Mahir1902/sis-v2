/**
 * Display helpers for a student row. `studentFullName` is optional since the
 * import widening (#93), so both helpers must tolerate a nameless record —
 * a crash here takes down the whole students table, not just one row.
 */

/**
 * Up to two uppercase initials, or an em-dash when there is no name — the
 * same fallback the student detail views already use for a blank avatar.
 */
export function getStudentInitials(name: string | undefined): string {
  const initials = (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return initials || "—";
}

/** Haystack for the table's global filter — must never read "undefined". */
export function studentSearchText(row: {
  studentFullName?: string;
  studentNumber: string;
}): string {
  return [row.studentFullName, row.studentNumber].filter(Boolean).join(" ");
}
