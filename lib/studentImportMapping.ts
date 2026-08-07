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
 * The governing rule throughout (§3.1): **absent → import it unset; present
 * but unrecognisable → reject the row.** No placeholders, ever. A blank field
 * reads as a visible gap someone fills; `"Unknown"` reads as fact forever.
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

/**
 * The closed list of three (§3.5). A warning never blocks and never changes
 * what is written; a tier that fires on every row is noise everyone learns to
 * click past, which is why the list is closed rather than growable.
 *
 * 1 — the tab name disagrees with the row's stated `CURRENT CLASS`
 * 2 — the row imports with several key fields blank
 * 3 — a phone number is not 11 digits
 */
export type Warning = { code: 1 | 2 | 3; text: string };

/**
 * One reason a row cannot be imported. The sheet name, Excel row and student
 * number that complete the §3.4 record live on the `PreviewRow` around it.
 */
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

export type ImportPreview = {
  tabs: PreviewTab[];
  rows: PreviewRow[];
  /**
   * Set by the two whole-file aborts (§3.2): an in-file duplicate student
   * number, and a file where no tab survives header validation. The file
   * itself is untrustworthy rather than some of its rows, so **nothing** may
   * be written when this is set — `rows` is still returned so the surface can
   * show what it read.
   */
  fileError?: string;
};

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

/* ──────────────────────────────── derivations ───────────────────────────── */

/** Excel's 1900-system day zero. Serial 45483 → 2024-07-10. */
const EXCEL_DAY_ZERO_UTC = Date.UTC(1899, 11, 30);

const DAY_MS = 86_400_000;

/** `Date` → the `YYYY-MM-DD` the parser meant, read in UTC. */
export function formatUtcDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * A date cell's text → epoch ms **at UTC midnight** (§5.5). Bangladesh is
 * UTC+6, so a date built at *local* midnight serialises to the previous
 * calendar day; every date in the import therefore goes through here once and
 * lands on a whole multiple of a day.
 *
 * Two shapes are accepted, and only two: the `YYYY-MM-DD` that `cellText`
 * produces from a parsed `Date`, and a bare Excel day serial. Anything else —
 * `10/07/2024`, `N/A`, `2024-02-31` — returns `null` and rejects the row,
 * because guessing between DD/MM and MM/DD writes a wrong date that is
 * indistinguishable from a right one.
 */
export function toUtcMidnightMs(text: string): number | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) {
    const ms = Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    // Rejects 2024-02-31 and friends: JS would roll them into March.
    return formatUtcDate(ms) === text ? ms : null;
  }
  if (!/^\d{1,6}$/.test(text)) return null;
  const serial = Number(text);
  return serial > 0 ? EXCEL_DAY_ZERO_UTC + serial * DAY_MS : null;
}

/** Earliest plausible `DOB` (§3.1). Anything older is a typo, not a student. */
const EARLIEST_DOB_MS = Date.UTC(1990, 0, 1);

/** The `S{MM}{YY}-{seq}` parts (R1). `MM` is a month and is never `00`. */
export type StudentNumberParts = {
  month: number;
  year: number;
  sequence: string;
};

/**
 * `S0724-1304` → month 7, year 2024, sequence `1304` (R1). Blank, malformed
 * and out-of-range-month values all return `null`, which rejects the row —
 * `studentNumber` is the upsert identity, so a typo'd key would import under a
 * bad permanent identity and the corrected re-upload would create a *second*
 * record instead of fixing the first.
 */
export function parseStudentNumber(value: string): StudentNumberParts | null {
  const parts = /^S(\d{2})(\d{2})-(\d+)$/.exec(value.trim());
  if (!parts) return null;
  const month = Number(parts[1]);
  if (month < 1 || month > 12) return null;
  return { month, year: 2000 + Number(parts[2]), sequence: parts[3] };
}

/**
 * The June-cutoff admission year (R2): a number issued in June or later
 * belongs to the year that starts then, anything earlier to the one already
 * running.
 *
 * This only ever fills a **blank** `ACADEMIC YEAR` cell. A filled cell always
 * wins, silently and with no warning — the school typed that value, whereas
 * the cutoff is our reverse-engineering of their convention (R6).
 */
export function derivedAcademicYearName(
  parts: Pick<StudentNumberParts, "month" | "year">,
): string {
  const start = parts.month >= 6 ? parts.year : parts.year - 1;
  return `${start}-${start + 1}`;
}

/**
 * `Class-3` → the level code its name claims, for warning 1. Tab names that
 * parse to nothing raise no warning: a name we cannot read cannot disagree.
 */
