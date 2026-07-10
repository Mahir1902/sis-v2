# Domain Glossary — SIS v2 (Fee Billing & Collection)

This context covers how the school bills parents and tracks fee payments. Student records are governed elsewhere; the grading and report-card language lives in the **Grading & Academic Records** glossary at the bottom of this file.

## Language

**Money Receipt** (or just **Receipt**):
A first-class billing document issued at the moment a payment is recorded. Has its own number (`RCP-YYYY-NNNNN`, calendar-year reset, global across campuses) and lifecycle (`issued` → `voided`). Persisted in the `receipts` table. **Every field rendered on the document is snapshotted at issue time** — line items, payer name, payer role (father/mother/guardian), student name + number, issuer name, payment method, payment date, total. Reprinting an old Receipt does not pick up later edits to the student record, the Billing Contact assignment, or admin user names. **Cosmetic fields are editable in place** (payer name, payer role, remarks) — these corrections are audit-logged but do not change the Receipt number, do not void the Receipt, and do not produce a new document. **Financial fields are not editable** (amount, payment method, payment date, which fees are covered, the student) — correcting any of these requires void + re-issue, producing a new Receipt number cross-linked to the voided one. One Receipt wraps exactly one **Fee Collection Session** (1:1). A single Receipt may cover multiple fees paid together — e.g. tuition + transport + books in one cash handover produces one Receipt with three lines. The Receipt is the canonical parent-facing document; there is no separate "bill" or "invoice" produced upstream.
_Avoid_: "Invoice", "Bill", "Statement", "Demand Note" — these collide with v1 SIS legacy or imply a pre-payment document the school does not produce.

**Receipt Lifecycle**:
- `issued` — created automatically when a payment is recorded. Snapshotted at issue time; cosmetic fields (payer name, payer role, remarks) are editable in place via audit-logged corrections, but financial fields are not. The default state.
- `voided` — admin reversed the entire Receipt. Every fee on it flips back to `unpaid`, the underlying Fee Collection Session is also voided, and the document re-renders with a "VOIDED" stamp. Voiding is whole-receipt-only; partial reversal requires voiding then issuing a fresh Receipt for the correct lines.

**Re-issue**:
The act of correcting a financial field on a Receipt (amount, payment method, payment date, line items, student). The original Receipt is voided; a fresh Receipt is created via the normal payment flow; the two are cross-linked. Each PDF carries a visible reference to its counterpart — the voided one shows *"VOIDED — superseded by RCP-YYYY-NNNNN"*, the new one shows *"Re-issued in place of RCP-YYYY-NNNNN"* — so whichever copy a parent shows up with, the admin can trace the active version. Re-issue is a single atomic operation, not two separate steps.

**Fee Collection Session**:
A `feeCollectionSessions` row created whenever `collectFees` records a payment. The transaction-log primitive — surfaced in the admin Transaction Log for cash-flow and audit. Each session has one or more `feeTransactions` rows (one per fee paid in the session). Every Session has exactly one Receipt (1:1). The Session carries the raw transactional facts; the Receipt is the parent-facing snapshot.

**Student Fee**:
A `studentFees` row representing one fee owed by one student in one academic year. Status: `unpaid` or `paid`. A Student Fee is **directly billable** — there is no upstream document (no invoice). When paid, the Student Fee references the Fee Collection Session via `feeTransactions`. Payment is all-or-nothing: a fee is either fully unpaid or fully paid; there is no partial state.

**Overdue Fee**:
A Student Fee where `status = "unpaid"` AND `dueDate < now()`. **Computed at query time** — there is no `overdue` value in the `studentFees.status` union, no cron flips state, no stored flag. The overdue list re-evaluates on every read so editing a `dueDate` or assigning new fees is immediately reflected without a batch job.

**WhatsApp Reminder** (UI action, not a domain event):
A pure UI affordance that opens a `wa.me/<billing-contact-phone>?text=<prefilled body>` deep link. Used to nudge parents about overdue fees and to deliver Receipts. Always targets the **current** Billing Contact's phone — never a snapshot. The historical document (the Receipt PDF) is the snapshot; the *act of sending right now* follows whatever the family told the school is the current fee-comms relationship. **Writes nothing to the server.** The SIS cannot prove the admin actually sent the WhatsApp message — there is no `lastRemindedAt` field, no reminder log. Same honesty principle as Compose Email: claiming "reminder sent" because a tab was opened would be a false positive.

