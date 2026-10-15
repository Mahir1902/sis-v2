/**
 * Pure presentation helpers for the attendance screens (spec §2.3, §5).
 * No Convex, no React — every string the screens show that is derived from
 * a count or a date is produced here so it can be unit-tested.
 */

import { BD_OFFSET_MS } from "./attendanceDate";
import { attendancePercentage } from "./attendancePercentage";

export type AttendanceStatus = "present" | "absent" | "late";

/** The row tap cycle: present → absent → late → present (spec §5.3). */
export function nextStatus(status: AttendanceStatus): AttendanceStatus {
  return status === "present"
    ? "absent"
    : status === "absent"
      ? "late"
      : "present";
}

export function tally(statuses: Iterable<AttendanceStatus>) {
  const t = { present: 0, absent: 0, late: 0 };
  for (const s of statuses) t[s] += 1;
  return t;
}

/** The save button copy carries the "is this marked yet" signal (spec §5.3). */
export function saveButtonLabel(opts: {
  alreadyMarked: boolean;
  touched: boolean;
  counts: { present: number; absent: number; late: number };
}): string {
  if (opts.alreadyMarked) return "Update register";
  const total = opts.counts.present + opts.counts.absent + opts.counts.late;
  if (!opts.touched) return `Confirm all ${total} present`;
  const { present, late, absent } = opts.counts;
  return `Save — ${present} present · ${late} late · ${absent} absent`;
}

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
const DAYS = "Sunday Monday Tuesday Wednesday Thursday Friday Saturday".split(
  " ",
);

/** "YYYY-MM-DD" → "30 Sep". Fixed names — locales disagree on "Sep"/"Sept". */
export function formatDayMonth(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}

/** "YYYY-MM-DD" → "Wednesday, 30 Sep 2026". */
export function formatLongDate(date: string): string {
  const day = DAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  return `${day}, ${formatDayMonth(date)} ${date.slice(0, 4)}`;
}

/** Epoch ms → Dhaka-local "HH:MM" for "Marked at 08:12". */
export function formatDhakaTime(ms: number): string {
  return new Date(ms + BD_OFFSET_MS).toISOString().slice(11, 16);
}

/** "YYYY-MM-DD" (Dhaka-local midnight) → epoch ms, for academicYears fields. */
export function dhakaMidnightMs(date: string): number {
  return Date.parse(`${date}T00:00:00+06:00`);
}

/** "89%" or "—" (never 0% on an empty denominator). */
export function percentLabel(c: {
  present: number;
  late: number;
  denominator: number;
}): string {
  const pct = attendancePercentage(c);
  return pct === null ? "—" : `${pct}%`;
}

/** "35/39 days" — always shown beside the percentage. */
export function rawCountLabel(c: {
  present: number;
  late: number;
  denominator: number;
}): string {
  return `${c.present + c.late}/${c.denominator} days`;
}

/**
 * The two flags of §2.3 plus the leaver mirror, as the words the typist
 * transcribes from. Empty when nothing needs saying.
 */
export function appearanceNotes(s: {
  denominator: number;
  firstAppearance: string | null;
  markedBeforeFirst: number;
  lastAppearance: string | null;
  markedAfterLast: number;
}): string[] {
  if (s.denominator === 0) return ["never appears in this period's register"];
  const notes: string[] = [];
  if (s.firstAppearance) {
    notes.push(
      `first appears ${formatDayMonth(s.firstAppearance)} — the class was marked on ${s.markedBeforeFirst} ${plural(s.markedBeforeFirst, "day")} before that`,
    );
  }
  if (s.lastAppearance) {
    notes.push(
      `last appears ${formatDayMonth(s.lastAppearance)} — class marked ${s.markedAfterLast} ${plural(s.markedAfterLast, "day")} after`,
    );
  }
  return notes;
}

/** The completeness banner of §5.5, in prose. Null when nothing was missed. */
export function unmarkedDaysBanner(r: {
  schoolDaysUnmarked: number;
  classMarkedDays: number;
}): string | null {
  if (r.schoolDaysUnmarked === 0) return null;
  const total = r.schoolDaysUnmarked + r.classMarkedDays;
  return `${r.schoolDaysUnmarked} of ${total} school ${plural(total, "day")} ${r.schoolDaysUnmarked === 1 ? "was" : "were"} never marked for this class. Those days count for nobody — every figure below is out of ${r.classMarkedDays}.`;
}

/** The void-confirm copy of §4.2. */
export function closureVoidMessage(o: {
  startDate: string;
  endDate: string;
  markCount: number;
  classCount: number;
}): string {
  const when =
    o.startDate === o.endDate
      ? formatDayMonth(o.startDate)
      : `${formatDayMonth(o.startDate)} – ${formatDayMonth(o.endDate)}`;
  return `${when} already ${o.startDate === o.endDate ? "has" : "have"} ${o.markCount} ${plural(o.markCount, "mark")} across ${o.classCount} ${plural(o.classCount, "class", "classes")}. Adding this closure voids them from all attendance figures.`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}

/** The academic year containing `today`, else the most recent one. */
export function currentYear<T extends { startDate: number; endDate: number }>(
  years: T[],
  now: number = Date.now(),
): T | undefined {
  return (
    years.find((y) => y.startDate <= now && now <= y.endDate) ??
    [...years].sort((a, b) => b.startDate - a.startDate)[0]
  );
}
