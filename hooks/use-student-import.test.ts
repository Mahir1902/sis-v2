import { describe, expect, it, vi } from "vitest";
import { importRowValidator } from "@/convex/studentImport";
import {
  buildImportPreview,
  type PreviewRow,
  toCommitRow,
} from "@/lib/studentImportMapping";
import { commitInBatches } from "./use-student-import";

/**
 * The commit loop of spec §4.4 (#99). Batching exists for the Convex ceiling
 * and for determinate progress — not for atomicity, which §3.3 rules out — so
 * what is worth pinning is the batch boundary, the progress it reports, and
 * what a mid-run failure leaves behind.
 */

const previewRow = (n: number): PreviewRow => ({
  sheet: "Class-1",
  excelRow: n + 2,
  studentNumber: `S0724-${1000 + n}`,
  outcome: "insert",
  fields: [
    {
      key: "studentNumber",
      header: "STUDENT ID",
      value: `S0724-${1000 + n}`,
      source: "sheet",
    },
    {
      key: "standardLevel",
      header: "CURRENT CLASS",
      value: "Grade 1",
      source: "derived",
    },
  ],
  warnings: [],
  errors: [],
});

const rows = (count: number) =>
  Array.from({ length: count }, (_, i) => previewRow(i));

const inserted = (count: number) =>
  Array.from({ length: count }, () => ({ action: "inserted" as const }));

describe("commitInBatches", () => {
  it("sends 346 rows as 250 then 96, and reports progress after each", async () => {
    const send = vi.fn(async (batch: unknown[], _index: number) =>
      inserted(batch.length),
    );
    const progress: number[] = [];

    const summary = await commitInBatches(rows(346), send, (written) =>
      progress.push(written),
    );

    expect(send.mock.calls.map(([batch]) => batch.length)).toEqual([250, 96]);
    // 1-based, and the only thing that orders a run's audit documents.
    expect(send.mock.calls.map(([, index]) => index)).toEqual([1, 2]);
    expect(progress).toEqual([250, 346]);
    expect(summary).toEqual({ created: 346, updated: 0 });
  });

  it("counts created and updated separately", async () => {
    const send = async () => [
      { action: "inserted" as const },
      { action: "updated" as const },
      { action: "updated" as const },
    ];

    expect(await commitInBatches(rows(3), send, () => {})).toEqual({
      created: 1,
      updated: 2,
    });
  });

  it("sends the mapped payload, not the preview row", async () => {
    const send = vi.fn(async (batch: unknown[], _index: number) =>
      inserted(batch.length),
    );

    await commitInBatches(rows(1), send, () => {});

    expect(send.mock.calls[0][0]).toEqual([
      { studentNumber: "S0724-1000", standardLevel: "Grade 1" },
    ]);
  });

  it("stops at the batch that fails, keeping the progress already made", async () => {
    // No rollback by design: the write is an upsert, so re-uploading the same
    // file rewrites the 250 that landed and completes the rest.
    const send = vi
      .fn()
      .mockImplementationOnce(async () => inserted(250))
      .mockRejectedValueOnce(new Error("network"));
    const progress: number[] = [];

    await expect(
      commitInBatches(rows(346), send, (written) => progress.push(written)),
    ).rejects.toThrow();

    expect(send).toHaveBeenCalledTimes(2);
    expect(progress).toEqual([250]);
  });

  it("does nothing when every row was rejected", async () => {
    const send = vi.fn();

    expect(await commitInBatches([], send, () => {})).toEqual({
      created: 0,
      updated: 0,
    });
    expect(send).not.toHaveBeenCalled();
  });
});

/**
 * Every mapped column, on one invented student. The real sample file is 30
 * real children and is gitignored along with its test, so the payload contract
 * — the one thing that must hold in CI — is pinned here on made-up data.
 */
const INVENTED_SHEET = {
  name: "Class-1",
  rows: [
    [
      "STUDENT ID",
      "STUDENT NAME",
      "GENDER",
      "DOB",
      "CITIZENSHIP",
      "RELIGION",
      "BIRTH REG  NUMBEER",
      "PASSPORT NUMBER",
      "CURRENT CLASS",
      "CAMPUS",
      "ADMITTED CLASS",
      "ACADEMIC YEAR",
      "SEMESTER",
      "CLASS STARTING DATE",
      "FATHER'S NAME",
      "MOTHER'S NAME",
      "MOB. MO",
      "MOB. FA",
      "PRESENT ADDRESS",
      "PERMANENT ADDRESS",
      "EMAIL",
      "STATUS",
    ],
    [
      "S0122-1000",
      "Test Student",
      "Female",
      "2015-04-01",
      "Bangladeshi",
      "Islam",
      "12345678901234567",
      "A00000000",
      "C-1",
      "1",
      "PG",
      "2021-2022",
      "First",
      "2022-01-10",
      "Test Father",
      "Test Mother",
      "01700000000",
      "01700000001",
      "Test present address",
      "Test permanent address",
      "test@example.com",
      "OPEN",
    ],
  ],
};

describe("toCommitRow — the payload contract", () => {
  it("emits only keys commitImportBatch accepts, with the right types", () => {
    // The cast inside `toCommitRow` is the only thing between the preview's
    // display strings and the mutation's validator, and Convex throws out the
    // *whole batch* over one unknown key. This is what fails when a mapped
    // column is added on one side of that boundary only.
    const fields: Record<string, { kind: string }> = importRowValidator.fields;
    const preview = buildImportPreview({
      sheets: [INVENTED_SHEET],
      reference: {
        levelNamesByCode: new Map([
          ["01", "Grade 1"],
          ["PG", "Play Group"],
        ]),
        campusNames: new Set(["Campus 01"]),
        academicYearNames: new Set(["2021-2022"]),
      },
      existingStudentNumbers: [],
    });

    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0].errors).toEqual([]);

    const payload = toCommitRow(preview.rows[0]);
    // Every mapped column made it, so the loop below is not vacuous.
    expect(Object.keys(payload).length).toBeGreaterThan(20);

    for (const [key, value] of Object.entries(payload)) {
      expect(
        fields[key],
        `${key} is not an argument of the mutation`,
      ).toBeDefined();
      expect(typeof value, key).toBe(
        fields[key].kind === "float64" ? "number" : "string",
      );
    }
  });
});