**Compose Email** (UI action, not a domain event):
A pure UI affordance that opens a pre-filled Gmail compose tab targeting the **current** Billing Contact's email — never a snapshot of who the Billing Contact was at issue time. Used to send a Receipt PDF (after the admin downloads it and drags it into the composer) or any other ad-hoc note. **Writes nothing to the server.** Compose Email exists because the SIS cannot prove what happens inside the admin's email client; treating "opened the composer" as "delivered the document" would produce false positives.

**Fee Notice**:
A PDF generated on demand from a student's Fees tab. Lists all outstanding fees with due dates ("10th of billing month" for monthly fees, "Upon Enrollment" for one-time or yearly fees). Not stored, has no number, has no lifecycle. Used for informal communication; not a billing document.

**Billing Contact**:
The single adult — chosen from the student's father, mother, or guardian — designated as the party financially responsible for the student's fees. Every Student has exactly one Billing Contact. Stored on the student record as `primaryBillingContact: "father" | "mother" | "guardian"`. This is the **role**, separate from the person's identity: knowing the mother's contact details (e.g. `motherEmail`, `motherPhoneNumber`) is distinct from designating her as the Billing Contact. Both the Compose Email launcher (uses the Billing Contact's email) and the WhatsApp Reminder launcher (uses the Billing Contact's phone) target this person; the rest of the parents remain queryable for ad-hoc communication but the billing flows use the Billing Contact and only the Billing Contact.
_Avoid_: "Payer", "Bill recipient", "Primary parent" — these have collided in past conversations.

## Relationships

- A **Receipt** has exactly one **Student**, exactly one **Fee Collection Session**, and one or more **Student Fees** represented as snapshotted line items.
- A **Student Fee** is independent of any parent-facing document until paid. There is no "fee belongs to invoice" relationship — fees stand alone.
- A paid **Student Fee** has zero or more **feeTransactions** (typically one per payment session) linking it back through the Session to the Receipt.
- Voiding a **Receipt** voids the underlying **Fee Collection Session** and flips every covered Student Fee back to `unpaid`. Re-billing requires a fresh `collectFees` call, which produces a new Session + new Receipt.
- A Receipt with `status = voided` cannot be unvoided. To restore a record, issue a new Receipt by re-collecting payment.
- An **Overdue Fee** is a computed view over `studentFees` — it is not stored, not a status, not a separate table.
- A **Fee Notice** is independent of all the above and produces no DB writes.

## Example dialogue

> **Dev:** "When admin assigns a tuition fee to a student, what billing document is created?"
> **Domain expert:** "None. The Student Fee row is the billable unit. The school doesn't issue any document until the parent actually pays."
>
> **Dev:** "So what does the parent get when they pay?"
> **Domain expert:** "A Money Receipt — generated automatically inside the collectFees mutation. Lists every fee paid in that session. The admin downloads the PDF and either drags it into an email (Gmail compose launcher) or hands it over physically."
>
> **Dev:** "How do we chase overdue fees?"
> **Domain expert:** "Admin opens the overdue list (computed live from unpaid + past-due fees), clicks Remind on a student row, WhatsApp Web opens with a prefilled message to the Billing Contact's phone. Admin sends manually. The SIS doesn't record that the message went out — it can't verify."
>
> **Dev:** "Then what is `feeCollectionSessions` for?"
> **Domain expert:** "It's the transaction-log primitive. Every payment creates one. The Receipt wraps it 1:1 — Session is for audit and cash-flow reports, Receipt is for the parent."

## Flagged ambiguities

