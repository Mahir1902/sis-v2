import { describe, expect, it } from "vitest";
import { ISSUES_CSV_HEADER, issuesCsv } from "./studentImportFile";
import type { ImportPreview, PreviewRow } from "./studentImportMapping";

/**
 * The issues CSV is the artifact sent back to the school (§7.5), and the only
 * part of the preview that survives the tab closing — so the seam under test
 * is its text, not how the surface renders it.
 */

const row = (over: Partial<PreviewRow> = {}): PreviewRow => ({
  sheet: "Class-3",
  excelRow: 4,
  studentNumber: "S0724-1304",
  outcome: "reject",
  fields: [],
  warnings: [],
  errors: [],
  ...over,
});

const preview = (over: Partial<ImportPreview> = {}): ImportPreview => ({
  tabs: [],
  rows: [],
  ...over,
});

const lines = (csv: string) => csv.trimEnd().split("\n");

describe("issuesCsv", () => {
  it("writes the documented header and nothing else for a clean file", () => {
    expect(issuesCsv(preview({ rows: [row({ outcome: "insert" })] }))).toBe(
      `${ISSUES_CSV_HEADER}\n`,
    );
  });

  it("exports every failure in a row, not just the first", () => {
    const csv = issuesCsv(
      preview({
        rows: [
          row({
            errors: [
              { column: "GENDER", value: "M/F", reason: "unrecognised gender" },
              { column: "DOB", value: "N/A", reason: "unreadable date" },
            ],
          }),
        ],
      }),
    );

    expect(lines(csv).slice(1)).toEqual([
      "error,Class-3,4,S0724-1304,GENDER,M/F,unrecognised gender",
      "error,Class-3,4,S0724-1304,DOB,N/A,unreadable date",
    ]);
  });

  it("exports warnings alongside errors, told apart by the severity column", () => {
    const csv = issuesCsv(
      preview({
        rows: [
          row({
            outcome: "insert",
            warnings: [
              { code: 3, text: 'MOB. FA "017111111112" is not 11 digits' },
            ],
          }),
        ],
      }),
    );

    expect(lines(csv).slice(1)).toEqual([
      'warning,Class-3,4,S0724-1304,,,"MOB. FA ""017111111112"" is not 11 digits"',
    ]);
  });

  it("names a tab rejected for a missing header, which has no rows to report", () => {
    const csv = issuesCsv(
      preview({
        tabs: [
          {
            name: "Class-12",
            rows: 0,
            rejected: "missing column CURRENT CLASS",
          },
        ],
      }),
    );

    expect(lines(csv).slice(1)).toEqual([
      "error,Class-12,1,,,,missing column CURRENT CLASS",
    ]);
  });

  it("quotes a value carrying a comma so the columns still line up", () => {
    const csv = issuesCsv(
      preview({
        rows: [
          row({
            errors: [
              {
                column: "CURRENT CLASS",
                value: "Grade 3, section B",
                reason: "unrecognised class",
              },
            ],
          }),
        ],
      }),
    );

    expect(lines(csv).slice(1)).toEqual([
      'error,Class-3,4,S0724-1304,CURRENT CLASS,"Grade 3, section B",unrecognised class',
    ]);
  });
});