function tabLevelCode(tabName: string): string | null {
  const value = tabName.toUpperCase().replace(/\s+/g, "");
  const numbered = /^CLASS-?(\d{1,2})$/.exec(value);
  return levelCodeOf(numbered ? `C-${numbered[1]}` : value);
}

/* ───────────────────────────────── mapping ──────────────────────────────── */

/** How one sheet column becomes one `students` field (§1.2). */
type ColumnMapping = {
  key: string;
  header: string;
  /** `null` means "present but not mappable". */
  transform: (text: string, reference: ImportReferenceData) => string | null;
  /** Provenance for a value this module produced rather than read verbatim. */
  derived?: boolean;
  /**
   * Reason to reject the row when the cell is filled but `transform` returned
   * `null` (§3.2). Absent here means a value we cannot read imports unset —
   * which is only ever right for columns that carry no decision.
   */
  unrecognised?: string;
  /**
   * Reason to reject the row when the cell is *blank*. `CURRENT CLASS` only —
   * `STUDENT ID`'s blank case is caught alongside its format parse in
   * `buildImportPreview`, which needs the parse for R2 regardless.
   */
  required?: string;
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

/** A sheet class value → the seeded level name, or `null` if it is neither. */
function levelNameOf(
  sheetValue: string,
  reference: ImportReferenceData,
): string | null {
  const code = levelCodeOf(sheetValue);
  return (code && reference.levelNamesByCode.get(code)) ?? null;
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
 * A `transform` returning `null` on a filled cell rejects the row wherever
 * `unrecognised` is set — every column whose value carries a decision. The
 * columns without it (names, addresses, phone numbers) have no unreadable
 * state: whatever the school typed is the value.
 */
const COLUMN_MAPPINGS: readonly ColumnMapping[] = [
  // Format-validated in `buildRow`, where the same parse also feeds R2.
  { key: "studentNumber", header: "STUDENT ID", transform: verbatim },
  { key: "studentFullName", header: "STUDENT NAME", transform: titleCase },
  {
    key: "gender",
    header: "GENDER",
    transform: (text) =>
      ({ MALE: "Male", FEMALE: "Female" })[text.toUpperCase()] ?? null,
    unrecognised: "unrecognised gender",
  },
  {
    key: "dateOfBirth",
    header: "DOB",
    transform: (text) => {
      const ms = toUtcMidnightMs(text);
      if (ms === null || ms < EARLIEST_DOB_MS || ms > Date.now()) return null;
      return formatUtcDate(ms);
    },
    unrecognised: "unreadable or implausible date of birth",
  },
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
    transform: levelNameOf,
    // It is the enrollment level; there is no meaningful unset.
    required: "missing class",
    unrecognised: "unrecognised class",
  },
  {
    key: "campus",
    header: "CAMPUS",
    derived: true,
    transform: (text, reference) => {
      const name = campusNameOf(text);
      return reference.campusNames.has(name) ? name : null;
    },
    unrecognised: "no matching campus",
  },
  {
    key: "admittedLevel",
    header: "ADMITTED CLASS",
    derived: true,
    transform: levelNameOf,
    unrecognised: "unrecognised class",
  },
  {
    key: "admissionAcademicYear",
    header: "ACADEMIC YEAR",
    transform: (text, reference) => {
      const name = academicYearNameOf(text);
      return name && reference.academicYearNames.has(name) ? name : null;
    },
    // The import never creates reference data, so a year with no document is a
    // hard, operator-visible rejection rather than a silently minted year.
    unrecognised: "no such academic year — run the reference-data backfill",
  },
  { key: "admissionSemester", header: "SEMESTER", transform: verbatim },
  {
    // Sheet value only, never derived (R4): the sample's three real dates are
    // the 27th, 10th and 31st, so "the 1st of the admission month" would have
    // been wrong by 26, 9 and 30 days. Empty reads as unknown; a made-up date
    // reads as fact.
    key: "classStartDate",
    header: "CLASS STARTING DATE",
    transform: (text) => {
      const ms = toUtcMidnightMs(text);
      return ms === null ? null : formatUtcDate(ms);
    },
    unrecognised: "unreadable date",
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
    // The school's vocabulary beyond OPEN is unknown, and withdrawn-vs-expelled
    // is a guess. A rejected row costs one round trip and yields the real word.
    unrecognised: "unrecognised status",
  },
];

const MAPPING_BY_KEY = new Map(COLUMN_MAPPINGS.map((m) => [m.key, m]));

/**
 * The fields warning 2 counts (§3.5). Deliberately not every field: `EMAIL`,
 * `PASSPORT NUMBER` and `CLASS STARTING DATE` are blank on almost every row of
 * the sample, so counting them would fire the warning on all 30 — which is the
 * noise the closed list exists to avoid.
 */
const KEY_FIELDS: readonly string[] = [
  "studentFullName",
  "gender",
  "dateOfBirth",
  "birthCertificateNumber",
  "presentAddress",
  "fatherPhoneNumber",
  "motherPhoneNumber",
];

/** How many blank key fields make a record thin enough to flag. */
const BLANK_KEY_FIELD_THRESHOLD = 3;

/** The two fields warning 3 measures. */
const PHONE_FIELDS: readonly string[] = [
  "fatherPhoneNumber",
  "motherPhoneNumber",
];

/**
 * `students` fields the import can never fill from this sheet (§1.8). They are
 * emitted, not hidden: a column of "not in sheet" rows is the honest picture
 * of what an imported record actually is.
 *
 * `admissionDate` is *not* here: it has no source column, but it does have a
 * value — it mirrors `classStartDate` (R5).
 */
export const NO_SOURCE_FIELDS: readonly string[] = [
  "placeOfBirth",
  "bloodGroup",
  "passportValidTill",
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
  errors: Rejection[],
): { fields: PreviewField[]; texts: Map<string, string | null> } {
  const fields: PreviewField[] = [];
  /** The raw cell text per field, so the derivation pass can tell a blank
   * cell (derive into it) from an unreadable one (already rejected). */
  const texts = new Map<string, string | null>();

  for (const mapping of COLUMN_MAPPINGS) {
    const column = headers.get(mapping.header);
    if (column === undefined) {
      // The column is absent from this tab: every cell in it is absent, which
      // under §3.1 imports unset — the same picture as a no-source field.
      fields.push({
        key: mapping.key,
        header: NO_SOURCE_HEADER,
        value: null,
        source: "blank",
      });
      texts.set(mapping.key, null);
      continue;
    }
    const text = cellText(row[column.column] ?? null);
    const value = text === null ? null : mapping.transform(text, reference);
    texts.set(mapping.key, text);

    if (text === null && mapping.required) {
      errors.push({
        column: column.header,
        value: "",
        reason: mapping.required,
      });
    } else if (text !== null && value === null && mapping.unrecognised) {
      errors.push({
        column: column.header,
        value: text,
        reason: mapping.unrecognised,
      });
    }

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

  return { fields, texts };
}

/** The `PreviewField` for `key`; every field is present on every row. */
function fieldOf(fields: PreviewField[], key: string): PreviewField {
  const field = fields.find((f) => f.key === key);
  if (!field) throw new Error(`unmapped field ${key}`);
  return field;
}

/**
 * The header to name in a message about `key` — the file's own spelling where
 * the tab has the column (§3.4), the canonical one where it does not.
 */
function namedHeader(fields: PreviewField[], key: string): string {
  const header = fieldOf(fields, key).header;
  return header === NO_SOURCE_HEADER
    ? (MAPPING_BY_KEY.get(key)?.header ?? key)
    : header;
}

/**
 * The two values the sheet has no column for but the importer can still fill:
 * the June-cutoff academic year (R2), and `admissionDate` mirroring
 * `classStartDate` (R5). Both carry the `derived` marker, and both fill a
 * **blank** only — a filled cell always wins, silently (R6).
 */
function applyDerivations(
  fields: PreviewField[],
  texts: ReadonlyMap<string, string | null>,
  studentNumber: StudentNumberParts | null,
  reference: ImportReferenceData,
  errors: Rejection[],
): void {
  const year = fieldOf(fields, "admissionAcademicYear");
  if (
    year.value === null &&
    texts.get("admissionAcademicYear") === null &&
    studentNumber
  ) {
    const name = derivedAcademicYearName(studentNumber);
    if (reference.academicYearNames.has(name)) {
      year.value = name;
      year.source = "derived";
    } else {
      errors.push({
        column: namedHeader(fields, "admissionAcademicYear"),
        value: "",
        reason: `no academic year ${name} — run the reference-data backfill`,
      });
    }
  }

  // R5: the same real date where the sheet has one, empty otherwise. Never
  // `Date.now()` — an imported record must not claim it was admitted today.
  const classStart = fieldOf(fields, "classStartDate");
  fields.splice(fields.indexOf(classStart) + 1, 0, {
    key: "admissionDate",
    header: classStart.header,
    value: classStart.value,
    source: classStart.value === null ? "blank" : "derived",
  });
}

/** The three warnings of §3.5, in code order. Never blocks the import. */
function collectWarnings(
  fields: PreviewField[],
  texts: ReadonlyMap<string, string | null>,
  sheetName: string,
): Warning[] {
  const warnings: Warning[] = [];

  // 1 — the tab says one class, the row says another. The column still wins
  // (D3); this is the only place a stale CURRENT CLASS becomes visible before
  // report-card time. Fires on 10 of the sample's 30 rows.
  const statedClass = texts.get("standardLevel");
  const tabCode = tabLevelCode(sheetName);
  const rowCode =
    statedClass === null || statedClass === undefined
      ? null
      : levelCodeOf(statedClass);
  if (tabCode !== null && rowCode !== null && tabCode !== rowCode) {
    warnings.push({
      code: 1,
      text: `tab ${sheetName} disagrees with CURRENT CLASS "${statedClass}" — importing as ${fieldOf(fields, "standardLevel").value}`,
    });
  }

  // 2 — blanks now sail through (§3.1), so this is what turns a silently thin
  // record into a to-do list. A key field whose *column* is missing from the
  // tab does not count: every row on that tab would carry an identical
  // warning, which §3.5 rules out by name as not being information.
  const blank = KEY_FIELDS.filter((key) => {
    const field = fieldOf(fields, key);
    return field.value === null && field.header !== NO_SOURCE_HEADER;
  });
  if (blank.length >= BLANK_KEY_FIELD_THRESHOLD) {
    const headers = blank.map((key) => fieldOf(fields, key).header);
    warnings.push({
      code: 2,
      text: `${blank.length} fields blank: ${headers.join(", ")}`,
    });
  }

  // 3 — a contact-field typo must not cost the school a student.
  for (const key of PHONE_FIELDS) {
    const field = fieldOf(fields, key);
    if (field.value === null) continue;
    const digits = field.value.replace(/\D/g, "").length;
    if (digits !== 11) {
      warnings.push({
        code: 3,
        text: `${field.header} "${field.value}" is not 11 digits`,
      });
    }
  }

  return warnings;
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

    const studentId = headers.get("STUDENT ID");
    let count = 0;

    for (let i = 1; i < sheet.rows.length; i++) {
      const row = sheet.rows[i];
      if (isEmptyRow(row)) continue;

      const errors: Rejection[] = [];
      const { fields, texts } = buildFields(
        row,
        headers,
        input.reference,
        errors,
      );

      // R1. The same parse both validates the upsert identity and feeds R2,
      // so it happens once, here, rather than inside the mapping table.
      const studentNumber = texts.get("studentNumber") ?? "";
      const parsed = parseStudentNumber(studentNumber);
      if (parsed === null) {
        errors.push({
          column: studentId?.header ?? "STUDENT ID",
          value: studentNumber,
          reason: studentNumber
            ? "student number does not match S{MM}{YY}-{seq}"
            : "missing student number",
        });
      }

      applyDerivations(fields, texts, parsed, input.reference, errors);

      const isUpdate = existing.has(studentNumber);
      const previous = isUpdate
        ? input.existingFieldValues?.get(studentNumber)
        : undefined;
      if (previous) attachPrevious(fields, previous);

      rows.push({
        sheet: sheet.name,
        // Row 1 is the header, so the sheet's own row numbering starts at 2.
        excelRow: i + 1,
        studentNumber,
        outcome: errors.length > 0 ? "reject" : isUpdate ? "update" : "insert",
        fields,
        warnings: collectWarnings(fields, texts, sheet.name),
        errors,
      });
      count++;
    }

    tabs.push({ name: sheet.name, rows: count });
  }

  return { tabs, rows, fileError: fileErrorOf(tabs, rows) };
}

/**
 * The two conditions that make the *file* untrustworthy rather than some of
 * its rows (§3.2), so nothing at all may be written.
 */
function fileErrorOf(
  tabs: readonly PreviewTab[],
  rows: readonly PreviewRow[],
): string | undefined {
  if (tabs.length > 0 && tabs.every((tab) => tab.rejected !== undefined)) {
    return "no tab in this file has both a STUDENT ID and a CURRENT CLASS column";
  }

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const row of rows) {
    // Only a *valid* number can be claimed by two students; a repeated
    // malformed one has already rejected both rows on its own, and aborting
    // the file over it would hold 400 students hostage to one typo.
    if (parseStudentNumber(row.studentNumber) === null) continue;
    if (seen.has(row.studentNumber)) duplicates.add(row.studentNumber);
    seen.add(row.studentNumber);
  }
  if (duplicates.size > 0) {
    // Which of the two rows is the student is not ours to pick.
    return `duplicate student ${duplicates.size === 1 ? "number" : "numbers"} in this file: ${[...duplicates].join(", ")}`;
  }

  return undefined;
}