- **"Invoice" (v1 SIS legacy AND pre-2026-06-15 v2 model).** Resolved: the SIS no longer has an Invoice entity. The school does not issue pre-payment billing documents — communication about fees owed happens verbally, by text, or via the informal Fee Notice. The Money Receipt is the only parent-facing billing document and is issued post-payment only. References to "Invoice" in old comments, ADRs, or code are pointers to a deprecated model that ended on 2026-06-15.
- **"Bill", "Statement", "Demand Note"** — informal aliases that have appeared in user conversation. All resolved: the school does not produce these.
- **"Receipt" used to mean "a paid Invoice that re-renders with paid status" (v2 model, 2026-06-08 → 2026-06-15).** Resolved: Receipt is now a first-class entity with its own number sequence, its own table, and its own `issued → voided` lifecycle. The "paid Invoice = informal receipt" framing is gone with invoicing.
- **`partial` status on Student Fees** — removed 2026-06-09. Schema is `("unpaid", "paid")` only. Old code that branched on `partial` should be deleted, not coalesced.
- **Delivery Status / Delivery Channel / Mark as Issued (Invoice-era concepts).** Removed with invoicing. Delivery is no longer attested on any document. Compose Email and WhatsApp Reminder are pure launchers that write nothing; the SIS does not claim to know whether a parent received anything.

---

# Grading & Academic Records

This glossary covers how the school measures and reports academic performance. It is a separate domain from Fee Billing above. Grade-computation decisions are recorded in [ADR-0004](docs/adr/0004-grade-computation-model.md).

## Language

**Continuous Assessment (CA-1, CA-2, CA-3)**:
One of the (up to) three graded assessments a subject runs in a semester. A subject's term grade is built from its CAs and nothing else. CAs are numbered 1/2/3; the number is positional, not a weight.

**Assessment**:
The `assessments` row for one CA of one subject, at one standard level, in one academic year and semester. Uniquely identified by that combination — there is at most one CA-1 Math for Grade 4 in Sem 1 of a given year. Carries a display-only `totalMarks` target; the real total a student is graded against is the sum of its Questions (see _Present CA_).

**Question**:
An `assessmentQuestions` row — one item on a CA paper, worth `marksAllocated`. Marks are entered and stored **per question per student**, never as a single CA total. This granularity is deliberate: it powers per-question diagnostics ("which questions did the class miss?") and is the intended basis for future concept-level analytics (`conceptTag`, `learningObjective` — captured but not yet surfaced).
_Avoid_: treating a CA score as a single atomic number — it is always the sum of its question marks.

**Present CA** (for a given student):
A CA whose assessment exists **and** for which the student has at least one entered mark. Only present CAs contribute to the weighted average, and the average is renormalized to their combined weight. A CA with no questions, or for which the student has no answer rows, is **not present** and is excluded — not scored 0.
_Avoid_: "missing CA" as a synonym for 0 — a not-yet-conducted or not-yet-marked CA is absent from the calculation, not a zero in it.

**Absent** vs **Unmarked** (the distinction that matters most here):
- **Absent** — the student was recorded absent for a CA (`isAbsent: true`, marks forced to 0). Counts as a **present 0**: it pulls the average down, because you cannot drop a CA by missing the test.
- **Unmarked** — the student has no answer rows for a CA yet (not graded). **Excluded** from the average entirely.
These look identical on screen (both "no positive marks") but mean opposite things to the calculation.

**Weighted Average / Computed Grade**:
A `computedGrades` row: the renormalized weighted average of a student's present CAs for one subject/semester, plus the server-computed letter grade. CAs are weighted **equally** (the only weighting the school uses). The per-subject percentage and letter grade are authoritative and computed server-side; **averages across subjects** (the tab banner, the per-enrollment overall, the sidebar) are display aggregations computed client-side from those authoritative per-subject numbers. A Computed Grade exists **only when the subject has at least one present CA** — a subject with zero present CAs has no row at all. "Not yet graded" is therefore represented by the *absence* of a Computed Grade, never by a stored 0 or "F". A roster of which subjects are still un-entered is a separate view over `assessments` vs `computedGrades`, not a property of the grade row.
_Avoid_: "GPA" — the school works in percentages and letter grades, not grade points. Also avoid reading a missing Computed Grade as failure — missing means unmeasured.

**Class** (the comparison group; also loosely "cohort"):
All **active enrollments sharing one standard level + academic year**. This is the unit assessments are defined for, marks are entered for, and grades are compared within. `section` is a cosmetic sub-label and does **not** subdivide a Class for grading or analytics — the whole level+year is one Class.
_Avoid_: "class" meaning a section, a room, or one teacher's group. For grading, Class = level + year.

