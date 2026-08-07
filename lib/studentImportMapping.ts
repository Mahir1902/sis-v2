/**
 * Pure mapping + provenance layer for the Excel student import
 * (`docs/wayfinder/excel-import/IMPLEMENTATION-SPEC.md` §1 and §7.2).
 *
 * It sits immediately after the parser: in goes the raw per-tab cell grid
 * `read-excel-file` produced, plus the seeded reference data and the set of
 * student numbers already in the database; out comes the preview model the
 * import surface renders. No I/O, no React, no Convex — everything here is a
 * function of its arguments, so the whole column→field table is unit-testable
 * against the real sample file.
 *
 * Scope note: this module owns **mapping and provenance only**. Derivation
 * (Excel serial → epoch ms, the June-cutoff admission year, `admissionDate`)
 * and validation (row/tab rejections, warnings) are the next ticket's; the
 * `warnings` / `errors` arrays and the `"reject"` outcome exist in the
 * contract here but are never populated by this module.
 */

/* ────────────────────────────── the contract ────────────────────────────── */

/** A cell exactly as the parser produced it. Absent cells arrive as `null`. */
export type RawCell = string | number | boolean | Date | null;

/** One tab. `rows[0]` is the header row; every row is positional. */
export type RawSheet = { name: string; rows: RawCell[][] };

/** Where a field's value came from — rendered as a pill in the inspector. */
export type FieldSource = "sheet" | "derived" | "blank";

export type PreviewField = {
  /** `students` field name. */
  key: string;
  /** Sheet header as it appears in the file; `"—"` when there is no column. */
  header: string;
  value: string | null;
  source: FieldSource;
  /** Set only on updates, and only where the database value differs. */
  previous?: string | null;
};

/** Populated by the validation ticket; declared here so the shape is stable. */
export type Warning = { code: 1 | 2 | 3; text: string };

/** Populated by the validation ticket. */
export type Rejection = { column: string; value: string; reason: string };

export type PreviewRow = {
  sheet: string;
  excelRow: number;
  studentNumber: string;
  outcome: "insert" | "update" | "reject";
  fields: PreviewField[];
  warnings: Warning[];
  errors: Rejection[];
};

/** Per-tab outcome. `rejected` names the missing required header (§1.1). */
export type PreviewTab = { name: string; rows: number; rejected?: string };

export type ImportPreview = { tabs: PreviewTab[]; rows: PreviewRow[] };

/**
 * The seeded lookups the sheet joins against. Names, not ids: the preview
 * renders names, and resolving them to `v.id`s belongs to the commit payload.
 */
export type ImportReferenceData = {
  /** `standardLevels.code` → `standardLevels.name`, e.g. `"02"` → `Grade 2`. */
  levelNamesByCode: ReadonlyMap<string, string>;
  /** `campuses.name`, e.g. `Campus 01`. */
  campusNames: ReadonlySet<string>;
  /** `academicYears.name`, e.g. `2021-2022`. */
  academicYearNames: ReadonlySet<string>;
};

export type ImportPreviewInput = {
  sheets: readonly RawSheet[];
  reference: ImportReferenceData;
  /** Drives the new-vs-update split (`getExistingStudentNumbers`, §5.2). */
  existingStudentNumbers: Iterable<string>;
  /**
   * Current database values keyed by `studentNumber`, then by `students`
   * field. Optional: without it updates simply carry no `previous`.
   */
  existingFieldValues?: ReadonlyMap<
    string,
    Readonly<Record<string, string | null>>
  >;
};

/** The `header` placeholder for a field with no source column (§7.2). */
export const NO_SOURCE_HEADER = "—";

/* ─────────────────────────── header normalisation ───────────────────────── */

/**
 * Trim → collapse internal whitespace runs → uppercase (§1.1). Step two is
 * load-bearing: the file's birth-registration header is `BIRTH REG  NUMBEER`,
 * double-spaced *and* misspelled. Curly apostrophes are folded to straight
 * ones so `FATHER’S NAME` and `FATHER'S NAME` are the same header.
 */
