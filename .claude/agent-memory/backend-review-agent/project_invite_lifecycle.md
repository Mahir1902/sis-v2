---
name: invite-lifecycle-conventions
description: Approved patterns for the invite-only account-creation feature (#55/#56/#57) — audit verb mapping, ConvexError code contract, token entropy
metadata:
  type: project
---

The invite-only account-creation feature spans several files with conventions a reviewer must hold consistent across future changes.

**Files:** `convex/invites.ts` (admin lifecycle: create/list/regenerate/revoke), `convex/auth.ts` (`redeemInvite` — the acceptance gate, minted the `users` row), `lib/inviteStatus.ts` (pure `deriveInviteState` + `INVITE_TTL_MS`/`INVITE_AMBER_MS`). `invites` table indexes: `by_token`, `by_email`.

**Why these conventions exist / How to apply when reviewing invite code:**

- **Audit action verbs are a CLOSED union** (`convex/auditLogs.ts`: create|update|delete|status_change|collect_payment|collect_fees|apply_discount|upload|promote|role_change|void). Invite audits MUST map onto existing verbs — create=issue, update=regenerate, status_change=revoke — with `entityType: "invite"`. Reject any PR that invents a new action verb for invites; require it map onto the union instead. `entityType` is a free-form string, so `"invite"` is fine.

- **Business-logic rejections MUST be `ConvexError` carrying a stable `code`, never plain `Error`.** Reason: plain `Error` messages are REDACTED in Convex production; `ConvexError.data` survives the network boundary so the UI can branch on `code`. Established codes: ACCOUNT_EXISTS (+userId, for reactivate UI), PENDING_INVITE_EXISTS, INVALID_NAME, INVALID_EMAIL, INVITE_NOT_FOUND, INVITE_NOT_REGENERATABLE, INVITE_NOT_REVOCABLE. Tests lock the contract via `rejects.toMatchObject({ data: { code: ... } })`. Treat a plain-Error business rejection in invite code as a hard blocker.

- **Token unguessability standard:** `generateToken` uses `crypto.getRandomValues(new Uint8Array(32))` hex-encoded = 256 bits from a CSPRNG. Reject `Math.random`-based tokens for anything auth-bearing.

- **Guard semantics:** Guard 1 checks `users` row EXISTENCE (active OR deactivated — do NOT gate on `isActive`); an existing account must block a new invite and route to reactivate. Guard 2 blocks a live `pending` invite (expired is derived, still stored as `pending`) — dedupes rather than piling rows.

- **`expired` is derived, never stored.** No cron/sweep. A stored `pending` past `expiresAt` is "expired" only via `deriveInviteState`. Both the acceptance gate and the list query MUST derive from the same `lib/inviteStatus.ts` function so UI and gate can't drift — flag any hand-rolled expiry check.

- **listInvites** uses `.take(200)` then a JS `.filter(status !== "accepted")`. Bounded by staff headcount; a `ponytail:` comment tracks pagination as the documented follow-up. Acceptable now; if invite volume ever grows, require real pagination.