**Class Average**:
For one subject + semester, the mean of the **renormalized weighted averages** of every student in the Class who has a Computed Grade for it. It is the **difficulty-adjusted baseline** a student is measured against — comparing a student to the classmates who sat the same papers cancels difficulty out, which raw cross-level scores cannot. Shown only when **at least 5 students** in the Class have a grade for that subject+semester; below that the sample is too small to be a meaningful average and the comparison is suppressed ("not enough class data yet"). The per-CA baseline used in the within-term view is the mean of *present* students' percentages for that specific CA.
_Avoid_: presenting a 1–4 student "average" as a class baseline — it identifies a specific peer rather than a cohort.

**Class Position**:
A student's **rank within the Class**, by descending renormalized weighted average (1st = highest). Two scopes: **per-subject** (rank within one subject+semester, shown as detail in each subject row) and **overall** (rank by the across-subjects term average — the traditional report-card "stood 4th in class," the headline figure). Ties share a position (standard competition ranking: two tied for 5th are both 5th, the next is 7th). A position is shown **only when the grade is final** (not Provisional) **and at least 5 classmates** also have a final grade in scope to rank against — so it does not thrash as marks are keyed in mid-term.
_Avoid_: ranking on provisional/partial grades, or presenting a position computed against fewer than 5 ranked peers.

**Provisional Grade**:
A Computed Grade that rests on **fewer present CAs than the subject runs this term** (present count < expected count, where expected = the number of CAs/assessments defined for that subject/level/semester). It is shown with an "early" indicator (e.g. *"based on 1 of 3 CAs"*) so an early-term grade is not mistaken for a final one. The letter grade itself is still the authoritative renormalized value — "provisional" labels *confidence/completeness*, not a different number. A grade resting on all the term's CAs is **final** (not provisional). `expectedCaCount` is stored on the grade row; present count is derived from which `caXPercentage` fields are set.
_Avoid_: treating provisional as a separate or lower grade — it is the same renormalized grade, just flagged as resting on partial data.

**Report Card**:
A `reportCards` row: a PDF uploaded for one enrollment + semester (max one per pair). It is an **uploaded document, not generated** — the SIS does not render report cards from computed grades; an admin/teacher uploads the school's own PDF. No number, no lifecycle beyond exists/deleted.
_Avoid_: conflating Report Card with Computed Grade — the report card is an opaque file; the computed grade is structured data. They are not derived from each other.

## Relationships

- A **Computed Grade** belongs to one student, one enrollment, one subject, one semester, and is derived only from that subject's **Present CAs** for that semester.
- An **Assessment** has zero or more **Questions**; a student has zero or more per-question answers per assessment. The CA total a student is graded against is the sum of the assessment's question marks, not the assessment's `totalMarks` field.
- A **Report Card** references an enrollment + semester and is independent of Computed Grades — deleting or recomputing grades does not touch it, and vice versa.
- **Cross-level comparison is not difficulty-adjusted.** A subject's score plotted across grade levels (e.g. Grade 2 Math → Grade 4 Math) is a raw-score history, not a like-for-like improvement signal, because difficulty changes between levels. Genuine improvement is measured against a same-difficulty baseline (peers in the same class, or CA-1→2→3 within one term).

## Flagged ambiguities

- **"Trend"** had meant two different things in code (semester-over-semester within one enrollment, and first-vs-last across the whole history) under one label. **Resolved (2026-06-26):** the cross-level first-vs-last "Improving/Declining" verdict is removed — it compared different-difficulty levels and judged the student on an apples-to-oranges basis. The cross-year line may survive only as **raw history**, explicitly labeled "different years, different difficulty" and carrying *no* improvement judgment. The word "improvement"/"trend" is reserved for **same-difficulty** comparisons only: progression across the three CAs within one term, and movement relative to the class average on the same papers.
- **`assessment.totalMarks`** — historically used as the grading denominator; per ADR-0004 it is display-only and the question-mark sum is authoritative. Old code dividing by `totalMarks` is the deprecated path.
- **`conceptTag` / `learningObjective`** — captured on Questions but not yet readable or writable through any UI. Reserved for planned concept-level analytics, not dead fields.

