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
  toCommitRow,
} from "@/lib/studentImportMapping";

/**
 * The import surface's whole flow: file in, preview model out (spec §7).
 *
 * Everything up to the commit happens here, in the browser, before a single
 * byte reaches the backend — the preview *is* the gate.
 */

/** The file, once read — the split pane stays on screen through the commit. */
type Loaded = { fileName: string; preview: ImportPreview };

export type ImportPhase =
  | { kind: "idle" }
  | { kind: "parsing"; fraction: number; label: string }
  | { kind: "error"; message: string }
  | ({ kind: "preview" } & Loaded)
  | ({ kind: "committing"; written: number; total: number } & Loaded)
  | ({
      kind: "done";
      created: number;
      updated: number;
      skipped: number;
    } & Loaded);

/**
 * §5.2: one index range per student number, so the lookup is chunked rather
 * than sent as one 400-element argument that grows with the school.
 */
const LOOKUP_CHUNK = 250;

/**
 * §4.4. Not for atomicity — cross-batch atomicity is ruled out. 250 rows × 2
 * ops is half Convex's concurrent-IO limit, no file is ever too big, and the
 * client knowing batch *i* of *n* is what makes progress determinate and free.
 */
const COMMIT_BATCH = 250;

/** What one committed row did — the mutation's return, minus the number. */
type BatchResult = { action: "inserted" | "updated" };

/**
 * The write loop itself, kept out of React so it is testable without a Convex
 * provider: sequential batches, a progress call after each, and the run
 * summary at the end. A batch that throws propagates — the caller decides,
 * and the rows already written stay written (there is nothing to roll back).
 */
export async function commitInBatches(
  rows: readonly PreviewRow[],
  send: (
    batch: ReturnType<typeof toCommitRow>[],
    index: number,
  ) => Promise<BatchResult[]>,
  onProgress: (written: number) => void,
) {
  let created = 0;
  let updated = 0;
  for (let i = 0; i < rows.length; i += COMMIT_BATCH) {
    const batch = rows.slice(i, i + COMMIT_BATCH);
    const results = await send(batch.map(toCommitRow), i / COMMIT_BATCH + 1);
    created += results.filter((r) => r.action === "inserted").length;
    updated += results.filter((r) => r.action === "updated").length;
    onProgress(i + batch.length);
  }
  return { created, updated };
}

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

  /**
   * §4.4 + §3.3: valid rows only, in sequential 250-row batches under one
   * run id. There is no rollback and none is needed — the write is an upsert
   * on `studentNumber`, so a run that dies halfway is completed by simply
   * re-uploading the same file.
   */
  const commit = useCallback(async () => {
    if (phase.kind !== "preview" || phase.preview.fileError) return;

    const { preview, fileName } = phase;
    const rows = preview.rows.filter((row) => row.outcome !== "reject");
    const skipped = preview.rows.length - rows.length;
    const runId = crypto.randomUUID();
    let written = 0;

    setPhase({
      kind: "committing",
      fileName,
      preview,
      written: 0,
      total: rows.length,
    });
    try {
      const { created, updated } = await commitInBatches(
        rows,
        (payload, batch) =>
          convex.mutation(api.studentImport.commitImportBatch, {
            runId,
            batch,
            rows: payload,
          }),
        (done) => {
          written = done;
          setPhase((current) =>
            current.kind === "committing"
              ? { ...current, written: done }
              : current,
          );
        },
      );
      setPhase({ kind: "done", fileName, preview, created, updated, skipped });
      toast.success(
        `${created} created · ${updated} updated · ${skipped} skipped`,
      );
    } catch {
      // Back to the preview: the rows that landed are already correct, and the
      // fix is the same file again rather than anything the admin must undo.
      setPhase({ kind: "preview", fileName, preview });
      toast.error(
        `Import stopped after ${written} of ${rows.length} rows. Upload the same file again to finish it.`,
      );
    }
  }, [convex, phase]);

  return { phase, drop, commit, reset };
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
