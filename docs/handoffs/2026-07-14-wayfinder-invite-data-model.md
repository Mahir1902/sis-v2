# Handoff — Wayfinder map: admin-created users w/ invite links → next frontier is the invite data model

**Date:** 2026-07-14
**Branch:** `feature/crons`
**Mode:** Wayfinder ("Work through the map") — a **planning** effort producing decisions, not code yet.

## Where to start next session

Run `/wayfinder` against the map (#47). No ticket named ⇒ it takes the first frontier ticket = **[Invite data model & lifecycle (#50)](https://github.com/Mahir1902/sis-v2/issues/50)**. Then per the wayfinder "Work through the map" steps:

1. **Claim #50** (self-assign to `Mahir1902`) *before any work* — it is currently open + unassigned.
2. **Resolve it — this is a `wayfinder:grilling` ticket = HITL.** You MUST grill the user one question at a time via `/grilling` + `/domain-modeling`. **Do not answer for the user** — a grilling agent that resolves its own questions has broken the rule. Read #50's body for the exact question before starting.
3. Record: resolution comment on #50 → close #50 → append a one-line pointer to the map's *Decisions so far*.
4. **Graduate the fog:** resolving #50 makes the three UX-surface fog patches specifiable — create them as child tickets of #47 (create-then-wire blocking), and clear each graduated patch from the map's *Not yet specified*. See "After #50" below.

**Rule:** never resolve more than one ticket per session.

## The canonical artifact is the map — read it, don't trust this doc's snapshot

- **Map:** https://github.com/Mahir1902/sis-v2/issues/47 (`wayfinder:map`) — Destination, Notes, Decisions-so-far, fog (*Not yet specified*), *Out of scope*.
- Tracker convention + active-map state also in agent memory: `project_wayfinder_tracker.md`.

## Map state right now

| Ticket | Type | State |
|---|---|---|
| [Decide signup policy & block hijack (#48)](https://github.com/Mahir1902/sis-v2/issues/48) | grilling | ✅ resolved (strictly invite-only) |
| [Research: Convex Auth token-gated password setup (#49)](https://github.com/Mahir1902/sis-v2/issues/49) | research (AFK) | ✅ resolved last session |
| [Invite data model & lifecycle (#50)](https://github.com/Mahir1902/sis-v2/issues/50) | grilling | 🟢 **frontier — the takeable ticket** (both blockers #48, #49 closed) |

Blocking + parent/child are native GitHub relationships (sub-issues + `blocked_by`), so the frontier renders in GitHub's own UI.

## What #50 must decide (don't restate — read the ticket; this is the shape)

The invite token's **storage + lifecycle**: token record shape, email-binding, statuses (pending / used / revoked / expired?), expiry policy, single-use enforcement, and regenerate/revoke semantics. This is the **keystone** — the three UX surfaces are fog until it lands.

## Hard constraints on #50 from #49's research (these bound the grilling — don't re-open them)

Full answer: [#49 resolution comment](https://github.com/Mahir1902/sis-v2/issues/49#issuecomment-4958636552). The chosen mechanism is the stock `@convex-dev/auth@0.0.91` **`Password` provider with a custom `profile(params, ctx)` server-side gate**. That mechanism dictates the data model must provide:

- A **lookup-by-token** callable inside a Convex mutation `ctx` (i.e. usable from `profile()` / `createOrUpdateUser`), backed by a **`by_token` index**, returning at minimum: bound **email**, **status**, **expiry**, **role**.
- Tokens are **cryptographically random / unguessable** (sole authZ for account creation).
- **Single-use** = flip status → `used` in the *same transaction* as the account+user insert (the hooks run inside `auth:store`, so writes are atomic).
- Account email is **locked to the token's bound email**, not the client-supplied one — so the token record owns the email.

Full research note (primary-source cited, exact file/line refs): **local file** `docs/wayfinder/user-invites/tickets/assets/0049-convex-auth-token-gated-password.RESEARCH.md`.

## ⚠️ Gotcha: `docs/wayfinder/` is gitignored

`.gitignore:68` ignores `docs/wayfinder/`. So the map's asset tree (incl. the #49 research note) is **local-only** — reachable by filesystem path by any agent on this machine, but **not via any GitHub blob URL** (don't link/fetch a blob URL for it — it 404s). The map issue + resolution comments on GitHub are the durable record; the resolution comments are self-contained by design.

## What #48 & #49 already decided (don't re-litigate)

- **#48** — strictly invite-only; accounts born only by redeeming a valid, **email-bound, single-use** token, enforced **server-side**; dormant auto-create-`student` branch in `convex/auth.ts` gets removed; normal `signIn` unchanged; admin-set-password fallback + student logins **out of scope**. ([resolution](https://github.com/Mahir1902/sis-v2/issues/48#issuecomment-4958476312))
- **#49** — the enforcing hook is `Password` provider's `profile(params, ctx)` (+ `createOrUpdateUser` as second guard/role stamp); email locked from token; no OTP/`verify` round-trip needed.

## After #50 — the fog it graduates (create as child tickets once #50 lands)

Currently in the map's *Not yet specified*; each becomes specifiable once the lifecycle is decided:

- **Admin create-user form + link reveal** — fields, validation, how the generated link is presented (copy button / `wa.me` share affordance).
- **Invite acceptance page** (`/invite/[token]`) — layout + token states (valid / expired / used / invalid), locked-email display, name + password + confirm, success redirect. → likely a `prototype` ticket.
- **Pending-invite management** — where pending invites surface, status display, resend / regenerate / revoke actions. Depends on the lifecycle/status set #50 chooses.
- **Assembled implementation spec** — gather resolved decisions into one hand-off doc for the `planning-agent` / `TASK_LOG.md` flow. Specifiable once all decisions are made (the map's destination).

## Suggested skills

- **`wayfinder`** — invoke first; drives the whole "work through the map" flow.
- **`grilling`** + **`domain-modeling`** — #50 is a HITL grilling ticket; these drive the one-question-at-a-time interview to model the invite table + lifecycle.
- **`convex`** — grounding the data model in Convex schema/index idioms (`by_token` index, table shape, transactional status flip).
- Earlier prior handoff (now superseded, kept for history): `docs/handoffs/2026-07-13-wayfinder-user-invites.md`.
