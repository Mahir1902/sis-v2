/**
 * The browser boundary of the Excel student import (spec §4.1, §7.5): the file
 * goes in, raw per-tab cell grids and a downloadable issues CSV come out.
 *
 * Parsing happens here rather than on the server because every decision in the
 * validation policy — including both whole-file aborts — is computable from the
 * parsed rows alone, so a round trip would buy nothing. The file is transport,
 * never a record, and is not retained.
 *
 * `read-excel-file` is behind a dynamic import so its weight stays off every
 * other route; nothing else in this module reaches for it.
 */

import type { ImportPreview, RawCell, RawSheet } from "./studentImportMapping";

/**
 * A file the importer could not turn into rows. `kind` separates the two
 * states the administrator must be able to tell apart (§7.4): the wrong kind
 * of file, and a spreadsheet that will not open.
 */
export class ImportFileError extends Error {
  constructor(
    readonly kind: "wrong-type" | "unreadable",
    message: string,
  ) {
    super(message);
    this.name = "ImportFileError";
  }
}

/** The only shape `read-excel-file` reads. `.xls` and `.csv` are not it. */
const SPREADSHEET = /\.xlsx$/i;

/**
 * The stages the parse moves through: the label to show while each one runs,
 * and how far along the bar sits when it starts. They are what makes the
 * progress bar determinate — the parser hands back the whole file in a single
 * call and reports nothing while it works, so the honest unit of progress is
 * the stage, not the row.
 *
 * ponytail: three stages, not a row counter. If ~400 rows ever stops feeling
 * instant, the upgrade is a web worker reading one sheet at a time
 * (`read-excel-file/web-worker`), not a fake animation here.
 */
export const PARSE_STAGES = {
  opening: { fraction: 0, label: "Opening the file" },
  reading: { fraction: 0.15, label: "Reading the sheets" },
  checking: { fraction: 0.7, label: "Checking the rows" },
} as const;

export type ParseStage = keyof typeof PARSE_STAGES;

/**
 * Read every tab of the student data file into raw cell grids, in one pass.
 *
 * @param file The dropped file.
 * @param onStage Called as each stage begins, so the administrator can tell
 *   working from hung.
 * @throws ImportFileError for a non-spreadsheet or an unreadable file.
 */
export async function readStudentFile(
  file: File,
  onStage: (stage: ParseStage) => void,
): Promise<RawSheet[]> {
  if (!SPREADSHEET.test(file.name)) {
    throw new ImportFileError(
      "wrong-type",
      `${file.name} is not a spreadsheet — the importer reads .xlsx files.`,
    );
  }

  // Dynamic so the parser's weight stays off every other route (§4.1).
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  onStage("reading");

  let sheets: { sheet: string; data: unknown[][] }[];
  try {
    sheets = await readXlsxFile(file);
  } catch {
    throw new ImportFileError("unreadable", UNREADABLE);
  }

  // The parser's `CellValue` and our `RawCell` are the same four types plus
  // null; its declaration writes `typeof Date` where it means `Date`.
  return sheets.map((s) => ({ name: s.sheet, rows: s.data as RawCell[][] }));
}

const UNREADABLE =
  "This file could not be read — it may be corrupt, or saved in an older Excel format. Re-save it as .xlsx and try again.";

/* ──────────────────────────────── issues CSV ────────────────────────────── */

/** The column set the school gets back (§7.5). */
export const ISSUES_CSV_HEADER =
  "severity,sheet,excelRow,studentId,column,value,reason";

/** RFC 4180: quote anything carrying a delimiter, a quote or a newline. */
function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Every error and every warning in the preview, as CSV text. This is the
 * artifact sent back to the school and the only part of the preview that
 * survives the tab closing, so warnings are in it too — told apart from
 * rejections by the severity column rather than by being left out.
 */
export function issuesCsv(preview: ImportPreview): string {
  const lines = [ISSUES_CSV_HEADER];
  const write = (cells: (string | number)[]) =>
    lines.push(cells.map((c) => csvCell(String(c))).join(","));

  // A tab rejected for a missing header has no rows to report it against, and
  // it is the one fix that unblocks every student on that tab.
  for (const tab of preview.tabs) {
    if (tab.rejected) write(["error", tab.name, 1, "", "", "", tab.rejected]);
  }

  for (const row of preview.rows) {
    for (const error of row.errors) {
      write([
        "error",
        row.sheet,
        row.excelRow,
        row.studentNumber,
        error.column,
        error.value,
        error.reason,
      ]);
    }
    for (const warning of row.warnings) {
      // A warning is about the row, not about one cell: its text already names
      // the column where there is one.
      write([
        "warning",
        row.sheet,
        row.excelRow,
        row.studentNumber,
        "",
        "",
        warning.text,
      ]);
    }
  }

  return `${lines.join("\n")}\n`;
}

/**
 * Save the issues CSV as a local blob — no backend, so the artifact exists the
 * moment the preview does (§7.5).
 *
 * The anchor goes into the document and the object URL is revoked on the next
 * task, not this one: Firefox ignores a click on a detached anchor and can
 * abort the download if the URL is revoked in the same tick.
 */
export function downloadIssuesCsv(preview: ImportPreview, fileName: string) {
  const url = URL.createObjectURL(
    new Blob([issuesCsv(preview)], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName.replace(/\.xlsx$/i, "")}-import-issues.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
