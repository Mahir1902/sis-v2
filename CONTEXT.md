# Domain Glossary — SIS v2 (Fee Billing & Collection)

This context covers how the school bills parents and tracks fee payments. Student records, academic data, and report cards are governed elsewhere.

## Language

**Invoice**:
A bill issued to a parent before payment, listing one or more outstanding fees. Has its own lifecycle (`draft` → `issued` → `paid` or `overdue` → `voided`) and its own number (`INV-YYYY-NNN`). Persisted in the `invoices` table with line items snapshotted at creation so the document is immune to future fee structure changes.
_Avoid_: Bill, Statement, "sent" (we use **issued** — see below).

**Issued** (Invoice status):
The Invoice has been finalised and the school has billed the parent. This is a **finance bookkeeping** state — it asserts intent to bill, not proof of delivery. An Invoice is `issued` the moment an admin clicks the action, regardless of whether any real-world message reached the parent. Tracked on the same axis as `draft`, `paid`, `overdue`, `voided`.
_Avoid_: "Sent" (overloaded with delivery semantics and used by v1 SIS to mean something else).

**Delivery Status** (separate axis from Invoice status):
Tracks whether a real-world message carrying the Invoice (email, in-person, phone, etc.) actually reached a parent. Values: `delivered`, `failed`. **Self-reported by the admin** at Mark-as-Issued time — not provider-derived (the SIS does not send messages itself; see Compose Email below). Lives on a separate field from Invoice status because billing lifecycle must not be coupled to delivery outcome — an Invoice can be `issued` with delivery `failed` and remain a valid bill (e.g. finance followed up by phone the next day).

**Delivery Channel** (recorded alongside Delivery Status):
The real-world channel the admin used to deliver the Invoice to the parent. Values: `email`, `in_person`, `phone`, `whatsapp`, `other`. Self-reported. Set together with Delivery Status at Mark-as-Issued time.

**Compose Email** (UI action, not a domain event):
A pure UI affordance that opens a pre-filled Gmail compose tab targeting the billing contact's email. **Writes nothing to the server.** The Invoice's lifecycle is unaffected by Compose Email — the admin must still explicitly run **Mark as Issued** for the Invoice to transition out of `draft`. Compose Email exists because the SIS cannot prove what happened inside the admin's email client; treating "opened the composer" as "billed the parent" would produce false positives.

**Mark as Issued** (explicit finance action):
The deliberate admin attestation that an Invoice has been billed to the parent. Transitions the Invoice from `draft` to `issued`. Records `issuedAt`, `issuedBy`, and optionally **Delivery Channel** and **Delivery Status**. Channel-agnostic — works equally for email, in-person handover, phone call, or any other real-world delivery. This — not Compose Email — is the canonical billing event.

**Receipt**:
Informal label for a fully-paid Invoice. We do **not** have a separate Receipt entity — once an Invoice transitions to `paid`, the same document re-renders with a paid status and serves as the parent's receipt.

**Fee Notice**:
A PDF generated on demand from a student's Fees tab. Lists all outstanding fees with due dates ("10th of billing month" for monthly fees, "Upon Enrollment" for one-time or yearly fees). Not stored, has no number, has no lifecycle. Used for informal communication; not a billing document.

**Fee Collection Session**:
A `feeCollectionSessions` row created whenever `collectFees` records a payment. Bundles one or more `feeTransactions` under a single `sessionRef`. Surfaced in the Transaction Log only — not a parent-facing billing document.

**Student Fee**:
A `studentFees` row representing one fee owed by one student in one academic year. Has a status of `unpaid` or `paid` (the `partial` value is deprecated and being removed). Eligible for invoicing only when `unpaid` AND not already on a non-voided Invoice.

**Billing Contact**:
The single adult — chosen from the student's father, mother, or guardian — designated as the party financially responsible for the student's fees. Every Student has exactly one Billing Contact. Stored on the student record as `primaryBillingContact: "father" | "mother" | "guardian"`. This is the **role**, separate from the person's identity: knowing the mother's contact details (e.g. `motherEmail`) is distinct from designating her as the Billing Contact. The Compose Email action targets the Billing Contact's email. Mother and Guardian remain queryable for ad-hoc communication, but the Invoice flow uses the Billing Contact and only the Billing Contact.
_Avoid_: "Payer", "Bill recipient", "Primary parent" — these have collided in past conversations.

## Relationships

- An **Invoice** has exactly one **Student** and covers one or more **Student Fees** as snapshotted line items.
- A **Student Fee** can be on at most one non-voided **Invoice** at a time.
- A **Fee Collection Session** covers one or more **Student Fees** as payment lines and may correspond to one or more **Invoices** (or none, if the payment was recorded without an invoice).
- A **paid Invoice** is implicitly the **Receipt** — no separate document is issued.
- A **Fee Notice** is independent of all the above and produces no DB writes.

## Example dialogue

> **Dev:** "When admin assigns a tuition fee to a student, do we create an Invoice automatically?"
> **Domain expert:** "No — assigning a fee just adds a Student Fee row. The Invoice is created later, manually, when finance decides to bill the parent."
>
> **Dev:** "What document does the parent get after they pay?"
> **Domain expert:** "The same Invoice they were billed with. It transitions to `paid` and re-renders with the paid status — that's their receipt."
>
> **Dev:** "Then what is `feeCollectionSessions` for?"
> **Domain expert:** "It's the transaction log primitive. Every payment creates one. It existed before Invoices did. Don't surface it to parents."

## Flagged ambiguities

- **"Invoice" used to mean a post-payment receipt (v1 SIS legacy).** Resolved: an Invoice is now strictly the pre-payment bill with its own lifecycle. Old v1 receipts mapped 1-to-1 to `feeCollectionSessions`; that mapping no longer holds and the term "Invoice" must not be used for `feeCollectionSessions`.
- **"Bill", "Statement", "Demand Note"** — informal aliases that have appeared in user conversation. All resolve to **Invoice**.
- **`partial` status on Student Fees** — being deprecated. Treat as `unpaid` for any new logic.
