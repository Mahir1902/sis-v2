---
status: accepted
date: 2026-06-03
---

# Invoice delivery uses a launcher architecture, not backend sending

## Context and decision

The SIS needs to deliver fee invoices to parents. We chose to implement this as a **launcher** rather than as a true backend sender: clicking *Compose Email* on an invoice opens a Gmail compose tab pre-filled with the [Billing Contact](../../CONTEXT.md)'s email, subject, and body, and the admin manually attaches the downloaded PDF and hits Send. The SIS does not hold any messaging-provider credentials, does not call any email / SMS / WhatsApp API, and does not claim to know whether the message was delivered.

The invoice lifecycle is advanced by a separate explicit **Mark as Issued** action, which records the admin's attestation of delivery (`issuedAt`, `issuedBy`) plus a self-reported `deliveryChannel` and `deliveryStatus`. Compose Email writes nothing to the server; only Mark as Issued does.

## Considered options

- **Backend sending via Resend / Postmark / SES (email).** Modest cost (~$0–$15/year at school scale) but requires DNS configuration (SPF/DKIM/DMARC), provider account, webhook handlers, a retry queue, and a parent-email schema migration. Email engagement among Bangladeshi school parents is empirically low and spam-prone — investing in this infrastructure before knowing parents will engage is premature.
- **Backend sending via WhatsApp Business API (Meta BSP).** Strongest parent-side engagement in the BD market, but Meta Business verification takes 1–3 weeks, requires template pre-approval per message variant, a BSP subscription (~$25–50/month + per-message fees), and 24-hour session window compliance. Significant upfront commitment for a feature whose value hasn't yet been validated.
- **SMS gateway.** Reliable delivery, low engagement, no PDF attachment possible (links only), and link-based SMS look like scams to parents.
- **In-app parent portal.** Requires a whole new auth surface, role, and mobile UX. Useless without a notification channel layered on top anyway.
- **Manual workflow (status quo from issue #28).** Admin downloads PDF and forwards from their own client with no SIS assistance. Functional but high friction; loses the per-invoice convenience and the audit attestation.

## Consequences

- **Zero infrastructure cost** for delivery. No provider accounts, no DNS work, no compliance overhead, no monthly bills.
- **The SIS cannot prove delivery.** `deliveryStatus` is self-reported by the admin at Mark-as-Issued time, not provider-derived. Accepted: finance operations already run on admin attestation; the launcher model makes this honesty explicit rather than papering over it.
- **No genuine bulk send.** Browser popup-blocking limits make opening N Gmail tabs in one click unworkable. Issue #30's "Bulk Send" is repurposed as **Bulk Mark as Issued** with a channel selector — matching the real bulk workflow ("I just handed out 27 paper invoices, mark them all issued").
- **`From:` is whoever the admin is signed into Gmail as.** No canonical school sender identity (e.g. `finance@school.edu.bd`) — accepted as a trade-off until the school adopts Google Workspace or explicitly asks for backend send.
- **PDF attachment is manual.** Neither `mailto:` nor Gmail compose URLs can pre-attach files. The admin drags the downloaded PDF into the composer; a SIS-side toast on Compose Email click cues this workflow.
- **Channel-agnostic by design.** Mark as Issued accepts `deliveryChannel: "email" | "in_person" | "phone" | "whatsapp" | "other"`, naturally supporting paper invoices, phone billing, in-person handover, and any future channel without code changes.
- **Reversible.** Upgrading to backend sending later replaces the client-side `composeEmail` helper with a Convex `action`; the schema, the Mark-as-Issued flow, the audit log structure, the Billing Contact model, and the three body templates all remain. The two-button UX collapses into one if and when the SIS can prove delivery itself.