export function normaliseHeader(raw: RawCell): string {
  if (raw === null || raw === undefined) return "";
  return String(raw)
    .replace(/[‘’ʼ]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/**
 * Normalised spellings that mean the same column. The file's own header is
 * always the canonical form, so the sample resolves through the identity
 * entry and the aliases only absorb drift in the ~10 sheets not yet seen
 * (§13). Extend this table rather than the mapping table when a tab renames a
 * column.
 */
const HEADER_ALIASES: Record<string, string> = {
  "BIRTH REG NUMBER": "BIRTH REG NUMBEER",
  "BIRTH REGISTRATION NUMBER": "BIRTH REG NUMBEER",
  "BIRTH CERTIFICATE NUMBER": "BIRTH REG NUMBEER",
  "STUDENT NO.": "STUDENT ID",
  "STUDENT NO": "STUDENT ID",
  "STUDENT NUMBER": "STUDENT ID",
  "ID NO.": "STUDENT ID",
  "NAME OF STUDENT": "STUDENT NAME",
  "DATE OF BIRTH": "DOB",
  "D.O.B": "DOB",
  "D.O.B.": "DOB",
  "FATHERS NAME": "FATHER'S NAME",
  "FATHER NAME": "FATHER'S NAME",
  "MOTHERS NAME": "MOTHER'S NAME",
  "MOTHER NAME": "MOTHER'S NAME",
  "MOB. FATHER": "MOB. FA",
  "MOB FA": "MOB. FA",
  "MOB. MOTHER": "MOB. MO",
  "MOB MO": "MOB. MO",
  "CLASS STARTING DATE.": "CLASS STARTING DATE",
  "PRESENT ADDRESS.": "PRESENT ADDRESS",
  "E-MAIL": "EMAIL",
  "EMAIL ADDRESS": "EMAIL",
};

/** Normalise, then alias. Blank/`null` headers (spacers) resolve to `""`. */
function canonicalHeader(raw: RawCell): string {
  const normalised = normaliseHeader(raw);
  return HEADER_ALIASES[normalised] ?? normalised;
}

/**
 * Column index and raw header text per canonical header, for one tab. Built
 * from row 1 only, so a blank spacer column (`Class-5` column X arrives as a
 * `null` header) is skipped rather than shifting everything after it.
 */
type HeaderIndex = ReadonlyMap<string, { column: number; header: string }>;

function indexHeaders(headerRow: readonly RawCell[]): HeaderIndex {
  const index = new Map<string, { column: number; header: string }>();
  headerRow.forEach((cell, column) => {
    const canonical = canonicalHeader(cell);
    // Blank spacer columns carry no header, and the first spelling wins so a
    // duplicated column cannot silently shadow the one already bound.
    if (canonical === "" || index.has(canonical)) return;
    index.set(canonical, { column, header: String(cell) });
  });
  return index;
}

/* ───────────────────────────── value handling ───────────────────────────── */

/**
 * A cell as text, trimmed and internal-whitespace-collapsed (§1.5 — that rule
 * applies to *every* value, verbatim ones included). Empty → `null`.
 *
 * Numbers are stringified, never re-parsed: `CAMPUS` and `SL NO.` arrive as
 * numbers while the 17-digit birth-registration number arrives as a string,
 * and it must stay one — a round trip through `Number` would silently drop its
 * last two digits.
 */
function cellText(cell: RawCell): string | null {
  if (cell === null || cell === undefined) return null;
  const text =
    cell instanceof Date
      ? cell.toISOString().slice(0, 10)
      : String(cell).replace(/\s+/g, " ").trim();
  return text === "" ? null : text;
}

/**
 * Uppercase the first letter of each whitespace-separated word and lowercase
 * the rest (§1.5). Applied to names, citizenship and religion only — never to
 * addresses, where it corrupts ordinals and colon-joined abbreviations.
 */
export function titleCase(text: string): string {
  return text
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/* ───────────────────────────────── mapping ──────────────────────────────── */

/** How one sheet column becomes one `students` field (§1.2). */
type ColumnMapping = {
  key: string;
  header: string;
  /** `null` means "present but not mappable"; the value imports unset. */
  transform: (text: string, reference: ImportReferenceData) => string | null;
  /** Provenance for a value this module produced rather than read verbatim. */
  derived?: boolean;
};

const verbatim = (text: string) => text;

/** `PG` / `NURSERY` / `KG-1` / `C-2` → a `standardLevels.code` (§1.3). */
export function levelCodeOf(sheetValue: string): string | null {
  const value = sheetValue.toUpperCase().replace(/\s+/g, "");
  const fixed: Record<string, string> = {
    PG: "PG",
    NURSERY: "NUR",
    "KG-1": "KG1",
    "KG-2": "KG2",
  };
  if (fixed[value]) return fixed[value];
  const grade = /^C-(\d{1,2})$/.exec(value);
  return grade ? String(Number(grade[1])).padStart(2, "0") : null;
}

/** `1` → `Campus 01` (§1.4). The join is on the name; `campuses` has no code. */
export function campusNameOf(sheetValue: string): string {
  return `Campus ${sheetValue.trim().padStart(2, "0")}`;
}

/** `2021-22` → `2021-2022`; an already-full name passes through (§1.2 #14). */
export function academicYearNameOf(sheetValue: string): string | null {
  const compact = /^(\d{4})\s*-\s*(\d{2})$/.exec(sheetValue.trim());
  if (compact) return `${compact[1]}-${compact[1].slice(0, 2)}${compact[2]}`;
  const full = /^(\d{4})\s*-\s*(\d{4})$/.exec(sheetValue.trim());
  return full ? `${full[1]}-${full[2]}` : null;
}

/**
 * The column → field table, in the order the inspector renders it. Headers are
 * the canonical (normalised) spellings; the raw text from the file is what
 * ends up on the `PreviewField`.
 *
 * Present-but-unrecognised values (`GENDER = "M"`, an unknown level or campus)
 * return `null` here and so import unset. Turning them into row rejections is
 * the validation ticket's job, which reads the same raw rows.
 */
const COLUMN_MAPPINGS: readonly ColumnMapping[] = [
  { key: "studentNumber", header: "STUDENT ID", transform: verbatim },
  { key: "studentFullName", header: "STUDENT NAME", transform: titleCase },
  {
    key: "gender",
    header: "GENDER",
    transform: (text) =>
      ({ MALE: "Male", FEMALE: "Female" })[text.toUpperCase()] ?? null,
  },
  // Serial → epoch ms is the derivation ticket's; the raw cell shows as-is.
  { key: "dateOfBirth", header: "DOB", transform: verbatim },
  { key: "citizenship", header: "CITIZENSHIP", transform: titleCase },
  { key: "religion", header: "RELIGION", transform: titleCase },
  {
    key: "birthCertificateNumber",
    header: "BIRTH REG NUMBEER",
    transform: verbatim,
  },
  {
    key: "passportNumber",
    header: "PASSPORT NUMBER",
    transform: (text) => text.toUpperCase(),
  },
  {
    key: "standardLevel",
    header: "CURRENT CLASS",
    derived: true,
    transform: (text, reference) => {
      const code = levelCodeOf(text);
      return (code && reference.levelNamesByCode.get(code)) ?? null;
    },
  },
  {
    key: "campus",
    header: "CAMPUS",
    derived: true,
    transform: (text, reference) => {
      const name = campusNameOf(text);
      return reference.campusNames.has(name) ? name : null;
    },
  },
  {
    key: "admittedLevel",
    header: "ADMITTED CLASS",
    derived: true,
    transform: (text, reference) => {
      const code = levelCodeOf(text);
      return (code && reference.levelNamesByCode.get(code)) ?? null;
    },
  },
  {
    key: "admissionAcademicYear",
    header: "ACADEMIC YEAR",
    transform: (text, reference) => {
      const name = academicYearNameOf(text);
      return name && reference.academicYearNames.has(name) ? name : null;
    },
  },
  { key: "admissionSemester", header: "SEMESTER", transform: verbatim },
  {
    key: "classStartDate",
    header: "CLASS STARTING DATE",
    transform: verbatim,
  },
  { key: "fatherName", header: "FATHER'S NAME", transform: titleCase },
  { key: "motherName", header: "MOTHER'S NAME", transform: titleCase },
  { key: "motherPhoneNumber", header: "MOB. MO", transform: verbatim },
  { key: "fatherPhoneNumber", header: "MOB. FA", transform: verbatim },
  { key: "presentAddress", header: "PRESENT ADDRESS", transform: verbatim },
  { key: "permanentAddress", header: "PERMANENT ADDRESS", transform: verbatim },
  {
    // One unattributed column against three schema fields; the father is the
    // attribution the only filled row supports (§1.6).
    key: "fatherEmail",
    header: "EMAIL",
    transform: (text) => text.toLowerCase(),
  },
  {
    key: "status",
    header: "STATUS",
    transform: (text) => (text.toUpperCase() === "OPEN" ? "active" : null),
  },
];

/**
 * `students` fields the import can never fill from this sheet (§1.8). They are
 * emitted, not hidden: a column of "not in sheet" rows is the honest picture
 * of what an imported record actually is.
 *
 * `admissionDate` sits here because its derivation (mirror `classStartDate`)
 * belongs to the next ticket; it has no source column either way.
 */
export const NO_SOURCE_FIELDS: readonly string[] = [
  "placeOfBirth",
  "bloodGroup",
  "passportValidTill",
  "admissionDate",
  "previousSchoolName",
  "previousSchoolAddress",
  "healthIssue",
  "studentPhotoUrl",
  "fatherPhotoUrl",
  "motherPhotoUrl",
  "fatherOccupation",
  "fatherNidNumber",
  "motherOccupation",
  "motherNidNumber",
  "motherEmail",
  "guardianName",
  "guardianRelation",
  "guardianNidNumber",
  "guardianPhoneNumber",
  "guardianEmail",
  "primaryBillingContact",
  "familyAnnualIncome",
  "consultantName",
  "siblingIds",
];

/** Headers whose absence rejects the whole tab (§1.1) — exactly two. */
export const REQUIRED_HEADERS: readonly string[] = [
  "STUDENT ID",
  "CURRENT CLASS",
];

/** Columns read by nothing, listed so nobody hunts for them later (§1.2). */
export const IGNORED_HEADERS: readonly string[] = [
  "CLASS",
  "SL NO.",
  "DROPOUT DATE",
  "OUTSTANDING AMOUNT",
  "REMARKS",
];

/* ──────────────────────────────── the build ─────────────────────────────── */

function buildFields(
  row: readonly RawCell[],
  headers: HeaderIndex,
  reference: ImportReferenceData,
  previous: Readonly<Record<string, string | null>> | undefined,
): PreviewField[] {
  const fields: PreviewField[] = [];

  for (const mapping of COLUMN_MAPPINGS) {
    const column = headers.get(mapping.header);
    if (column === undefined) {
      // The column is absent from this tab: same picture as a no-source field.
      fields.push({
        key: mapping.key,
        header: NO_SOURCE_HEADER,
        value: null,
        source: "blank",
      });
      continue;
    }
    const text = cellText(row[column.column] ?? null);
    const value = text === null ? null : mapping.transform(text, reference);
    fields.push({
      key: mapping.key,
      header: column.header,
      value,
      source: value === null ? "blank" : mapping.derived ? "derived" : "sheet",
    });
  }

  for (const key of NO_SOURCE_FIELDS) {
    fields.push({
      key,
      header: NO_SOURCE_HEADER,
      value: null,
      source: "blank",
    });
  }

  if (previous) attachPrevious(fields, previous);
  return fields;
}

/**
 * Hang the database's current value off each field the sheet disagrees with,
 * so the inspector can render `old → new` (§7.3). Fields that match are left
 * without a `previous` — an untouched field must not read as a change.
 */
function attachPrevious(
  fields: PreviewField[],
  previous: Readonly<Record<string, string | null>>,
): void {
  for (const field of fields) {
    if (!(field.key in previous)) continue;
    const before = previous[field.key] ?? null;
    if (before !== field.value) field.previous = before;
  }
}

/** True for a row with nothing in it — trailing sheet padding, not a student. */
const isEmptyRow = (row: readonly RawCell[]) =>
  row.every((cell) => cellText(cell) === null);

/**
 * Turn the parser's raw tabs into the preview model: one `PreviewRow` per data
 * row, every `students` field present on every row, each carrying the header
 * it came from and how it got there.
 */
export function buildImportPreview(input: ImportPreviewInput): ImportPreview {
  const existing = new Set(input.existingStudentNumbers);
  const tabs: PreviewTab[] = [];
  const rows: PreviewRow[] = [];

  for (const sheet of input.sheets) {
    const headers = indexHeaders(sheet.rows[0] ?? []);
    const missing = REQUIRED_HEADERS.find((header) => !headers.has(header));
    if (missing) {
      tabs.push({
        name: sheet.name,
        rows: 0,
        rejected: `missing column ${missing}`,
      });
      continue;
    }

    const studentIdColumn = headers.get("STUDENT ID")?.column ?? 0;
    let count = 0;

    for (let i = 1; i < sheet.rows.length; i++) {
      const row = sheet.rows[i];
      if (isEmptyRow(row)) continue;

      const studentNumber = cellText(row[studentIdColumn] ?? null) ?? "";
      const isUpdate = existing.has(studentNumber);
      rows.push({
        sheet: sheet.name,
        // Row 1 is the header, so the sheet's own row numbering starts at 2.
        excelRow: i + 1,
        studentNumber,
        outcome: isUpdate ? "update" : "insert",
        fields: buildFields(
          row,
          headers,
          input.reference,
          isUpdate ? input.existingFieldValues?.get(studentNumber) : undefined,
        ),
        warnings: [],
        errors: [],
      });
      count++;
    }

    tabs.push({ name: sheet.name, rows: count });
  }

  return { tabs, rows };
}
