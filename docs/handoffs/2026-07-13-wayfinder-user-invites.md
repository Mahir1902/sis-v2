# Handoff — Wayfinder map: admin-created users with self-service invite links

**Date:** 2026-07-13
**Branch:** `feature/crons`
**Mode:** Wayfinder ("Work through the map") — this is a **planning** effort producing decisions, not code yet.

## What this effort is

Charting the way to an implementation-ready decision-set for: an **admin creates a staff user → the person gets a copy-paste invite link → they open it and set their own password**. Staff-only (admin + teacher), any admin can invite, no email provider (link delivered out-of-band like the existing `wa.me` receipts).

The canonical artifact is the **map**, a GitHub issue — do not restate its contents here, read it:

- **Map:** https://github.com/Mahir1902/sis-v2/issues/47 (`wayfinder:map`) — Destination, Notes, Decisions-so-far, fog (*Not yet specified*), *Out of scope*.

Tracker convention + active-map state are also in agent memory: `project_wayfinder_tracker.md`.

## State of the map right now

| Ticket | Type | State |
|---|---|---|
| [#48 Decide signup policy & block pre-provisioned-email hijack](https://github.com/Mahir1902/sis-v2/issues/48) | grilling | ✅ **resolved this session** |
| [#49 Research: Convex Auth token-gated password setup](https://github.com/Mahir1902/sis-v2/issues/49) | research (AFK) | 🟢 **frontier — the one takeable ticket** |
| [#50 Invite data model & lifecycle](https://github.com/Mahir1902/sis-v2/issues/50) | grilling | 🔒 blocked by #49 (keystone) |

Blocking + parent/child are wired with **native GitHub relationships** (sub-issues + `blocked_by` dependencies), so the frontier renders in GitHub's own UI.

The three UX surfaces (create form, `/invite/[token]` accept page, pending-invite management) are deliberately **fog** in the map — they graduate to tickets once #50 (the data model) lands. Don't ticket them early.

## What #48 decided (don't re-litigate)

Full resolution: https://github.com/Mahir1902/sis-v2/issues/48#issuecomment-4958476312 — summary: **strictly invite-only.** Accounts only created by redeeming a valid, **email-bound, single-use** invite token, enforced **server-side** in the auth callback (Convex Auth's `signUp` flow is a public endpoint the UI can't gate). The dormant auto-create-`student` branch in `convex/auth.ts` gets removed. Normal `flow:"signIn"` login unchanged. Admin-set-password fallback and student logins are **out of scope**.

## Key codebase facts discovered (save the fresh agent the rediscovery)

- `convex/auth.ts` `createOrUpdateUser` already preserves the role of a **pre-provisioned** `users` row on first sign-in, and otherwise inserts a `role:"student"` row. That student-insert branch is the thing #48 says to delete; it's currently **dead from the UI** (no signup page).
- `app/(auth)/login/page.tsx` only calls `signIn("password", { flow:"signIn" })`. **No signup UI exists anywhere.**
- `convex/users.ts` has `listUsers` / `updateUserRole` / `deactivateUser` / `reactivateUser` — **no `createUser`** and no invite/token machinery yet. Audit logging via `logAudit`.
- `convex/students.ts` `createStudent` inserts into the **`students`** table (pupil records) — unrelated to `users` login accounts. `users.studentId` (optional FK) is the seam that would bind a future student *login* to a pupil record.
- `convex/seedAdmin.ts` seeds the bootstrap admin directly (Scrypt) — outside the invite rule, fine.
- Route protection: `proxy.ts` (Next 16 uses `proxy.ts`, not `middleware.ts`).

## Next session — do this

Run `/wayfinder` against the map (#47). With no ticket named it takes the first frontier ticket = **#49**. Then, per the wayfinder "Work through the map" steps:

1. **Claim** #49 (self-assign) before any work.
2. Resolve it: it's **AFK research** — no grilling needed. Investigate the `@convex-dev/auth` Password provider for how to set a password for a specific pre-provisioned email **gated by our own token**, and *which server hook* enforces #48's invariant (rules 1–3). See the ticket body for the exact questions. Produce a markdown summary and **link it as an asset** on the issue.
3. Record: resolution comment → close #49 → append a one-line pointer to the map's Decisions-so-far.
4. Resolving #49 unblocks **#50** (data model, a grilling ticket) — that becomes the next frontier but is a *separate* session (one ticket per session).

**Rule:** never resolve more than one ticket per session.

## Suggested skills

- **`wayfinder`** — invoke first; it drives the whole "work through the map" flow.
- **`research`** — #49 is a research ticket; use this to structure the investigation + write the summary asset.
- **`convex-setup-auth`** and **`convex`** — the subject matter (Convex Auth Password provider internals, custom providers, callbacks).
- For the *later* #50 session (not next): **`grilling`** + **`convex`** (domain-modeling the invites table/lifecycle).
