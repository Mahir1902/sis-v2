# Handoff — Wayfinder map: invite data model landed → next frontier is the 3 UX surfaces

**Date:** 2026-07-14
**Mode:** Wayfinder ("Work through the map") — a **planning** effort producing decisions, not code yet.

## What just happened

Resolved **[Invite data model & lifecycle (#50)](https://github.com/Mahir1902/sis-v2/issues/50)** (grilling, HITL) and closed it. Full decision-set in its [resolution comment](https://github.com/Mahir1902/sis-v2/issues/50#issuecomment-4964599926) — read that, not this snapshot. Headlines: a dedicated **role-agnostic `invites` table**; **`users` row created at acceptance**, not invite time; statuses `pending|accepted|revoked` with **expired *derived*** (no cron); **7-day** expiry; single-use via **atomic `→accepted` flip**; revoke = soft terminal, regenerate = **rotate token in place**; **any existing `users` row (active or deactivated) blocks a new invite** (reactivate, don't re-invite).

Resolving #50 **graduated the fog** into three child tickets of the map.

## Map state now

| Ticket | Type | State |
|---|---|---|
| [Signup policy (#48)](https://github.com/Mahir1902/sis-v2/issues/48) | grilling | ✅ resolved |
| [Convex Auth research (#49)](https://github.com/Mahir1902/sis-v2/issues/49) | research | ✅ resolved |
| [Invite data model & lifecycle (#50)](https://github.com/Mahir1902/sis-v2/issues/50) | grilling | ✅ resolved this session |
| [Admin create-user form + link reveal (#51)](https://github.com/Mahir1902/sis-v2/issues/51) | prototype | 🟢 frontier — unclaimed |
| [Invite acceptance page /invite/[token] (#52)](https://github.com/Mahir1902/sis-v2/issues/52) | prototype | 🟢 frontier — unclaimed |
| [Pending-invite management (#53)](https://github.com/Mahir1902/sis-v2/issues/53) | prototype | 🟢 frontier — unclaimed |

All three are **unblocked and independent** — they can be worked in any order, or in parallel sessions. Each is a **`prototype` (HITL)** ticket: build a cheap rough artifact to react to (consult `/prototype`, `frontend-design`, `shadcn`), don't just decide in the abstract.

## Next session — do this

Run `/wayfinder` against the map (#47). No ticket named ⇒ it takes the first frontier ticket in order = **#51**. Or name one of #51/#52/#53. Then per "Work through the map": **claim it (self-assign) before any work** → resolve via `/prototype` → resolution comment + close + one-line pointer on the map's *Decisions so far*.

**Rule:** never resolve more than one ticket per session (but the user may run #51/#52/#53 in parallel sessions).

## After the three UX tickets

The only remaining fog is the **assembled implementation spec** — the destination artifact. It graduates to a `task` ticket (blocked by #51/#52/#53) once all three land, gathering #48/#49/#50 + the UX decisions into one hand-off doc for the `planning-agent` → `TASK_LOG.md` → `coding-agent` flow. That completes the map.

## Constraints carried into the UX tickets (don't re-litigate)

- Acceptance page submits `signIn("password", { flow:"signUp", inviteToken, password })`; **email/role/name come from the token server-side**, not the form ([#49](https://github.com/Mahir1902/sis-v2/issues/49) §3). Password min length 8 (Convex Auth default). No OTP.
- `/invite/[token]` must be reachable **unauthenticated** — `proxy.ts` allowlist (Next 16 uses `proxy.ts`).
- Link delivery is **out-of-band** (copy button + `wa.me` share), no email provider.
- Token states the accept page must render: valid / expired (derived) / accepted / revoked / invalid.

## ⚠️ Gotcha (unchanged)

`docs/wayfinder/` is **gitignored** (`.gitignore:68`) — the #49 research asset is local-only, not fetchable via a GitHub blob URL. The map issue + resolution comments on GitHub are the durable, self-contained record.

## Suggested skills

- **`wayfinder`** — invoke first; drives "work through the map".
- **`prototype`** + **`frontend-design`** + **`shadcn`** — #51/#52/#53 are prototype tickets.
- **`convex`** / **`convex-setup-auth`** — grounding the accept-page submit + gate in the real auth flow.
- Prior handoff (superseded): `docs/handoffs/2026-07-14-wayfinder-invite-data-model.md`.
