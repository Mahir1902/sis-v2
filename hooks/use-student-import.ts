"use client";

import { useConvex } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  ImportFileError,
  PARSE_STAGES,
  type ParseStage,
  readStudentFile,
} from "@/lib/studentImportFile";
import {
  buildImportPreview,
  type ImportPreview,
  type PreviewRow,
} from "@/lib/studentImportMapping";

/**
 * The import surface's whole flow: file in, preview model out (spec §7).
 *
 * Everything up to the commit happens here, in the browser, before a single
 * byte reaches the backend — the preview *is* the gate.
 */

export type ImportPhase =
  | { kind: "idle" }
  | { kind: "parsing"; fraction: number; label: string }
  | { kind: "error"; message: string }
  | { kind: "preview"; fileName: string; preview: ImportPreview };

/**
 * §5.2: one index range per student number, so the lookup is chunked rather
 * than sent as one 400-element argument that grows with the school.
 */
const LOOKUP_CHUNK = 250;

export function useStudentImport() {
  const convex = useConvex();
  const [phase, setPhase] = useState<ImportPhase>({ kind: "idle" });

  const reset = useCallback(() => setPhase({ kind: "idle" }), []);

  const drop = useCallback(
    async (file: File) => {
      const stage = (s: ParseStage) =>
        setPhase({
          kind: "parsing",
          fraction: PARSE_STAGES[s].fraction,
          label: PARSE_STAGES[s].label,
        });

      stage("opening");
      try {
        const sheets = await readStudentFile(file, stage);
        stage("checking");
        const preview = await buildPreview(convex, sheets);
        setPhase({ kind: "preview", fileName: file.name, preview });
      } catch (error) {
        const message =
          error instanceof ImportFileError
            ? error.message
            : "Something went wrong reading this file. Try again, or check that you are signed in as an administrator.";
        setPhase({ kind: "error", message });
        toast.error(message);
      }
    },
    [convex],
  );

  return { phase, drop, reset };
}

type ConvexClient = ReturnType<typeof useConvex>;

/** Reference data + the existing-students lookup, then the preview model. */
async function buildPreview(
  convex: ConvexClient,
  sheets: Awaited<ReturnType<typeof readStudentFile>>,
): Promise<ImportPreview> {
  const [levels, campuses, years] = await Promise.all([
    convex.query(api.standardLevels.list, {}),
    convex.query(api.campus.list, {}),
    convex.query(api.academicYears.list, {}),
  ]);
  const reference = {
    levelNamesByCode: new Map(levels.map((l) => [l.code, l.name])),
    campusNames: new Set(campuses.map((c) => c.name)),
    academicYearNames: new Set(years.map((y) => y.name)),
  };

  // Built twice on purpose. The new-vs-update split needs the student numbers,
  // and reading them out of the sheet is exactly what the mapping module does
  // — so the first pass extracts them (with nothing known to exist) and the
  // second is the real one. Two passes of pure code over ~400 rows costs
  // nothing; a second copy of the header matching here would eventually drift.
  const scouted = buildImportPreview({
    sheets,
    reference,
    existingStudentNumbers: [],
  });
  const numbers = [
    ...new Set(scouted.rows.map((r) => r.studentNumber).filter(Boolean)),
  ];

  // Shape owned by the query, so adding an imported field is a one-file change.
  const existing: FunctionReturnType<
    typeof api.studentImport.getExistingStudents
  > = [];
  for (let i = 0; i < numbers.length; i += LOOKUP_CHUNK) {
    existing.push(
      ...(await convex.query(api.studentImport.getExistingStudents, {
        studentNumbers: numbers.slice(i, i + LOOKUP_CHUNK),
      })),
    );
  }

  return buildImportPreview({
    sheets,
    reference,
    existingStudentNumbers: existing.map((e) => e.studentNumber),
    existingFieldValues: new Map(
      existing.map((e) => [e.studentNumber, e.fields]),
    ),
  });
}

/* ────────────────────────────── the row list ────────────────────────────── */

export type RowFilter = "all" | "insert" | "update" | "warned" | "reject";

export type RowCounts = Record<RowFilter, number>;

/** The student's name as the sheet gave it, for the list and the search. */
export function rowName(row: PreviewRow): string {
  return row.fields.find((f) => f.key === "studentFullName")?.value ?? "";
}

export function countRows(rows: readonly PreviewRow[]): RowCounts {
  return {
    all: rows.length,
    insert: rows.filter((r) => r.outcome === "insert").length,
    update: rows.filter((r) => r.outcome === "update").length,
    warned: rows.filter((r) => r.warnings.length > 0).length,
    reject: rows.filter((r) => r.outcome === "reject").length,
  };
}

/** Filter chip + search, applied together. Search is name or student number. */
export function useFilteredRows(
  rows: readonly PreviewRow[],
  filter: RowFilter,
  search: string,
) {
  return useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "warned"
          ? row.warnings.length > 0
          : row.outcome === filter);
      if (!matchesFilter) return false;
      if (!needle) return true;
      return (
        rowName(row).toLowerCase().includes(needle) ||
        row.studentNumber.toLowerCase().includes(needle)
      );
    });
  }, [rows, filter, search]);
}
